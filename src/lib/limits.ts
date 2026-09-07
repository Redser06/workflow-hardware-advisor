/**
 * Tunable budget and safety limits. One place, so tuning the budget does not
 * mean hunting through a route file.
 */

/** Per-user daily ceiling on chat turns. Protects the shared AI budget. */
export const DAILY_MESSAGE_LIMIT = 80;

/** Tool-call budget for one reply. Four tools, a handful of retries, no runaway loops. */
export const MAX_STEPS = 20;

/** How many catalog rows one price-refresh cron run will re-price. */
export const PRICE_REFRESH_BATCH = 12;

/** How many new machines one research run may add to the catalog. */
export const CATALOG_DISCOVERY_LIMIT = 4;

/** How long one background run may hold its single-flight lease. */
export const JOB_LEASE_MINUTES = 15;

/**
 * Gaps the discovery pass tries to fill, one per run, rotating by day so a
 * single run never fans out across all of them.
 */
export const CATALOG_GAPS = [
  "a quiet, low-idle-power mini PC or small desktop that can run a 30B-parameter local model unattended 24/7",
  "a laptop under 1.5 kg with 32 GB or more memory, for photo and design work on the move, under $2,000",
  "a desktop with 16 GB or more of GPU VRAM for local AI work, under $3,000",
  "a durable everyday laptop with upgradeable memory and storage, meant to last five years, under $1,000",
  "a workstation-class desktop with 64 GB or more memory for heavy multitasking and video work",
];
