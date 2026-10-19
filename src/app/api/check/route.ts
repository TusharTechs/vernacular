// POST /api/check: runs one Vernacular check and streams progress as
// server-sent events (one JSON CheckEvent per `data:` line).

import Anthropic from "@anthropic-ai/sdk";
import { QlooError } from "@/lib/qloo/client";
import { admit } from "@/lib/rate-limit";
import { RefusalError } from "@/lib/vernacular/llm";
import { runCheck } from "@/lib/vernacular/run";
import { CheckInputSchema } from "@/lib/vernacular/schema";
import type { CheckEvent } from "@/lib/vernacular/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function publicMessage(err: unknown): string {
  if (err instanceof QlooError) {
    if (err.code === "rate_limited") return "Qloo's rate limit was reached. Wait a minute and try again.";
    if (err.code === "timeout" || err.code === "network" || err.code === "server") return "Qloo didn't respond in time. Try again in a moment.";
    if (err.code === "missing_key" || err.code === "auth") return "The server's Qloo connection isn't configured correctly.";
    return "Qloo rejected one of the requests. Try different references or audience anchors.";
  }
  if (err instanceof RefusalError) return "The model declined to process this copy.";
  if (err instanceof Anthropic.RateLimitError) return "The model is rate-limited right now. Try again in a minute.";
  if (err instanceof Anthropic.AuthenticationError) return "The server's model connection isn't configured correctly.";
  if (err instanceof Anthropic.APIError) return "The model request failed. Try again in a moment.";
  if (err instanceof Error && /Paste some copy|limited to|Describe the audience|taste anchors/.test(err.message)) return err.message;
  return "Something went wrong while checking this copy.";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send the copy and audience as JSON." }, { status: 400 });
  }
  const parsed = CheckInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const admission = admit(ip);
  if (!admission.ok) {
    return Response.json({ error: admission.message }, { status: admission.status, headers: { "Retry-After": String(admission.retryAfter) } });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (e: CheckEvent) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      const keepAlive = setInterval(() => !closed && controller.enqueue(encoder.encode(": ping\n\n")), 15_000);
      try {
        await runCheck(parsed.data, send);
      } catch (err) {
        console.error("check failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
        send({ type: "error", message: publicMessage(err) });
      } finally {
        clearInterval(keepAlive);
        admission.release();
        closed = true;
        controller.close();
      }
    },
    cancel() {
      admission.release();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
