// Real swaps from the saved gallery checks (written by scripts/showcase.ts), used by
// the home-page ticker. Each line is from our own sample copy; scores are Qloo percentiles.

export interface ShowcaseSwap {
  audience: string;
  line: string; // "{ref}" marks the reference
  before: { name: string; p: number };
  after: { name: string; p: number };
  checkedAt: string;
}

export const SHOWCASE: ShowcaseSwap[] = [
  { audience: "Gen Z Latin-pop fans", line: "Picture a {ref} marathon with a live crowd", before: { name: "Seinfeld", p: 40 }, after: { name: "Never Have I Ever", p: 100 }, checkedAt: "2026-10-29" },
  { audience: "Gen Z Latin-pop fans", line: "A sing-along that feels like {ref} night at the lounge.", before: { name: "Frank Sinatra", p: 60 }, after: { name: "Kali Uchis", p: 100 }, checkedAt: "2026-10-29" },
  { audience: "Gen Z Latin-pop fans", line: "Funnier than The Kissing Booth 2 and more terrifying than {ref}.", before: { name: "Jaws", p: 28 }, after: { name: "Bird Box", p: 100 }, checkedAt: "2026-10-29" },
  { audience: "Gen Z Latin-pop fans", line: "Deals hotter than a {ref} summer", before: { name: "Nashville", p: 0 }, after: { name: "Miami", p: 92 }, checkedAt: "2026-10-29" },
  { audience: "Gen Z Latin-pop fans", line: "Trucks tougher than {ref}", before: { name: "John Wayne", p: 0 }, after: { name: "Wonder Woman", p: 100 }, checkedAt: "2026-10-29" },
  { audience: "25–29 indie & A24 fans", line: "Your cart misses you more than {ref}.", before: { name: "Ross missed Rachel", p: 56 }, after: { name: "Rob missed Mac in High Fidelity", p: 100 }, checkedAt: "2026-10-29" },
];
