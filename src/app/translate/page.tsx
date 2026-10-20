import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { Translator } from "@/components/translator";

export const metadata: Metadata = {
  title: "Culture Translator · Vernacular",
  description: "Every audience has its own Seinfeld. Type any reference and see what it translates to for five audiences, verified on Qloo's taste graph.",
};

export default function TranslatePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:py-10">
      <SiteHeader />
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl italic tracking-tight text-balance sm:text-6xl">Culture Translator</h1>
        <p className="max-w-2xl text-lg text-muted">
          A dictionary between audiences. Type one reference and Vernacular scores it for five audiences on Qloo. Where it misses, Qloo proposes
          equivalents the audience over-indexes on, verifies them, and Claude picks the one that plays the same role.
        </p>
      </header>
      <Translator />
    </main>
  );
}
