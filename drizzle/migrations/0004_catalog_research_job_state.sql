-- Single-flight / pause state for the background catalog research job.
CREATE TABLE public.job_state (
  job_name text PRIMARY KEY,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused')),
  lease_expires_at timestamptz,
  paused_reason text,
  last_run_at timestamptz,
  last_result jsonb
);

GRANT ALL ON public.job_state TO service_role;

ALTER TABLE public.job_state ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (the cron handler) touches this table.

INSERT INTO public.job_state (job_name) VALUES ('catalog_research');

-- Where a catalog row came from, so a machine added by research is never
-- mistaken for a hand-curated one.
ALTER TABLE public.catalog_items ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'seed';
