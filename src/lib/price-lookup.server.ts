export type PriceResult = {
  slug: string;
  name: string;
  price_usd: number;
  currency: "USD";
  /** true when the figure came from a live lookup just now */
  live: boolean;
  source: string | null;
  checked_at: string;
  note: string;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Live retail price probe. Reads a public search results page and takes the
 * median of plausible USD figures near the product name. Anything that fails
 * falls back to the catalog baseline, clearly flagged as not freshly checked.
 */
export async function lookupPrice(args: {
  slug: string;
  name: string;
  brand: string;
  baselinePriceUsd: number;
}): Promise<PriceResult> {
  const checked_at = new Date().toISOString();
  const query = `${args.brand} ${args.name} price buy`;

  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: { "user-agent": UA, accept: "text/html" },
        signal: AbortSignal.timeout(9000),
      },
    );

    if (!res.ok) throw new Error(`search returned ${res.status}`);
    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, " ");

    const found: number[] = [];
    for (const match of text.matchAll(/\$\s?([0-9][0-9,]{2,6})(?:\.(\d{2}))?/g)) {
      const value = Number(match[1]!.replace(/,/g, ""));
      if (!Number.isFinite(value)) continue;
      // Ignore obvious noise: nothing sane sits outside this band, and a figure
      // wildly detached from the baseline is almost certainly a different product.
      if (value < 150 || value > 20000) continue;
      if (value < args.baselinePriceUsd * 0.4 || value > args.baselinePriceUsd * 2.2) continue;
      found.push(value);
    }

    if (found.length >= 2) {
      return {
        slug: args.slug,
        name: args.name,
        price_usd: median(found),
        currency: "USD",
        live: true,
        source: "public retail listings",
        checked_at,
        note: `median of ${found.length} listed prices found just now`,
      };
    }

    throw new Error("no usable prices in results");
  } catch (error) {
    console.warn(
      `[price] live lookup failed for ${args.slug}:`,
      error instanceof Error ? error.message : error,
    );
    return {
      slug: args.slug,
      name: args.name,
      price_usd: args.baselinePriceUsd,
      currency: "USD",
      live: false,
      source: null,
      checked_at,
      note: "catalog baseline price — not freshly checked",
    };
  }
}
