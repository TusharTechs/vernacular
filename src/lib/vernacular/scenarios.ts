// Real-world scenarios: the formats people actually write, each sent to an
// audience it wasn't written for. All copy is original, written for this project.

import { AUDIENCE_PRESETS } from "./presets";
import type { AudienceSpec } from "./types";

export const SCENARIOS_VERSION = 2;

const preset = (id: string, extra: Partial<AudienceSpec> = {}): AudienceSpec => ({
  ...structuredClone(AUDIENCE_PRESETS.find((p) => p.id === id)!.spec),
  ...extra,
});

export interface Scenario {
  id: string;
  format: string;
  label: string;
  /** Why this is a realistic problem, in one line. */
  situation: string;
  text: string;
  audience: AudienceSpec;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "tour",
    format: "Event promo",
    label: "Comedy tour announcement",
    situation: "A tour poster written by a 50-something promoter, aimed at Gen Z.",
    text: "This summer the funniest night of your year rolls into town. Picture a Seinfeld marathon with a live crowd, dinner like a Friday at Olive Garden, and a sing-along that feels like Frank Sinatra night at the lounge. Tickets go fast.",
    audience: preset("genz-latin"),
  },
  {
    id: "podcast",
    format: "Podcast ad read",
    label: "Mattress host-read",
    situation: "One host-read script, bought across shows with very different listeners.",
    text: "Quick break. You know that feeling when the Succession theme kicks in and you suddenly want to buy a yacht? That's how this mattress makes mornings feel. It's firmer than a Tom Brady handshake and ships in a box smaller than your Peloton.",
    audience: preset("country-45"),
  },
  {
    id: "trailer",
    format: "Trailer voiceover",
    label: "Summer blockbuster spot",
    situation: "A trailer VO that leans on the studio's classics, cut for a young audience.",
    text: "This summer, from the minds that gave you Jurassic Park, comes a story bigger than Titanic, funnier than Ghostbusters and more terrifying than Jaws.",
    audience: preset("genz-latin"),
  },
  {
    id: "radio",
    format: "Radio spot",
    label: "Truck dealer sales event",
    situation: "A country-station radio script reused on a Latin-pop station.",
    text: "Come on down to the Labor Day sales event. Deals hotter than a Nashville summer, trucks tougher than John Wayne, and coffee as strong as Dolly Parton's voice. Only this weekend.",
    audience: preset("genz-latin"),
  },
  {
    id: "email",
    format: "Email subject + preview",
    label: "Abandoned-cart email",
    situation: "A retention email whose jokes are aimed at the writer's own generation.",
    text: "Your cart misses you more than Ross missed Rachel. Come back before it goes the way of Blockbuster — your picks are saved, for now.",
    audience: preset("indie-25"),
  },
  {
    id: "launch-post",
    format: "Launch post",
    label: "Notes app launch",
    situation: "A startup's launch post, read by an older audience it hopes to win.",
    text: "Introducing Orbit: the notes app with the memory of a Jeopardy! champion and the calm of a Studio Ghibli film. Built for people who live in Notion but dream in Spotify playlists.",
    audience: preset("classic-55"),
  },
  {
    id: "tiktok",
    format: "Short-video caption",
    label: "Skincare GRWM",
    situation: "A creator brief written for TikTok, repurposed for a 45–54 Facebook campaign.",
    text: "POV: your skincare routine is more chaotic than a Love Island recoupling 💅 Glow like you just stepped off the Euphoria set. #GRWM",
    audience: preset("country-45"),
  },
  {
    id: "billboard",
    format: "Billboard (Chicago)",
    label: "Sports bar out-of-home",
    situation: "A billboard for a Chicago sports bar; open the map to see where it should run.",
    text: "Louder than a Bears game at Soldier Field. Colder beer than a Wrigley Field bleacher seat in April. Wings worth missing a Taylor Swift encore for.",
    audience: preset("hiphop-30s", { location: "Chicago" }),
  },
  {
    id: "app-store",
    format: "App Store blurb",
    label: "Budgeting app",
    situation: "App-store copy written by millennials, for a Gen Z download push.",
    text: "Budgeting that feels less like doing your taxes and more like a Mario Kart rainbow road. Save like Warren Buffett, splurge like Carrie Bradshaw, sleep like a baby.",
    audience: preset("genz-latin"),
  },
  {
    id: "fundraiser",
    format: "Charity appeal",
    label: "Fall fun run",
    situation: "A fundraiser email that has to recruit younger runners.",
    text: "Run with us this fall. Bring the stamina of Rocky Balboa, the spirit of a Grateful Dead show and the snack game of a Trader Joe's tasting. Every mile funds a classroom.",
    audience: preset("indie-25"),
  },
  {
    id: "spanish",
    format: "Spanish-language promo",
    label: "Holiday gift promo (ES)",
    situation: "Spanish copy written for parents, sent to their Gen Z kids.",
    text: "Esta Navidad, regala algo más épico que un concierto de Luis Miguel y más emotivo que un capítulo de La Rosa de Guadalupe.",
    audience: preset("genz-latin"),
  },
  {
    id: "linkedin",
    format: "LinkedIn post",
    label: "B2B onboarding story",
    situation: "A B2B founder post that has to reach younger operators.",
    text: "Our onboarding used to feel like the Lord of the Rings extended edition. Now it's shorter than a Ted Lasso episode. Here's what changed when we hit 10,000 customers.",
    audience: preset("hiphop-30s"),
  },
];
