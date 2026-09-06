import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Server-function auth, built on the single token verifier in
 * verify-bearer.server.ts. There is exactly one definition of "valid token"
 * and one definition of the RLS-scoped client that follows from it; routes and
 * server functions both go through it.
 *
 * The verifier is imported inside the handler so the server-only module never
 * enters a client bundle through a *.functions.ts import chain.
 */
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { bearerFromRequest, verifyBearer } = await import("@/lib/verify-bearer.server");

  const request = getRequest();
  if (!request?.headers) throw new Error("Unauthorized");

  const caller = await verifyBearer(bearerFromRequest(request));
  if (!caller) throw new Error("Unauthorized");

  return next({
    context: {
      supabase: caller.supabase,
      userId: caller.userId,
    },
  });
});
