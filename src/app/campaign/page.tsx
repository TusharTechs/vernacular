import type { Metadata } from "next";
import { CampaignView } from "@/components/campaign-view";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Campaign check · Vernacular",
  description: "Every version of an ad against every audience in one grid: which version runs where, and which references to fix first, scored on Qloo's taste graph.",
};

export default function CampaignPage() {
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:py-10">
      <SiteHeader />
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl italic tracking-tight text-balance sm:text-6xl">Campaign check</h1>
        <p className="max-w-2xl text-lg text-muted">
          Agencies write several versions of an ad and have to decide which one runs where. Paste the versions, pick the audiences, and Vernacular scores
          every cultural reference in every version for every audience on Qloo, in one grid. Open any cell for the full check with verified swaps.
        </p>
      </header>
      <CampaignView />
    </main>
  );
}
