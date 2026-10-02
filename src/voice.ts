import { pick, speechLocale } from "./i18n";
import type { LocalizedText } from "./types";

/**
 * Plays a step's recorded audio, or speaks its text with the browser's
 * text-to-speech when there is no recording (or it fails to load).
 * `play` resolves when speaking ends, so the mic never opens mid-sentence
 * and hears the guide's own voice.
 */
export class Speaker {
  muted = false;
  private audio: HTMLAudioElement | null = null;
  private finish: (() => void) | null = null;

  constructor(private readonly tts: boolean) {}

  play(text: string, audio: LocalizedText | undefined, lang: string): Promise<void> {
    this.stop();
    if (this.muted) return Promise.resolve();
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (this.finish !== done) return;
        this.finish = null;
        clearTimeout(timer);
        resolve();
      };
      this.finish = done;
      // Browsers sometimes never fire `end` (Chrome TTS, blocked audio); never hang.
      timer = setTimeout(done, 1500 + text.length * 90);

      const url = pick(audio, lang);
      if (url) {
        const el = new Audio(url);
        this.audio = el;
        el.onended = done;
        el.play().catch(() => {
          // Missing file or autoplay blocked before any user gesture: fall back to TTS.
          if (this.audio === el) this.speak(text, lang, done);
        });
        return;
      }
      this.speak(text, lang, done);
    });
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.finish?.();
  }

  private speak(text: string, lang: string, done: () => void): void {
    if (!this.tts || !text || typeof speechSynthesis === "undefined") return done();
    const utter = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}]/gu, ""));
    const locale = speechLocale(lang);
    utter.lang = locale;
    const voices = speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang === locale) ?? voices.find((v) => v.lang.startsWith(lang + "-"));
    if (voice) utter.voice = voice;
    utter.onend = done;
    utter.onerror = done;
    speechSynthesis.speak(utter);
  }
}
