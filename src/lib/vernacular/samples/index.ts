import type { CheckInput } from "../types";

/** Demo inputs. The copy is original sample text written for this project. */
export const SAMPLES: Record<string, CheckInput> = {
  tour: {
    text:
      "This summer the funniest night of your year rolls into town. Picture a Seinfeld marathon with a live crowd, dinner like a Friday at Olive Garden, and a sing-along that feels like Frank Sinatra night at the lounge. Tickets go fast.",
    audience: {
      label: "Gen Z Latin-pop fans",
      anchors: [{ query: "Bad Bunny", type: "artist" }, { query: "Euphoria", type: "tv_show" }],
      age: "24_and_younger",
    },
  },
  coffee: {
    text:
      "Our new cold brew is smoother than a Fleetwood Mac album and more addictive than a Succession binge. Grab one before your next Patagonia-clad hike.",
    audience: {
      label: "30–34 hip-hop heads",
      anchors: [{ query: "Kendrick Lamar", type: "artist" }, { query: "Atlanta", type: "tv_show" }],
      age: "30_to_34",
    },
  },
};
