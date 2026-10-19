import type { AudienceSpec } from "./types";

export const AUDIENCE_PRESETS: { id: string; spec: AudienceSpec }[] = [
  {
    id: "genz-latin",
    spec: { label: "Gen Z Latin-pop fans", anchors: [{ query: "Bad Bunny", type: "artist" }, { query: "Euphoria", type: "tv_show" }], age: "24_and_younger" },
  },
  {
    id: "hiphop-30s",
    spec: { label: "30–34 hip-hop heads", anchors: [{ query: "Kendrick Lamar", type: "artist" }, { query: "Atlanta", type: "tv_show" }], age: "30_to_34" },
  },
  {
    id: "classic-55",
    spec: { label: "55+ classic-rock fans", anchors: [{ query: "Eagles", type: "artist" }, { query: "M*A*S*H", type: "tv_show" }], age: "55_and_older" },
  },
];

export const SAMPLE_COPY = [
  {
    id: "tour",
    label: "Comedy tour announcement",
    text: "This summer the funniest night of your year rolls into town. Picture a Seinfeld marathon with a live crowd, dinner like a Friday at Olive Garden, and a sing-along that feels like Frank Sinatra night at the lounge. Tickets go fast.",
  },
  {
    id: "coffee",
    label: "Cold brew launch",
    text: "Our new cold brew is smoother than a Fleetwood Mac album and more addictive than a Succession binge. Grab one before your next Patagonia-clad hike.",
  },
];
