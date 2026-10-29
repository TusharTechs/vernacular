// GET /api/translate/sample: the saved Culture Translator run the page opens on
// (npm run snapshot -- translate). 404 if there isn't one.

import { translateSnapshot } from "@/lib/vernacular/snapshots";

export const runtime = "nodejs";

export async function GET() {
  const saved = translateSnapshot();
  return saved ? Response.json(saved) : Response.json({ error: "No saved translation." }, { status: 404 });
}
