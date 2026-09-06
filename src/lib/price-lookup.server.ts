import { createPublicClient } from "@/lib/verify-bearer.server";

export type PriceConfidence = "verified" | "estimated" | "unverified";

export type PriceResult = {
  slug: string;
  name: string;
  price_usd: number;
  currency: "USD";
  /** how much the figure can be trusted; never "verified" for scraped numbers */
  confidence: PriceConfidence;
  source: string | null;
  /** when the figure was actually established — never "now" unless a check just happened */
  checked_at: string;
  note: string;
};

const CONFIDENCE_NOTE: Record<PriceConfidence, string> = {
  verified: "price confirmed against a named retail listing",
  estimated:
    "estimate from public search listings; treat as a ballpark and confirm with the retailer",
  unverified: "catalog baseline figure, not independently confirmed",
};

/**
 * Read the stored price for a catalog machine.
 *
 * No network call happens on the request path. A background job refreshes these
 * figures (see /api/public/cron/refresh-prices); the chat only reads what that
 * job wrote, together with the timestamp of the event it describes.
 */
export async function readStoredPrice(args: {
  slug: string;
}): Promise<PriceResult | { error: string }> {
  const supabase = createPublicClient();
  if (!supabase) return { error: "backend not configured" };

  const { data, error } = await supabase
    .from("catalog_items")
    .select(
      "slug, name, baseline_price_usd, baseline_price_checked_at, price_confidence, price_source_url",
    )
    .eq("slug", args.slug)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: `no catalog machine with slug ${args.slug}` };

  const confidence = (data.price_confidence ?? "unverified") as PriceConfidence;

  return {
    slug: data.slug,
    name: data.name,
    price_usd: data.baseline_price_usd,
    currency: "USD",
    confidence: CONFIDENCE_NOTE[confidence] ? confidence : "unverified",
    source: data.price_source_url,
    checked_at: data.baseline_price_checked_at,
    note: CONFIDENCE_NOTE[confidence] ?? CONFIDENCE_NOTE.unverified,
  };
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export type ProbeOutcome =
  | { ok: true; price_usd: number; sample_size: number; checked_at: string }
  | { ok: false; reason: string };

/**
 * Background-only price probe. Reads a public search results page and takes the
 * median of plausible USD figures. This is a coarse estimate, never a verified
 * price: search text also contains adjacent models, refurbished units and ads,
 * so the result is only ever stored with confidence "estimated".
 *
 * Never call this from a user request — it is slow and the endpoint rate-limits
 * shared egress addresses.
 */
export async function probeEstimatedPrice(args: {
  name: string;
  brand: string;
  baselinePriceUsd: number;
}): Promise<ProbeOutcome> {
  const query = `${args.brand} ${args.name} price buy`;
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "user-agent": UA, accept: "text/html" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return { ok: false, reason: `search returned ${res.status}` };

    const text = (await res.text()).replace(/<[^>]+>/g, " ");
    const found: number[] = [];
    for (const match of text.matchAll(/\$\s?([0-9][0-9,]{2,6})(?:\.(\d{2}))?/g)) {
      const value = Number(match[1]!.replace(/,/g, ""));
      if (!Number.isFinite(value)) continue;
      // A tight band around the known baseline. It keeps out other products in
      // the same results page far better than an absolute range would, and a
      // figure outside it is more likely a different model than a real move.
      if (value < args.baselinePriceUsd * 0.75 || value > args.baselinePriceUsd * 1.3) continue;
      found.push(value);
    }

    // Require a real cluster, not two coincidences.
    if (found.length < 4) return { ok: false, reason: "not enough consistent listings" };

    return {
      ok: true,
      price_usd: median(found),
      sample_size: found.length,
      checked_at: new Date().toISOString(),
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "lookup failed" };
  }
}
