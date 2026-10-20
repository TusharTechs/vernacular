// GET /api/scenario/:id: a real check of one gallery scenario, cached server-side
// for a day (served stale while it refreshes) so the gallery opens instantly.

import { unstable_cache } from "next/cache";
import { runCheck } from "@/lib/vernacular/run";
import { SCENARIOS, SCENARIOS_VERSION } from "@/lib/vernacular/scenarios";

export const runtime = "nodejs";
export const maxDuration = 120;

const cached = (id: string) =>
  unstable_cache(
    async () => {
      const s = SCENARIOS.find((x) => x.id === id)!;
      return { checkedAt: new Date().toISOString(), result: await runCheck({ text: s.text, audience: s.audience }) };
    },
    ["scenario", id, String(SCENARIOS_VERSION)],
    { revalidate: 60 * 60 * 24 },
  )();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SCENARIOS.some((s) => s.id === id)) return Response.json({ error: "Unknown scenario." }, { status: 404 });
  try {
    return Response.json(await cached(id));
  } catch (err) {
    console.error("scenario failed:", id, err instanceof Error ? err.message : err);
    return Response.json({ error: "This scenario isn't available right now." }, { status: 503 });
  }
}
