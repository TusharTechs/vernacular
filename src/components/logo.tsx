import { useId } from "react";

// The Vernacular mark: a spell-check squiggle (a reference that misses) that
// straightens into a check (a swap that lands), forming a V.
export const MARK_PATH =
  "M12.00 17.00C11.85 17.28 11.30 18.18 11.12 18.69C10.95 19.19 10.84 19.67 10.95 20.02C11.07 20.38 11.40 20.63 11.84 20.83C12.27 21.03 12.96 21.10 13.57 21.21C14.19 21.32 14.96 21.35 15.53 21.49C16.09 21.62 16.65 21.76 16.96 22.02C17.26 22.28 17.40 22.63 17.38 23.06C17.36 23.49 17.09 24.04 16.84 24.58C16.58 25.12 16.13 25.77 15.86 26.32C15.59 26.87 15.28 27.44 15.22 27.89C15.16 28.34 15.23 28.72 15.49 29.01C15.75 29.29 16.25 29.46 16.79 29.60C17.33 29.75 18.09 29.79 18.72 29.89C19.34 30.00 20.06 30.06 20.53 30.24C21.00 30.42 21.39 30.64 21.56 30.97C21.72 31.30 21.67 31.75 21.53 32.24C21.39 32.72 21.00 33.33 20.72 33.89C20.43 34.45 20.00 35.09 19.79 35.60C19.59 36.12 19.42 36.63 19.49 37.01C19.56 37.39 19.82 37.67 20.22 37.89C20.61 38.11 21.26 38.20 21.86 38.32C22.47 38.43 23.25 38.46 23.84 38.58C24.42 38.71 25.06 38.81 25.38 39.06C25.70 39.32 25.80 39.69 25.78 40.11C25.76 40.54 25.45 41.11 25.28 41.61C25.11 42.11 24.83 42.67 24.74 43.13C24.65 43.59 24.64 44.01 24.74 44.38C24.85 44.74 25.12 45.02 25.38 45.31C25.64 45.60 26.02 45.82 26.29 46.10C26.56 46.39 26.88 46.85 27.00 47.00 L53.0 15.0";

export const MARK_STOPS: [number, string][] = [
  [0, "#ff5a3c"],
  [0.38, "#ffa53a"],
  [0.56, "#22c27a"],
  [1, "#14a06a"],
];

export function LogoMark({ size = 32, tile = false, className }: { size?: number; tile?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`vg${id}`} x1="10" y1="14" x2="54" y2="44" gradientUnits="userSpaceOnUse">
          {MARK_STOPS.map(([o, c]) => (
            <stop key={o} offset={o} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      {tile && <rect width="64" height="64" rx="15" fill="#14121f" />}
      <path d={MARK_PATH} fill="none" stroke={`url(#vg${id})`} strokeWidth={size < 24 ? 6.5 : 4.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className="font-serif text-[1.75em] font-semibold italic leading-none tracking-tight">vernacular</span>
    </span>
  );
}
