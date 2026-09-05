import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { CHAT_MODEL, createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { searchCatalog, getCatalogItemsBySlug } from "@/lib/catalog.server";
import { lookupPrice } from "@/lib/price-lookup.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const SYSTEM_PROMPT = `You are Hardware Fit, a hardware buying analyst.

VOICE
- Plain, exact, unsentimental. You sound like a technician writing a spec sheet, not a shop.
- Banned: marketing adjectives and vague praise ("blazing", "powerful", "amazing", "seamless", "future-proof", "beast", "sleek", "premium experience"). Also banned: exclamation marks, emoji, hype framing, and "up to Nx faster" style claims.
- Every claim must attach to something the user actually told you, or to a measured spec. If you cannot tie it to their stated work, do not say it.
- Never invent machines, specs, or prices. Machines come only from search_catalog. Prices come only from check_price.

INTERVIEW
- Ask ONE focused question at a time. Keep each turn short.
- Push past vague answers. "Video editing" is not an answer: ask resolution, codec, typical timeline length, whether they use proxies. "Running an AI agent" is not an answer: ask model size in parameters, whether it must run unattended overnight, and whether latency or capacity matters more.
- Cover, over the course of the interview: the specific programs used; how many run at once; typical file sizes; whether it is carried daily; whether it must stay powered on continuously; how many years it must last; the operating system they need; and the budget ceiling.
- When a user gives a budget, treat it as a hard ceiling unless they say otherwise.
- Do not ask questions you already have answers to. Once you have enough to act, stop asking and move on.

PRODUCING THE ANALYSIS
1. Call record_workload_profile with the requirement figures and a one-line reason per figure. Each reason must quote or paraphrase something the user said.
2. Call search_catalog with the REQUIRED figures as hard filters (not the comfortable ones), plus budget and form factor.
3. If very few machines survive, relax one filter at a time and say in your reply which requirement you relaxed and why.
4. Call check_price for each machine you intend to recommend.
5. Call record_recommendation with exactly three picks: minimum_viable, balanced, longest_life. Each needs the honest trade-off it makes, not just its strengths.
6. In your written reply, do not repeat the tables the app already renders. Say only what the structured output cannot: which requirement was hardest to satisfy, and what you would check before buying.

EXPLAINING SPECS
When a spec drives the decision, explain it in one sentence in plain terms, at the point it matters. Examples of what people get wrong and you should correct when relevant: processor generation matters more than the tier name; soldered memory cannot be increased later; unified memory is shared between the processor and graphics; graphics memory, not system memory, sets the largest AI model that will run; sustained cooling matters more than peak speed for long jobs.`;

const catalogFilterSchema = z.object({
  min_ram_gb: z.number().optional(),
  min_storage_gb: z.number().optional(),
  min_vram_gb: z.number().optional(),
  min_cpu_multicore_score: z
    .number()
    .optional()
    .describe(
      "0-100 class score. ~30 office work, ~55 heavy multitasking, ~75 sustained rendering",
    ),
  min_cpu_singlecore_score: z.number().optional(),
  max_price_usd: z.number().optional(),
  max_weight_kg: z.number().optional(),
  min_battery_hours: z.number().optional(),
  form_factors: z.array(z.enum(["laptop", "mini_desktop", "tower_desktop"])).optional(),
  always_on_only: z.boolean().optional(),
  needs_upgradeable_ram: z.boolean().optional(),
});

const requirementSchema = z.object({
  label: z.string().describe("e.g. 'System memory', 'Graphics memory', 'Processor'"),
  required: z.string().describe("the figure that must be met, e.g. '32 GB'"),
  comfortable: z.string().describe("the figure that leaves headroom, e.g. '48 GB'"),
  reason: z.string().describe("one line tying the figure to something the user said"),
});

const pickSchema = z.object({
  tier: z.enum(["minimum_viable", "balanced", "longest_life"]),
  catalog_slug: z.string(),
  price_usd: z.number(),
  price_live: z.boolean(),
  price_checked_at: z.string(),
  fits_because: z.string().describe("what it does well for THIS workload, in one or two lines"),
  gives_up: z.string().describe("the honest trade-off this pick makes"),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !publishableKey) {
          return new Response("Backend not configured", { status: 500 });
        }

        const authClient = createClient<Database>(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
        const userId = claimsData?.claims?.sub;
        if (claimsError || !userId) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { messages?: UIMessage[]; sessionId?: string };
        const { messages, sessionId } = body;
        if (!Array.isArray(messages) || !sessionId) {
          return new Response("messages and sessionId are required", { status: 400 });
        }

        const { data: session } = await supabaseAdmin
          .from("sessions")
          .select("id, user_id, title")
          .eq("id", sessionId)
          .maybeSingle();
        if (!session || session.user_id !== userId) {
          return new Response("Not found", { status: 404 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing AI credentials", { status: 500 });

        // Persist the incoming user message before we stream.
        const incoming = messages[messages.length - 1];
        if (incoming?.role === "user") {
          const { error: insertError } = await supabaseAdmin.from("messages").insert({
            session_id: sessionId,
            user_id: userId,
            role: "user",
            ui_message: incoming as never,
          });
          if (insertError) console.error("[chat] failed to save user message", insertError.message);

          if (session.title === "New analysis") {
            const text = incoming.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .trim();
            if (text) {
              await supabaseAdmin
                .from("sessions")
                .update({ title: text.slice(0, 60), updated_at: new Date().toISOString() })
                .eq("id", sessionId);
            }
          }
        }

        let latestProfileId: string | null = null;

        const gateway = createLovableAiGatewayProvider(apiKey);

        const result = streamText({
          model: gateway(CHAT_MODEL),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(50),
          tools: {
            search_catalog: tool({
              description:
                "Hard-filter the curated machine catalog by required specs. Returns only machines that meet every filter. Use the REQUIRED figures, not the comfortable ones.",
              inputSchema: catalogFilterSchema,
              execute: async (filter) => searchCatalog(filter),
            }),
            check_price: tool({
              description:
                "Look up the current retail price for one catalog machine. Call once per machine you plan to recommend, immediately before recommending it.",
              inputSchema: z.object({ catalog_slug: z.string() }),
              execute: async ({ catalog_slug }) => {
                const [item] = await getCatalogItemsBySlug([catalog_slug]);
                if (!item) return { error: `no catalog machine with slug ${catalog_slug}` };
                return lookupPrice({
                  slug: item.slug,
                  name: item.name,
                  brand: item.brand,
                  baselinePriceUsd: item.baseline_price_usd,
                });
              },
            }),
            record_workload_profile: tool({
              description:
                "Write the finished workload analysis. Call this once you understand the work, before searching the catalog.",
              inputSchema: z.object({
                summary: z
                  .string()
                  .describe("2-4 sentences stating what this machine actually has to do"),
                requirements: z.array(requirementSchema),
              }),
              execute: async ({ summary, requirements }) => {
                const { data, error } = await supabaseAdmin
                  .from("workload_profiles")
                  .insert({
                    session_id: sessionId,
                    user_id: userId,
                    summary,
                    requirements: requirements as never,
                  })
                  .select("id")
                  .single();
                if (error) {
                  console.error("[chat] failed to save workload profile", error.message);
                  return { saved: false, error: error.message };
                }
                latestProfileId = data.id;
                return { saved: true, requirement_count: requirements.length };
              },
            }),
            record_recommendation: tool({
              description:
                "Write the three final picks. Every price must come from a check_price call made in this conversation.",
              inputSchema: z.object({ picks: z.array(pickSchema) }),
              execute: async ({ picks }) => {
                const items = await getCatalogItemsBySlug(picks.map((p) => p.catalog_slug));
                const enriched = picks
                  .map((pick) => {
                    const item = items.find((i) => i.slug === pick.catalog_slug);
                    if (!item) return null;
                    return { ...pick, machine: item };
                  })
                  .filter(Boolean);

                if (enriched.length === 0) {
                  return { saved: false, error: "none of those slugs exist in the catalog" };
                }

                const { error } = await supabaseAdmin.from("recommendations").insert({
                  session_id: sessionId,
                  user_id: userId,
                  workload_profile_id: latestProfileId,
                  picks: enriched as never,
                });
                if (error) {
                  console.error("[chat] failed to save recommendations", error.message);
                  return { saved: false, error: error.message };
                }
                return { saved: true, pick_count: enriched.length };
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            const { error } = await supabaseAdmin.from("messages").insert({
              session_id: sessionId,
              user_id: userId,
              role: "assistant",
              ui_message: responseMessage as never,
            });
            if (error) console.error("[chat] failed to save assistant message", error.message);
            await supabaseAdmin
              .from("sessions")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", sessionId);
          },
        });
      },
    },
  },
});
