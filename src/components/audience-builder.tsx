"use client";

import { AGE_BANDS, type AgeBand, type EntityType } from "@/lib/qloo/params";
import { AUDIENCE_PRESETS } from "@/lib/vernacular/presets";
import type { AudienceSpec } from "@/lib/vernacular/types";

const AGE_LABEL: Record<AgeBand, string> = {
  "24_and_younger": "24 and younger",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55 and older",
};

const ANCHOR_TYPES: { value: EntityType; label: string }[] = [
  { value: "artist", label: "Artist" },
  { value: "tv_show", label: "TV show" },
  { value: "movie", label: "Film" },
  { value: "brand", label: "Brand" },
  { value: "book", label: "Book" },
  { value: "podcast", label: "Podcast" },
  { value: "videogame", label: "Game" },
  { value: "person", label: "Person" },
];

export function AudienceBuilder({ value, onChange, disabled }: { value: AudienceSpec; onChange: (a: AudienceSpec) => void; disabled?: boolean }) {
  const setAnchor = (i: number, patch: Partial<AudienceSpec["anchors"][number]>) =>
    onChange({ ...value, anchors: value.anchors.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-4 disabled:opacity-60">
      <legend className="sr-only">Audience</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Audience presets">
        {AUDIENCE_PRESETS.map((p) => {
          const active = p.spec.label === value.label;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(structuredClone(p.spec))}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active ? "border-accent bg-accent-soft text-ink" : "border-rule text-muted hover:border-accent hover:text-ink"
              }`}
            >
              {p.spec.label}
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">Audience name</span>
        <input
          id="audience-label"
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          className="rounded-md border border-rule bg-sheet px-3 py-2 outline-none focus:border-accent"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">They love</span>
        {value.anchors.map((a, i) => (
          <div key={i} className="flex gap-2">
            <input
              id={`anchor-${i}`}
              aria-label={`Taste anchor ${i + 1}`}
              value={a.query}
              onChange={(e) => setAnchor(i, { query: e.target.value })}
              placeholder="e.g. Bad Bunny"
              className="min-w-0 flex-1 rounded-md border border-rule bg-sheet px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <select
              id={`anchor-type-${i}`}
              aria-label={`Type of taste anchor ${i + 1}`}
              value={a.type}
              onChange={(e) => setAnchor(i, { type: e.target.value as EntityType })}
              className="rounded-md border border-rule bg-sheet px-2 py-2 text-sm outline-none focus:border-accent"
            >
              {ANCHOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange({ ...value, anchors: value.anchors.filter((_, j) => j !== i) })}
              aria-label={`Remove ${a.query || "anchor"}`}
              className="rounded-md px-2 text-muted hover:text-misses"
            >
              ×
            </button>
          </div>
        ))}
        {value.anchors.length < 5 && (
          <button
            type="button"
            onClick={() => onChange({ ...value, anchors: [...value.anchors, { query: "", type: "artist" }] })}
            className="self-start text-sm text-accent hover:underline"
          >
            + Add something they love
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Age</span>
          <select
            id="audience-age"
            value={value.age ?? ""}
            onChange={(e) => onChange({ ...value, age: (e.target.value || undefined) as AgeBand | undefined })}
            className="rounded-md border border-rule bg-sheet px-2 py-2 outline-none focus:border-accent"
          >
            <option value="">Any age</option>
            {AGE_BANDS.map((b) => (
              <option key={b} value={b}>
                {AGE_LABEL[b]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">City (brands &amp; places)</span>
          <input
            id="audience-location"
            value={value.location ?? ""}
            onChange={(e) => onChange({ ...value, location: e.target.value || undefined })}
            placeholder="Optional"
            className="rounded-md border border-rule bg-sheet px-3 py-2 outline-none focus:border-accent"
          />
        </label>
      </div>
    </fieldset>
  );
}

export { AGE_LABEL };
