import { pick, speechLocale } from "./i18n";
import type { LocalizedText } from "./types";

/**
 * Plays a step's recorded audio, or speaks its text with the browser's
 * text-to-speech when there is no recording (or it fails to load).
 */
export class Speaker {
  muted = false;
  private audio: HTMLAudioElement | null = null;

  constructor(private readonly tts: boolean) {}

  play(text: string, audio: LocalizedText | undefined, lang: string): void {
    this.stop();
    if (this.muted) return;
    const url = pick(audio, lang);
    if (url) {
      const el = new Audio(url);
      this.audio = el;
      el.play().catch(() => {
        // Missing file or autoplay blocked before any user gesture: fall back to TTS.
        if (this.audio === el) this.speak(text, lang);
      });
      return;
    }
    this.speak(text, lang);
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }

  private speak(text: string, lang: string): void {
    if (!this.tts || !text || typeof speechSynthesis === "undefined") return;
    const utter = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}]/gu, ""));
    const locale = speechLocale(lang);
    utter.lang = locale;
    const voices = speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang === locale) ?? voices.find((v) => v.lang.startsWith(lang + "-"));
    if (voice) utter.voice = voice;
    speechSynthesis.speak(utter);
  }
}
