import {
  FORM_FACTOR_LABEL,
  TIER_LABEL,
  TIER_NOTE,
  formatCheckedAt,
  formatUsd,
  type Pick,
} from "@/lib/analysis-types";

const TIER_ORDER: Pick["tier"][] = ["minimum_viable", "balanced", "longest_life"];

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-rule/60 py-1.5">
      <span className="label-caps shrink-0">{label}</span>
      <span className="figure text-right text-xs text-foreground">{value}</span>
    </div>
  );
}

function PickCard({ pick }: { pick: Pick }) {
  const m = pick.machine;
  const memoryNote = m.unified_memory
    ? `${m.ram_gb} GB unified`
    : `${m.ram_gb} GB${m.ram_upgradeable ? ` · to ${m.ram_max_gb ?? "?"} GB` : " · soldered"}`;

  return (
    <article className="flex flex-col border border-rule bg-surface">
      <header className="border-b border-rule px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="label-caps text-signal">{TIER_LABEL[pick.tier]}</span>
          <span className="figure text-lg text-foreground">{formatUsd(pick.price_usd)}</span>
        </div>
        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
          {TIER_NOTE[pick.tier]}
        </p>
      </header>

      <div className="px-4 py-3">
        <h3 className="text-base font-semibold leading-tight text-foreground">{m.name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {m.brand} · {FORM_FACTOR_LABEL[m.form_factor] ?? m.form_factor}
          {m.os ? ` · ${m.os}` : ""}
        </p>

        <p
          className={
            pick.price_live
              ? "figure mt-2 text-[11px] text-muted-foreground"
              : "figure mt-2 text-[11px] text-under"
          }
        >
          {pick.price_live
            ? `price checked ${formatCheckedAt(pick.price_checked_at)}`
            : `not freshly checked — catalog baseline as of ${formatCheckedAt(pick.price_checked_at)}`}
        </p>
      </div>

      <div className="px-4 pb-3">
        <SpecRow label="Processor" value={m.cpu_name} />
        {m.cpu_generation ? <SpecRow label="Generation" value={m.cpu_generation} /> : null}
        <SpecRow label="Memory" value={memoryNote} />
        {m.gpu_name ? (
          <SpecRow
            label="Graphics"
            value={m.gpu_vram_gb ? `${m.gpu_name} · ${m.gpu_vram_gb} GB` : m.gpu_name}
          />
        ) : null}
        <SpecRow
          label="Storage"
          value={`${m.storage_gb} GB${m.storage_upgradeable ? " · replaceable" : " · fixed"}`}
        />
        {m.weight_kg ? <SpecRow label="Weight" value={`${m.weight_kg} kg`} /> : null}
        {m.battery_hours ? <SpecRow label="Battery" value={`${m.battery_hours} h`} /> : null}
        {m.idle_watts ? <SpecRow label="Idle draw" value={`${m.idle_watts} W`} /> : null}
      </div>

      <div className="mt-auto space-y-3 border-t border-rule px-4 py-3">
        <div>
          <span className="label-caps">Fits because</span>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{pick.fits_because}</p>
        </div>
        <div>
          <span className="label-caps">Gives up</span>
          <p className="mt-1 text-xs leading-relaxed text-under">{pick.gives_up}</p>
        </div>
      </div>
    </article>
  );
}

export function RecommendationPanel({ picks }: { picks: Pick[] }) {
  const ordered = [...picks].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );

  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="label-caps text-foreground">Recommendations</h2>
        <span className="label-caps">{ordered.length} picks</span>
      </header>
      <div className="grid gap-3 lg:grid-cols-3">
        {ordered.map((pick) => (
          <PickCard key={pick.tier + pick.catalog_slug} pick={pick} />
        ))}
      </div>
    </section>
  );
}
