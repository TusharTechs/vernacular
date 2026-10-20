// A shared culture check. The token holds only reference names and scores.

import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { notFound } from "next/navigation";
import { decodeShare, scoreOf } from "@/lib/vernacular/share";

type Params = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const s = decodeShare(token);
  if (!s) return { title: "Vernacular" };
  const score = scoreOf(s);
  const title = `${score.headline} · Vernacular`;
  const description = `${score.lands} of ${score.total} cultural references land with ${s.audience}, checked on Qloo's taste graph.`;
  const image = `/api/card?d=${token}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharedCheck({ params }: Params) {
  const { token } = await params;
  const s = decodeShare(token);
  if (!s) notFound();
  const score = scoreOf(s);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <SiteHeader />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/card?d=${token}`}
        alt={`${score.headline} ${score.lands} of ${score.total} references land.`}
        width={1200}
        height={630}
        className="h-auto w-full rounded-2xl border border-rule shadow-sm"
      />
      <div className="flex flex-col gap-3">
        <p className="max-w-2xl text-lg">
          Every cultural reference in a piece of copy, scored for <strong>{s.audience}</strong> on Qloo&apos;s taste graph. The ones that miss get swapped for
          verified equivalents the audience actually loves.
        </p>
        <div>
          <Link href="/" className="inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90">
            Check your own copy
          </Link>
        </div>
      </div>
    </main>
  );
}
