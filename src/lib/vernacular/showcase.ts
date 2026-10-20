// Real swaps from live checks of the scenario gallery (Oct 20, 2026), used by the
// home-page ticker. Each line is from our own sample copy; scores are Qloo percentiles.

export interface ShowcaseSwap {
  audience: string;
  line: string; // "{ref}" marks the reference
  before: { name: string; p: number };
  after: { name: string; p: number };
}

export const SHOWCASE: ShowcaseSwap[] = [
  { audience: "Gen Z Latin-pop fans", line: "Picture a {ref} marathon with a live crowd.", before: { name: "Seinfeld", p: 40 }, after: { name: "Derry Girls", p: 100 } },
  { audience: "45–54 country fans", line: "You know that feeling when the {ref} theme kicks in?", before: { name: "Succession", p: 63 }, after: { name: "The Son", p: 100 } },
  { audience: "Gen Z Latin-pop fans", line: "Coffee as strong as {ref}'s voice.", before: { name: "Dolly Parton", p: 38 }, after: { name: "Rosalía", p: 100 } },
  { audience: "25–29 indie & A24 fans", line: "Bring the spirit of a {ref} show.", before: { name: "Grateful Dead", p: 8 }, after: { name: "Mitski", p: 100 } },
  { audience: "30–34 hip-hop heads", line: "Now it's shorter than a {ref} episode.", before: { name: "Ted Lasso", p: 25 }, after: { name: "Insecure", p: 100 } },
  { audience: "Gen Z Latin-pop fans", line: "Más emotivo que un capítulo de {ref}.", before: { name: "La Rosa de Guadalupe", p: 3 }, after: { name: "On My Block", p: 100 } },
  { audience: "45–54 country fans", line: "Glow like you just stepped off the {ref} set.", before: { name: "Euphoria", p: 55 }, after: { name: "George & Tammy", p: 100 } },
];
