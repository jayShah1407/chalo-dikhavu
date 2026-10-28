import { speechLocale } from "./i18n";

// The Web Speech API is not in TypeScript's DOM lib yet; describe the parts we use.
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
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

export type ListenStatus =
  /** Heard an answer. */
  | "ok"
  /** Nobody spoke before `waitMs` ran out. */
  | "silent"
  /** The user or browser blocked the microphone. */
  | "denied"
  /** No microphone, no recognition service, or a network failure. */
  | "unavailable"
  /** Cancelled by the caller (the user started typing, the flow stopped). */
  | "aborted";

export interface ListenResult {
  /** The recognizer's best guess. */
  text: string;
  status: ListenStatus;
  /** Its other guesses for the whole answer, best first. */
  alternatives: string[];
}

export interface ListenOptions {
  lang: string;
  signal: AbortSignal;
  onInterim?: (text: string) => void;
  /** How long to wait for the user to *start* speaking. Default 8000 ms. */
  waitMs?: number;
  /**
   * How long a pause ends the answer, once they've started. Default 1800 ms:
   * long enough for "98250 … 12345", short enough not to feel stuck.
   */
  silenceMs?: number;
  /** Hard cap on one answer. Default 25000 ms. */
  maxMs?: number;
  /** What the guide just said. A transcript that is mostly this is our own voice coming back, and is dropped. */
  ignore?: string;
  /** Answers the guide offered (a choice's options). Saying one of them is never an echo. */
  expected?: string[];
}

const echoWords = (s: string) => s.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);

/**
 * Is `heard` just the guide's own question picked up by the mic? Only for 3+
 * words: a one-word answer like "Male" is legitimately also in "You can say: Male, Female".
 * An answer that is one of the `expected` options ("5 to 10 lakh") is the user, not an echo,
 * even though the guide just read that option out.
 */
export function isEcho(heard: string, spoken: string | undefined, expected: string[] = []): boolean {
  if (!spoken) return false;
  const h = echoWords(heard);
  if (h.length < 3) return false;
  const isOption = expected.some((option) => {
    const o = echoWords(option);
    return h.length <= o.length + 1 && h.filter((w) => o.includes(w)).length >= h.length - 1;
  });
  if (isOption) return false;
  const said = new Set(echoWords(spoken));
  return h.filter((w) => said.has(w)).length / h.length >= 0.8;
}

/**
 * Listen for one spoken answer after a question.
 *
 * Chrome's single-shot mode stops at the first pause (often before the user has
 * started, or halfway through a phone number) and delivers results late. So this
 * keeps recognition running continuously and decides itself when the answer is
 * over: `silenceMs` after the last thing heard. If the browser ends the session
 * early (it does after a few seconds of silence, or on a network blip), it's restarted.
 */
export function listenOnce(opts: ListenOptions): Promise<ListenResult> {
  const Ctor = recognitionCtor();
  const { signal } = opts;
  if (!Ctor) return Promise.resolve({ text: "", status: "unavailable", alternatives: [] });
  if (signal.aborted) return Promise.resolve({ text: "", status: "aborted", alternatives: [] });
  const waitMs = opts.waitMs ?? 8000;
  const silenceMs = opts.silenceMs ?? 1800;
  const maxMs = opts.maxMs ?? 25000;

  return new Promise((resolve) => {
    const started = Date.now();
    let rec: Recognition | null = null;
    let settled = false;
    let stopping = false;
    let restarts = 0;
    let lastHeardAt = 0;
    // Each segment keeps all of the recognizer's guesses, best first.
    let heardSegs: string[][] = []; // sessions that already ended
    let currentSegs: string[][] = []; // the live session
    let failure: ListenStatus | null = null;

    const join = (parts: string[]) => parts.join(" ").replace(/\s+/g, " ").trim();
    const allSegs = () => [...heardSegs, ...currentSegs];
    const text = () => join(allSegs().map((s) => s[0]));
    /** Whole-answer alternatives: the k-th guess of each segment (falling back to the best). */
    const alternatives = () => {
      const segs = allSegs();
      const depth = Math.max(0, ...segs.map((s) => s.length));
      const out: string[] = [];
      for (let k = 1; k < depth; k++) {
        const alt = join(segs.map((s) => s[k] ?? s[0]));
        if (alt && alt !== text() && !out.includes(alt)) out.push(alt);
      }
      return out;
    };
    let heard = ""; // best text so far, for the end-of-session checks below
    const finish = (status: ListenStatus) => {
      if (settled) return;
      settled = true;
      clearInterval(clock);
      signal.removeEventListener("abort", onAbort);
      if (rec) {
        rec.onresult = rec.onerror = rec.onend = null;
        try {
          rec.abort();
        } catch {
          /* already stopped */
        }
      }
      const ok = status === "ok";
      resolve({ text: ok ? text() : "", status, alternatives: ok ? alternatives() : [] });
    };
    const onAbort = () => finish("aborted");

    const begin = () => {
      const r = new Ctor();
      rec = r;
      r.lang = speechLocale(opts.lang);
      r.interimResults = true;
      r.continuous = true;
      // Names especially: "Jay" often comes back as "G" first and "Jay" second.
      r.maxAlternatives = 5;
      r.onresult = (e) => {
        // Chrome splits speech into segments at pauses. Drop any segment that is
        // just our own question coming back through the speakers.
        const segs: string[][] = [];
        for (let i = 0; i < e.results.length; i++) {
          const result = e.results[i];
          if (isEcho(result[0].transcript, opts.ignore, opts.expected)) continue;
          const guesses: string[] = [];
          for (let k = 0; k < result.length; k++) {
            const g = result[k].transcript.trim();
            if (g) guesses.push(g);
          }
          if (guesses.length) segs.push(guesses);
        }
        currentSegs = segs;
        const current = join(segs.map((s) => s[0]));
        if (current) {
          lastHeardAt = Date.now();
          opts.onInterim?.(text());
        }
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") failure = "denied";
        else if (e.error === "audio-capture" || e.error === "network" || e.error === "language-not-supported") failure = "unavailable";
        // "no-speech" and "aborted" are normal here: onend decides what happens next.
      };
      r.onend = () => {
        if (settled) return;
        heardSegs = allSegs();
        currentSegs = [];
        heard = text();
        if (failure) return finish(failure);
        if (stopping) return finish(heard ? "ok" : "silent");
        // Ended by the browser, not us. Keep listening while there's time left.
        if (heard && Date.now() - lastHeardAt >= silenceMs * 0.5) return finish("ok");
        if (restarts++ < 5 && Date.now() - started < maxMs) {
          try {
            begin();
            return;
          } catch {
            /* fall through */
          }
        }
        finish(heard ? "ok" : "silent");
      };
      r.start();
    };

    // One clock decides when the answer is over, independent of browser quirks.
    const clock = setInterval(() => {
      const now = Date.now();
      const spoke = lastHeardAt > 0;
      const done =
        (spoke && now - lastHeardAt >= silenceMs) || // they finished
        (!spoke && now - started >= waitMs) || // they never started
        now - started >= maxMs;
      if (done && !stopping) {
        stopping = true;
        try {
          rec?.stop(); // flushes the last result, then onend → finish
        } catch {
          finish(spoke ? "ok" : "silent");
        }
        // Some browsers never fire onend after stop(); don't hang on them.
        setTimeout(() => finish(lastHeardAt ? "ok" : "silent"), 1500);
      }
    }, 100);

    signal.addEventListener("abort", onAbort);
    try {
      begin();
    } catch {
      finish("unavailable");
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
