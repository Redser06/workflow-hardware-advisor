# Hardware Fit

A buying analyst for computer hardware. You describe the work you actually do —
the programs, the file sizes, whether models run locally or in the cloud,
whether the machine travels or stays on all night, how long it has to last, and
what you can spend. It interviews you briefly, writes a requirement profile with
a reason attached to every figure, hard-filters a curated catalogue against those
figures in code, and returns three machines: minimum viable, balanced, longest
life — each with the trade-off it makes.

No marketing language, no invented machines, no invented prices.

## How it is put together

- **TanStack Start** (React 19, Vite) — routes in `src/routes`.
- **Lovable Cloud** (Postgres + Auth) — schema in `drizzle/migrations`.
- **Lovable AI Gateway** — the interviewer model, called server-side only.

### Trust rules the code enforces

- Machines come only from `search_catalog`, which filters the catalogue
  deterministically in `src/lib/catalog.server.ts`. The model ranks and explains
  what survives; it cannot add to it.
- Prices come only from the server. `record_recommendation` overwrites whatever
  price the model typed with the figure returned by `check_price` in the same
  request, and refuses to save a pick that was never priced.
- Every price carries provenance: `verified` (confirmed retail listing),
  `estimated` (rough figure from public listings), or `unverified` (catalogue
  baseline nobody has confirmed). The interface says which, and never shows a
  "checked at" time for a check that did not happen.
- All user-scoped reads and writes run through an RLS-scoped client built from
  the caller's own token, so Postgres enforces ownership. The service-role key is
  used only by the background price job.
- Tokens are verified in exactly one place: `src/lib/verify-bearer.server.ts`.

## Running it locally

```sh
npm install
npm run dev        # http://localhost:8080
npm run typecheck
npm run lint
```

## Environment

Provided automatically by Lovable Cloud; needed if you run this elsewhere.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | database + auth |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | server | RLS-scoped server queries |
| `SUPABASE_SERVICE_ROLE_KEY` | server | background price job only |
| `LOVABLE_API_KEY` | server | AI gateway |
| `LOVABLE_CRON_SECRET` | server | authenticates the price job |

## The price job

`POST /api/public/cron/refresh-prices`, authenticated with
`Authorization: Bearer $LOVABLE_CRON_SECRET`. Run it daily. It probes public
listings for the 40 least recently checked machines and writes any confident
result back as an `estimated` price with the timestamp of the probe. Failures
change nothing — the previous figure and its previous date stay. Rows marked
`verified` by a human are never overwritten.

Price lookups never happen inside a user request.

## Known gaps

- Catalogue prices are seeded figures, not human-verified listings. Until each
  row has a real source URL and a confirmed price, they are surfaced as
  `unverified` or `estimated`, never as verified.
- Rate limiting is a per-user daily message cap only.
