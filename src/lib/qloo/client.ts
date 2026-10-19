// Server-side Qloo REST client. Never import this from a client component:
// it reads QLOO_API_KEY from the environment.
//
// Docs: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide
// - Hackathon keys only work on https://hackathon.api.qloo.com
// - Auth header is X-Api-Key; all calls are GET with query-string params
// - Invalid params are silently ignored, so we whitelist them (see params.ts)

import { assertKnownParams } from "./params";

export const DEFAULT_BASE_URL = "https://hackathon.api.qloo.com";

export type QlooErrorCode =
  | "missing_key"
  | "auth"
  | "rate_limited"
  | "bad_request"
  | "forbidden"
  | "not_found"
  | "server"
  | "timeout"
  | "network";

export class QlooError extends Error {
  constructor(
    public code: QlooErrorCode,
    message: string,
    public status?: number,
    public retryable = false,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

export type QlooParams = Record<string, string | number | boolean | undefined>;

export interface QlooCall<T> {
  data: T;
  meta: {
    callId: string;
    path: string;
    params: Record<string, string>;
    status: number;
    ms: number;
    cached: boolean;
  };
}

interface Options {
  timeoutMs?: number;
  retries?: number;
  cacheTtlMs?: number;
}

const cache = new Map<string, { at: number; value: QlooCall<unknown> }>();
const CACHE_MAX = 500;
let callCounter = 0;

function config() {
  const key = process.env.QLOO_API_KEY;
  if (!key) {
    throw new QlooError(
      "missing_key",
      "QLOO_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  const baseUrl = (process.env.QLOO_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  return { key, baseUrl };
}

function normalise(params: QlooParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(params).sort()) {
    const v = params[k];
    if (v === undefined || v === "") continue;
    out[k] = String(v);
  }
  return out;
}

function classify(status: number, body: string): QlooError {
  const snippet = body.slice(0, 300);
  if (status === 401) return new QlooError("auth", `Qloo rejected the API key (401). ${snippet}`, status);
  if (status === 403) return new QlooError("forbidden", `Qloo returned 403, often an unsupported filter.type. ${snippet}`, status);
  if (status === 404) return new QlooError("not_found", `Qloo returned 404. ${snippet}`, status);
  if (status === 429) return new QlooError("rate_limited", "Qloo rate limit reached (429).", status, true);
  if (status >= 500) return new QlooError("server", `Qloo server error (${status}).`, status, true);
  return new QlooError("bad_request", `Qloo returned ${status}. ${snippet}`, status);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function qlooGet<T = unknown>(
  path: string,
  params: QlooParams = {},
  { timeoutMs = 8000, retries = 1, cacheTtlMs = 60 * 60 * 1000 }: Options = {},
): Promise<QlooCall<T>> {
  const { key, baseUrl } = config();
  assertKnownParams(path, params);
  const query = normalise(params);
  const qs = new URLSearchParams(query).toString();
  const url = `${baseUrl}${path}${qs ? `?${qs}` : ""}`;
  const callId = `q${++callCounter}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < cacheTtlMs) {
    return { ...(hit.value as QlooCall<T>), meta: { ...hit.value.meta, callId, cached: true } };
  }

  let attempt = 0;
  for (;;) {
    const started = Date.now();
    try {
      const res = await fetch(url, {
        headers: { "X-Api-Key": key, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      const text = await res.text();
      if (!res.ok) throw classify(res.status, text);
      const value: QlooCall<T> = {
        data: JSON.parse(text) as T,
        meta: { callId, path, params: query, status: res.status, ms: Date.now() - started, cached: false },
      };
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(url, { at: Date.now(), value });
      return value;
    } catch (err) {
      const e =
        err instanceof QlooError
          ? err
          : err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
            ? new QlooError("timeout", `Qloo did not answer within ${timeoutMs} ms.`, undefined, true)
            : new QlooError("network", `Could not reach Qloo: ${(err as Error).message}`, undefined, true);
      if (e.retryable && attempt < retries) {
        attempt++;
        await sleep(400 * 2 ** attempt);
        continue;
      }
      throw e;
    }
  }
}
