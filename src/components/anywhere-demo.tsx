"use client";

import { useRef } from "react";

const EXAMPLES = {
  post: "Monday mood: more chaotic than a Love Island recoupling, but our new planner keeps you calmer than a Bob Ross episode. Link in bio.",
  email: "Your cart misses you more than Ross missed Rachel. Come back before it goes the way of Blockbuster.",
  chat: "for the launch video can we do something like a Wes Anderson film with a Coldplay track under it? feels on brand",
};

function Fill({ target, text }: { target: React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>; text: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const el = target.current;
        if (!el) return;
        if (el instanceof HTMLTextAreaElement) el.value = text;
        else el.innerText = text;
        el.focus();
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }}
      className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-ink"
    >
      Use an example
    </button>
  );
}

export function AnywhereDemo() {
  const post = useRef<HTMLTextAreaElement>(null);
  const email = useRef<HTMLDivElement>(null);
  const chat = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-xl border border-rule bg-sheet p-5" aria-label="Social post composer">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-7 w-7 rounded-full bg-gradient-to-br from-accent to-lands" aria-hidden /> Start a post
          </span>
          <Fill target={post} text={EXAMPLES.post} />
        </div>
        <textarea ref={post} rows={6} placeholder="What do you want to talk about?" className="resize-none rounded-lg border border-rule bg-sheet p-3 text-[15px] outline-none focus:border-accent" />
        <div className="flex justify-end">
          <span className="rounded-full bg-accent px-4 py-1.5 text-sm text-white opacity-70">Post</span>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-rule bg-sheet p-5" aria-label="Email composer">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">New message</span>
          <Fill target={email} text={EXAMPLES.email} />
        </div>
        <div className="flex flex-col divide-y divide-rule rounded-lg border border-rule text-sm">
          <span className="px-3 py-2 text-muted">To: customers@yourbrand.example</span>
          <span className="px-3 py-2 text-muted">Subject: We saved your cart</span>
          <div
            ref={email}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Email body"
            className="min-h-32 px-3 py-2 text-[15px] outline-none"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-rule bg-sheet p-5 lg:col-span-2" aria-label="Team chat">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold"># launch-video</span>
          <Fill target={chat} text={EXAMPLES.chat} />
        </div>
        <textarea ref={chat} rows={3} placeholder="Message #launch-video" className="resize-none rounded-lg border border-rule bg-sheet p-3 text-[15px] outline-none focus:border-accent" />
      </section>
    </div>
  );
}
