import { assistClick, assistField, type AssistHost } from "./assist";
import { buildRequest, callAi, wantsExplanation } from "./explain";
import { collectFields, describeField, selectorFor, submitButtonOf, type FieldInfo } from "./fields";
import { findNow, waitFor } from "./finder";
import { pick, ui } from "./i18n";
import { flowTitle, rankFlows, resolve } from "./intent";
import { CloudVoice, listenCloud } from "./cloudvoice";
import { canListen, listenOnce, Listener } from "./listen";
import { Overlay, type BubbleButton } from "./overlay";
import { isStaticPath, matchPath } from "./paths";
import { buttonLabel, guideTextFor } from "./prompts";
import type { Flow, LocalizedText, ChaloDikhavuEvent, ChaloDikhavuOptions, RunMode, Step } from "./types";
import { Speaker } from "./voice";

const STATE_KEY = "chalo-dikhavu:run";
const LANG_KEY = "chalo-dikhavu:lang";

type Outcome = "next" | "stop";

/** A step generated from a `form` step, carrying the element it was made from. */
type FieldStep = Step & { el?: Element };

function storage(kind: "session" | "local"): Storage | null {
  try {
    return kind === "session" ? sessionStorage : localStorage;
  } catch {
    return null; // blocked cookies / sandboxed iframe
  }
}

function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

function isFormControl(el: Element): boolean {
  return /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((res) => {
    const t = setTimeout(res, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      res();
    }, { once: true });
  });
}

/** Default navigation: click a real link to that path if the page has one (keeps SPA routing), else load it. */
function defaultNavigate(path: string): void {
  const link = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).find(
    (a) => a.origin === location.origin && a.pathname === path,
  );
  if (link) link.click();
  else location.assign(path);
}

/** Flows with actions or forms can be done *with* the user, so they get a choice. */
function canDo(flow: Flow): boolean {
  return flow.steps.some((s) => s.action || s.form);
}

export class ChaloDikhavu {
  private readonly opts: Required<Omit<ChaloDikhavuOptions, "onEvent" | "navigate" | "ai" | "knowledge" | "speech" | "voice">> & Pick<ChaloDikhavuOptions, "onEvent" | "navigate" | "ai" | "knowledge" | "speech" | "voice">;
  private overlay: Overlay | null = null;
  private readonly speaker: Speaker;
  private readonly cloudVoice?: CloudVoice;
  private readonly listener: Listener;
  private lang: string;
  private current: { flow: Flow; ctl: AbortController; mode: RunMode } | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private listening = false;
  private answerSink: ((text: string) => void) | null = null;
  /** The mic was blocked this session; stop offering voice until reload. */
  private voiceOff = false;
  private cancelAutoListen: (() => void) | null = null;
  private readonly cleanup: Array<() => void> = [];

  constructor(options: ChaloDikhavuOptions) {
    const language = options.language ?? "en";
    this.opts = {
      hotkey: " ",
      holdMs: 350,
      launcher: true,
      tts: true,
      color: "#4f46e5",
      theme: "light",
      cursor: "arrow",
      languages: [language],
      ...options,
      language,
    };
    const saved = storage("local")?.getItem(LANG_KEY);
    this.lang = saved && this.opts.languages.includes(saved) ? saved : language;
    this.cloudVoice = this.opts.voice?.endpoint ? new CloudVoice(this.opts.voice) : undefined;
    this.speaker = new Speaker(this.opts.tts, this.cloudVoice);
    this.listener = new Listener((text) => {
      if (this.answerSink) this.overlay?.setMicState("listening", `${ui(this.lang, "listeningNow")}: “${text}”`);
      else this.overlay?.showListening(true, text);
    });
  }

  /** Attach the UI and listeners. Resumes a flow that was interrupted by a page load. */
  mount(): this {
    if (this.overlay || typeof document === "undefined") return this;
    this.overlay = new Overlay(this.opts.color, this.opts.theme, this.opts.cursor, this.lang, this.opts.languages, this.opts.launcher, {
      onAsk: (q) => this.ask(q),
      onMicDown: () => this.startListening(),
      onMicUp: () => void this.finishListening(),
      onPickFlow: (id) => this.start(id),
      onLanguage: (l) => this.setLanguage(l),
      onToggleMute: () => (this.speaker.muted = !this.speaker.muted),
    });
    this.overlay.mount();
    this.showPopular();
    this.bindKeys();

    const saved = this.readState();
    const flow = saved && this.opts.flows.find((f) => f.id === saved.flowId);
    if (saved && flow) void this.run(flow, saved.index, saved.mode);
    return this;
  }

  destroy(): void {
    this.stop();
    this.cleanup.splice(0).forEach((fn) => fn());
    this.overlay?.destroy();
    this.overlay = null;
  }

  /**
   * Start a flow by id. For flows with `action`/`form` steps, `mode` picks
   * "do" (fill it in with the user) or "show" (point only); if omitted the
   * user is asked.
   */
  start(flowId: string, mode?: RunMode): void {
    const flow = this.opts.flows.find((f) => f.id === flowId);
    if (!flow) throw new Error(`chalo-dikhavu: no flow with id "${flowId}"`);
    void this.run(flow, 0, mode);
  }

  /** Stop the running flow, if any. */
  stop(): void {
    if (!this.current) return;
    const { flow, ctl } = this.current;
    this.current = null;
    ctl.abort();
    this.clearState();
    this.speaker.stop();
    this.overlay?.hideStep();
    this.overlay?.showListening(false);
    this.overlay?.showLauncher(true);
    this.emit({ type: "flow:end", flowId: flow.id, completed: false });
  }

  /** Answer a typed or spoken question: start the matching flow or offer choices. */
  ask(query: string): void {
    const result = resolve(query, this.opts.flows);
    this.emit({ type: "ask", query, matchedFlowId: result.kind === "start" ? result.flow.id : null });
    const overlay = this.overlay;
    if (!overlay) return;
    // "What is KYC for?" wants an answer, not a walkthrough (that's "how do I do KYC").
    if (this.opts.ai && wantsExplanation(query)) {
      void this.answerInPanel(query);
      return;
    }
    if (result.kind === "start") {
      this.start(result.flow.id);
      return;
    }
    overlay.togglePanel(true);
    if (result.kind === "choose") {
      overlay.setMessage(`“${query}”`);
      overlay.setFlows(ui(this.lang, "didYouMean"), result.options.map((f) => ({ id: f.id, title: flowTitle(f, this.lang) })));
    } else {
      overlay.setMessage(`“${query}” — ${ui(this.lang, "noMatch")}`);
      this.showPopular();
    }
  }

  /** Answer a free-form question in the help panel, then offer the most related guide. */
  private async answerInPanel(query: string): Promise<void> {
    const overlay = this.overlay!;
    if (!this.current) overlay.hideStep(); // e.g. a lingering "All done!" bubble
    overlay.togglePanel(true);
    overlay.setMessage(`“${query}” — ${ui(this.lang, "thinking")}`);
    const ranked = rankFlows(query, this.opts.flows);
    const related = this.current?.flow ?? ranked[0]?.flow ?? null;
    const answer = await this.explain(query, related, null, undefined, false);
    if (!this.overlay) return;
    overlay.setMessage(answer);
    void this.speaker.play(answer, undefined, this.lang);
    const offer = ranked.filter((m) => m.score >= 0.35).slice(0, 3).map((m) => m.flow);
    if (offer.length) overlay.setFlows(ui(this.lang, "related"), offer.map((f) => ({ id: f.id, title: flowTitle(f, this.lang) })));
    else this.showPopular();
  }

  setLanguage(lang: string): void {
    this.lang = lang;
    storage("local")?.setItem(LANG_KEY, lang);
    this.overlay?.setLanguage(lang);
    this.showPopular();
  }

  get language(): string {
    return this.lang;
  }

  // ---- flow runner ----------------------------------------------------------

  private async run(flow: Flow, startIndex: number, mode?: RunMode): Promise<void> {
    if (this.current) {
      this.current.ctl.abort();
      this.speaker.stop();
    }
    const ctl = new AbortController();
    const current = { flow, ctl, mode: mode ?? "show" };
    this.current = current;
    const overlay = this.overlay!;
    overlay.togglePanel(false);
    overlay.showLauncher(false);

    if (!mode && canDo(flow)) {
      const picked = await this.chooseMode(flow, ctl.signal);
      if (ctl.signal.aborted) return;
      if (!picked) return this.stop();
      current.mode = picked;
    }
    if (startIndex === 0) this.emit({ type: "flow:start", flowId: flow.id, mode: current.mode });

    for (let i = startIndex; i < flow.steps.length; i++) {
      this.saveState(flow.id, i, current.mode);
      const outcome = await this.runStep(flow, i, current.mode, ctl.signal);
      if (ctl.signal.aborted) return;
      if (outcome === "stop") return this.stop();
    }

    this.clearState();
    this.current = null;
    const doneText = ui(this.lang, "done");
    overlay.showStep(null, flowTitle(flow, this.lang), doneText, [
      { label: "OK", primary: true, onClick: () => overlay.hideStep() },
    ]);
    void this.speaker.play(doneText, undefined, this.lang);
    setTimeout(() => {
      if (!this.current) overlay.hideStep();
    }, 3000);
    overlay.showLauncher(true);
    this.emit({ type: "flow:end", flowId: flow.id, completed: true });
  }

  private chooseMode(flow: Flow, signal: AbortSignal): Promise<RunMode | null> {
    const overlay = this.overlay!;
    const text = ui(this.lang, "modeQuestion");
    void this.speaker.play(text, undefined, this.lang);
    return new Promise((res) => {
      const pickMode = (m: RunMode | null) => {
        signal.removeEventListener("abort", onAbort);
        res(m);
      };
      const onAbort = () => pickMode(null);
      signal.addEventListener("abort", onAbort);
      overlay.showStep(null, flowTitle(flow, this.lang), text, [
        { label: ui(this.lang, "showMode"), onClick: () => pickMode("show") },
        { label: ui(this.lang, "doMode"), primary: true, onClick: () => pickMode("do") },
      ]);
    });
  }

  private async runStep(flow: Flow, index: number, mode: RunMode, signal: AbortSignal): Promise<Outcome> {
    const step = flow.steps[index];
    const overlay = this.overlay!;
    const title = flowTitle(flow, this.lang);
    const meta = `${title} · ${index + 1}/${flow.steps.length}`;

    if (step.path && !matchPath(step.path, location.pathname)) {
      const canGo = isStaticPath(step.path);
      const text = pick(step.say, this.lang);
      overlay.showStep(null, meta, canGo ? ui(this.lang, "goingTo") : `${ui(this.lang, "waitingFor")}${text ? `\n\n${text}` : ""}`, [this.stopButton()]);
      if (canGo) (this.opts.navigate ?? defaultNavigate)(step.path);
      const arrived = await this.waitForPath(step.path, canGo ? 10000 : 120000, signal);
      if (!arrived) return "stop";
    }

    if (!step.form) return this.runTarget(flow, index, step, meta, mode, signal);

    // A whole form: one generated step per field, then the submit button.
    const form = await waitFor(step.form, step.timeout ?? 8000, signal);
    if (signal.aborted) return "stop";
    if (!form) return this.missing(flow, index, meta, pick(step.say, this.lang), signal);
    const steps = this.stepsForForm(form, step, mode);
    for (let k = 0; k < steps.length; k++) {
      const outcome = await this.runTarget(flow, index, steps[k], `${title} · ${k + 1}/${steps.length}`, mode, signal);
      if (outcome === "stop" || signal.aborted) return "stop";
    }
    return "next";
  }

  private stepsForForm(form: Element, step: Step, mode: RunMode): FieldStep[] {
    const steps: FieldStep[] = [];
    for (const el of collectFields(form)) {
      const override = Object.entries(step.fields ?? {}).find(([sel]) => {
        try {
          return el.matches(sel);
        } catch {
          return false;
        }
      })?.[1];
      if (override?.skip) continue;
      steps.push({ ...override, target: selectorFor(el), el, action: "fill", advance: mode === "show" ? "input" : undefined });
    }
    const submit = submitButtonOf(form);
    if (submit) steps.push({ target: selectorFor(submit), el: submit, action: "click", confirm: step.confirm });
    return steps;
  }

  /** Find a step's element, then show it ("show" mode) or act on it ("do" mode). */
  private async runTarget(flow: Flow, index: number, step: FieldStep, meta: string, mode: RunMode, signal: AbortSignal): Promise<Outcome> {
    const overlay = this.overlay!;
    let el: Element | null = step.el?.isConnected ? step.el : null;
    if (!el && step.target) {
      el = await waitFor(step.target, step.timeout ?? 8000, signal);
      // Hidden inputs behind custom widgets are still fillable.
      if (!el && step.action === "fill") el = findNow(step.target, document, false);
      if (signal.aborted) return "stop";
      if (!el) return this.missing(flow, index, meta, pick(step.say, this.lang), signal);
    }
    this.emit({ type: "step:show", flowId: flow.id, index });
    const say = pick(step.say, this.lang);

    if (el && mode === "do" && step.action) {
      const host = this.assistHost(flow, signal);
      if (step.action === "fill") return assistField(host, describeField(el), step, meta);
      return assistClick(host, el, meta, say, step.confirm);
    }

    // "Show" mode: point, explain, wait for the user.
    let point: Element | null = el;
    let text = say;
    if (el && isFormControl(el)) {
      const info = describeField(el);
      point = info.point;
      text ||= guideTextFor(info, this.lang);
    } else if (el) {
      text ||= ui(this.lang, "clickHere", { label: buttonLabel(el) });
    }
    if (point) {
      const r = point.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) {
        point.scrollIntoView({ block: "center", behavior: "smooth" });
        await sleep(400, signal);
      }
    }
    const advance = step.advance ?? (el && isFormControl(el) ? "input" : step.target ? "click" : "next");

    return this.choice(signal, (done) => {
      const buttons: BubbleButton[] = [this.stopButton()];
      if (advance === "click") buttons.push({ label: ui(this.lang, "skip"), onClick: () => done("next") });
      if (advance === "next" || advance === "input") {
        buttons.push({ label: ui(this.lang, "next"), primary: true, onClick: () => done("next") });
      }
      overlay.showStep(point, meta, text, buttons);
      void overlay.moveCursor();
      void this.speaker.play(text, step.audio, this.lang);
      return this.watchAdvance(step, advance, el, done);
    });
  }

  private missing(flow: Flow, index: number, meta: string, text: string, signal: AbortSignal): Promise<Outcome> {
    this.emit({ type: "step:missing", flowId: flow.id, index });
    return this.choice(signal, (done) => {
      this.overlay!.showStep(null, meta, `${ui(this.lang, "notFound")}${text ? `\n\n${text}` : ""}`, [
        this.stopButton(),
        { label: ui(this.lang, "skip"), primary: true, onClick: () => done("next") },
      ]);
    });
  }

  private assistHost(flow: Flow, signal: AbortSignal): AssistHost {
    const self = this;
    return {
      overlay: this.overlay!,
      speaker: this.speaker,
      lang: this.lang,
      flowId: flow.id,
      signal,
      get voice() {
        return (canListen() || !!self.cloudVoice?.listens) && !self.voiceOff;
      },
      listen: (o) => (this.cloudVoice?.listens ? listenCloud(o, this.cloudVoice) : listenOnce(o)),
      disableVoice: () => (this.voiceOff = true),
      speech: this.opts.speech,
      emit: (e) => this.emit(e),
      stopButton: () => this.stopButton(),
      setAnswerSink: (sink, cancelAuto) => {
        this.answerSink = sink;
        this.cancelAutoListen = cancelAuto ?? null;
      },
      canExplain: !!this.opts.ai,
      explain: (question, field, why, preferWhy) => this.explain(question, flow, field, why, preferWhy, signal),
    };
  }

  /**
   * Answer a question: the field's own `why` text when it fits (free, exact
   * wording), otherwise the AI. Never throws; failures become a polite message.
   */
  private async explain(
    question: string,
    flow: Flow | null,
    field: FieldInfo | null,
    why: LocalizedText | undefined,
    preferWhy: boolean,
    signal?: AbortSignal,
  ): Promise<string> {
    const base = { flowId: flow?.id ?? null, field: field?.label ?? null };
    if (why !== undefined && (preferWhy || !this.opts.ai)) {
      this.emit({ type: "explain", ...base, source: "why" });
      return pick(why, this.lang);
    }
    if (!this.opts.ai) return ui(this.lang, "noWhy");
    try {
      const form = field?.el.closest("form");
      const formFields = form ? collectFields(form).map((el) => describeField(el)) : [];
      const req = buildRequest(question, this.lang, flow, field, formFields, this.opts.knowledge);
      const answer = await callAi(this.opts.ai, req, signal);
      this.emit({ type: "explain", ...base, source: "ai" });
      return answer;
    } catch (err) {
      if (!signal?.aborted) console.warn("chalo-dikhavu: AI answer failed", err);
      this.emit({ type: "explain", ...base, source: "error" });
      return ui(this.lang, "aiError");
    }
  }

  private stopButton(): BubbleButton {
    return { label: ui(this.lang, "stop"), onClick: () => this.stop() };
  }

  /**
   * Wait for the user to do what the step asks. React often swaps DOM nodes on
   * re-render, so the target is re-found by its description, not held by reference.
   */
  private watchAdvance(step: Step, advance: Step["advance"], el: Element | null, done: (o: Outcome) => void): () => void {
    const offs: Array<() => void> = [];
    const current = () => (el && el.isConnected ? el : step.target ? findNow(step.target, document, false) : null);
    const inside = (e: Event) => {
      const t = current();
      if (!t) return false;
      if (e.composedPath().includes(t)) return true;
      // Any radio in the same group counts as answering a radio step.
      const radio = t as HTMLInputElement;
      const hit = e.target as HTMLInputElement;
      return radio.type === "radio" && !!radio.name && hit?.type === "radio" && hit.name === radio.name;
    };

    if (advance === "click") {
      const onClick = (e: Event) => {
        if (this.overlay?.owns(e) || !inside(e)) return;
        // Let the site handle the click first (open the dropdown, follow the link).
        setTimeout(() => done("next"), 150);
      };
      document.addEventListener("click", onClick, true);
      offs.push(() => document.removeEventListener("click", onClick, true));
    }
    if (advance === "input") {
      const onChange = (e: Event) => {
        if (inside(e)) setTimeout(() => done("next"), 400);
      };
      document.addEventListener("change", onChange, true);
      offs.push(() => document.removeEventListener("change", onChange, true));
    }
    if (advance === "auto") {
      const t = setTimeout(() => done("next"), step.delay ?? 2500);
      offs.push(() => clearTimeout(t));
    }
    if (el && step.target) {
      const target = step.target;
      const refresh = setInterval(() => {
        if (el && !el.isConnected) {
          const again = findNow(target);
          if (again) {
            el = again;
            this.overlay?.retarget(isFormControl(again) ? describeField(again).point : again);
          }
        }
      }, 300);
      offs.push(() => clearInterval(refresh));
    }
    return () => offs.forEach((off) => off());
  }

  /** Run a UI setup that resolves via `done`; tears down its listeners on resolve or abort. */
  private choice(signal: AbortSignal, setup: (done: (o: Outcome) => void) => (() => void) | void): Promise<Outcome> {
    return new Promise((res) => {
      let teardown: (() => void) | void;
      let settled = false;
      const done = (o: Outcome) => {
        if (settled) return;
        settled = true;
        teardown?.();
        signal.removeEventListener("abort", onAbort);
        res(o);
      };
      const onAbort = () => done("stop");
      signal.addEventListener("abort", onAbort);
      teardown = setup(done);
    });
  }

  private waitForPath(pattern: string, timeoutMs: number, signal: AbortSignal): Promise<boolean> {
    return new Promise((res) => {
      const started = Date.now();
      const t = setInterval(() => {
        if (signal.aborted) finish(false);
        else if (matchPath(pattern, location.pathname)) finish(true);
        else if (Date.now() - started > timeoutMs) finish(false);
      }, 150);
      const finish = (ok: boolean) => {
        clearInterval(t);
        res(ok);
      };
    });
  }

  // ---- push-to-talk -----------------------------------------------------------

  private bindKeys(): void {
    const key = this.opts.hotkey;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.current) this.stop();
    };
    window.addEventListener("keydown", onEsc);
    this.cleanup.push(() => window.removeEventListener("keydown", onEsc));
    if (key === false) return;

    const down = (e: KeyboardEvent) => {
      if (e.key !== key || isEditable(e.target) || this.overlay?.owns(e)) return;
      if (e.repeat) {
        // Holding Space would otherwise keep scrolling the page.
        if (this.holdTimer || this.listening) e.preventDefault();
        return;
      }
      this.holdTimer = setTimeout(() => {
        this.holdTimer = null;
        this.startListening();
      }, this.opts.holdMs);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== key) return;
      if (this.holdTimer) {
        clearTimeout(this.holdTimer);
        this.holdTimer = null;
      }
      if (this.listening) {
        e.preventDefault(); // don't also "press" a focused button
        void this.finishListening();
      }
    };
    const blur = () => {
      if (this.holdTimer) clearTimeout(this.holdTimer);
      this.holdTimer = null;
      if (this.listening) {
        this.listening = false;
        this.listener.cancel();
        this.overlay?.showListening(false);
      }
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", blur);
    this.cleanup.push(() => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", blur);
    });
  }

  private startListening(): void {
    if (this.listening) return;
    // A question is open and already auto-listening: take over the mic.
    this.cancelAutoListen?.();
    // Silence the guide *before* opening the mic, or it hears itself.
    this.speaker.stop();
    if (!canListen() || this.voiceOff || !this.listener.start(this.lang)) {
      if (this.answerSink) {
        // They can still type the answer in the bubble.
        this.overlay?.setMicState("problem", ui(this.lang, this.voiceOff ? "micBlocked" : "micUnavailable"));
        return;
      }
      this.overlay?.togglePanel(true);
      this.overlay?.setMessage(ui(this.lang, "micUnsupported"));
      return;
    }
    this.listening = true;
    // During a question the bubble shows the mic state; the pill would cover its buttons.
    if (this.answerSink) this.overlay?.setMicState("listening", ui(this.lang, "listeningNow"));
    else this.overlay?.showListening(true);
  }

  private async finishListening(): Promise<void> {
    if (!this.listening) return;
    this.listening = false;
    const text = await this.listener.finish();
    this.overlay?.showListening(false);
    if (!text.trim()) {
      if (this.answerSink) this.overlay?.setMicState("idle", ui(this.lang, "notHeard"));
      return;
    }
    // While a form question is open, speech answers it rather than starting a new search.
    if (this.answerSink) this.answerSink(text);
    else this.ask(text);
  }

  // ---- helpers ------------------------------------------------------------------

  private showPopular(): void {
    this.overlay?.setFlows(
      ui(this.lang, "popular"),
      this.opts.flows.slice(0, 6).map((f) => ({ id: f.id, title: flowTitle(f, this.lang) })),
    );
  }

  private emit(event: ChaloDikhavuEvent): void {
    try {
      this.opts.onEvent?.(event);
    } catch (err) {
      console.error("chalo-dikhavu: onEvent handler threw", err);
    }
  }

  private saveState(flowId: string, index: number, mode: RunMode): void {
    storage("session")?.setItem(STATE_KEY, JSON.stringify({ flowId, index, mode }));
  }

  private readState(): { flowId: string; index: number; mode?: RunMode } | null {
    try {
      const raw = storage("session")?.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private clearState(): void {
    storage("session")?.removeItem(STATE_KEY);
  }
}
