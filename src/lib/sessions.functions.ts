import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";


import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { Pick, Requirement } from "@/lib/analysis-types";

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .insert({ user_id: context.userId, title: "New analysis" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("sessions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: session, error } = await context.supabase
      .from("sessions")
      .select("id, title, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) return null;

    const [{ data: messageRows }, { data: profileRows }, { data: recRows }] = await Promise.all([
      context.supabase
        .from("messages")
        .select("ui_message, created_at")
        .eq("session_id", data.id)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("workload_profiles")
        .select("id, summary, requirements, created_at")
        .eq("session_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1),
      context.supabase
        .from("recommendations")
        .select("id, picks, created_at")
        .eq("session_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const profileRow = profileRows?.[0] ?? null;
    const recRow = recRows?.[0] ?? null;

    return {
      session,
      // Kept as plain JSON across the RPC boundary; the client casts to UIMessage[].
      messages: (messageRows ?? []).map((row) => row.ui_message as Json),
      profile: profileRow
        ? {
            summary: profileRow.summary,
            requirements: profileRow.requirements as unknown as Requirement[],
            created_at: profileRow.created_at,
          }
        : null,
      recommendation: recRow
        ? {
            picks: recRow.picks as unknown as Pick[],
            created_at: recRow.created_at,
          }
        : null,
    };
  });
