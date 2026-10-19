// Server-sent events helpers shared by the streaming routes.

import Anthropic from "@anthropic-ai/sdk";
import { QlooError } from "./qloo/client";
import { admit } from "./rate-limit";
import { RefusalError } from "./vernacular/llm";

export function publicMessage(err: unknown): string {
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
  if (err instanceof Error && /Paste some copy|limited to|Describe the audience|taste anchors|Tour Mode compares|interpret that audience/.test(err.message)) return err.message;
  return "Something went wrong while checking this copy.";
}

/**
 * Admit the request, then run `work` and stream every event it emits as one
 * `data:` line. Failures become a final `{type: "error"}` event.
 */
export function streamEvents<E>(req: Request, work: (send: (e: E) => void) => Promise<unknown>): Response {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const admission = admit(ip);
  if (!admission.ok) {
    return Response.json({ error: admission.message }, { status: admission.status, headers: { "Retry-After": String(admission.retryAfter) } });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const write = (s: string) => !closed && controller.enqueue(encoder.encode(s));
      const keepAlive = setInterval(() => write(": ping\n\n"), 15_000);
      try {
        await work((e) => write(`data: ${JSON.stringify(e)}\n\n`));
      } catch (err) {
        console.error("stream failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
        write(`data: ${JSON.stringify({ type: "error", message: publicMessage(err) })}\n\n`);
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

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
