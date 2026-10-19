// Best-effort, per-instance limits that protect the shared Qloo and Claude quotas.
// Each check costs roughly 20–40 Qloo calls and several Claude calls.

const WINDOW_MS = 10 * 60 * 1000;
const PER_IP: Record<Bucket, number> = { check: 8, audience: 20 };
export type Bucket = "check" | "audience";
const MAX_CONCURRENT = 4;

const hits = new Map<string, number[]>();
let running = 0;

export type Admission = { ok: true; release: () => void } | { ok: false; status: 429 | 503; message: string; retryAfter: number };

export function admit(ip: string, bucket: Bucket = "check"): Admission {
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const limit = PER_IP[bucket];
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    return { ok: false, status: 429, message: `You've made ${limit} of these requests in 10 minutes. Try again in about ${Math.ceil(retryAfter / 60)} min.`, retryAfter };
  }
  if (running >= MAX_CONCURRENT) {
    return { ok: false, status: 503, message: "Vernacular is busy with other checks. Try again in a few seconds.", retryAfter: 10 };
  }
  recent.push(now);
  hits.set(key, recent);
  running++;
  let released = false;
  return {
    ok: true,
    release: () => {
      if (!released) {
        released = true;
        running--;
      }
    },
  };
}
