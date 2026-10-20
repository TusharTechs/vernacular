// Qloo entities carry dozens of tags the browser never uses. Strip them from
// everything we send to the client (streamed events and cached results), which
// cuts a check's payload by roughly 90%. The audience spec's own tags are kept.

import type { ResolvedEntity } from "../qloo/tools";
import type { CheckEvent, CheckResult } from "./types";

const bare = <T extends ResolvedEntity | null>(e: T): T => (e ? { ...e, tags: [] } : e);

export function slimResult(r: CheckResult): CheckResult {
  return {
    ...r,
    audience: { ...r.audience, anchors: r.audience.anchors.map(bare) },
    references: r.references.map((x) => ({ ...x, entity: bare(x.entity) })),
    swaps: r.swaps.map((s) => ({ ...s, replacement: { ...s.replacement, tags: [] } })),
  };
}

export function slimEvent(e: CheckEvent): CheckEvent {
  switch (e.type) {
    case "audience":
      return { ...e, anchors: e.anchors.map(bare) };
    case "scored":
      return { ...e, reference: { ...e.reference, entity: bare(e.reference.entity) } };
    case "swap":
      return { ...e, swap: { ...e.swap, replacement: { ...e.swap.replacement, tags: [] } } };
    case "done":
      return { ...e, result: slimResult(e.result) };
    default:
      return e;
  }
}
