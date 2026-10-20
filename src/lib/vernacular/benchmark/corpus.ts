// The benchmark's fixed inputs: original sample copy written for this project,
// crossed with the five audience presets. Changing anything here changes the
// benchmark, so results record which corpus version they came from.

import { AUDIENCE_PRESETS, SAMPLE_COPY } from "../presets";

export const CORPUS_VERSION = 1;

export const BENCHMARK_COPY: { id: string; label: string; text: string }[] = [
  ...SAMPLE_COPY,
  {
    id: "sneaker",
    label: "Running shoe drop",
    text: "Built for the kind of energy you only get at a Beyoncé stadium show. Lace up, cue the Top Gun soundtrack, and run like you're late for a table at The Cheesecake Factory.",
  },
  {
    id: "streaming",
    label: "Streaming bundle promo",
    text: "One subscription, a whole winter of nights in: more twists than Lost, more laughs than The Office, and more hospital drama than Grey's Anatomy. Your first month is free.",
  },
  {
    id: "fitness",
    label: "Fitness app launch",
    text: "Train like Rocky on the museum steps, keep your playlist stacked with Taylor Swift, and recover with a stretch session calmer than a Bob Ross episode. Your first week is on us.",
  },
  {
    id: "restaurant",
    label: "Taco bar opening",
    text: "Opening night feels like a Jimmy Buffett concert with better tacos: frozen margaritas, a patio straight out of Grease, and a crowd louder than a Monday Night Football watch party.",
  },
  {
    id: "hotel",
    label: "Boutique hotel campaign",
    text: "Wake up somewhere that looks like a Wes Anderson film, spend the afternoon like a guest on The White Lotus, and end the night with Coldplay drifting from the rooftop speakers.",
  },
  {
    id: "fintech",
    label: "Savings app ad",
    text: "Spend like it's a Drake album drop, save like Warren Buffett is watching, and feel as organised as a Marie Kondo makeover. Open an account in two minutes.",
  },
];

export const BENCHMARK_AUDIENCES = AUDIENCE_PRESETS;
