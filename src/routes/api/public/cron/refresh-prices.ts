import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { PRICE_REFRESH_BATCH } from "@/lib/limits";
import { probeEstimatedPrice } from "@/lib/price-lookup.server";

/**
 * Daily price refresh.
 *
 * Price lookups are slow and rate-limited, so they happen here — off the
 * request path — and write to the database. The chat only reads what this job
 * stored. A machine whose probe fails keeps its previous figure and its
 * previous timestamp; nothing is ever stamped "checked now" without a check.
 */
export const Route = createFileRoute("/api/public/cron/refresh-prices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: items, error } = await supabaseAdmin
          .from("catalog_items")
          .select("slug, name, brand, baseline_price_usd, price_confidence")
          .order("baseline_price_checked_at", { ascending: true })
          .limit(PRICE_REFRESH_BATCH);

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let refreshed = 0;
        let skipped = 0;

        for (const item of items ?? []) {
          const outcome = await probeEstimatedPrice({
            name: item.name,
            brand: item.brand,
            baselinePriceUsd: item.baseline_price_usd,
          });

          if (!outcome.ok) {
            skipped += 1;
            continue;
          }

          // A verified figure entered by a human is never overwritten by an estimate.
          if (item.price_confidence === "verified") {
            skipped += 1;
            continue;
          }

          const { error: updateError } = await supabaseAdmin
            .from("catalog_items")
            .update({
              baseline_price_usd: outcome.price_usd,
              baseline_price_checked_at: outcome.checked_at,
              price_confidence: "estimated",
            })
            .eq("slug", item.slug);

          if (updateError) skipped += 1;
          else refreshed += 1;
        }

        return Response.json({ ok: true, refreshed, skipped });
      },
    },
  },
});
