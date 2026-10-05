// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEcho, listenOnce, type ListenResult } from "../src/listen";
import { Speaker } from "../src/voice";

/**
 * Behaves like Chrome's recognizer in the ways that broke real users: it ends a
 * session on its own after a few seconds of silence, splits speech into
 * segments at pauses, delivers results late, and hears whatever the speakers play.
 */
class ChromeLikeRecognizer {
  static last: ChromeLikeRecognizer | null = null;
  static sessions = 0;
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  private segments: Array<{ transcript: string; isFinal: boolean }> = [];
  private silenceTimer: ReturnType<typeof setTimeout> | undefined;
  ended = false;

  start() {
    ChromeLikeRecognizer.last = this;
    ChromeLikeRecognizer.sessions++;
    // Chrome gives up after ~5 s with nothing said ("no-speech"), even in continuous mode.
    this.silenceTimer = setTimeout(() => {
      this.onerror?.({ error: "no-speech" });
      this.finish();
    }, 5000);
  }
  /** The user (or the speakers) produce a segment. */
  hear(text: string, isFinal = true) {
    clearTimeout(this.silenceTimer);
    const last = this.segments[this.segments.length - 1];
    if (last && !last.isFinal) last.transcript = text, (last.isFinal = isFinal);
    else this.segments.push({ transcript: text, isFinal });
    const results = this.segments.map((s) => Object.assign([{ transcript: s.transcript }], { isFinal: s.isFinal }));
    this.onresult?.({ resultIndex: 0, results });
  }
  fail(error: string) {
    this.onerror?.({ error });
    this.finish();
  }
  stop() {
    setTimeout(() => this.finish(), 300); // the last result flushes before end
  }
  abort() {
    this.finish();
  }
  private finish() {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.silenceTimer);
    this.onend?.();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  ChromeLikeRecognizer.last = null;
  ChromeLikeRecognizer.sessions = 0;
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = ChromeLikeRecognizer;
});
afterEach(() => vi.useRealTimers());

function listen(extra: Partial<Parameters<typeof listenOnce>[0]> = {}) {
  const ctl = new AbortController();
  let result: ListenResult | null = null;
  void listenOnce({ lang: "en", signal: ctl.signal, ...extra }).then((r) => (result = r));
  return { ctl, get result() { return result; } };
}
const at = async (ms: number) => vi.advanceTimersByTimeAsync(ms);
const rec = () => ChromeLikeRecognizer.last!;

describe("listenOnce on a Chrome-like recognizer", () => {
  it("waits for a user who starts speaking late, restarting when Chrome gives up early", async () => {
    const l = listen();
    await at(5200); // Chrome ended the first session after 5 s of silence
    expect(l.result).toBeNull();
    expect(ChromeLikeRecognizer.sessions).toBe(2);
    rec().hear("Jay Shah");
    await at(2500);
    expect(l.result).toEqual({ text: "Jay Shah", status: "ok" });
  });

  it("doesn't cut off a phone number spoken with a pause in the middle", async () => {
    const l = listen();
    await at(500);
    rec().hear("98250", false);
    await at(300);
    rec().hear("98250", true);
    await at(1200); // natural pause between digit groups
    expect(l.result).toBeNull();
    rec().hear("12345", true);
    await at(2500);
    expect(l.result).toEqual({ text: "98250 12345", status: "ok" });
  });

  it("keeps a late result that arrives just after it decided to stop", async () => {
    const l = listen();
    await at(300);
    rec().hear("savings", false);
    await at(1850); // silence threshold reached: stop() requested
    rec().hear("savings account", true); // Chrome flushes the final text during stop()
    await at(500);
    expect(l.result).toEqual({ text: "savings account", status: "ok" });
  });

  it("ignores the guide's own question picked up by the mic", async () => {
    const l = listen({ ignore: "What's your mobile number?" });
    await at(100);
    rec().hear("what's your mobile number"); // the speakers, not the user
    await at(2500);
    expect(l.result).toBeNull(); // still waiting for the real answer
    rec().hear("9825012345");
    await at(2500);
    expect(l.result).toEqual({ text: "9825012345", status: "ok" });
  });

  it("reports silence instead of hanging", async () => {
    const l = listen({ waitMs: 8000 });
    await at(8000 + 2000);
    expect(l.result).toEqual({ text: "", status: "silent" });
  });

  it("reports a blocked microphone", async () => {
    const l = listen();
    await at(50);
    rec().fail("not-allowed");
    await at(50);
    expect(l.result).toEqual({ text: "", status: "denied" });
  });

  it("stops at once when the user starts typing", async () => {
    const l = listen();
    await at(50);
    rec().hear("Ja", false);
    l.ctl.abort();
    await at(10);
    expect(l.result).toEqual({ text: "", status: "aborted" });
  });
});

describe("isEcho", () => {
  it("drops our own words but never a short real answer", () => {
    expect(isEcho("which gender you can say male female", "Which gender? You can say: Male, Female, Transgender.")).toBe(true);
    expect(isEcho("male", "Which gender? You can say: Male, Female, Transgender.")).toBe(false);
    expect(isEcho("the second one", "Which gender? You can say: Male, Female.")).toBe(false);
    expect(isEcho("Jay Shah", undefined)).toBe(false);
  });
});

describe("Speaker", () => {
  it("doesn't report 'finished' while the browser is still speaking, even if Chrome fires an early error", async () => {
    let speaking = false;
    const synth = {
      speaking: false,
      pending: false,
      getVoices: () => [],
      cancel: () => (speaking = false),
      speak: (u: { onerror?: (e: unknown) => void }) => {
        speaking = true;
        u.onerror?.({ error: "interrupted" }); // Chrome's spurious early event after cancel()
        setTimeout(() => (speaking = false), 3000); // the real audio lasts 3 s
      },
    };
    Object.defineProperty(synth, "speaking", { get: () => speaking });
    (globalThis as unknown as { speechSynthesis: unknown }).speechSynthesis = synth;
    (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      lang = "";
      voice = null;
      constructor(public text: string) {}
    };

    let finished = false;
    void new Speaker(true).play("What's your mobile number?", undefined, "en").then(() => (finished = true));
    await at(1500);
    expect(finished).toBe(false); // the old code resolved here and opened the mic over its own voice
    await at(2000);
    expect(finished).toBe(true);
  });
});
