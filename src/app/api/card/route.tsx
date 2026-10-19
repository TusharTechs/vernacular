// GET /api/card?d=<token>: renders the 1200x630 share image for a check.

import { ImageResponse } from "next/og";
import { decodeShare, scoreOf } from "@/lib/vernacular/share";
import type { Verdict } from "@/lib/vernacular/types";

export const runtime = "nodejs";

const COLORS = { bg: "#2a3fc4", ink: "#0f1330", paper: "#ffffff", soft: "#dfe4ff" };
const PILL: Record<Verdict, { bg: string; fg: string; label: string }> = {
  lands: { bg: "#d8f2e2", fg: "#14653a", label: "LANDS" },
  mixed: { bg: "#fbecd0", fg: "#8a560c", label: "MIXED" },
  misses: { bg: "#fcdcd3", fg: "#a12f15", label: "MISSES" },
  unmeasured: { bg: "#e8e9ee", fg: "#5d6475", label: "N/A" },
};

const fonts = new Map<string, ArrayBuffer | null>();
/** Fetch a TTF from Google Fonts (the CSS API serves TTF to non-browser clients). */
async function font(family: string, spec: string): Promise<ArrayBuffer | null> {
  const key = `${family}:${spec}`;
  if (fonts.has(key)) return fonts.get(key)!;
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:${spec}`, { signal: AbortSignal.timeout(4000) })).text();
    const url = /src: url\((https:[^)]+)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
    const data = url ? await (await fetch(url, { signal: AbortSignal.timeout(4000) })).arrayBuffer() : null;
    fonts.set(key, data);
    return data;
  } catch {
    fonts.set(key, null);
    return null;
  }
}

export async function GET(req: Request) {
  const summary = decodeShare(new URL(req.url).searchParams.get("d") ?? "");
  if (!summary) return new Response("Invalid card", { status: 400 });
  const s = scoreOf(summary);
  const [serif, sans] = await Promise.all([font("Newsreader", "ital,wght@1,600"), font("Instrument+Sans", "wght@600")]);

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: COLORS.bg, color: COLORS.paper, padding: 56, fontFamily: sans ? "Instrument Sans" : undefined }}>
        <div style={{ display: "flex", flexDirection: "column", width: 640, justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: COLORS.soft }}>VERNACULAR · CULTURE CHECK</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", fontFamily: serif ? "Newsreader" : undefined, fontStyle: "italic", fontSize: summary.audience.length > 30 ? 58 : 68, lineHeight: 1.05 }}>
              {s.headline}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: COLORS.soft }}>
              {`${s.lands} of ${s.total} references land${s.swaps ? `, ${s.afterLands} of ${s.total} after Vernacular's swaps` : ""}.`}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 20, color: COLORS.soft, letterSpacing: 2 }}>CULTURE SCORE</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, fontSize: 96, lineHeight: 1 }}>
                <span>{s.before ?? "–"}</span>
                {s.swaps > 0 && <span style={{ fontSize: 56, color: COLORS.soft }}>→</span>}
                {s.swaps > 0 && <span>{s.after ?? "–"}</span>}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 18, color: COLORS.soft, paddingBottom: 14 }}>Average percentile on Qloo&apos;s taste graph</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, marginLeft: 40, width: 408 }}>
          {summary.refs.slice(0, 5).map((r, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", background: COLORS.paper, color: COLORS.ink, borderRadius: 18, padding: "16px 20px", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 28, fontFamily: serif ? "Newsreader" : undefined, fontStyle: "italic" }}>{r.name}</span>
                <span style={{ display: "flex", background: PILL[r.verdict].bg, color: PILL[r.verdict].fg, borderRadius: 999, padding: "4px 12px", fontSize: 16 }}>
                  {PILL[r.verdict].label}
                  {r.percentile !== null ? ` · p${r.percentile}` : ""}
                </span>
              </div>
              {r.swap && (
                <div style={{ display: "flex", fontSize: 20, color: "#3c4357" }}>
                  {`→ ${r.swap}${r.swapPercentile !== null && r.swapPercentile !== undefined ? ` · p${r.swapPercentile}` : ""}`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        ...(serif ? [{ name: "Newsreader", data: serif, style: "italic" as const, weight: 600 as const }] : []),
        ...(sans ? [{ name: "Instrument Sans", data: sans, style: "normal" as const, weight: 600 as const }] : []),
      ],
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    },
  );
}
