// MCP endpoint (Streamable HTTP, stateless): lets any agent run Vernacular as a
// tool before it publishes copy. Point an MCP client at <origin>/api/mcp.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { AGE_BANDS, ENTITY_TYPES } from "@/lib/qloo/params";
import { admit } from "@/lib/rate-limit";
import { publicMessage } from "@/lib/sse";
import { resolveEntity } from "@/lib/qloo/tools";
import { proposeAudience } from "@/lib/vernacular/audience";
import { buildCityMap, MAP_TOP } from "@/lib/vernacular/map";
import { runCheck } from "@/lib/vernacular/run";
import { runTour, type TourEvent } from "@/lib/vernacular/tour";
import type { AudienceSpec, CheckResult } from "@/lib/vernacular/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const audienceShape = {
  description: z.string().max(300).optional().describe("Plain-language description, e.g. 'Gen Z fans of Bad Bunny'. Used when no anchors are given."),
  label: z.string().max(80).optional(),
  anchors: z
    .array(z.object({ query: z.string().max(80), type: z.enum(ENTITY_TYPES) }))
    .max(5)
    .optional()
    .describe("Things this audience loves, e.g. [{query: 'Bad Bunny', type: 'artist'}]."),
  age: z.enum(AGE_BANDS).optional(),
  location: z.string().max(80).optional().describe("City; applied to brand and place references only."),
};
const AudienceInput = z.object(audienceShape);

async function toSpec(a: z.infer<typeof AudienceInput>): Promise<AudienceSpec> {
  if (a.anchors?.length || a.age) {
    return { label: a.label ?? a.description ?? "Target audience", anchors: a.anchors ?? [], age: a.age, location: a.location };
  }
  if (!a.description) throw new Error("Describe the audience with at least one thing they love or an age band.");
  return (await proposeAudience(a.description)).spec;
}

function summarise(r: CheckResult) {
  const lines = r.references.map((ref) => {
    const swap = r.swaps.find((s) => s.referenceId === ref.id);
    const kept = r.kept.find((k) => k.referenceId === ref.id);
    return `- ${ref.span}: ${ref.verdict}${ref.percentile !== null ? ` (p${ref.percentile})` : ""}${
      swap ? ` → ${swap.replacement.name} (p${swap.replacement.percentile}). ${swap.rationale}` : kept ? `, kept: ${kept.reason}` : ""
    }`;
  });
  return `Checked for ${r.audience.label}.\n${lines.join("\n")}\n\nRewritten copy:\n${r.rewrittenText}`;
}

function buildServer(ip: string) {
  const server = new McpServer({ name: "vernacular", version: "0.1.0" });
  const guarded = async <T,>(fn: () => Promise<T>) => {
    const admission = admit(ip);
    if (!admission.ok) throw new Error(admission.message);
    try {
      return await fn();
    } catch (err) {
      throw new Error(publicMessage(err));
    } finally {
      admission.release();
    }
  };

  server.registerTool(
    "check_copy",
    {
      title: "Check copy for an audience",
      description:
        "Scores every named cultural reference in the copy for the audience on Qloo's taste graph and replaces weak ones with Qloo-verified equivalents. Returns per-reference verdicts, percentiles, swaps with rationale, and the rewritten copy. Takes 30–60 seconds.",
      inputSchema: { text: z.string().min(1).max(4000), audience: AudienceInput },
    },
    async ({ text, audience }) =>
      guarded(async () => {
        const result = await runCheck({ text, audience: await toSpec(audience) });
        return {
          content: [{ type: "text" as const, text: summarise(result) }],
          structuredContent: {
            audience: result.audience.label,
            references: result.references.map((r) => ({ reference: r.span, matched: r.entity?.name ?? null, verdict: r.verdict, percentile: r.percentile, notes: r.notes })),
            swaps: result.swaps.map((s) => ({ reference: result.references.find((r) => r.id === s.referenceId)?.span, replacement: s.replacement.name, percentile: s.replacement.percentile, rationale: s.rationale })),
            rewritten: result.rewrittenText,
            qlooCalls: result.stats.qlooCalls,
          },
        };
      }),
  );

  server.registerTool(
    "build_audience",
    {
      title: "Build an audience from a description",
      description: "Turns a plain description into Qloo signals: named entities, Qloo audience segments, and the cross-domain entities that audience over-indexes on.",
      inputSchema: { description: z.string().min(3).max(300) },
    },
    async ({ description }) =>
      guarded(async () => {
        const p = await proposeAudience(description);
        return {
          content: [
            {
              type: "text" as const,
              text: `${p.spec.label}: anchors ${p.spec.anchors.map((a) => a.query).join(", ") || "none"}; segments ${p.segments.map((s) => s.name).join(", ") || "none"}; over-indexes on ${p.fingerprint.map((f) => f.name).join(", ")}.`,
            },
          ],
          structuredContent: { audience: p.spec, fingerprint: p.fingerprint.map((f) => ({ name: f.name, type: f.type, affinity: f.affinity })) },
        };
      }),
  );

  server.registerTool(
    "compare_audiences",
    {
      title: "Compare how copy lands across audiences",
      description: "Scores the copy's cultural references for 2–5 audiences side by side (no rewriting). Use it to decide which audience a piece of copy suits, or which references to localise.",
      inputSchema: { text: z.string().min(1).max(4000), audiences: z.array(AudienceInput).min(2).max(5) },
    },
    async ({ text, audiences }) =>
      guarded(async () => {
        const specs = await Promise.all(audiences.map(toSpec));
        const grid: Record<string, Record<string, string>> = {};
        await runTour({ text, audiences: specs }, (e: TourEvent) => {
          if (e.type !== "scored") return;
          for (const r of e.references) {
            grid[r.span] ??= {};
            grid[r.span][specs[e.index].label] = `${r.verdict}${r.percentile !== null ? ` p${r.percentile}` : ""}`;
          }
        });
        const text_ = Object.entries(grid)
          .map(([ref, cols]) => `- ${ref}: ${Object.entries(cols).map(([a, v]) => `${a} ${v}`).join("; ")}`)
          .join("\n");
        return { content: [{ type: "text" as const, text: text_ || "No named cultural references found." }], structuredContent: { grid } };
      }),
  );

  server.registerTool(
    "where_it_lands",
    {
      title: "Map an audience and references onto a city's neighbourhoods",
      description:
        "Uses Qloo's neighbourhood heatmaps to list where in a city the audience over-indexes, and, for each reference, how many of those neighbourhoods its fans also live in. Use it to plan out-of-home or geo-targeted runs. Where fans live is not the same as taste; pair it with check_copy.",
      inputSchema: {
        city: z.string().min(2).max(60).describe("A large city, e.g. 'Chicago' or 'Los Angeles'."),
        audience: AudienceInput,
        references: z.array(z.object({ query: z.string().max(80), type: z.enum(ENTITY_TYPES) })).max(8),
      },
    },
    async ({ city, audience, references }) =>
      guarded(async () => {
        const spec = await toSpec(audience);
        const resolved = await Promise.all(references.map((r) => resolveEntity(r.query, r.type)));
        const refs = resolved.flatMap((r) => (r.entity ? [{ name: r.entity.name, entityId: r.entity.id, role: "original" as const }] : []));
        const map = await buildCityMap(city, spec, refs);
        const name = (id: string) => map.hoods.find((h) => h.id === id)?.name ?? id;
        const audienceTop = map.audience.ranked.slice(0, MAP_TOP.audience).map(name);
        const layers = map.references.map((r) => ({
          name: r.name,
          overlap: r.ranked.length < 5 ? null : r.overlap,
          strongest: r.ranked.slice(0, 5).map(name),
        }));
        const text = [
          `${spec.label} in ${city}: strongest in ${audienceTop.join(", ")}.`,
          ...layers.map((l) =>
            l.overlap === null
              ? `- ${l.name}: too little local data in ${city}.`
              : `- ${l.name}: fans live in ${l.overlap} of the audience's ${MAP_TOP.audience} strongest neighbourhoods (its own strongest: ${l.strongest.join(", ")}).`,
          ),
        ].join("\n");
        return { content: [{ type: "text" as const, text }], structuredContent: { city, audienceTop, references: layers } };
      }),
  );

  return server;
}

async function handle(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const server = buildServer(ip);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
