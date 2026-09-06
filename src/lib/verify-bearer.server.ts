import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * The single place a user bearer token is verified.
 *
 * Every server entry point that accepts an Authorization header must go through
 * this function, so there is exactly one definition of "valid token" and one
 * definition of the client that subsequent queries run on. The returned client
 * carries the caller's token, so Postgres row-level security — not application
 * `if` statements — decides what the request may read or write.
 */
export type VerifiedCaller = {
  userId: string;
  supabase: SupabaseClient<Database>;
};

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function readEnv() {
  const url = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

/** Anonymous, RLS-scoped client. Public-read data only (the catalog). */
export function createPublicClient(): SupabaseClient<Database> | null {
  const env = readEnv();
  if (!env) return null;
  return createClient<Database>(env.url, env.publishableKey, {
    global: { fetch: createSupabaseFetch(env.publishableKey) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Returns the caller identity plus an RLS-scoped client, or null when the token
 * is absent, malformed, or rejected by Supabase Auth.
 */
export async function verifyBearer(token: string | null): Promise<VerifiedCaller | null> {
  if (!token) return null;
  // A Supabase user access token is always a three-part JWT. Opaque API keys
  // and truncated tokens are rejected here rather than at the Auth call.
  if (token.split(".").length !== 3) return null;

  const env = readEnv();
  if (!env) throw new Error("Supabase environment is not configured");

  const supabase = createClient<Database>(env.url, env.publishableKey, {
    global: {
      fetch: createSupabaseFetch(env.publishableKey),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  return { userId, supabase };
}
