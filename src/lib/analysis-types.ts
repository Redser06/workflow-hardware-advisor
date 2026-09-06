export type Requirement = {
  label: string;
  required: string;
  comfortable: string;
  reason: string;
};

export type PickTier = "minimum_viable" | "balanced" | "longest_life";

export type Machine = {
  slug: string;
  name: string;
  brand: string;
  form_factor: string;
  cpu_name: string;
  cpu_generation: string | null;
  cpu_cores: number | null;
  gpu_name: string | null;
  gpu_vram_gb: number | null;
  ram_gb: number;
  ram_type: string | null;
  ram_upgradeable: boolean;
  ram_max_gb: number | null;
  unified_memory: boolean;
  storage_gb: number;
  storage_type: string | null;
  storage_upgradeable: boolean;
  display_desc: string | null;
  weight_kg: number | null;
  battery_hours: number | null;
  idle_watts: number | null;
  always_on_suitable: boolean;
  os: string | null;
  sustained_thermal_note: string | null;
  notes: string | null;
  buy_url: string | null;
};

export type PriceConfidence = "verified" | "estimated" | "unverified";

export type Pick = {
  tier: PickTier;
  catalog_slug: string;
  price_usd: number;
  /** Set server-side from the price lookup; never from the model. */
  price_confidence?: PriceConfidence;
  price_source?: string | null;
  price_note?: string;
  price_checked_at: string;
  fits_because: string;
  gives_up: string;
  machine: Machine;
};

export const TIER_LABEL: Record<PickTier, string> = {
  minimum_viable: "Minimum viable",
  balanced: "Balanced",
  longest_life: "Longest life",
};

export const TIER_NOTE: Record<PickTier, string> = {
  minimum_viable: "cheapest option that still meets every requirement",
  balanced: "headroom without paying for capability you did not ask for",
  longest_life: "built to still be adequate in four or five years",
};

export const FORM_FACTOR_LABEL: Record<string, string> = {
  laptop: "Laptop",
  mini_desktop: "Mini desktop",
  tower_desktop: "Desktop tower",
};

export function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

/** Plain-language provenance line for a price. Never claims a check that did not happen. */
export function describePrice(pick: Pick): { text: string; trusted: boolean } {
  const confidence: PriceConfidence = pick.price_confidence ?? "unverified";
  const day = formatDay(pick.price_checked_at);
  if (confidence === "verified") {
    return { text: `price confirmed against a retail listing on ${day}`, trusted: true };
  }
  if (confidence === "estimated") {
    return {
      text: `estimate from public listings on ${day} — confirm with the retailer`,
      trusted: false,
    };
  }
  return { text: `catalog baseline from ${day} — not independently confirmed`, trusted: false };
}

export function formatDay(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "an unknown date";
  return date.toISOString().slice(0, 10);
}

export function formatCheckedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown time";
  return `${date.toISOString().slice(11, 16)} UTC ${date.toISOString().slice(0, 10)}`;
}
