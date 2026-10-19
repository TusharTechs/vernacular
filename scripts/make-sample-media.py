#!/usr/bin/env python3
"""Draws the original sample storyboard (5 panels) and renders it as JPEGs and
a 15-second animatic MP4 in public/samples/. Requires Google Chrome (headless), ImageMagick and ffmpeg.

Usage: python3 scripts/make-sample-media.py
"""
import pathlib
import subprocess
import tempfile

OUT = pathlib.Path("public/samples")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
W, H = 1280, 720
INK = "#1d2230"
PAPER = "#fbfbf8"
SHADE = "#e4e6ec"
ACCENT = "#c9cfdc"

PANELS = [
    {
        "caption": "SHOT 1 — Friends pile onto a couch. The TV is playing a Seinfeld marathon.",
        "vo": "This summer, the funniest night of your year rolls into town.",
        "art": f"""
          <rect x="760" y="150" width="380" height="240" rx="14" fill="{INK}"/>
          <rect x="778" y="168" width="344" height="204" rx="6" fill="#f2f2ee"/>
          <text x="950" y="262" font-size="54" font-weight="800" text-anchor="middle" fill="{INK}" font-family="Helvetica">SEINFELD</text>
          <text x="950" y="312" font-size="26" text-anchor="middle" fill="{INK}" font-family="Helvetica">MARATHON TONIGHT</text>
          <rect x="930" y="390" width="40" height="40" fill="{INK}"/>
          <rect x="150" y="360" width="520" height="150" rx="40" fill="{SHADE}" stroke="{INK}" stroke-width="5"/>
          <circle cx="250" cy="320" r="44" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>
          <circle cx="410" cy="310" r="44" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>
          <circle cx="570" cy="320" r="44" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>
        """,
    },
    {
        "caption": "SHOT 2 — The group crowds a booth for dinner under the Olive Garden sign.",
        "vo": "Dinner like a Friday at your favourite spot.",
        "art": f"""
          <rect x="330" y="90" width="620" height="120" rx="12" fill="{PAPER}" stroke="{INK}" stroke-width="6"/>
          <text x="640" y="172" font-size="64" font-style="italic" font-weight="700" text-anchor="middle" fill="{INK}" font-family="Georgia">Olive Garden</text>
          <rect x="200" y="330" width="880" height="40" fill="{SHADE}" stroke="{INK}" stroke-width="5"/>
          <rect x="230" y="370" width="30" height="150" fill="{INK}"/>
          <rect x="1020" y="370" width="30" height="150" fill="{INK}"/>
          <circle cx="380" cy="280" r="40" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>
          <circle cx="640" cy="270" r="40" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>
          <circle cx="900" cy="280" r="40" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>
          <rect x="560" y="300" width="160" height="26" rx="10" fill="{ACCENT}" stroke="{INK}" stroke-width="3"/>
        """,
    },
    {
        "caption": "SHOT 3 — A lounge stage. A poster reads “Frank Sinatra Tribute Night”. The crowd sings along.",
        "vo": "And a sing-along you'll still be humming on Monday.",
        "art": f"""
          <rect x="140" y="110" width="330" height="420" fill="{PAPER}" stroke="{INK}" stroke-width="6"/>
          <text x="305" y="200" font-size="40" font-weight="800" text-anchor="middle" fill="{INK}" font-family="Helvetica">FRANK</text>
          <text x="305" y="248" font-size="40" font-weight="800" text-anchor="middle" fill="{INK}" font-family="Helvetica">SINATRA</text>
          <text x="305" y="300" font-size="26" text-anchor="middle" fill="{INK}" font-family="Helvetica">TRIBUTE NIGHT</text>
          <circle cx="305" cy="410" r="60" fill="{SHADE}" stroke="{INK}" stroke-width="5"/>
          <rect x="560" y="430" width="620" height="40" fill="{SHADE}" stroke="{INK}" stroke-width="5"/>
          <line x1="870" y1="170" x2="870" y2="430" stroke="{INK}" stroke-width="6"/>
          <circle cx="870" cy="160" r="18" fill="{INK}"/>
          <circle cx="660" cy="380" r="34" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>
          <circle cx="780" cy="370" r="34" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>
          <circle cx="960" cy="370" r="34" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>
          <circle cx="1080" cy="380" r="34" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>
        """,
    },
    {
        "caption": "SHOT 4 — Outside the venue after the show. A Buick is parked under a billboard for the tour.",
        "vo": "One night only, in a city near you.",
        "art": f"""
          <rect x="680" y="90" width="500" height="200" fill="{PAPER}" stroke="{INK}" stroke-width="6"/>
          <text x="930" y="175" font-size="44" font-weight="800" text-anchor="middle" fill="{INK}" font-family="Helvetica">LIVE COMEDY</text>
          <text x="930" y="230" font-size="30" text-anchor="middle" fill="{INK}" font-family="Helvetica">THIS FRIDAY</text>
          <line x1="930" y1="290" x2="930" y2="430" stroke="{INK}" stroke-width="8"/>
          <path d="M150 440 L230 360 L520 360 L600 440 Z" fill="{SHADE}" stroke="{INK}" stroke-width="5"/>
          <rect x="120" y="440" width="520" height="70" rx="20" fill="{SHADE}" stroke="{INK}" stroke-width="5"/>
          <circle cx="230" cy="515" r="34" fill="{INK}"/>
          <circle cx="530" cy="515" r="34" fill="{INK}"/>
          <text x="380" y="488" font-size="30" font-weight="700" text-anchor="middle" fill="{INK}" font-family="Helvetica">BUICK</text>
        """,
    },
    {
        "caption": "SHOT 5 — End card.",
        "vo": "Tickets go fast. On sale Friday.",
        "art": f"""
          <text x="640" y="250" font-size="66" font-style="italic" text-anchor="middle" fill="{INK}" font-family="Georgia">The Funniest Night</text>
          <text x="640" y="330" font-size="66" font-style="italic" text-anchor="middle" fill="{INK}" font-family="Georgia">of the Year</text>
          <rect x="400" y="380" width="480" height="80" rx="40" fill="{INK}"/>
          <text x="640" y="433" font-size="30" font-weight="700" text-anchor="middle" fill="{PAPER}" font-family="Helvetica">TICKETS ON SALE FRIDAY</text>
        """,
    },
]


def svg(panel: dict, n: int) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <rect width="{W}" height="{H}" fill="{PAPER}"/>
  <rect x="24" y="24" width="{W - 48}" height="{H - 48}" fill="none" stroke="{INK}" stroke-width="4"/>
  <text x="48" y="64" font-size="22" font-weight="700" fill="{INK}" font-family="Helvetica">PANEL {n}</text>
  {panel["art"]}
  <rect x="24" y="560" width="{W - 48}" height="136" fill="{INK}"/>
  <text x="56" y="612" font-size="26" fill="{PAPER}" font-family="Helvetica">{panel["caption"]}</text>
  <text x="56" y="664" font-size="26" font-style="italic" fill="#c8cede" font-family="Helvetica">VO: “{panel["vo"]}”</text>
</svg>"""


def main() -> None:
    (OUT / "storyboard").mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        frames = []
        for i, p in enumerate(PANELS, start=1):
            src = pathlib.Path(tmp) / f"panel-{i}.svg"
            src.write_text(svg(p, i))
            jpg = OUT / "storyboard" / f"panel-{i}.jpg"
            # Headless Chrome renders the SVG at exactly W x H with system fonts.
            png = pathlib.Path(tmp) / f"panel-{i}.png"
            subprocess.run(
                [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--window-size={W},{H}",
                 f"--screenshot={png}", f"file://{src}"],
                check=True, capture_output=True,
            )
            subprocess.run(["magick", str(png), "-quality", "82", str(jpg)], check=True)
            frames.append(jpg)
        # 3 seconds per panel with a slow push-in, 24 fps, no audio.
        inputs, filters = [], []
        for i, f in enumerate(frames):
            inputs += ["-i", str(f)]
            filters.append(f"[{i}:v]scale=1280:720,zoompan=z='min(zoom+0.0006,1.04)':d=72:s=1280x720:fps=24,setsar=1[v{i}]")
        concat = "".join(f"[v{i}]" for i in range(len(frames))) + f"concat=n={len(frames)}:v=1:a=0[out]"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filters + [concat]),
             "-map", "[out]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "28", "-movflags", "+faststart",
             str(OUT / "comedy-tour-animatic.mp4")],
            check=True,
        )
    print("Wrote", *sorted(str(p) for p in OUT.rglob("*.*")), sep="\n  ")


if __name__ == "__main__":
    main()
