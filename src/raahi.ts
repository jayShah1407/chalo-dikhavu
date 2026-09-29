import { findNow, waitFor } from "./finder";
import { pick, ui } from "./i18n";
import { flowTitle, resolve } from "./intent";
import { canListen, Listener } from "./listen";
import { Overlay, type BubbleButton } from "./overlay";
import { isStaticPath, matchPath } from "./paths";
import type { Flow, RaahiEvent, RaahiOptions, Step } from "./types";
import { Speaker } from "./voice";

const STATE_KEY = "raahi:run";
const LANG_KEY = "raahi:lang";

type Outcome = "next" | "stop";

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

export class Raahi {
  private readonly opts: Required<Omit<RaahiOptions, "onEvent" | "navigate">> & Pick<RaahiOptions, "onEvent" | "navigate">;
  private overlay: Overlay | null = null;
  private readonly speaker: Speaker;
  private readonly listener: Listener;
  private lang: string;
  private current: { flow: Flow; ctl: AbortController } | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private listening = false;
  private readonly cleanup: Array<() => void> = [];

  constructor(options: RaahiOptions) {
    const language = options.language ?? "en";
    this.opts = {
      hotkey: " ",
      holdMs: 350,
      launcher: true,
      tts: true,
      color: "#4f46e5",
      languages: [language],
      ...options,
      language,
    };
    const saved = storage("local")?.getItem(LANG_KEY);
    this.lang = saved && this.opts.languages.includes(saved) ? saved : language;
    this.speaker = new Speaker(this.opts.tts);
    this.listener = new Listener((text) => this.overlay?.showListening(true, text));
  }

  /** Attach the UI and listeners. Resumes a flow that was interrupted by a page load. */
  mount(): this {
    if (this.overlay || typeof document === "undefined") return this;
    this.overlay = new Overlay(this.opts.color, this.lang, this.opts.languages, this.opts.launcher, {
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
    if (saved && flow) void this.run(flow, saved.index);
    return this;
  }

  destroy(): void {
    this.stop();
    this.cleanup.splice(0).forEach((fn) => fn());
    this.overlay?.destroy();
    this.overlay = null;
  }

  /** Start a flow by id. */
  start(flowId: string): void {
    const flow = this.opts.flows.find((f) => f.id === flowId);
    if (!flow) throw new Error(`raahi: no flow with id "${flowId}"`);
    void this.run(flow, 0);
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
    this.overlay?.showLauncher(true);
    this.emit({ type: "flow:end", flowId: flow.id, completed: false });
  }

  /** Answer a typed or spoken question: start the matching flow or offer choices. */
  ask(query: string): void {
    const result = resolve(query, this.opts.flows);
    this.emit({ type: "ask", query, matchedFlowId: result.kind === "start" ? result.flow.id : null });
    const overlay = this.overlay;
    if (!overlay) return;
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

  private async run(flow: Flow, startIndex: number): Promise<void> {
    if (this.current) {
      this.current.ctl.abort();
      this.speaker.stop();
    }
    const ctl = new AbortController();
    this.current = { flow, ctl };
    const overlay = this.overlay!;
    overlay.togglePanel(false);
    overlay.showLauncher(false);
    if (startIndex === 0) this.emit({ type: "flow:start", flowId: flow.id });

    for (let i = startIndex; i < flow.steps.length; i++) {
      this.saveState(flow.id, i);
      const outcome = await this.runStep(flow, i, ctl.signal);
      if (ctl.signal.aborted) return;
      if (outcome === "stop") return this.stop();
    }

    this.clearState();
    this.current = null;
    const doneText = ui(this.lang, "done");
    overlay.showStep(null, flowTitle(flow, this.lang), doneText, [
      { label: "OK", primary: true, onClick: () => overlay.hideStep() },
    ]);
    this.speaker.play(doneText, undefined, this.lang);
    setTimeout(() => {
      if (!this.current) overlay.hideStep();
    }, 3000);
    overlay.showLauncher(true);
    this.emit({ type: "flow:end", flowId: flow.id, completed: true });
  }

  private async runStep(flow: Flow, index: number, signal: AbortSignal): Promise<Outcome> {
    const step = flow.steps[index];
    const overlay = this.overlay!;
    const meta = `${flowTitle(flow, this.lang)} · ${index + 1}/${flow.steps.length}`;
    const text = pick(step.say, this.lang);
    const stopBtn: BubbleButton = { label: ui(this.lang, "stop"), onClick: () => this.stop() };

    if (step.path && !matchPath(step.path, location.pathname)) {
      const canGo = isStaticPath(step.path);
      overlay.showStep(null, meta, canGo ? ui(this.lang, "goingTo") : `${ui(this.lang, "waitingFor")}\n\n${text}`, [stopBtn]);
      if (canGo) (this.opts.navigate ?? defaultNavigate)(step.path);
      const arrived = await this.waitForPath(step.path, canGo ? 10000 : 120000, signal);
      if (!arrived) return "stop";
    }

    let el: Element | null = null;
    if (step.target) {
      el = await waitFor(step.target, step.timeout ?? 8000, signal);
      if (signal.aborted) return "stop";
      if (!el) {
        this.emit({ type: "step:missing", flowId: flow.id, index });
        return this.choice(signal, (done) => {
          overlay.showStep(null, meta, `${ui(this.lang, "notFound")}\n\n${text}`, [
            stopBtn,
            { label: ui(this.lang, "skip"), primary: true, onClick: () => done("next") },
          ]);
        });
      }
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        await sleep(400, signal);
      }
    }

    const advance = step.advance ?? (step.target ? "click" : "next");
    this.emit({ type: "step:show", flowId: flow.id, index });

    return this.choice(signal, (done) => {
      const buttons: BubbleButton[] = [stopBtn];
      if (advance === "click") buttons.push({ label: ui(this.lang, "skip"), onClick: () => done("next") });
      if (advance === "next" || advance === "input") {
        buttons.push({ label: ui(this.lang, "next"), primary: true, onClick: () => done("next") });
      }
      overlay.showStep(el, meta, text, buttons);
      void overlay.moveCursor();
      this.speaker.play(text, step.audio, this.lang);
      return this.watchAdvance(step, advance, el, done);
    });
  }

  /**
   * Wait for the user to do what the step asks. React often swaps DOM nodes on
   * re-render, so the target is re-found by its description, not held by reference.
   */
  private watchAdvance(step: Step, advance: Step["advance"], el: Element | null, done: (o: Outcome) => void): () => void {
    const offs: Array<() => void> = [];
    const current = () => (el && el.isConnected ? el : step.target ? findNow(step.target) : null);
    const inside = (e: Event) => {
      const t = current();
      return !!t && e.composedPath().includes(t);
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
            this.overlay?.retarget(again);
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
    if (!canListen() || !this.listener.start(this.lang)) {
      this.overlay?.togglePanel(true);
      this.overlay?.setMessage(ui(this.lang, "micUnsupported"));
      return;
    }
    this.listening = true;
    this.speaker.stop();
    this.overlay?.showListening(true);
  }

  private async finishListening(): Promise<void> {
    if (!this.listening) return;
    this.listening = false;
    const text = await this.listener.finish();
    this.overlay?.showListening(false);
    if (text.trim()) this.ask(text);
  }

  // ---- helpers ------------------------------------------------------------------

  private showPopular(): void {
    this.overlay?.setFlows(
      ui(this.lang, "popular"),
      this.opts.flows.slice(0, 6).map((f) => ({ id: f.id, title: flowTitle(f, this.lang) })),
    );
  }

  private emit(event: RaahiEvent): void {
    try {
      this.opts.onEvent?.(event);
    } catch (err) {
      console.error("raahi: onEvent handler threw", err);
    }
  }

  private saveState(flowId: string, index: number): void {
    storage("session")?.setItem(STATE_KEY, JSON.stringify({ flowId, index }));
  }

  private readState(): { flowId: string; index: number } | null {
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
