import { createFileRoute, Link } from "@tanstack/react-router";

import { BrandMark } from "@/components/brand-mark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hardware Fit — work out what hardware your work needs" },
      {
        name: "description",
        content:
          "Answer questions about the work you actually do. Get a required-versus-comfortable spec profile and three specific machines at current prices.",
      },
      { property: "og:title", content: "Hardware Fit — work out what hardware your work needs" },
      {
        property: "og:description",
        content:
          "A workflow analysis first, then three specific machines at current prices. No marketing language.",
      },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    n: "01",
    title: "Describe the work",
    body: "The programs, the file sizes, how much runs at once, whether you carry it, whether it stays on overnight. Follow-up questions until the answers are specific enough to act on.",
  },
  {
    n: "02",
    title: "Get a requirement profile",
    body: "Memory, processor class, graphics memory and storage, each with a required figure, a comfortable figure, and one line explaining which part of your work set it.",
  },
  {
    n: "03",
    title: "See three machines",
    body: "The cheapest that genuinely works, the balanced pick, and the one that lasts longest. Current prices, timestamped, with what each one gives up.",
  },
];

const CONFUSIONS = [
  ["Generation beats tier", "A current i5 usually outruns an older i7. The number after the name matters more than the letter in front of it."],
  ["Soldered memory is final", "Most thin laptops cannot be given more memory later. The figure you buy is the figure you keep."],
  ["Unified memory is shared", "On Apple machines the processor and graphics draw from the same pool, so 16 GB is not 16 GB plus graphics."],
  ["Graphics memory sets model size", "For running AI models locally, the video memory figure decides what fits. System memory does not rescue it."],
];

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2">
            <BrandMark />
            <span className="figure text-sm font-semibold tracking-tight text-foreground">
              HARDWARE FIT
            </span>
          </span>
          <Link
            to="/auth"
            className="figure border border-rule px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <span className="label-caps">Specification analysis</span>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
          Work out what your work needs.
          <br />
          Then buy exactly that.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          Most buying advice starts with a product. This starts with your workflow — what you run,
          how much of it, for how long — and ends with three specific machines and the prices they
          sell for right now. Nothing else.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/auth"
            className="bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start an analysis
          </Link>
          <span className="figure text-xs text-muted-foreground">
            Student laptops through always-on AI workstations
          </span>
        </div>
      </section>

      <section className="border-y border-rule bg-surface">
        <div className="mx-auto grid max-w-5xl gap-px sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="bg-background px-6 py-8">
              <span className="figure text-xs text-primary">{step.n}</span>
              <h2 className="mt-2 text-base font-semibold text-foreground">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="label-caps text-foreground">Things the spec sheet does not tell you</h2>
        <dl className="mt-6 grid gap-px border border-rule bg-rule sm:grid-cols-2">
          {CONFUSIONS.map(([term, body]) => (
            <div key={term} className="bg-background px-5 py-5">
              <dt className="text-sm font-semibold text-foreground">{term}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6">
          <span className="figure text-xs text-muted-foreground">
            Recommendations only. Nothing is sold here.
          </span>
          <Link to="/auth" className="figure text-xs text-primary hover:underline">
            Start an analysis
          </Link>
        </div>
      </footer>
    </main>
  );
}
