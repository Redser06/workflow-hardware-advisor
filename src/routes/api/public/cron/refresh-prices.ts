import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { acquireJob, finishJob, pauseJob, type Admin } from "@/lib/job-state.server";
import { CATALOG_DISCOVERY_LIMIT, CATALOG_GAPS, PRICE_REFRESH_BATCH } from "@/lib/limits";
import { discoverMachines, researchPrice, type DiscoveredMachine } from "@/lib/perplexity.server";

const JOB_NAME = "catalog_research";

/**
 * Daily catalog research.
 *
 * Two passes, both off the request path: re-price the machines whose figures
 * are oldest, then look for machines that fill a stated gap. Every figure
 * written here carries the listing URL it came from; a machine researched this
 * way is stored as an estimate, never as verified — only a human pricing a row
 * against a listing they opened themselves earns that label.
 */
export const Route = createFileRoute("/api/public/cron/refresh-prices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as Admin;

        const gate = await acquireJob(admin, JOB_NAME);
        if (!gate.run) {
          return Response.json({ ok: false, skipped: true, reason: gate.reason });
        }

        // While paused (no credits, blocked key), one item per run probes
        // whether the block has cleared. A denied probe keeps the pause.
        const priceBudget = gate.mode === "probe" ? 1 : PRICE_REFRESH_BATCH;

        const { data: items, error } = await admin
          .from("catalog_items")
          .select("slug, name, brand, baseline_price_usd, price_confidence")
          .neq("price_confidence", "verified")
          .order("baseline_price_checked_at", { ascending: true })
          .limit(priceBudget);

        if (error) {
          await finishJob(admin, JOB_NAME, { error: error.message });
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let repriced = 0;
        let unchanged = 0;
        const skipped: string[] = [];

        for (const item of items ?? []) {
          const outcome = await researchPrice({
            brand: item.brand,
            name: item.name,
            baselinePriceUsd: item.baseline_price_usd,
          });

          if (!outcome.ok) {
            if (outcome.fatal) {
              await pauseJob(admin, JOB_NAME, outcome.reason);
              return Response.json({ ok: false, paused: true, reason: outcome.reason, repriced });
            }
            skipped.push(`${item.slug}: ${outcome.reason}`);
            unchanged += 1;
            continue;
          }

          // The timestamp records the check that just happened, nothing else.
          const { error: updateError } = await admin
            .from("catalog_items")
            .update({
              baseline_price_usd: outcome.value.price_usd,
              baseline_price_checked_at: new Date().toISOString(),
              price_confidence: "estimated",
              price_source_url: outcome.value.source_url,
              buy_url: outcome.value.source_url,
            })
            .eq("slug", item.slug);

          if (updateError) unchanged += 1;
          else repriced += 1;
        }

        let added = 0;
        let discoveryNote: string | null = null;

        if (gate.mode === "normal") {
          const result = await runDiscovery(admin);
          if (result.paused) {
            await pauseJob(admin, JOB_NAME, result.reason);
            return Response.json({ ok: false, paused: true, reason: result.reason, repriced });
          }
          added = result.added;
          discoveryNote = result.note;
        }

        const summary = { repriced, unchanged, added, discoveryNote, skipped };
        await finishJob(admin, JOB_NAME, summary);
        return Response.json({ ok: true, ...summary });
      },
    },
  },
});

/** One gap per run, rotating by day, so a run never fans out across all of them. */
async function runDiscovery(
  admin: Admin,
): Promise<{ paused: true; reason: string } | { paused: false; added: number; note: string }> {
  const dayIndex = Math.floor(Date.now() / 86_400_000) % CATALOG_GAPS.length;
  const gap = CATALOG_GAPS[dayIndex]!;

  const { data: existing } = await admin.from("catalog_items").select("slug, name").limit(200);
  const known = existing ?? [];

  const found = await discoverMachines({
    gapDescription: gap,
    excludeNames: known.map((row) => row.name),
    limit: CATALOG_DISCOVERY_LIMIT,
  });

  if (!found.ok) {
    if (found.fatal) return { paused: true, reason: found.reason };
    return { paused: false, added: 0, note: `discovery found nothing: ${found.reason}` };
  }

  const takenSlugs = new Set(known.map((row) => row.slug));
  let added = 0;

  for (const machine of found.value) {
    const slug = slugify(`${machine.brand} ${machine.name}`);
    if (!slug || takenSlugs.has(slug)) continue;
    takenSlugs.add(slug);

    const { error } = await admin.from("catalog_items").insert(toRow(machine, slug, gap));
    if (!error) added += 1;
  }

  return { paused: false, added, note: gap };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function segmentFor(priceUsd: number) {
  if (priceUsd < 900) return "budget";
  if (priceUsd < 1800) return "mainstream";
  if (priceUsd < 3200) return "pro";
  return "workstation";
}

function toRow(machine: DiscoveredMachine, slug: string, gap: string) {
  return {
    slug,
    name: machine.name,
    brand: machine.brand,
    form_factor: machine.form_factor,
    segment: segmentFor(machine.price_usd),
    cpu_name: machine.cpu_name,
    cpu_generation: machine.cpu_generation,
    cpu_cores: machine.cpu_cores,
    gpu_name: machine.gpu_name,
    gpu_vram_gb: machine.gpu_vram_gb,
    ram_gb: machine.ram_gb,
    ram_upgradeable: machine.ram_upgradeable,
    ram_max_gb: machine.ram_max_gb,
    unified_memory: machine.unified_memory,
    storage_gb: machine.storage_gb,
    storage_upgradeable: machine.storage_upgradeable,
    weight_kg: machine.weight_kg,
    battery_hours: machine.battery_hours,
    idle_watts: machine.idle_watts,
    always_on_suitable: machine.always_on_suitable,
    os: machine.os,
    display_desc: machine.display_desc,
    baseline_price_usd: Math.round(machine.price_usd),
    baseline_price_checked_at: new Date().toISOString(),
    price_confidence: "estimated",
    price_source_url: machine.source_url,
    buy_url: machine.source_url,
    provenance: "research",
    notes: machine.notes ?? `Added by catalog research for: ${gap}`,
  };
}
