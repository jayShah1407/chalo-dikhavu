import { speechLocale } from "./i18n";

// The Web Speech API is not in TypeScript's DOM lib yet; describe the parts we use.
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen(): boolean {
  return typeof window !== "undefined" && recognitionCtor() !== null;
}

/**
 * Listen for one answer after a question: stops by itself after a pause.
 * Resolves "" if nothing was heard, voice is unavailable, or `signal` aborts;
 * the caller then keeps waiting for a typed answer instead.
 */
export function listenOnce(lang: string, signal: AbortSignal, onInterim?: (text: string) => void, maxMs = 12000): Promise<string> {
  const Ctor = recognitionCtor();
  if (!Ctor || signal.aborted) return Promise.resolve("");
  return new Promise((resolve) => {
    const rec = new Ctor();
    rec.lang = speechLocale(lang);
    rec.interimResults = true;
    rec.continuous = false;
    let heard = "";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(heard.trim());
    };
    const onAbort = () => {
      heard = "";
      rec.abort();
      finish();
    };
    rec.onresult = (e) => {
      heard = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(" ");
      onInterim?.(heard);
    };
    rec.onerror = finish;
    rec.onend = finish;
    const timer = setTimeout(() => rec.stop(), maxMs);
    signal.addEventListener("abort", onAbort);
    try {
      rec.start();
    } catch {
      finish();
    }
  });
}

/**
 * Push-to-talk speech recognition: start() when the key goes down,
 * finish() when it comes up, and get the whole transcript back.
 */
export class Listener {
  private rec: Recognition | null = null;
  private transcript = "";
  private settle: ((text: string) => void) | null = null;

  constructor(private readonly onInterim: (text: string) => void) {}

  start(lang: string): boolean {
    const Ctor = recognitionCtor();
    if (!Ctor) return false;
    this.cancel();
    const rec = new Ctor();
    rec.lang = speechLocale(lang);
    rec.interimResults = true;
    rec.continuous = true;
    this.transcript = "";

    rec.onresult = (e) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      this.transcript = (finalText + " " + interim).trim();
      this.onInterim(this.transcript);
    };
    rec.onerror = () => this.end();
    rec.onend = () => this.end();

    this.rec = rec;
    try {
      rec.start();
    } catch {
      this.rec = null;
      return false;
    }
    return true;
  }

  /** Stop listening and resolve with what was heard (may be ""). */
  finish(): Promise<string> {
    if (!this.rec) return Promise.resolve(this.transcript);
    return new Promise((resolve) => {
      this.settle = resolve;
      this.rec?.stop(); // onend fires once the last result is delivered
      // Some browsers never fire onend after an error; don't hang the UI.
      setTimeout(() => this.end(), 1500);
    });
  }

  cancel(): void {
    this.settle = null;
    this.rec?.abort();
    this.rec = null;
  }

  private end(): void {
    this.rec = null;
    const settle = this.settle;
    this.settle = null;
    settle?.(this.transcript);
  }
}
