"use client";

import { useEffect, useState } from "react";

export interface SectionLink {
  id: string;
  label: string;
}

/** A sticky row of jumps to each part of the results, highlighting the one in view. */
export function SectionBar({ sections }: { sections: SectionLink[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const ids = sections.map((s) => s.id).join(",");
  useEffect(() => {
    const els = ids.split(",").map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids]);

  if (sections.length < 2) return null;
  return (
    <nav aria-label="Results" className="sticky top-0 z-30 -mx-1 flex gap-1 overflow-x-auto rounded-full border border-rule bg-sheet/85 p-1 text-sm shadow-sm backdrop-blur">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          aria-current={active === s.id ? "true" : undefined}
          onClick={(e) => {
            e.preventDefault();
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            document.getElementById(s.id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
            setActive(s.id);
          }}
          className={`shrink-0 rounded-full px-3 py-1 transition-colors ${active === s.id ? "bg-ink text-sheet" : "text-muted hover:text-ink"}`}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
