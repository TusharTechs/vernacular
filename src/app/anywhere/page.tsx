import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import Script from "next/script";
import { AnywhereDemo } from "@/components/anywhere-demo";

export const metadata: Metadata = {
  title: "Vernacular Anywhere",
  description: "A culture check for any text box. Write anywhere; Vernacular scores your references for your audience on Qloo's taste graph.",
};

export default function AnywherePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:py-10">
      <SiteHeader />
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl italic tracking-tight text-balance sm:text-5xl">Vernacular, everywhere you write</h1>
        <p className="max-w-2xl text-muted">
          The browser extension puts a culture check in every text box: social posts, email, docs, chat. Click into a box below, or press an example,
          and watch the pill in the corner. This page runs the exact script the extension injects.
        </p>
      </header>
      <AnywhereDemo />
      <section className="flex flex-col gap-2 rounded-xl border border-rule bg-sheet p-6 text-sm">
        <h2 className="font-semibold">Install the extension</h2>
        <p className="text-muted">
          It&apos;s in the repository&apos;s <code className="font-mono text-ink">extension/</code> folder. In Chrome, open{" "}
          <code className="font-mono text-ink">chrome://extensions</code>, turn on Developer mode, choose <em>Load unpacked</em> and pick that folder.
          It sends text to Vernacular only while you&apos;re writing in a box, and never stores it.
        </p>
      </section>
      <Script id="vernacular-anywhere-config" strategy="afterInteractive">
        {`window.VernacularAnywhereConfig = { api: "", app: "" };`}
      </Script>
      <Script src="/anywhere/vernacular-anywhere.js" strategy="afterInteractive" />
    </main>
  );
}
