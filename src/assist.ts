import { parseAnswer, parseYesNo, type Parsed } from "./answers";
import { isSubmitButton, type FieldInfo } from "./fields";
import { clickElement, fillField } from "./fill";
import { pick, ui } from "./i18n";
import { listenOnce } from "./listen";
import type { AnswerBox, BubbleButton, Overlay } from "./overlay";
import { buttonLabel, questionFor } from "./prompts";
import type { FieldOptions, LocalizedText, RaahiEvent } from "./types";
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
  /** Voice input is available in this browser. */
  voice: boolean;
  emit(event: RaahiEvent): void;
  stopButton(): BubbleButton;
  /**
   * While a question is open, push-to-talk transcripts go to `sink` instead of
   * starting a new search, and `cancelAuto` stops the automatic listener first.
   */
  setAnswerSink(sink: ((text: string) => void) | null, cancelAuto?: () => void): void;
}

type Answer = { text: string; typed: boolean };

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
 * Ask one question and wait for an answer: spoken (auto-listen after the
 * question, or push-to-talk) or typed into the bubble. Whichever comes first.
 */
function askOnce(
  host: AssistHost,
  info: FieldInfo,
  meta: string,
  prompt: string,
  audio: LocalizedText | undefined,
  canSkip: boolean,
): Promise<Answer | "skip" | "stop"> {
  const { overlay, lang, signal } = host;
  return pending<Answer | "skip" | "stop">(signal, "stop", (done) => {
    const auto = new AbortController();
    const buttons: BubbleButton[] = [host.stopButton()];
    if (canSkip) buttons.push({ label: ui(lang, "skip"), onClick: () => done("skip") });
    const box: AnswerBox = {
      placeholder: ui(lang, "answerPlaceholder"),
      type: inputTypeFor(info),
      onSubmit: (text) => done({ text, typed: true }),
      onTyping: () => auto.abort(),
    };
    overlay.showStep(info.point, meta, prompt, buttons, box);
    void overlay.moveCursor();
    host.setAnswerSink((text) => done({ text, typed: false }), () => auto.abort());

    void (async () => {
      await host.speaker.play(prompt, audio, lang);
      if (auto.signal.aborted || signal.aborted || !host.voice) return;
      overlay.showListening(true);
      const heard = await listenOnce(lang, auto.signal, (t) => overlay.showListening(true, t));
      if (!auto.signal.aborted) overlay.showListening(false);
      // Nothing heard: keep waiting for typing or push-to-talk rather than nagging.
      if (heard) done({ text: heard, typed: false });
    })();

    return () => {
      auto.abort();
      host.setAnswerSink(null);
      overlay.showListening(false);
    };
  });
}

/** "I heard: 98250 12345. Is that right?" — yes/no by voice or button. */
function confirmValue(host: AssistHost, info: FieldInfo, meta: string, display: string): Promise<boolean | "stop"> {
  const { overlay, lang, signal } = host;
  return pending<boolean | "stop">(signal, "stop", (done) => {
    const auto = new AbortController();
    const text = ui(lang, "heard", { value: display });
    overlay.showStep(info.point, meta, text, [
      host.stopButton(),
      { label: ui(lang, "no"), onClick: () => done(false) },
      { label: ui(lang, "yes"), primary: true, onClick: () => done(true) },
    ]);
    host.setAnswerSink((t) => {
      const yes = parseYesNo(t);
      if (yes !== null) done(yes);
    }, () => auto.abort());

    void (async () => {
      await host.speaker.play(text, undefined, lang);
      if (auto.signal.aborted || signal.aborted || !host.voice) return;
      overlay.showListening(true);
      const heard = await listenOnce(lang, auto.signal, (t) => overlay.showListening(true, t), 6000);
      if (!auto.signal.aborted) overlay.showListening(false);
      const yes = parseYesNo(heard);
      if (yes !== null) done(yes);
    })();

    return () => {
      auto.abort();
      host.setAnswerSink(null);
      overlay.showListening(false);
    };
  });
}

/** Point at the field and wait for the user to fill it themselves. */
function userFills(host: AssistHost, info: FieldInfo, meta: string, text: string): Promise<Outcome> {
  const { overlay, lang, signal } = host;
  host.emit({ type: "field:manual", flowId: host.flowId, label: info.label });
  return pending<Outcome>(signal, "stop", (done) => {
    overlay.showStep(info.point, meta, text, [
      host.stopButton(),
      { label: ui(lang, "next"), primary: true, onClick: () => done("next") },
    ]);
    void overlay.moveCursor();
    void host.speaker.play(text, undefined, lang);
    return onUserChange(info.el, () => done("next"));
  });
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

  if (opts.sensitive ?? info.sensitive) return userFills(host, info, meta, ui(lang, "typeYourself", { label: info.label }));
  if (info.kind === "manual") return userFills(host, info, meta, ui(lang, "fillYourself", { label: info.label }));

  const question = opts.ask ? pick(opts.ask, lang) : questionFor(info, lang);
  const canSkip = opts.optional ?? !info.required;
  let prompt = question;
  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = await askOnce(host, info, meta, prompt, attempt === 0 ? opts.audio : undefined, canSkip);
    if (answer === "stop") return "stop";
    if (answer === "skip") return "next";

    const parsed = parseAnswer(info, answer.text, answer.typed);
    if (!parsed.ok) {
      prompt = `${ui(lang, "retry")}\n\n${question}`;
      continue;
    }
    // Speech gets misheard; typed answers are what the user meant.
    if (!answer.typed && info.kind !== "check") {
      const ok = await confirmValue(host, info, meta, parsed.display);
      if (ok === "stop") return "stop";
      if (!ok) {
        prompt = question;
        continue;
      }
    }
    await put(host, info, meta, parsed);
    host.emit({ type: "field:filled", flowId: host.flowId, label: info.label, by: answer.typed ? "typed" : "voice" });
    return signal.aborted ? "stop" : "next";
  }
  return userFills(host, info, meta, ui(lang, "fillYourself", { label: info.label }));
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
