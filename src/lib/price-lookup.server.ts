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
