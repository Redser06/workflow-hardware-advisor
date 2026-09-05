import type { Requirement } from "@/lib/analysis-types";

export function WorkloadProfilePanel({
  summary,
  requirements,
}: {
  summary: string;
  requirements: Requirement[];
}) {
  return (
    <section className="border border-rule bg-surface">
      <header className="flex items-baseline justify-between border-b border-rule px-4 py-3">
        <h2 className="label-caps text-foreground">Workload profile</h2>
        <span className="label-caps">{requirements.length} requirements</span>
      </header>

      <p className="border-b border-rule px-4 py-4 text-sm leading-relaxed text-foreground">
        {summary}
      </p>

      <div className="hidden grid-cols-[1fr_7rem_7rem] gap-4 px-4 pt-3 sm:grid">
        <span className="label-caps">Spec</span>
        <span className="label-caps text-right">Required</span>
        <span className="label-caps text-right">Comfortable</span>
      </div>

      <ul>
        {requirements.map((req) => (
          <li
            key={req.label}
            className="border-t border-rule/60 px-4 py-3 first:border-t-0 sm:border-t"
          >
            <div className="grid gap-1 sm:grid-cols-[1fr_7rem_7rem] sm:items-baseline sm:gap-4">
              <span className="text-sm font-medium text-foreground">{req.label}</span>
              <span className="figure text-sm text-signal sm:text-right">
                <span className="label-caps mr-2 sm:hidden">Required</span>
                {req.required}
              </span>
              <span className="figure text-sm text-muted-foreground sm:text-right">
                <span className="label-caps mr-2 sm:hidden">Comfortable</span>
                {req.comfortable}
              </span>
            </div>
            <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
              {req.reason}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
