import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";

import { CHAT_MODEL, createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { searchCatalog, getCatalogItemsBySlug } from "@/lib/catalog.server";
import { readStoredPrice, type PriceResult } from "@/lib/price-lookup.server";
import { DAILY_MESSAGE_LIMIT, MAX_STEPS } from "@/lib/limits";
import { bearerFromRequest, verifyBearer } from "@/lib/verify-bearer.server";

const SYSTEM_PROMPT = `You are Hardware Fit, a hardware buying analyst.

VOICE
- Plain, exact, unsentimental. You sound like a technician writing a spec sheet, not a shop.
- Banned: marketing adjectives and vague praise ("blazing", "powerful", "amazing", "seamless", "future-proof", "beast", "sleek", "premium experience"). Also banned: exclamation marks, emoji, hype framing, and "up to Nx faster" style claims.
- Every claim must attach to something the user actually told you, or to a measured spec. If you cannot tie it to their stated work, do not say it.
- Never invent machines, specs, or prices. Machines come only from search_catalog. Prices come only from check_price.

INTERVIEW
- Ask at most FOUR questions in the whole interview, and never more than two in one turn. Group related questions into one short turn rather than trickling them out.
- Never ask a question you have already asked, and never ask for anything the user has already told you or that you can infer from what they said. If they name a budget, a program, a weight limit, or a lifespan, that item is settled.
- Push past vague answers. "Video editing" is not an answer: ask resolution, codec, typical timeline length, whether they use proxies. "Running an AI agent" is not an answer: ask whether the models run locally or in the cloud, the local model size in parameters, whether it must run unattended overnight, and whether latency or capacity matters more. A user who runs cloud models full time needs network reliability, memory for clients and tabs, and uptime — not a large GPU; say so when it applies.
- Cover, over the course of the interview: the specific programs used; how many run at once; typical file sizes; whether AI workloads run locally (and at what model size) or in the cloud full time; whether it is carried daily; whether it must stay powered on continuously; how many years it must last; the operating system they need; and the budget ceiling.
- When a user gives a budget, treat it as a hard ceiling unless they say otherwise.
- Cover what you can by inference. Where a detail is missing but low-stakes, assume the ordinary case, state the assumption in one line, and continue. Do not stall the analysis on it.
- By your third reply at the latest, stop asking and produce the analysis. A slightly assumed profile that is delivered beats a perfect one that never arrives.

PRODUCING THE ANALYSIS
1. Call record_workload_profile with the requirement figures and a one-line reason per figure. Each reason must quote or paraphrase something the user said.
2. Call search_catalog with the REQUIRED figures as hard filters (not the comfortable ones), plus budget and form factor.
3. If very few machines survive, relax one filter at a time and say in your reply which requirement you relaxed and why.
4. Call check_price for each machine you intend to recommend.
5. Call record_recommendation with exactly three picks: minimum_viable, balanced, longest_life. They must be three DIFFERENT machines. If fewer than three qualify, widen the search once (raise the budget ceiling by up to 20%, or relax the least critical requirement) and say in your reply what you widened and why. Each pick needs the honest trade-off it makes, not just its strengths.
6. In your written reply, do not repeat the tables the app already renders. Say only what the structured output cannot: which requirement was hardest to satisfy, and what you would check before buying.

PRICES
- A price is only as good as its provenance. check_price returns a confidence: "verified" means a confirmed retail listing, "estimated" means a rough figure from public listings, "unverified" means a catalog baseline nobody has confirmed. Say so plainly when a pick rests on an estimated or unverified figure, and tell the user to confirm it with the retailer before buying.

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

// The model chooses WHICH machine and WHY. It never supplies price facts: those
// are taken from the check_price call recorded server-side in this request.
const pickSchema = z.object({
  tier: z.enum(["minimum_viable", "balanced", "longest_life"]),
  catalog_slug: z.string(),
  fits_because: z.string().describe("what it does well for THIS workload, in one or two lines"),
  gives_up: z.string().describe("the honest trade-off this pick makes"),
});

function textOf(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await verifyBearer(bearerFromRequest(request));
        if (!caller) return new Response("Unauthorized", { status: 401 });
        const { supabase, userId } = caller;

        const body = (await request.json()) as { messages?: UIMessage[]; sessionId?: string };
        const { messages, sessionId } = body;
        if (!Array.isArray(messages) || !sessionId) {
          return new Response("messages and sessionId are required", { status: 400 });
        }

        // RLS scopes this read to the caller's own sessions: a session belonging
        // to someone else simply does not exist for this request.
        const { data: session } = await supabase
          .from("sessions")
          .select("id, title")
          .eq("id", sessionId)
          .maybeSingle();
        if (!session) return new Response("Not found", { status: 404 });

        // Daily budget guard.
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("role", "user")
          .gte("created_at", since);
        if ((count ?? 0) >= DAILY_MESSAGE_LIMIT) {
          return new Response("Daily message limit reached. Try again tomorrow.", { status: 429 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing AI credentials", { status: 500 });

        const incoming = messages[messages.length - 1];
        const userMessage = incoming?.role === "user" ? incoming : null;

        if (userMessage && session.title === "New analysis") {
          const text = textOf(userMessage);
          if (text) {
            await supabase
              .from("sessions")
              .update({ title: text.slice(0, 60), updated_at: new Date().toISOString() })
              .eq("id", sessionId);
          }
        }

        let latestProfileId: string | null = null;
        // Prices actually looked up during this request, keyed by slug. The
        // recommendation writer reads from here and ignores anything the model
        // claims about price.
        const priceLedger = new Map<string, PriceResult>();

        const gateway = createLovableAiGatewayProvider(apiKey);

        const result = streamText({
          model: gateway(CHAT_MODEL),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(MAX_STEPS),
          tools: {
            search_catalog: tool({
              description:
                "Hard-filter the curated machine catalog by required specs. Returns only machines that meet every filter. Use the REQUIRED figures, not the comfortable ones.",
              inputSchema: catalogFilterSchema,
              execute: async (filter) => searchCatalog(filter),
            }),
            check_price: tool({
              description:
                "Look up the recorded price for one catalog machine, with its provenance. Call once per machine you plan to recommend, before recommending it.",
              inputSchema: z.object({ catalog_slug: z.string() }),
              execute: async ({ catalog_slug }) => {
                const price = await readStoredPrice({ slug: catalog_slug });
                if ("error" in price) return price;
                priceLedger.set(price.slug, price);
                return price;
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
                const { data, error } = await supabase
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
                "Write the three final picks. Every machine must already have been passed to check_price in this conversation; prices are taken from that call, not from you.",
              inputSchema: z.object({ picks: z.array(pickSchema) }),
              execute: async ({ picks }) => {
                const unchecked = picks
                  .map((p) => p.catalog_slug)
                  .filter((slug) => !priceLedger.has(slug));
                if (unchecked.length > 0) {
                  return {
                    saved: false,
                    error: `call check_price first for: ${unchecked.join(", ")}`,
                  };
                }

                const items = await getCatalogItemsBySlug(picks.map((p) => p.catalog_slug));
                const enriched = picks
                  .map((pick) => {
                    const item = items.find((i) => i.slug === pick.catalog_slug);
                    const price = priceLedger.get(pick.catalog_slug);
                    if (!item || !price) return null;
                    // Price facts come from the server-side lookup only.
                    return {
                      tier: pick.tier,
                      catalog_slug: pick.catalog_slug,
                      fits_because: pick.fits_because,
                      gives_up: pick.gives_up,
                      price_usd: price.price_usd,
                      price_confidence: price.confidence,
                      price_source: price.source,
                      price_checked_at: price.checked_at,
                      price_note: price.note,
                      machine: item,
                    };
                  })
                  .filter(Boolean);

                if (enriched.length === 0) {
                  return { saved: false, error: "none of those slugs exist in the catalog" };
                }

                const { error } = await supabase.from("recommendations").insert({
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
            // User and assistant turns are persisted together once the stream
            // completes, so an interrupted stream cannot leave the transcript
            // showing the user talking to themselves. A resend of the same
            // message is deduped on (session_id, client_message_id).
            const rows = [];
            if (userMessage) {
              rows.push({
                session_id: sessionId,
                user_id: userId,
                role: "user",
                client_message_id: userMessage.id,
                ui_message: userMessage as never,
              });
            }
            rows.push({
              session_id: sessionId,
              user_id: userId,
              role: "assistant",
              client_message_id: responseMessage.id,
              ui_message: responseMessage as never,
            });

            const { error } = await supabase
              .from("messages")
              .upsert(rows, { onConflict: "session_id,client_message_id", ignoreDuplicates: true });
            if (error) console.error("[chat] failed to save transcript", error.message);

            await supabase
              .from("sessions")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", sessionId);
          },
        });
      },
    },
  },
});
