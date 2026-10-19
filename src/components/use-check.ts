"use client";

import { useCallback, useReducer, useRef } from "react";
import type { Evidence, ResolvedEntity } from "@/lib/qloo/tools";
import type { CheckEvent, CheckInput, CheckResult, ExtractedReference, Kept, ScoredReference, Swap } from "@/lib/vernacular/types";

export type Phase = "idle" | "reading" | "scoring" | "swapping" | "done" | "error";

export interface CheckState {
  phase: Phase;
  text: string;
  anchors: ResolvedEntity[];
  extracted: ExtractedReference[];
  scored: Record<string, ScoredReference>;
  steps: string[];
  swaps: Record<string, Swap>;
  kept: Record<string, Kept>;
  result: CheckResult | null;
  error: string | null;
}

const initial: CheckState = {
  phase: "idle",
  text: "",
  anchors: [],
  extracted: [],
  scored: {},
  steps: [],
  swaps: {},
  kept: {},
  result: null,
  error: null,
};

type Action = { type: "start"; text: string } | { type: "event"; event: CheckEvent } | { type: "fail"; message: string } | { type: "reset" };

function reducer(s: CheckState, a: Action): CheckState {
  if (a.type === "reset") return initial;
  if (a.type === "start") return { ...initial, phase: "reading", text: a.text };
  if (a.type === "fail") return { ...s, phase: "error", error: a.message };
  const e = a.event;
  switch (e.type) {
    case "audience":
      return { ...s, anchors: e.anchors };
    case "extracted":
      return { ...s, extracted: e.references, phase: "scoring" };
    case "scored": {
      const scored = { ...s.scored, [e.reference.id]: e.reference };
      const all = s.extracted.every((r) => scored[r.id]);
      return { ...s, scored, phase: all ? "swapping" : s.phase };
    }
    case "agent_step":
      return { ...s, steps: [...s.steps, e.message] };
    case "swap":
      return { ...s, swaps: { ...s.swaps, [e.swap.referenceId]: e.swap } };
    case "kept":
      return { ...s, kept: { ...s.kept, [e.kept.referenceId]: e.kept } };
    case "done":
      return { ...s, phase: "done", result: e.result };
    case "error":
      return { ...s, phase: "error", error: e.message };
  }
}

/** Every Qloo call that backs something on screen, de-duplicated. */
export function traceOf(s: CheckState): Evidence[] {
  const seen = new Map<string, Evidence>();
  for (const r of Object.values(s.scored)) for (const e of r.evidence) seen.set(e.callId, e);
  for (const w of Object.values(s.swaps)) for (const e of w.evidence) seen.set(e.callId, e);
  return [...seen.values()];
}

/** POST JSON and feed each server-sent event to `onEvent`. Returns an error message, or null. */
export async function streamPost<E>(url: string, body: unknown, signal: AbortSignal, onEvent: (e: E) => void): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      return data.error ?? `The request failed (${res.status}).`;
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return null;
      buffer += value;
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of chunk.split("\n")) if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)) as E);
      }
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return null;
    return "Lost the connection to the server. Check your network and try again.";
  }
}

export function useCheck() {
  const [state, dispatch] = useReducer(reducer, initial);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (input: CheckInput) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    dispatch({ type: "start", text: input.text });
    const error = await streamPost<CheckEvent>("/api/check", input, controller.signal, (event) => dispatch({ type: "event", event }));
    if (error) dispatch({ type: "fail", message: error });
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return { state, run, reset };
}
