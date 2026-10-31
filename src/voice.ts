import type { CloudVoice } from "./cloudvoice";
import { pick, speechLocale } from "./i18n";
import type { LocalizedText } from "./types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sentences, kept under ~180 chars: Chrome cuts long utterances off after ~15 s. */
function chunks(text: string): string[] {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?।]+[.!?।]*/g) ?? [text];
  const out: string[] = [];
  for (const s of sentences.map((x) => x.trim()).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last && last.length + s.length < 180) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
  }
  return out;
}

/**
 * Plays a step's recorded audio, or speaks its text with the browser's
 * text-to-speech when there is no recording (or it fails to load).
 *
 * `play` resolves only when the audio has really finished, so the mic is never
 * opened while the guide is still talking (and never hears itself). Chrome's
 * `end`/`error` events can't be trusted for that, as they fire early, especially
 * right after a cancel, so the actual `speechSynthesis.speaking` state decides.
 */
export class Speaker {
  muted = false;
  private audio: HTMLAudioElement | null = null;
  private finish: (() => void) | null = null;
  private generation = 0;

  constructor(private readonly tts: boolean, private readonly cloud?: CloudVoice) {}

  /**
   * `personal`: the text contains something the user said or typed. It's spoken by the
   * browser, never sent to the Cloud.
   */
  play(text: string, audio: LocalizedText | undefined, lang: string, personal = false): Promise<void> {
    this.stop();
    if (this.muted) return Promise.resolve();
    const gen = ++this.generation;
    return new Promise((resolve) => {
      let poll: ReturnType<typeof setInterval> | undefined;
      let cap: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (this.finish !== done) return;
        this.finish = null;
        clearInterval(poll);
        clearTimeout(cap);
        resolve();
      };
      this.finish = done;
      // Last-resort cap so a stuck speech engine can never freeze a flow.
      cap = setTimeout(done, 3000 + text.length * 140);

      const fallback = () => void this.speak(text, lang, gen, done, (p) => (poll = p));
      const playUrl = (url: string) => {
        const el = new Audio(url);
        this.audio = el;
        el.onended = done;
        el.onerror = () => this.audio === el && fallback();
        // Missing file or autoplay blocked before any user gesture: fall back to TTS.
        el.play().catch(() => this.audio === el && fallback());
      };
      const url = pick(audio, lang);
      if (url) return playUrl(url);
      if (this.cloud && this.tts && !personal) {
        void this.cloud.audioFor(text, lang).then((cloudUrl) => {
          if (gen !== this.generation) return;
          if (cloudUrl) playUrl(cloudUrl);
          else fallback();
        });
        return;
      }
      fallback();
    });
  }

  stop(): void {
    this.generation++;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.finish?.();
  }

  private async speak(text: string, lang: string, gen: number, done: () => void, setPoll: (p: ReturnType<typeof setInterval>) => void): Promise<void> {
    const synth = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
    const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
    if (!this.tts || !clean || !synth) return done();
    // Chrome drops or instantly "ends" an utterance queued right after cancel().
    await wait(80);
    if (gen !== this.generation) return;

    const locale = speechLocale(lang);
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang === locale) ?? voices.find((v) => v.lang.startsWith(lang + "-"));
    for (const part of chunks(clean)) {
      const utter = new SpeechSynthesisUtterance(part);
      utter.lang = locale;
      if (voice) utter.voice = voice;
      synth.speak(utter);
    }

    // Finished = the engine started and then went quiet for a moment. If it
    // never starts (no voice installed for this language), give up after 2.5 s.
    const began = Date.now();
    let started = false;
    let quietSince = 0;
    setPoll(setInterval(() => {
      const busy = synth.speaking || synth.pending;
      if (busy) {
        started = true;
        quietSince = 0;
        return;
      }
      if (!started) {
        if (Date.now() - began > 2500) done();
        return;
      }
      quietSince ||= Date.now();
      if (Date.now() - quietSince >= 250) done(); // gaps between sentences are shorter
    }, 50));
  }
}
