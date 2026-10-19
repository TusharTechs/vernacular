"use client";

import type { Evidence } from "@/lib/qloo/tools";

function summarise(e: Evidence): string {
  const p = e.params;
  const bits: string[] = [];
  if (p["filter.type"]) bits.push(p["filter.type"].replace("urn:entity:", "").replace("urn:", ""));
  if (p.query) bits.push(`"${p.query}"`);
  if (p["filter.query"]) bits.push(`tags "${p["filter.query"]}"`);
  if (p["signal.interests.entities"]) bits.push(`${p["signal.interests.entities"].split(",").length} taste signal(s)`);
  if (p["signal.demographics.age"]) bits.push(`age ${p["signal.demographics.age"]}`);
  if (p["signal.location.query"]) bits.push(`in ${p["signal.location.query"]}`);
  if (p["filter.results.entities"]) bits.push(`scoring ${p["filter.results.entities"].split(",").length} entities`);
  if (p["filter.tags"]) bits.push(`${p["filter.tags"].split(",").length} tag filter(s)`);
  if (p["filter.popularity.min"]) bits.push(`popularity ≥ ${p["filter.popularity.min"]}`);
  if (p["feature.explainability"]) bits.push("explainability");
  return bits.join(" · ");
}

export function TraceDrawer({ calls }: { calls: Evidence[] }) {
  if (!calls.length) return null;
  const ms = calls.filter((c) => !c.cached).reduce((t, c) => t + c.ms, 0);
  return (
    <details className="group rounded-lg border border-rule bg-sheet">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
        <span>
          <strong>{calls.length} Qloo calls</strong> back what you see here
        </span>
        <span className="font-mono text-xs text-muted">
          {(ms / 1000).toFixed(1)}s API time <span className="group-open:hidden">· show</span>
          <span className="hidden group-open:inline">· hide</span>
        </span>
      </summary>
      <div className="max-h-80 overflow-auto border-t border-rule">
        <table className="w-full text-left font-mono text-xs">
          <thead className="sticky top-0 bg-sheet text-muted">
            <tr>
              <th className="px-4 py-2 font-normal">#</th>
              <th className="px-2 py-2 font-normal">Endpoint</th>
              <th className="px-2 py-2 font-normal">Request</th>
              <th className="px-4 py-2 text-right font-normal">ms</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.callId} className="border-t border-rule/60 align-top">
                <td className="px-4 py-1.5 text-muted">{c.callId}</td>
                <td className="whitespace-nowrap px-2 py-1.5">GET {c.path}</td>
                <td className="px-2 py-1.5 text-muted">{summarise(c)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{c.cached ? "cache" : c.ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
