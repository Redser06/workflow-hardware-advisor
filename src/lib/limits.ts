/**
 * Tunable budget and safety limits. One place, so tuning the budget does not
 * mean hunting through a route file.
 */

/** Per-user daily ceiling on chat turns. Protects the shared AI budget. */
export const DAILY_MESSAGE_LIMIT = 80;

/** Tool-call budget for one reply. Four tools, a handful of retries, no runaway loops. */
export const MAX_STEPS = 20;

/** How many catalog rows one price-refresh cron run will probe. */
export const PRICE_REFRESH_BATCH = 40;
