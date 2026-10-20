import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-6xl flex-col gap-10 px-4 py-6 sm:px-6 lg:py-10">
      <SiteHeader />
      <section className="flex flex-1 flex-col items-start justify-center gap-5">
        <LogoMark size={56} />
        <h1 className="font-serif text-4xl italic tracking-tight sm:text-6xl">
          This page <span className="underline decoration-misses decoration-wavy decoration-2 underline-offset-8">misses</span>.
        </h1>
        <p className="max-w-xl text-lg text-muted">Nothing lives at this address. Here are some that land:</p>
        <div className="flex flex-wrap gap-2">
          {[
            ["/", "Check your copy"],
            ["/translate", "Culture Translator"],
            ["/benchmark", "Benchmark"],
            ["/how", "How it works"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-full border border-rule bg-sheet px-4 py-2 text-sm hover:border-accent">
              {label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
