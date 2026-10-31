import { isEcho, type ListenOptions, type ListenResult } from "./listen";
import type { VoiceOptions } from "./types";

/**
 * Natural voices from Chalo Dikhavu Cloud (or your own server with the same API): the guide's
 * words come back as audio from `${endpoint}/tts`, and, with `listen: true`, spoken answers are
 * recorded and transcribed at `${endpoint}/stt`. Any failure falls back to the browser's own
 * voice and recognition, and a refusal (no credits, bad key) turns the Cloud off for the session.
 */
export class CloudVoice {
  /** Set after a refusal: stop asking for the rest of the session. */
  off = false;
  private readonly clips = new Map<string, Promise<string | null>>();

  constructor(private readonly opts: VoiceOptions) {}

  get listens(): boolean {
    return !!this.opts.listen && !this.off && canRecord();
  }

  private url(path: "tts" | "stt"): string {
    return `${this.opts.endpoint.replace(/\/+$/, "")}/${path}`;
  }

  private headers(): Record<string, string> {
    return this.opts.projectKey ? { authorization: `Bearer ${this.opts.projectKey}` } : {};
  }

  private refused(status: number): void {
    // 401/403: bad key or origin; 402: no credits or a free plan; 503: not set up. Retrying won't help.
    if ([401, 402, 403, 503].includes(status)) this.off = true;
  }

  /** A playable URL for `text` spoken in `lang`, or null (then the browser's voice is used). */
  audioFor(text: string, lang: string): Promise<string | null> {
    if (this.off) return Promise.resolve(null);
    const key = `${lang}|${text}`;
    let clip = this.clips.get(key);
    if (!clip) {
      clip = this.fetchAudio(text, lang);
      this.clips.set(key, clip);
      // Keep the 40 most recent sentences; free the rest.
      if (this.clips.size > 40) {
        const [oldKey, old] = this.clips.entries().next().value!;
        this.clips.delete(oldKey);
        void old.then((u) => u && URL.revokeObjectURL(u));
      }
      void clip.then((u) => !u && this.clips.delete(key)); // a failure may succeed later
    }
    return clip;
  }

  private async fetchAudio(text: string, lang: string): Promise<string | null> {
    try {
      const res = await fetch(this.url("tts"), {
        method: "POST",
        headers: { "content-type": "application/json", ...this.headers() },
        body: JSON.stringify({ text, lang, ...(this.opts.speaker ? { speaker: this.opts.speaker } : {}) }),
      });
      if (!res.ok) return this.refused(res.status), null;
      return URL.createObjectURL(await res.blob());
    } catch {
      return null;
    }
  }

  /** The words in a recording, or null on failure. */
  async transcribe(audio: Blob, lang: string, seconds: number, signal: AbortSignal): Promise<string | null> {
    const form = new FormData();
    form.append("file", audio, "answer.webm");
    form.append("lang", lang);
    form.append("seconds", String(Math.ceil(seconds)));
    try {
      const res = await fetch(this.url("stt"), { method: "POST", headers: this.headers(), body: form, signal });
      if (!res.ok) return this.refused(res.status), null;
      return String(((await res.json()) as { text?: unknown }).text ?? "").trim();
    } catch {
      return null;
    }
  }
}

export function canRecord(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined" && typeof AudioContext !== "undefined";
}

/**
 * Listen for one spoken answer through the Cloud: record from the mic, end the answer on
 * `silenceMs` of quiet (judged from the sound level), then transcribe it. Same contract as
 * `listenOnce`, without live interim text.
 */
export async function listenCloud(opts: ListenOptions, cloud: CloudVoice): Promise<ListenResult> {
  const none = (status: ListenResult["status"]): ListenResult => ({ text: "", status, alternatives: [] });
  const { signal } = opts;
  if (signal.aborted) return none("aborted");
  const waitMs = opts.waitMs ?? 8000;
  const silenceMs = opts.silenceMs ?? 1800;
  const maxMs = Math.min(opts.maxMs ?? 25000, 28000); // the Cloud takes up to 30 s

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    const name = (e as DOMException).name;
    return none(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
  }
  if (signal.aborted) {
    stream.getTracks().forEach((t) => t.stop());
    return none("aborted");
  }

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  const type = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const started = Date.now();
  let spokeAt = 0;
  let lastVoiceAt = 0;
  let floor = 0.01; // background noise level, learned in the first moments

  const outcome = await new Promise<"spoke" | "silent" | "aborted">((resolve) => {
    const finish = (r: "spoke" | "silent" | "aborted") => {
      clearInterval(clock);
      signal.removeEventListener("abort", onAbort);
      resolve(r);
    };
    const onAbort = () => finish("aborted");
    signal.addEventListener("abort", onAbort);
    recorder.start(250);
    const clock = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      const level = Math.sqrt(sum / samples.length);
      const now = Date.now();
      if (now - started < 300) floor = Math.max(floor, level);
      else if (level > Math.max(0.02, floor * 2.5)) {
        lastVoiceAt = now;
        spokeAt ||= now;
        opts.onInterim?.("…");
      }
      if (spokeAt && now - lastVoiceAt >= silenceMs) finish("spoke");
      else if (!spokeAt && now - started >= waitMs) finish("silent");
      else if (now - started >= maxMs) finish(spokeAt ? "spoke" : "silent");
    }, 50);
  });

  const stopped = new Promise<void>((r) => (recorder.onstop = () => r()));
  if (recorder.state !== "inactive") recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  void ctx.close();

  if (outcome !== "spoke") return none(outcome);
  const text = await cloud.transcribe(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }), opts.lang, (Date.now() - started) / 1000, signal);
  if (signal.aborted) return none("aborted");
  if (text === null) return none("unavailable");
  if (!text || isEcho(text, opts.ignore, opts.expected)) return none("silent");
  return { text, status: "ok", alternatives: [] };
}
