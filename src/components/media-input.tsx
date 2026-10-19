"use client";

import { useRef, useState } from "react";
import { extractVoice } from "./audio";

export interface Frame {
  src: string;
  t?: number;
  name: string;
}

export interface StoryboardRead {
  text: string;
  shots: { index: number; label: string; note: string }[];
  frames: Frame[];
}

const MAX_FRAMES = 12;
const MAX_VIDEO_SECONDS = 180;

function toJpeg(source: CanvasImageSource, width: number, height: number, maxW = 1024) {
  const scale = Math.min(1, maxW / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

async function imageToFrame(blob: Blob, name: string): Promise<Frame> {
  const bmp = await createImageBitmap(blob);
  const src = toJpeg(bmp, bmp.width, bmp.height);
  bmp.close();
  return { src, name };
}

/** Sample evenly spaced frames from a video, entirely in the browser. */
async function sampleVideo(url: string, name: string, onProgress: (s: string) => void): Promise<Frame[]> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  await new Promise<void>((ok, fail) => {
    video.onloadedmetadata = () => ok();
    video.onerror = () => fail(new Error("This browser can't read that video. Try an MP4 (H.264)."));
  });
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Couldn't read the video's length.");
  if (duration > MAX_VIDEO_SECONDS) throw new Error(`Use a video under ${MAX_VIDEO_SECONDS / 60} minutes.`);
  const n = Math.max(4, Math.min(MAX_FRAMES, Math.ceil(duration / 2.5)));
  const frames: Frame[] = [];
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) * duration) / n;
    onProgress(`Sampling frame ${i + 1} of ${n}…`);
    // Some browsers drop "seeked" (e.g. in a background tab), so never wait more than 3 s per frame.
    await new Promise<void>((ok) => {
      const timer = window.setTimeout(ok, 3000);
      video.onseeked = () => {
        window.clearTimeout(timer);
        ok();
      };
      video.currentTime = t;
    });
    frames.push({ src: toJpeg(video, video.videoWidth, video.videoHeight, 960), t: Math.round(t * 10) / 10, name });
  }
  return frames;
}

export function MediaInput({ onRead, disabled }: { onRead: (r: StoryboardRead) => void; disabled?: boolean }) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [voiceover, setVoiceover] = useState("");
  const [segments, setSegments] = useState<{ start: number; end: number; text: string }[] | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const busy = status !== null;

  const guard = async (label: string, work: () => Promise<void>) => {
    setError(null);
    setStatus(label);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reading that file.");
    } finally {
      setStatus(null);
    }
  };

  const addImages = (files: FileList | null) =>
    guard("Preparing images…", async () => {
      const list = [...(files ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, MAX_FRAMES);
      const next = await Promise.all(list.map((f) => imageToFrame(f, f.name)));
      setFrames((cur) => [...cur.filter((c) => c.t === undefined), ...next].slice(0, MAX_FRAMES));
    });

  const addVideo = (video: Blob, name: string) =>
    guard("Opening the video…", async () => {
      const url = URL.createObjectURL(video);
      try {
        setFrames(await sampleVideo(url, name, (s) => setStatus(s)));
      } finally {
        URL.revokeObjectURL(url);
      }
      setVoiceover("");
      setSegments(null);
      setVoiceNote(null);
      setStatus("Listening for a voiceover…");
      const audio = await extractVoice(video);
      if (!audio) {
        setVoiceNote("No voiceover found in this video. Paste a script below if there is one.");
        return;
      }
      setStatus("Transcribing the voiceover…");
      const form = new FormData();
      form.append("audio", audio, "voiceover.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVoiceNote(`${data.error ?? "Couldn't transcribe the voiceover."} You can paste it below instead.`);
        return;
      }
      setVoiceover(data.text ?? "");
      setSegments(data.segments ?? null);
      setVoiceNote("Voiceover transcribed. Each line will be matched to the frame it plays over; edit it if anything was misheard.");
    });

  const loadSampleBoard = () =>
    guard("Loading the sample storyboard…", async () => {
      const blobs = await Promise.all([1, 2, 3, 4, 5].map((i) => fetch(`/samples/storyboard/panel-${i}.jpg`).then((r) => r.blob())));
      setFrames(await Promise.all(blobs.map((b, i) => imageToFrame(b, `panel-${i + 1}.jpg`))));
    });

  const read = () =>
    guard("Reading the frames with Claude…", async () => {
      const res = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frames: frames.map((f) => ({ image: f.src, t: f.t })),
          voiceover: voiceover.trim() || undefined,
          voiceSegments: segments ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read the frames.");
      onRead({ ...data, frames });
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled || busy} onClick={() => imageInput.current?.click()} className="rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink disabled:opacity-50">
          Upload storyboard images
        </button>
        <button type="button" disabled={disabled || busy} onClick={() => videoInput.current?.click()} className="rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink disabled:opacity-50">
          Upload a video ad
        </button>
        <span className="mx-1 self-center text-xs text-muted">or try</span>
        <button type="button" disabled={disabled || busy} onClick={loadSampleBoard} className="rounded-full border border-rule px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink">
          Sample storyboard
        </button>
        <button type="button" disabled={disabled || busy} onClick={() =>
            guard("Loading the sample animatic…", async () => {
              const blob = await (await fetch("/samples/comedy-tour-animatic.mp4")).blob();
              await addVideo(blob, "comedy-tour-animatic.mp4");
            })
          } className="rounded-full border border-rule px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink">
          Sample animatic (video)
        </button>
        <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) addVideo(f, f.name);
          }}
        />
      </div>

      <p className="text-xs text-muted">
        Videos are sampled into frames in your browser; only the stills and a compressed copy of the soundtrack are sent, for reading and transcription. Up to{" "}
        {MAX_FRAMES} frames. The sample animatic&apos;s voiceover is AI-generated.
      </p>

      {frames.length > 0 ? (
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {frames.map((f, i) => (
            <li key={`${f.name}-${i}`} className="group relative overflow-hidden rounded-md border border-rule bg-desk">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.src} alt={`Frame ${i + 1}`} className="aspect-video w-full object-cover" />
              <span className="absolute left-1.5 top-1.5 rounded bg-ink/80 px-1.5 py-px font-mono text-[10px] text-sheet">
                {typeof f.t === "number" ? `${Math.floor(f.t / 60)}:${String(Math.floor(f.t % 60)).padStart(2, "0")}` : `Panel ${i + 1}`}
              </span>
              <button
                type="button"
                aria-label={`Remove frame ${i + 1}`}
                onClick={() => setFrames((cur) => cur.filter((_, j) => j !== i))}
                className="absolute right-1.5 top-1.5 rounded bg-sheet/90 px-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-rule text-sm text-muted">
          Storyboard panels, key frames or a short video ad
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">Voiceover or script (optional)</span>
        {voiceNote && <span className="text-xs text-muted">{voiceNote}</span>}
        <textarea
          id="voiceover"
          value={voiceover}
          onChange={(e) => {
            setVoiceover(e.target.value);
            setSegments(null); // edited text is checked as a whole rather than per frame
          }}
          rows={2}
          maxLength={1500}
          placeholder="Paste the voiceover so its references are checked too"
          className="resize-y rounded-md border border-rule bg-sheet px-3 py-2 outline-none focus:border-accent"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-xs text-muted" aria-live="polite">
          {status ?? (frames.length ? `${frames.length} frame${frames.length === 1 ? "" : "s"} ready` : "")}
        </span>
        <button
          type="button"
          onClick={read}
          disabled={disabled || busy || !frames.length}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40"
        >
          Check the frames
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-misses">{error}</p>}
    </div>
  );
}
