import { LANGUAGE_NAMES, ui } from "./i18n";
import { css } from "./styles";

type Attrs = Record<string, string | ((e: Event) => void)>;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
}

const CURSOR_SVG =
  '<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg"><path d="M5 3 L5 22 L10 17.5 L13.5 25 L17 23.5 L13.6 16 L20.5 16 Z" fill="#fff" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round"/></svg>';

export interface BubbleButton {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

/** A text box inside the bubble, for typing an answer instead of saying it. */
export interface AnswerBox {
  placeholder: string;
  type?: string;
  onSubmit: (text: string) => void;
  /** The user started typing: stop listening so the two don't race. */
  onTyping?: () => void;
  /** Shows a 🎤 button that listens again (after silence, or to retry). */
  onMic?: () => void;
}

export type MicState = "listening" | "idle" | "problem";

export interface OverlayHandlers {
  onAsk: (query: string) => void;
  onMicDown: () => void;
  onMicUp: () => void;
  onPickFlow: (id: string) => void;
  onLanguage: (lang: string) => void;
  onToggleMute: () => boolean;
}

interface Point {
  x: number;
  y: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Everything Raahi draws. Lives in a shadow root so the host site's CSS can't
 * break it and ours can't leak out. One rAF loop keeps the spotlight, bubble
 * and cursor glued to the target element as the page scrolls or re-renders.
 */
export class Overlay {
  private host: HTMLElement;
  private root: ShadowRoot;
  private spot: HTMLElement;
  private cursor: HTMLElement;
  private bubble: HTMLElement;
  private launcher: HTMLButtonElement;
  private panel: HTMLElement;
  private input: HTMLInputElement;
  private micBtn: HTMLButtonElement;
  private msg: HTMLElement;
  private flowList: HTMLElement;
  private listTitle: HTMLElement;
  private langSelect: HTMLSelectElement;
  private listening: HTMLElement;
  private heard: HTMLElement;
  private muteBtn: HTMLButtonElement;
  private panelTitle: HTMLElement;
  private hint: HTMLElement;

  private answerHint: HTMLElement | null = null;
  private answerMic: HTMLButtonElement | null = null;
  private target: Element | null = null;
  private pos: Point = { x: innerWidth - 60, y: innerHeight - 60 };
  private anim: { from: Point; start: number; dur: number; done: () => void } | null = null;
  private frame = 0;
  private lang: string;

  constructor(
    color: string,
    lang: string,
    languages: string[],
    showLauncher: boolean,
    private readonly handlers: OverlayHandlers,
  ) {
    this.lang = lang;
    this.host = h("div", { "data-raahi-root": "" });
    this.root = this.host.attachShadow({ mode: "open" });

    this.spot = h("div", { class: "spot" });
    this.cursor = h("div", { class: "cursor" });
    this.cursor.innerHTML = CURSOR_SVG + '<span class="ring"></span>';
    this.bubble = h("div", { class: "bubble", role: "dialog", "aria-live": "polite" });

    this.launcher = h("button", { class: "launcher" + (showLauncher ? "" : " hidden"), onclick: () => this.togglePanel() });

    this.panelTitle = h("h2");
    this.langSelect = h("select", {
      "aria-label": "Language",
      onchange: () => this.handlers.onLanguage(this.langSelect.value),
    });
    for (const code of languages) this.langSelect.append(h("option", { value: code }, LANGUAGE_NAMES[code] ?? code));
    this.muteBtn = h("button", {
      class: "icon",
      "aria-label": "Mute voice",
      onclick: () => (this.muteBtn.textContent = this.handlers.onToggleMute() ? "🔇" : "🔊"),
    }, "🔊");
    const close = h("button", { class: "icon", "aria-label": "Close", onclick: () => this.togglePanel(false) }, "✕");

    this.input = h("input", { type: "text", autocomplete: "off" });
    this.micBtn = h("button", { class: "mic", type: "button", "aria-label": "Hold to talk" }, "🎤");
    // Hold-to-talk on the button too, for mouse and touch users.
    this.micBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.micBtn.setPointerCapture(e.pointerId);
      this.handlers.onMicDown();
    });
    this.micBtn.addEventListener("pointerup", () => this.handlers.onMicUp());
    this.micBtn.addEventListener("pointercancel", () => this.handlers.onMicUp());

    const form = h("form", {
      onsubmit: (e) => {
        e.preventDefault();
        const q = this.input.value.trim();
        if (q) this.handlers.onAsk(q);
      },
    }, this.input, this.micBtn);
    // Typing a space in our own box must not trigger push-to-talk.
    this.input.addEventListener("keydown", (e) => e.stopPropagation());

    this.hint = h("p", { class: "hint" });
    this.msg = h("p", { class: "msg" });
    this.listTitle = h("p", { class: "list-title" });
    this.flowList = h("div", { class: "flows" });
    const controls = h("div", { style: "display:flex;gap:4px;align-items:center" });
    if (languages.length > 1) controls.append(this.langSelect);
    controls.append(this.muteBtn, close);
    this.panel = h("div", { class: "panel", role: "dialog" },
      h("header", {}, this.panelTitle, controls),
      form, this.hint, this.msg, this.listTitle, this.flowList,
    );

    this.heard = h("span", { class: "heard" });
    this.listening = h("div", { class: "listening" }, h("span", { class: "orb" }, "🎤"), this.heard);

    const style = h("style");
    style.textContent = css(color);
    this.root.append(style, h("div", { class: "layer" }, this.spot, this.bubble, this.cursor, this.launcher, this.panel, this.listening));
    this.setLanguage(lang);
  }

  mount(): void {
    document.body.append(this.host);
    const loop = (now: number) => {
      this.tick(now);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.host.remove();
  }

  /** True when an event came from inside Raahi's own UI. */
  owns(e: Event): boolean {
    return e.composedPath().includes(this.host);
  }

  setLanguage(lang: string): void {
    this.lang = lang;
    this.langSelect.value = lang;
    this.launcher.replaceChildren(h("span", { class: "dot" }, "🧭"), ui(lang, "help"));
    this.panelTitle.textContent = ui(lang, "help");
    this.input.placeholder = ui(lang, "askPlaceholder");
    this.hint.textContent = ui(lang, "holdToTalk");
    this.listTitle.textContent = ui(lang, "popular");
    this.heard.textContent = ui(lang, "listening");
  }

  // ---- panel -------------------------------------------------------------

  togglePanel(open = !this.panel.classList.contains("on")): void {
    this.panel.classList.toggle("on", open);
    if (open) {
      this.setMessage("");
      this.input.value = "";
      setTimeout(() => this.input.focus(), 0);
    }
  }

  setMessage(text: string): void {
    this.msg.textContent = text;
  }

  setFlows(title: string, flows: Array<{ id: string; title: string }>): void {
    this.listTitle.textContent = title;
    this.flowList.replaceChildren(
      ...flows.map((f) => h("button", { type: "button", onclick: () => this.handlers.onPickFlow(f.id) }, f.title)),
    );
  }

  showLauncher(show: boolean): void {
    this.launcher.style.visibility = show ? "" : "hidden";
  }

  // ---- listening indicator ------------------------------------------------

  showListening(on: boolean, text?: string): void {
    this.listening.classList.toggle("on", on);
    this.micBtn.classList.toggle("live", on);
    this.heard.textContent = text || ui(this.lang, "listening");
  }

  // ---- guide: spotlight, bubble, cursor -------------------------------------

  /** Point at an element (or null for a centered message) and show the bubble. */
  showStep(el: Element | null, meta: string, text: string, buttons: BubbleButton[], answer?: AnswerBox): void {
    this.target = el;
    this.spot.classList.toggle("on", !!el);
    this.cursor.classList.toggle("on", !!el);
    const actions = h("div", { class: "actions" },
      ...buttons.map((b) => h("button", { class: "b" + (b.primary ? " primary" : ""), type: "button", onclick: b.onClick }, b.label)),
    );
    const children: Node[] = [h("div", { class: "meta" }, h("span", {}, meta)), h("div", { class: "text" }, text)];
    this.answerHint = null;
    this.answerMic = null;
    if (answer) {
      const input = h("input", { type: answer.type ?? "text", placeholder: answer.placeholder, autocomplete: "off" });
      input.addEventListener("keydown", (e) => e.stopPropagation()); // Space here is typing, not push-to-talk
      input.addEventListener("input", () => answer.onTyping?.());
      const parts: Node[] = [input];
      if (answer.onMic) {
        const onMic = answer.onMic;
        this.answerMic = h("button", { class: "mic", type: "button", "aria-label": "Answer by voice", onclick: () => onMic() }, "🎤");
        parts.push(this.answerMic);
      }
      parts.push(h("button", { class: "b primary", type: "submit", "aria-label": "Send" }, "↵"));
      children.push(h("form", {
        class: "answer",
        onsubmit: (e) => {
          e.preventDefault();
          if (input.value.trim()) answer.onSubmit(input.value);
        },
      }, ...parts));
      this.answerHint = h("p", { class: "answer-hint", "aria-live": "polite" });
      children.push(this.answerHint);
    }
    children.push(actions);
    this.bubble.replaceChildren(...children);
    this.bubble.classList.add("on");
  }

  /**
   * Show what the mic is doing under the answer box, so silence never looks
   * like a frozen flow: "Listening…", "I didn't hear anything — tap 🎤", etc.
   */
  setMicState(state: MicState, text: string): void {
    if (this.answerHint) {
      this.answerHint.textContent = text;
      this.answerHint.dataset.state = state;
    }
    this.answerMic?.classList.toggle("live", state === "listening");
  }

  /** Keep pointing at the same step after the site re-rendered its element. */
  retarget(el: Element): void {
    this.target = el;
  }

  hideStep(): void {
    this.target = null;
    this.settleAnim();
    this.spot.classList.remove("on");
    this.cursor.classList.remove("on");
    this.bubble.classList.remove("on");
  }

  /** Glide the cursor to the current target. Resolves on arrival, with a tap ripple. */
  moveCursor(): Promise<void> {
    this.settleAnim(); // a new move supersedes one still in flight
    return new Promise((resolve) => {
      const dist = Math.hypot(this.aim().x - this.pos.x, this.aim().y - this.pos.y);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.anim = {
        from: { ...this.pos },
        start: performance.now(),
        dur: reduced ? 0 : Math.min(1100, 350 + dist * 0.6),
        done: () => {
          this.cursor.classList.remove("tap");
          void this.cursor.offsetWidth; // restart the ripple animation
          this.cursor.classList.add("tap");
          resolve();
        },
      };
    });
  }

  /** End any in-flight glide so whoever awaits it isn't left hanging. */
  private settleAnim(): void {
    const anim = this.anim;
    this.anim = null;
    anim?.done();
  }

  /** Where the cursor should rest: a little inside the target, like a real pointer. */
  private aim(): Point {
    if (!this.target) return this.pos;
    const r = this.target.getBoundingClientRect();
    return { x: r.left + Math.min(r.width * 0.5, 40), y: r.top + Math.min(r.height * 0.6, 28) };
  }

  private tick(now: number): void {
    const el = this.target;
    if (el && !el.isConnected) {
      // React replaced the node; leave the visuals where they were until the engine re-finds it.
      return;
    }

    const bubbleRect = this.bubble.getBoundingClientRect();
    if (el) {
      const r = el.getBoundingClientRect();
      const pad = 6;
      Object.assign(this.spot.style, {
        left: `${r.left - pad}px`, top: `${r.top - pad}px`,
        width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
      });
      // Below the element if it fits, else above, else beside; always on-screen.
      const gap = 14;
      let top = r.bottom + gap;
      if (top + bubbleRect.height > innerHeight - 8) top = r.top - gap - bubbleRect.height;
      if (top < 8) top = Math.min(innerHeight - bubbleRect.height - 8, Math.max(8, r.top));
      let left = r.left;
      if (top < r.bottom && top + bubbleRect.height > r.top) {
        left = r.right + gap + bubbleRect.width < innerWidth ? r.right + gap : r.left - gap - bubbleRect.width;
      }
      left = Math.max(8, Math.min(left, innerWidth - bubbleRect.width - 8));
      this.bubble.style.left = `${left}px`;
      this.bubble.style.top = `${top}px`;
    } else {
      this.bubble.style.left = `${(innerWidth - bubbleRect.width) / 2}px`;
      this.bubble.style.top = `${Math.max(16, innerHeight * 0.3)}px`;
    }

    // The cursor chases the target's live position, so it lands correctly mid-scroll.
    const goal = this.aim();
    if (this.anim) {
      const t = this.anim.dur ? Math.min(1, (now - this.anim.start) / this.anim.dur) : 1;
      const k = easeInOut(t);
      const arc = Math.sin(Math.PI * t) * Math.min(60, Math.hypot(goal.x - this.anim.from.x, goal.y - this.anim.from.y) * 0.15);
      this.pos = {
        x: this.anim.from.x + (goal.x - this.anim.from.x) * k,
        y: this.anim.from.y + (goal.y - this.anim.from.y) * k - arc,
      };
      if (t >= 1) {
        const done = this.anim.done;
        this.anim = null;
        done();
      }
    } else if (el) {
      this.pos = goal;
    }
    this.cursor.style.transform = `translate(${this.pos.x}px, ${this.pos.y}px)`;
  }
}
