# Hardware Fit — a plain-spoken buying assistant

An assistant that interviews you about the work you actually do, then names specific machines at specific prices and explains, in plain terms, why those parts matter for that work. No marketing language, no "up to 20x faster". Every recommendation is tied to a concrete thing you said you do.

## What a user experiences

1. **Sign in** — email and password. Everything you generate is saved to your account.
2. **The interview** — a chat where the assistant asks about your work: the programs you run, file sizes, how many things you keep open, whether you travel with it, whether it needs to stay on all day, how long it has to last, and your budget. It asks follow-ups when an answer is too vague to act on ("video editing" gets a follow-up about resolution and footage type; "AI agent" gets one about model size and whether it must run overnight).
3. **A workload profile** — a short written summary the assistant produces: what your machine actually has to do, with a required and comfortable figure for memory, storage, processor class and graphics memory. Each figure has a one-line reason attached to something you said.
4. **Recommendations** — three picks: the cheapest thing that genuinely works, the balanced pick, and the one that lasts longest. Each shows current price, where it is sold, what it does well for you, and what it gives up. Prices are looked up live at the moment the recommendation is made, and stamped with the time they were checked.
5. **Plain-English spec explainer** — the confusing parts (chip generations, memory speed and whether it can be upgraded, why 16GB in one machine isn't 16GB in another) are explained inline, only where they affect your decision.
6. **Saved builds** — every profile and its recommendations are kept in your account, revisitable and re-priceable later.

## Scope of hardware covered

Everything from a student laptop up to a desktop running local AI models around the clock: laptops, small-form-factor and tower desktops, and always-on AI workstations where graphics memory, sustained thermals and idle power draw are the deciding factors — not just raw benchmark numbers.

## Where the numbers come from

A curated catalog of machines and components that we maintain, holding the specs, the class of each part and its generation, and a baseline price. Live web lookup at recommendation time supplies the current price and availability. If a live price can't be found, the machine still shows with its baseline price clearly marked as not freshly checked, rather than silently showing a stale number.

The catalog needs real content to be useful. The first version ships with a seeded set covering each segment (budget/mainstream/pro laptops, mainstream desktops, AI workstations) so the assistant has genuine options to reason over from day one.

## Deliberately not in this version

Buying, carts, checkout, affiliate links, or any transaction. The data is structured so that adding purchasing later is an addition, not a rewrite. Also out: peripherals, phones, tablets, and self-built parts lists.

## Technical outline

- **Stack**: TanStack Start, Lovable Cloud for accounts, database and saved builds, Lovable AI for the interview and reasoning.
- **Data**: tables for `profiles`, `catalog_items` (specs, generation, class scores, baseline price), `sessions` (a chat thread), `messages`, `workload_profiles` (the structured requirement output), `recommendations` (chosen items + rationale + price snapshot). Row-level security scopes every user-owned table to `auth.uid()`, with grants issued alongside each table. The catalog is publicly readable.
- **Threads**: each interview is its own page URL (`/session/$sessionId`), with a session list, so past analyses reload correctly.
- **Chat**: streaming server route with AI Elements for the transcript and composer. The model is given two tools — one that queries our catalog with hard spec filters, one that runs a live price/availability web lookup — plus a tool that writes the finished workload profile as structured data. Tool activity is visible but collapsed.
- **Recommendation logic** stays deterministic where it can: the model produces requirement figures, code filters the catalog against them, and the model only ranks and explains what survives the filter. That stops it inventing machines or specs.
- **Anti-fluff**: a system prompt that forbids marketing adjectives and requires every claim to reference a stated workload; recommendations render as structured fields, not free prose.
- **Design**: a technical, high-density, instrument-panel aesthetic — monospace figures, tight tables, restrained colour used only for required/comfortable/overkill signalling. Design directions will be generated for you to pick from before the UI is built.

## Build order

1. Accounts, database schema and seeded catalog.
2. Interview chat with session routing and saved history.
3. Workload profile extraction and the catalog-filtering tool.
4. Live price lookup and the recommendation view.
5. Spec explainer content and design polish.
