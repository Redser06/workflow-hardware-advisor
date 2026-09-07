import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { JOB_LEASE_MINUTES } from "@/lib/limits";

/**
 * Single-flight lease and pause state for background jobs.
 *
 * A scheduler keeps firing whatever the job's state is, so the guard that
 * actually stops work lives here: a paused job runs at most one probe item per
 * invocation, and a job already holding a live lease exits instead of running
 * a second copy in parallel.
 */

export type Admin = SupabaseClient<Database>;

export type JobGate =
  | { run: false; reason: string }
  | { run: true; mode: "normal" | "probe"; pausedReason: string | null };

export async function acquireJob(admin: Admin, jobName: string): Promise<JobGate> {
  const { data, error } = await admin
    .from("job_state")
    .select("status, lease_expires_at, paused_reason")
    .eq("job_name", jobName)
    .maybeSingle();

  if (error) return { run: false, reason: error.message };
  if (!data) return { run: false, reason: `no job_state row for ${jobName}` };

  const now = Date.now();
  const leaseLive = data.lease_expires_at ? Date.parse(data.lease_expires_at) > now : false;
  if (data.status === "running" && leaseLive) {
    return { run: false, reason: "a previous run is still in progress" };
  }

  const leaseExpiry = new Date(now + JOB_LEASE_MINUTES * 60_000).toISOString();
  const { error: leaseError } = await admin
    .from("job_state")
    .update({ status: "running", lease_expires_at: leaseExpiry })
    .eq("job_name", jobName);

  if (leaseError) return { run: false, reason: leaseError.message };

  return {
    run: true,
    // While paused, one item per run probes whether the block has cleared.
    mode: data.status === "paused" ? "probe" : "normal",
    pausedReason: data.paused_reason,
  };
}

export async function finishJob(
  admin: Admin,
  jobName: string,
  result: Database["public"]["Tables"]["job_state"]["Row"]["last_result"],
): Promise<void> {
  await admin
    .from("job_state")
    .update({
      status: "idle",
      lease_expires_at: null,
      paused_reason: null,
      last_run_at: new Date().toISOString(),
      last_result: result,
    })
    .eq("job_name", jobName);
}

export async function pauseJob(admin: Admin, jobName: string, reason: string): Promise<void> {
  await admin
    .from("job_state")
    .update({
      status: "paused",
      lease_expires_at: null,
      paused_reason: reason,
      last_run_at: new Date().toISOString(),
      last_result: { paused: true, reason },
    })
    .eq("job_name", jobName);
}
