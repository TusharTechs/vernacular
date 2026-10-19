// Word-level change between two versions of a sentence, so each swap can be
// shown and applied on its own, whatever else was accepted.

export interface Change {
  prefix: string;
  before: string;
  after: string;
  suffix: string;
}

const tokens = (s: string) => s.split(/(\s+)/).filter((t) => t !== "");

export function changeOf(previous: string, next: string): Change {
  const a = tokens(previous);
  const b = tokens(next);
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return {
    prefix: a.slice(0, p).join(""),
    before: a.slice(p, a.length - s).join(""),
    after: b.slice(p, b.length - s).join(""),
    suffix: a.slice(a.length - s).join(""),
  };
}

/** Apply one change to text that may already contain other changes. */
export function applyChange(text: string, c: Change): string {
  if (!c.before) {
    const anchor = c.prefix.slice(-24);
    const at = anchor ? text.indexOf(anchor) : -1;
    return at < 0 ? text : text.slice(0, at + anchor.length) + c.after + text.slice(at + anchor.length);
  }
  const hits: number[] = [];
  for (let i = text.indexOf(c.before); i >= 0; i = text.indexOf(c.before, i + 1)) hits.push(i);
  if (!hits.length) return text;
  const lead = c.prefix.slice(-12);
  const at = hits.find((i) => lead && text.slice(Math.max(0, i - lead.length), i) === lead) ?? hits[0];
  return text.slice(0, at) + c.after + text.slice(at + c.before.length);
}

/** A few words of context either side of a change, for display. */
export function contextOf(c: Change, words = 4) {
  const left = tokens(c.prefix);
  const right = tokens(c.suffix);
  const lead = left.slice(-words * 2).join("");
  const tail = right.slice(0, words * 2).join("");
  return {
    lead: (left.length > words * 2 ? "…" : "") + lead,
    tail: tail + (right.length > words * 2 ? "…" : ""),
  };
}
