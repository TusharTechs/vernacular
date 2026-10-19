// Best-effort, per-instance limits that protect the shared Qloo and Claude quotas.
// Each check costs roughly 20–40 Qloo calls and several Claude calls.

const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 8;
const MAX_CONCURRENT = 4;

const hits = new Map<string, number[]>();
let running = 0;

export type Admission = { ok: true; release: () => void } | { ok: false; status: 429 | 503; message: string; retryAfter: number };

export function admit(ip: string): Admission {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_IP) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    return { ok: false, status: 429, message: `You've run ${PER_IP} checks in 10 minutes. Try again in about ${Math.ceil(retryAfter / 60)} min.`, retryAfter };
  }
  if (running >= MAX_CONCURRENT) {
    return { ok: false, status: 503, message: "Vernacular is busy with other checks. Try again in a few seconds.", retryAfter: 10 };
  }
  recent.push(now);
  hits.set(ip, recent);
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
