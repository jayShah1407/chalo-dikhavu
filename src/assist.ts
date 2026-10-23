import { parseAnswer, parseYesNo, type Parsed } from "./answers";
import { isSubmitButton, type FieldInfo } from "./fields";
import { isQuestion } from "./explain";
import { clickElement, fillField } from "./fill";
import { pick, ui } from "./i18n";
import { listenOnce } from "./listen";
import type { AnswerBox, BubbleButton, Overlay } from "./overlay";
import { buttonLabel, questionFor } from "./prompts";
import type { FieldOptions, LocalizedText, ChaloDikhavuEvent } from "./types";
import type { Speaker } from "./voice";

/**
 * "Do it with me" mode: ask the user for each value (by voice or typing),
 * read it back, and fill it in for them while the cursor shows where it goes.
 * Sensitive fields and final submits are always left to the user.
 */

export type Outcome = "next" | "stop";

/** What the assistant needs from the engine. */
export interface AssistHost {
  overlay: Overlay;
  speaker: Speaker;
  lang: string;
  flowId: string;
  signal: AbortSignal;
  /** Voice input is available (browser supports it, and the mic hasn't been blocked). */
  voice: boolean;
  /** The mic was blocked: stop trying voice for the rest of this session. */
  disableVoice(): void;
  /** Listening timings from ChaloDikhavuOptions.speech. */
  speech?: { waitMs?: number; silenceMs?: number };
  emit(event: ChaloDikhavuEvent): void;
  stopButton(): BubbleButton;
  /**
   * While a question is open, push-to-talk transcripts go to `sink` instead of
   * starting a new search, and `cancelAuto` stops the automatic listener first.
   */
  setAnswerSink(sink: ((text: string) => void) | null, cancelAuto?: () => void): void;
  /** An AI is configured, so free-form questions can be answered. */
  canExplain: boolean;
  /**
   * Answer a question about `field`: its own `why` text when that fits,
   * otherwise the AI. Always resolves with something to say (errors included).
   */
  explain(question: string, field: FieldInfo, why: LocalizedText | undefined, preferWhy: boolean): Promise<string>;
}

/** `alternatives`: the recognizer's other guesses, best first (voice only). */
type Answer = { text: string; typed: boolean; alternatives?: string[] };
type AskResult = Answer | "skip" | "stop" | "why";

/** Resolve via `done` from inside `setup`; runs teardown on resolve or when the flow is stopped. */
function pending<T>(signal: AbortSignal, onAbort: T, setup: (done: (v: T) => void) => (() => void) | void): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    let teardown: (() => void) | void;
    const done = (v: T) => {
      if (settled) return;
      settled = true;
      teardown?.();
      signal.removeEventListener("abort", abort);
      resolve(v);
    };
    const abort = () => done(onAbort);
    if (signal.aborted) return resolve(onAbort);
    signal.addEventListener("abort", abort);
    teardown = setup(done);
    if (settled) teardown?.();
  });
}

const sleep = (ms: number, signal: AbortSignal) =>
  pending<void>(signal, undefined, (done) => {
    const t = setTimeout(done, ms);
    return () => clearTimeout(t);
  });

async function bringIntoView(el: Element, signal: AbortSignal): Promise<void> {
  const r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    await sleep(400, signal);
  }
}

/** Advance when the user changes `el` themselves (typing a password, picking a time). */
function onUserChange(el: Element, then: () => void): () => void {
  const handler = (e: Event) => {
    if (e.composedPath().includes(el)) setTimeout(then, 300);
  };
  document.addEventListener("change", handler, true);
  return () => document.removeEventListener("change", handler, true);
}

function inputTypeFor(info: FieldInfo): string {
  if (info.kind === "email") return "email";
  if (info.kind === "phone" || info.kind === "pincode") return "tel";
  return "text";
}

/**
 * Parse an answer, trying the recognizer's other guesses if the best one doesn't
 * fit the field: "G" is no name, but the second guess "Jay" is.
 */
function parseBest(info: FieldInfo, answer: Answer): Parsed {
  let first: Parsed | undefined;
  for (const candidate of [answer.text, ...(answer.alternatives ?? [])]) {
    const parsed = parseAnswer(info, candidate, answer.typed);
    if (parsed.ok) return parsed;
    first ??= parsed;
  }
  return first ?? { ok: false };
}

/** "A mobile number has 10 digits. I heard 9." beats "Sorry, I didn't catch that." */
function retryText(lang: string, parsed: Parsed): string {
  return !parsed.ok && parsed.why ? ui(lang, parsed.why, parsed.vars) : ui(lang, "retry");
}

/**
 * After filling: did the site reject the value? Native validity (type="email",
 * pattern…) or aria-invalid set by the site's own validation. Returns its message.
 */
export function rejectedBySite(info: FieldInfo): string | null {
  if (info.kind === "choice" || info.kind === "check") return null;
  const el = info.el as HTMLInputElement;
  const native = !!el.validity && !el.validity.valid && !el.validity.valueMissing;
  if (!native && el.getAttribute("aria-invalid") !== "true") return null;
  const ids = el.getAttribute("aria-errormessage") ?? el.getAttribute("aria-describedby") ?? "";
  const linked = ids.split(/\s+/).map((id) => (id ? document.getElementById(id)?.textContent?.trim() : "")).filter(Boolean).join(" ");
  return (el.validationMessage || linked).replace(/\s+/g, " ").slice(0, 160);
}

/** Pause after the guide stops talking before opening the mic, so room echo dies down. */
const ECHO_GAP_MS = 350;

/**
 * One spoken exchange: say `prompt`, wait until the speech has *really* ended
 * (plus an echo gap), then listen, showing the mic state in the bubble the
 * whole time. Silence or a blocked mic never leaves the user stuck: they see
 * what happened and can tap 🎤 to try again, or type.
 */
function voiceTurn(
  host: AssistHost,
  prompt: string,
  audio: LocalizedText | undefined,
  accept: (heard: string, alternatives: string[]) => boolean,
  unusable: string,
  /** Short replies like "yes" don't need the long end-of-answer pause. */
  shortReply = false,
) {
  const { overlay, lang } = host;
  let listening: AbortController | null = null;
  let closed = false;
  let typing = false;

  const cancel = () => {
    listening?.abort();
    listening = null;
    overlay.showListening(false);
  };

  const listen = async (): Promise<void> => {
    cancel();
    if (closed) return;
    if (!host.voice) return overlay.setMicState("problem", ui(lang, "micUnavailable"));
    host.speaker.stop(); // tapped 🎤 mid-sentence: stop talking first, never listen over ourselves
    typing = false;
    const mine = new AbortController();
    listening = mine;
    // The bubble shows the mic state and the words as they're heard; the floating
    // "Listening…" pill is for push-to-talk outside a question, and here it would cover the buttons.
    overlay.setMicState("listening", ui(lang, "listeningNow"));
    const r = await listenOnce({
      lang,
      signal: mine.signal,
      ignore: prompt,
      onInterim: (t) => overlay.setMicState("listening", `${ui(lang, "listeningNow")}: “${t}”`),
      ...host.speech,
      ...(shortReply ? { silenceMs: Math.min(1000, host.speech?.silenceMs ?? 1000) } : {}),
    });
    if (mine.signal.aborted || closed) return;
    listening = null;
    overlay.showListening(false);
    if (r.status === "ok") {
      if (!accept(r.text, r.alternatives)) overlay.setMicState("idle", unusable);
      return;
    }
    if (r.status === "denied") {
      host.disableVoice();
      return overlay.setMicState("problem", ui(lang, "micBlocked"));
    }
    if (r.status === "unavailable") return overlay.setMicState("problem", ui(lang, "micUnavailable"));
    overlay.setMicState("idle", ui(lang, "notHeard"));
  };

  return {
    /** Speak, then listen automatically (unless the user already typed or tapped 🎤). */
    async start(): Promise<void> {
      await host.speaker.play(prompt, audio, lang);
      if (closed || typing || listening || host.signal.aborted) return;
      await sleep(ECHO_GAP_MS, host.signal);
      if (closed || typing || listening || host.signal.aborted) return;
      if (host.voice) await listen();
    },
    listen,
    /** Push-to-talk took over the mic. */
    cancel,
    /** The user is typing: stop listening, and don't auto-start later. */
    typing(): void {
      typing = true;
      cancel();
      overlay.setMicState("idle", "");
    },
    close(): void {
      closed = true;
      cancel();
    },
  };
}

/**
 * Ask one question and wait for an answer: spoken (auto-listen after the
 * question, the 🎤 button, or push-to-talk) or typed into the bubble.
 */
function askOnce(
  host: AssistHost,
  info: FieldInfo,
  meta: string,
  prompt: string,
  audio: LocalizedText | undefined,
  canSkip: boolean,
  canAskWhy: boolean,
): Promise<AskResult> {
  const { overlay, lang, signal } = host;
  return pending<AskResult>(signal, "stop", (done) => {
    const turn = voiceTurn(host, prompt, audio, (text, alternatives) => (done({ text, typed: false, alternatives }), true), ui(lang, "notHeard"));
    const buttons: BubbleButton[] = [host.stopButton()];
    if (canAskWhy) buttons.push({ label: ui(lang, "why"), onClick: () => done("why") });
    if (canSkip) buttons.push({ label: ui(lang, "skip"), onClick: () => done("skip") });
    const box: AnswerBox = {
      placeholder: ui(lang, "answerPlaceholder"),
      type: inputTypeFor(info),
      onSubmit: (text) => done({ text, typed: true }),
      onTyping: () => turn.typing(),
      onMic: host.voice ? () => void turn.listen() : undefined,
    };
    overlay.showStep(info.point, meta, prompt, buttons, box);
    void overlay.moveCursor();
    host.setAnswerSink((text) => done({ text, typed: false }), () => turn.cancel());
    void turn.start();
    return () => {
      turn.close();
      host.setAnswerSink(null);
    };
  });
}

/** "I heard: 98250 12345. Is that right?" — yes/no by voice, typing or button. */
/**
 * "I heard: Jay Shah. Is that right?" The heard value sits in an editable box:
 * the user can say yes/no, fix it by typing (names are where speech-to-text
 * fails most), or simply say the corrected value. Resolves true/false, or the
 * correction as a new Answer.
 */
type Confirmed = boolean | "stop" | Answer;
function confirmValue(host: AssistHost, info: FieldInfo, meta: string, display: string): Promise<Confirmed> {
  const { overlay, lang, signal } = host;
  return pending<Confirmed>(signal, "stop", (done) => {
    const spoken = ui(lang, "heard", { value: display });
    const byVoice = (t: string, alternatives: string[] = []) => {
      const yes = parseYesNo(t);
      if (yes !== null) return done(yes), true;
      // Not yes/no: maybe they just said the right value. Treat it as a correction.
      if (!isQuestion(t) && [t, ...alternatives].some((c) => parseAnswer(info, c).ok)) {
        return done({ text: t, typed: false, alternatives }), true;
      }
      return false;
    };
    const turn = voiceTurn(host, spoken, undefined, byVoice, ui(lang, "sayYesNo"), info.kind !== "name" && info.kind !== "text");
    overlay.showStep(info.point, meta, `${spoken}\n${ui(lang, "fixBelow")}`, [
      host.stopButton(),
      { label: ui(lang, "no"), onClick: () => done(false) },
      { label: ui(lang, "yes"), primary: true, onClick: () => done(true) },
    ], {
      placeholder: ui(lang, "sayYesNo"),
      value: display,
      type: inputTypeFor(info),
      onSubmit: (t) => {
        // Enter on the untouched value = "yes"; an edited value is the correction.
        if (t.trim() === display) return done(true);
        const yes = parseYesNo(t);
        done(yes !== null && t.trim().split(/\s+/).length <= 2 ? yes : { text: t, typed: true });
      },
      onTyping: () => turn.typing(),
      onMic: host.voice ? () => void turn.listen() : undefined,
    });
    host.setAnswerSink((t) => {
      if (!byVoice(t)) overlay.setMicState("idle", ui(lang, "sayYesNo"));
    }, () => turn.cancel());
    void turn.start();
    return () => {
      turn.close();
      host.setAnswerSink(null);
    };
  });
}

/**
 * Point at the field and wait for the user to fill it themselves. They can still
 * ask why it's needed (the question is about the field, never its value).
 */
async function userFills(host: AssistHost, info: FieldInfo, meta: string, text: string, why?: LocalizedText): Promise<Outcome> {
  const { overlay, lang, signal } = host;
  host.emit({ type: "field:manual", flowId: host.flowId, label: info.label });
  const canAskWhy = host.canExplain || why !== undefined;
  let shown = text;
  for (let asked = 0; ; asked++) {
    const result = await pending<Outcome | "why">(signal, "stop", (done) => {
      const buttons: BubbleButton[] = [host.stopButton()];
      if (canAskWhy && asked < 3) buttons.push({ label: ui(lang, "why"), onClick: () => done("why") });
      buttons.push({ label: ui(lang, "next"), primary: true, onClick: () => done("next") });
      overlay.showStep(info.point, meta, shown, buttons);
      void overlay.moveCursor();
      void host.speaker.play(shown, undefined, lang);
      return onUserChange(info.el, () => done("next"));
    });
    if (result !== "why") return result;
    overlay.showStep(info.point, meta, ui(lang, "thinking"), [host.stopButton()]);
    const explanation = await host.explain(ui(lang, "why"), info, why, true);
    if (signal.aborted) return "stop";
    shown = `${explanation}\n\n${text}`;
  }
}

async function put(host: AssistHost, info: FieldInfo, meta: string, parsed: Extract<Parsed, { ok: true }>): Promise<void> {
  host.overlay.showStep(info.point, meta, `${info.label}: ${parsed.display}`, [host.stopButton()]);
  await host.overlay.moveCursor();
  await fillField(info, parsed.value, host.signal);
  await sleep(350, host.signal);
}

/** Fill one field with the user: ask, understand, confirm, type it in. */
export async function assistField(host: AssistHost, info: FieldInfo, opts: FieldOptions & { audio?: LocalizedText }, meta: string): Promise<Outcome> {
  const { lang, signal } = host;
  await bringIntoView(info.point, signal);
  if (signal.aborted) return "stop";

  if (opts.value !== undefined) {
    const parsed = parseAnswer(info, opts.value, true);
    const value = parsed.ok ? parsed : { ok: true as const, value: opts.value, display: opts.value };
    await put(host, info, meta, value);
    host.emit({ type: "field:filled", flowId: host.flowId, label: info.label, by: "preset" });
    return signal.aborted ? "stop" : "next";
  }

  if (opts.sensitive ?? info.sensitive) return userFills(host, info, meta, ui(lang, "typeYourself", { label: info.label }), opts.why);
  if (info.kind === "manual") {
    const upload = (info.el as HTMLInputElement).type === "file";
    return userFills(host, info, meta, ui(lang, upload ? "uploadYourself" : "fillYourself", { label: info.label }), opts.why);
  }

  const question = opts.ask ? pick(opts.ask, lang) : questionFor(info, lang);
  const canSkip = opts.optional ?? !info.required;
  const canAskWhy = host.canExplain || opts.why !== undefined;
  let prompt = question;
  let audio = opts.audio;
  let explained = 0;
  for (let attempt = 0; attempt < 3; ) {
    const answer = await askOnce(host, info, meta, prompt, audio, canSkip, canAskWhy);
    audio = undefined; // the recording matches the original question only
    if (answer === "stop") return "stop";
    if (answer === "skip") return "next";

    // "Why is this needed?" — tapped, or asked instead of answering.
    const tapped = answer === "why";
    const asked = tapped ? ui(lang, "why") : isQuestion(answer.text) ? answer.text : null;
    if (asked !== null) {
      // Cap explanations per field: each one can be an AI call that costs tokens.
      if (explained++ < 5) {
        host.overlay.showStep(info.point, meta, ui(lang, "thinking"), [host.stopButton()]);
        const explanation = await host.explain(asked, info, opts.why, tapped);
        if (signal.aborted) return "stop";
        // Explain, then put the same question again so the form carries on.
        prompt = `${explanation}\n\n${question}`;
      } else {
        prompt = question;
      }
      continue;
    }
    if (tapped) continue; // unreachable; narrows `answer` for TypeScript

    attempt++;
    let parsed = parseBest(info, answer);
    if (!parsed.ok) {
      prompt = `${retryText(lang, parsed)}\n\n${question}`;
      continue;
    }
    // Speech gets misheard; typed answers are what the user meant.
    let typed = answer.typed;
    let rejected = false;
    while (!typed && info.kind !== "check" && parsed.ok) {
      const verdict = await confirmValue(host, info, meta, parsed.display);
      if (verdict === "stop") return "stop";
      if (verdict === true) break;
      if (verdict === false) {
        rejected = true;
        break;
      }
      // A correction: typed ones go straight in, spoken ones are read back again.
      parsed = parseBest(info, verdict);
      typed = verdict.typed;
    }
    if (rejected || !parsed.ok) {
      prompt = rejected ? question : `${retryText(lang, parsed)}\n\n${question}`;
      continue;
    }
    await put(host, info, meta, parsed);
    if (signal.aborted) return "stop";
    const problem = rejectedBySite(info);
    if (problem !== null) {
      prompt = `${problem ? ui(lang, "siteInvalid", { message: problem }) : ui(lang, "hintFormat")}\n\n${question}`;
      continue;
    }
    host.emit({ type: "field:filled", flowId: host.flowId, label: info.label, by: typed ? "typed" : "voice" });
    return signal.aborted ? "stop" : "next";
  }
  return userFills(host, info, meta, ui(lang, "fillYourself", { label: info.label }), opts.why);
}

/**
 * Click a button for the user, except submit buttons (and `confirm: "user"`):
 * those they press themselves after checking, so nothing is submitted for them.
 */
export async function assistClick(host: AssistHost, el: Element, meta: string, say: string, confirm?: "user" | "auto"): Promise<Outcome> {
  const { overlay, lang, signal } = host;
  const label = buttonLabel(el);
  await bringIntoView(el, signal);
  if (signal.aborted) return "stop";

  const byUser = confirm === "user" || (confirm !== "auto" && isSubmitButton(el));
  if (byUser) {
    const text = say || ui(lang, "pressYourself", { label });
    return pending<Outcome>(signal, "stop", (done) => {
      overlay.showStep(el, meta, text, [host.stopButton()]);
      void overlay.moveCursor();
      void host.speaker.play(text, undefined, lang);
      const onClick = (e: Event) => {
        if (!overlay.owns(e) && e.composedPath().includes(el)) setTimeout(() => done("next"), 150);
      };
      document.addEventListener("click", onClick, true);
      return () => document.removeEventListener("click", onClick, true);
    });
  }

  const text = say || ui(lang, "clicking", { label });
  overlay.showStep(el, meta, text, [host.stopButton()]);
  await Promise.all([overlay.moveCursor(), host.speaker.play(text, undefined, lang)]);
  if (signal.aborted) return "stop";
  clickElement(el);
  await sleep(500, signal);
  return signal.aborted ? "stop" : "next";
}
