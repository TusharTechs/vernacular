"use client";

// Voiceover extraction in the browser: decode the video's audio track,
// downmix and resample to 16 kHz mono, and encode a small WAV for upload.

const RATE = 16000;
export const MAX_VOICE_SECONDS = 130;

function wav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Returns a 16 kHz mono WAV, or null when the video has no audible track. */
export async function extractVoice(video: Blob): Promise<Blob | null> {
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await video.arrayBuffer());
  } catch {
    return null; // no audio track, or a codec the browser can't decode
  } finally {
    void ctx.close();
  }
  const seconds = Math.min(decoded.duration, MAX_VOICE_SECONDS);
  const offline = new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const mono = (await offline.startRendering()).getChannelData(0);
  let sum = 0;
  for (let i = 0; i < mono.length; i += 16) sum += mono[i] * mono[i];
  const rms = Math.sqrt(sum / Math.max(1, mono.length / 16));
  return rms < 0.003 ? null : wav(mono, RATE);
}
