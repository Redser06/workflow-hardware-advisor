/**
 * Perplexity research calls. Background jobs only — never the request path.
 *
 * Perplexity answers are grounded in live web results and return citations, so
 * every figure this module produces carries the listing URL it came from. A
 * figure without a source URL is discarded rather than stored: an unsourced
 * price is exactly the kind of fact this app must not assert.
 */

const ENDPOINT = "https://api.perplexity.ai/chat/completions";

export type PerplexityFailure = {
  ok: false;
  reason: string;
  /** true when the whole job must stop: no credits, bad key, or rate limited */
  fatal: boolean;
};

type Ok<T> = { ok: true; value: T };

export type PerplexityOutcome<T> = Ok<T> | PerplexityFailure;

async function ask<T>(args: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  recency?: string;
}): Promise<PerplexityOutcome<T>> {
  const key = process.env["PERPLEXITY_API_KEY"];
  if (!key) return { ok: false, reason: "PERPLEXITY_API_KEY is not configured", fatal: true };

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
        ...(args.recency ? { search_recency_filter: args.recency } : {}),
        response_format: {
          type: "json_schema",
          json_schema: { name: args.schemaName, schema: args.schema },
        },
      }),
    });
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "request failed",
      fatal: false,
    };
  }

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401 && body.includes("insufficient_quota")) {
      return {
        ok: false,
        reason:
          "Perplexity API credits are exhausted. Buy credits at https://console.perplexity.ai for the account this key belongs to — API credits are separate from a Perplexity Pro subscription.",
        fatal: true,
      };
    }
    return {
      ok: false,
      reason: `Perplexity request failed [${response.status}]: ${body.slice(0, 300)}`,
      fatal: response.status === 401 || response.status === 403 || response.status === 429,
    };
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return { ok: false, reason: "empty response", fatal: false };

  try {
    return { ok: true, value: JSON.parse(content) as T };
  } catch {
    return { ok: false, reason: "response was not valid JSON", fatal: false };
  }
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\/\S+$/.test(value);
}

export type PricedMachine = {
  price_usd: number;
  source_url: string;
  retailer: string | null;
  note: string | null;
};

/** Find the current selling price of one known machine, with the listing it came from. */
export async function researchPrice(args: {
  brand: string;
  name: string;
  baselinePriceUsd: number;
}): Promise<PerplexityOutcome<PricedMachine>> {
  const result = await ask<{
    price_usd: number | null;
    source_url: string | null;
    retailer: string | null;
    note: string | null;
  }>({
    schemaName: "machine_price",
    system:
      "You report retail prices for computer hardware. Use only current listings from major retailers or the manufacturer's own store, in USD, for a new unit in its base configuration. Never guess. If you cannot find a live listing for this exact model, return null for price_usd and source_url.",
    user: `Current USD price of a new ${args.brand} ${args.name}. Return the price and the exact URL of the listing you took it from.`,
    schema: {
      type: "object",
      properties: {
        price_usd: { type: ["number", "null"] },
        source_url: { type: ["string", "null"] },
        retailer: { type: ["string", "null"] },
        note: { type: ["string", "null"] },
      },
      required: ["price_usd", "source_url", "retailer", "note"],
    },
  });

  if (!result.ok) return result;

  const { price_usd, source_url, retailer, note } = result.value;
  if (typeof price_usd !== "number" || !Number.isFinite(price_usd) || price_usd <= 0) {
    return { ok: false, reason: "no live listing found", fatal: false };
  }
  if (!isHttpUrl(source_url)) {
    return { ok: false, reason: "price returned without a source listing", fatal: false };
  }
  // A figure far off the known baseline is more likely a different model, a
  // refurbished unit or an accessory than a real price move.
  if (price_usd < args.baselinePriceUsd * 0.5 || price_usd > args.baselinePriceUsd * 1.8) {
    return { ok: false, reason: `implausible price ${price_usd} for this model`, fatal: false };
  }

  return {
    ok: true,
    value: { price_usd: Math.round(price_usd), source_url, retailer, note },
  };
}

export type DiscoveredMachine = {
  name: string;
  brand: string;
  form_factor: string;
  cpu_name: string;
  cpu_generation: string | null;
  cpu_cores: number | null;
  gpu_name: string | null;
  gpu_vram_gb: number | null;
  ram_gb: number;
  ram_upgradeable: boolean;
  ram_max_gb: number | null;
  unified_memory: boolean;
  storage_gb: number;
  storage_upgradeable: boolean;
  weight_kg: number | null;
  battery_hours: number | null;
  idle_watts: number | null;
  always_on_suitable: boolean;
  os: string | null;
  display_desc: string | null;
  price_usd: number;
  source_url: string;
  notes: string | null;
};

/**
 * Find machines that fill a stated gap in the catalog. Every returned machine
 * must be currently purchasable and carry the listing URL its price came from;
 * anything else is dropped by the caller.
 */
export async function discoverMachines(args: {
  gapDescription: string;
  excludeNames: string[];
  limit: number;
}): Promise<PerplexityOutcome<DiscoveredMachine[]>> {
  const result = await ask<{ machines: Partial<DiscoveredMachine>[] }>({
    schemaName: "discovered_machines",
    system:
      "You research computers that are on sale right now. Report only machines a buyer can order today from a major retailer or the manufacturer, with real published specifications. Prices are USD for the configuration you describe. Never invent a model, a specification or a price. Return fewer machines rather than uncertain ones.",
    user: `Find up to ${args.limit} distinct computers that fit this need: ${args.gapDescription}.
Do not include any of these, which are already covered: ${args.excludeNames.join("; ") || "none"}.
For each machine give its specifications and the URL of the listing the price came from.`,
    schema: {
      type: "object",
      properties: {
        machines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              brand: { type: "string" },
              form_factor: {
                type: "string",
                enum: ["laptop", "mini_desktop", "tower_desktop"],
              },
              cpu_name: { type: "string" },
              cpu_generation: { type: ["string", "null"] },
              cpu_cores: { type: ["number", "null"] },
              gpu_name: { type: ["string", "null"] },
              gpu_vram_gb: { type: ["number", "null"] },
              ram_gb: { type: "number" },
              ram_upgradeable: { type: "boolean" },
              ram_max_gb: { type: ["number", "null"] },
              unified_memory: { type: "boolean" },
              storage_gb: { type: "number" },
              storage_upgradeable: { type: "boolean" },
              weight_kg: { type: ["number", "null"] },
              battery_hours: { type: ["number", "null"] },
              idle_watts: { type: ["number", "null"] },
              always_on_suitable: { type: "boolean" },
              os: { type: ["string", "null"] },
              display_desc: { type: ["string", "null"] },
              price_usd: { type: "number" },
              source_url: { type: "string" },
              notes: { type: ["string", "null"] },
            },
            required: [
              "name",
              "brand",
              "form_factor",
              "cpu_name",
              "ram_gb",
              "storage_gb",
              "price_usd",
              "source_url",
              "always_on_suitable",
              "ram_upgradeable",
              "unified_memory",
              "storage_upgradeable",
            ],
          },
        },
      },
      required: ["machines"],
    },
  });

  if (!result.ok) return result;

  const machines = (result.value.machines ?? []).filter(
    (machine): machine is DiscoveredMachine =>
      typeof machine.name === "string" &&
      machine.name.length > 1 &&
      typeof machine.brand === "string" &&
      typeof machine.cpu_name === "string" &&
      typeof machine.ram_gb === "number" &&
      typeof machine.storage_gb === "number" &&
      typeof machine.price_usd === "number" &&
      machine.price_usd > 0 &&
      isHttpUrl(machine.source_url),
  );

  return { ok: true, value: machines.slice(0, args.limit) };
}
