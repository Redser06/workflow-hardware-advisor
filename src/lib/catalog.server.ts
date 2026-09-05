import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export type CatalogItem = Database["public"]["Tables"]["catalog_items"]["Row"];

export type CatalogFilter = {
  min_ram_gb?: number;
  min_storage_gb?: number;
  min_vram_gb?: number;
  min_cpu_multicore_score?: number;
  min_cpu_singlecore_score?: number;
  max_price_usd?: number;
  max_weight_kg?: number;
  min_battery_hours?: number;
  form_factors?: string[];
  always_on_only?: boolean;
  needs_upgradeable_ram?: boolean;
  limit?: number;
};

/**
 * Deterministic hard filter over the curated catalog.
 * The model supplies requirement figures; code decides what actually qualifies.
 */
export async function searchCatalog(filter: CatalogFilter) {
  let query = supabaseAdmin.from("catalog_items").select("*");

  if (filter.min_ram_gb != null) query = query.gte("ram_gb", filter.min_ram_gb);
  if (filter.min_storage_gb != null) query = query.gte("storage_gb", filter.min_storage_gb);
  if (filter.min_vram_gb != null) query = query.gte("gpu_vram_gb", filter.min_vram_gb);
  if (filter.min_cpu_multicore_score != null)
    query = query.gte("cpu_multicore_score", filter.min_cpu_multicore_score);
  if (filter.min_cpu_singlecore_score != null)
    query = query.gte("cpu_singlecore_score", filter.min_cpu_singlecore_score);
  if (filter.max_price_usd != null) query = query.lte("baseline_price_usd", filter.max_price_usd);
  if (filter.max_weight_kg != null) query = query.lte("weight_kg", filter.max_weight_kg);
  if (filter.min_battery_hours != null)
    query = query.gte("battery_hours", filter.min_battery_hours);
  if (filter.form_factors?.length) query = query.in("form_factor", filter.form_factors);
  if (filter.always_on_only) query = query.eq("always_on_suitable", true);
  if (filter.needs_upgradeable_ram) query = query.eq("ram_upgradeable", true);

  const { data, error } = await query
    .order("baseline_price_usd", { ascending: true })
    .limit(filter.limit ?? 12);

  if (error) {
    console.error("[catalog] search failed", error.message);
    return { matches: [], count: 0, error: error.message };
  }

  return {
    count: data.length,
    matches: data.map(summarise),
  };
}

export async function getCatalogItemsBySlug(slugs: string[]) {
  const { data, error } = await supabaseAdmin
    .from("catalog_items")
    .select("*")
    .in("slug", slugs);
  if (error) {
    console.error("[catalog] slug lookup failed", error.message);
    return [];
  }
  return data;
}

export function summarise(item: CatalogItem) {
  return {
    slug: item.slug,
    name: item.name,
    brand: item.brand,
    form_factor: item.form_factor,
    segment: item.segment,
    cpu: item.cpu_name,
    cpu_generation: item.cpu_generation,
    cpu_cores: item.cpu_cores,
    cpu_multicore_score: item.cpu_multicore_score,
    cpu_singlecore_score: item.cpu_singlecore_score,
    gpu: item.gpu_name,
    vram_gb: item.gpu_vram_gb,
    ram_gb: item.ram_gb,
    ram_upgradeable: item.ram_upgradeable,
    ram_max_gb: item.ram_max_gb,
    unified_memory: item.unified_memory,
    storage_gb: item.storage_gb,
    storage_upgradeable: item.storage_upgradeable,
    weight_kg: item.weight_kg,
    battery_hours: item.battery_hours,
    idle_watts: item.idle_watts,
    always_on_suitable: item.always_on_suitable,
    os: item.os,
    display: item.display_desc,
    baseline_price_usd: item.baseline_price_usd,
    thermals: item.sustained_thermal_note,
    notes: item.notes,
  };
}
