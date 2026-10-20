"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";

const NAV = [
  { href: "/", label: "Check" },
  { href: "/translate", label: "Translator" },
  { href: "/anywhere", label: "Anywhere" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/how", label: "How it works" },
  { href: "/pitch", label: "Why Vernacular" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/" aria-label="Vernacular home" className="text-ink">
        <Logo size={34} />
      </Link>
      <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Main">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 transition-colors ${active ? "bg-ink text-sheet" : "text-muted hover:bg-sheet hover:text-ink"}`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
