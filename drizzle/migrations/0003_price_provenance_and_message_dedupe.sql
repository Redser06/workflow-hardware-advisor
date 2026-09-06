-- Message dedupe: allow the chat route to persist a client-generated message id
-- once per session, so a resend after a failed stream cannot fork the transcript.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS client_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS messages_session_client_msg_idx
  ON public.messages (session_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

-- Price provenance: stop stamping "checked now" by default, and record how much
-- a baseline figure can be trusted.
ALTER TABLE public.catalog_items
  ALTER COLUMN baseline_price_checked_at DROP DEFAULT;

ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS price_confidence TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS price_source_url TEXT;

-- Backfill: every existing row was seeded from unverified figures at author time,
-- not checked at the moment the migration ran.
UPDATE public.catalog_items
   SET price_confidence = 'unverified',
       baseline_price_checked_at = TIMESTAMPTZ '2026-09-05 00:00:00+00'
 WHERE price_confidence = 'unverified';
