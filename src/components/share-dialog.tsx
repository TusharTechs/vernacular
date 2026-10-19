"use client";

import { useEffect, useRef, useState } from "react";
import { encodeShare, summaryOf } from "@/lib/vernacular/share";
import type { CheckResult } from "@/lib/vernacular/types";

export function ShareButton({ result }: { result: CheckResult }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const token = encodeShare(summaryOf(result));
  const link = `${origin}/c/${token}`;
  const image = `/api/card?d=${token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const download = async () => {
    const blob = await (await fetch(image)).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vernacular-culture-check.png";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCopied(false);
          dialog.current?.showModal();
        }}
        className="rounded-md border border-rule px-3 py-1 text-sm hover:border-ink"
      >
        Share card
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(92vw,760px)] rounded-2xl border border-rule bg-sheet p-0 text-ink backdrop:bg-ink/50"
        aria-label="Share this culture check"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Your culture check</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="rounded px-2 text-muted hover:text-ink">
              ×
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Share card preview" width={1200} height={630} className="h-auto w-full rounded-lg border border-rule" />
          <p className="text-xs text-muted">The card and link include reference names and scores only, never your copy.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={link} aria-label="Share link" onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-md border border-rule bg-desk px-3 py-2 font-mono text-xs" />
            <button type="button" onClick={copy} className="rounded-md bg-ink px-3 py-2 text-sm text-sheet hover:opacity-90">
              {copied ? "Link copied" : "Copy link"}
            </button>
            <button type="button" onClick={download} className="rounded-md border border-rule px-3 py-2 text-sm hover:border-ink">
              Download image
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
