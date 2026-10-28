// Colors are variables so one stylesheet serves both themes: the host element carries
// data-theme="light" | "dark" | "auto" ("auto" follows the visitor's system setting).
const LIGHT = `
  --bg: #ffffff; --fg: #0f172a; --fg-2: #334155; --muted: #64748b;
  --border: #e2e8f0; --border-strong: #cbd5e1; --field: #ffffff;
  --soft: #f1f5f9; --soft-hover: #e2e8f0;
  --shadow: 0 16px 48px rgba(15, 23, 42, .18), 0 2px 6px rgba(15, 23, 42, .06);
  --dim: rgba(15, 23, 42, .45); --pill: #0f172a;`;
const DARK = `
  --bg: #171c27; --fg: #e8ebf1; --fg-2: #c4cbd7; --muted: #8b95a8;
  --border: rgba(255, 255, 255, .08); --border-strong: rgba(255, 255, 255, .14); --field: rgba(255, 255, 255, .04);
  --soft: rgba(255, 255, 255, .06); --soft-hover: rgba(255, 255, 255, .11);
  --shadow: 0 16px 48px rgba(0, 0, 0, .55), 0 0 0 1px rgba(255, 255, 255, .04);
  --dim: rgba(0, 0, 0, .55); --pill: #242b39;`;

// A neutral chevron that reads on both themes.
const SELECT_ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238b95a8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

export function css(color: string): string {
  return `
:host { all: initial; --accent: ${color}; --ring: color-mix(in srgb, ${color} 28%, transparent); ${LIGHT} }
:host([data-theme="dark"]) { ${DARK} }
@media (prefers-color-scheme: dark) { :host([data-theme="auto"]) { ${DARK} } }

* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Gujarati", sans-serif; }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; }
.ico { width: 18px; height: 18px; display: block; flex: none; }
button { font: inherit; }
button:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.spot {
  position: fixed; border-radius: 10px; pointer-events: none; opacity: 0;
  box-shadow: 0 0 0 9999px var(--dim);
  outline: 2px solid var(--accent); outline-offset: 2px;
  transition: left .25s ease, top .25s ease, width .25s ease, height .25s ease, opacity .2s ease;
}
.spot.on { opacity: 1; }
.spot.on::after {
  content: ""; position: absolute; inset: -6px; border-radius: 14px;
  border: 2px solid var(--accent); animation: dikhavu-pulse 1.6s ease-out infinite;
}
@keyframes dikhavu-pulse { from { opacity: .8; transform: scale(1); } to { opacity: 0; transform: scale(1.12); } }

/* The cursor element sits exactly on the point; .shape is shifted so its hotspot lands there. */
.cursor {
  position: fixed; left: 0; top: 0; width: 0; height: 0; opacity: 0;
  transition: opacity .2s ease; will-change: transform;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,.35));
}
.cursor.on { opacity: 1; }
.cursor .shape { position: absolute; left: 0; top: 0; display: block; color: var(--accent); }
.cursor .shape svg, .cursor .shape img { width: 100%; height: 100%; display: block; }
.cursor .shape.text { display: grid; place-items: center; line-height: 1; }
.cursor .ring {
  position: absolute; left: -10px; top: -10px; width: 20px; height: 20px; border-radius: 50%;
  border: 3px solid var(--accent); opacity: 0;
}
.cursor.tap .ring { animation: dikhavu-tap .6s ease-out; }
@keyframes dikhavu-tap { from { opacity: 1; transform: scale(.4); } to { opacity: 0; transform: scale(2.2); } }

/* ---- shared controls ---- */
input.field, .panel input, .bubble .answer input {
  flex: 1; min-width: 0; height: 42px; border: 1px solid var(--border-strong); border-radius: 12px;
  padding: 0 12px; font-size: 14px; color: var(--fg); background: var(--field);
  transition: border-color .15s ease, box-shadow .15s ease;
}
.panel input::placeholder, .bubble .answer input::placeholder { color: var(--muted); }
.panel input:focus, .bubble .answer input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--ring); }

.mic {
  width: 42px; height: 42px; flex: none; display: grid; place-items: center; border: 0; border-radius: 12px; cursor: pointer;
  background: var(--soft); color: var(--fg-2); user-select: none; -webkit-user-select: none; touch-action: none;
  transition: background .15s ease, color .15s ease;
}
.mic:hover { background: var(--soft-hover); color: var(--fg); }
.mic.live { background: #ef4444; color: #fff; animation: dikhavu-orb 1s ease-in-out infinite; }

button.icon {
  width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 8px; cursor: pointer;
  background: transparent; color: var(--muted); transition: background .15s ease, color .15s ease;
}
button.icon:hover { background: var(--soft); color: var(--fg); }
button.icon[aria-pressed="true"] { color: var(--accent); }

button.b {
  border: 0; cursor: pointer; border-radius: 999px; padding: 8px 16px; font-size: 13px; font-weight: 600;
  background: var(--soft); color: var(--fg-2); transition: background .15s ease, filter .15s ease;
}
button.b:hover { background: var(--soft-hover); }
button.b.primary { background: var(--accent); color: #fff; }
button.b.primary:hover { filter: brightness(1.08); }

/* ---- bubble (the step card) ---- */
.bubble {
  position: fixed; width: 320px; max-width: calc(100vw - 24px); pointer-events: auto;
  background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 16px; padding: 14px 16px;
  box-shadow: var(--shadow); font-size: 14px; line-height: 1.5;
  opacity: 0; transform: translateY(4px); transition: opacity .2s ease, transform .2s ease;
}
.bubble.on { opacity: 1; transform: none; }
.bubble .meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 11px; color: var(--muted); font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }
.bubble .text { white-space: pre-line; }
.bubble .answer { display: flex; gap: 6px; margin-top: 12px; }
.bubble .answer input { height: 38px; border-radius: 10px; }
.bubble .answer .mic { width: 38px; height: 38px; border-radius: 10px; }
.bubble .send {
  width: 38px; height: 38px; flex: none; display: grid; place-items: center; border: 0; border-radius: 10px; cursor: pointer;
  background: var(--accent); color: #fff; transition: filter .15s ease;
}
.bubble .send:hover { filter: brightness(1.08); }
.bubble .answer-hint { margin: 6px 2px 0; font-size: 12px; color: var(--muted); min-height: 1em; }
.bubble .answer-hint:empty { display: none; }
.bubble .answer-hint[data-state="listening"] { color: #ef4444; font-weight: 600; }
.bubble .answer-hint[data-state="listening"]::before {
  content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ef4444;
  margin-right: 6px; vertical-align: 1px; animation: dikhavu-orb 1s ease-in-out infinite;
}
.bubble .answer-hint[data-state="problem"] { color: #d97706; }
.bubble .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; flex-wrap: wrap; }

/* ---- launcher ---- */
.launcher {
  position: fixed; right: 20px; bottom: 20px; pointer-events: auto; display: flex; align-items: center; gap: 10px;
  border: 0; cursor: pointer; border-radius: 999px; padding: 8px 18px 8px 8px;
  background: var(--accent); color: #fff; font-size: 14px; font-weight: 600; letter-spacing: .01em;
  box-shadow: 0 10px 28px color-mix(in srgb, var(--accent) 35%, rgba(0,0,0,.25));
  transition: transform .15s ease, box-shadow .15s ease;
}
.launcher:hover { transform: translateY(-1px); }
.launcher .dot { width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,.18); display: grid; place-items: center; }
.launcher .dot .ico { width: 16px; height: 16px; }
.launcher.hidden { display: none; }

/* ---- help panel ---- */
.panel {
  position: fixed; right: 20px; bottom: 80px; width: 360px; max-width: calc(100vw - 24px); pointer-events: auto;
  background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 16px; padding: 16px;
  box-shadow: var(--shadow); font-size: 14px;
  display: none;
}
.panel.on { display: block; animation: dikhavu-in .18s ease-out; }
@keyframes dikhavu-in { from { opacity: 0; transform: translateY(6px); } }
.panel header { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 14px; }
.panel h2 { font-size: 16px; margin: 0; font-weight: 700; color: var(--fg); }
.panel .controls { display: flex; gap: 2px; align-items: center; }
.panel select {
  appearance: none; -webkit-appearance: none; cursor: pointer; margin-right: 4px;
  font-size: 13px; height: 32px; border: 1px solid var(--border-strong); border-radius: 8px; padding: 0 28px 0 10px;
  color: var(--fg); background: var(--field) ${SELECT_ARROW} no-repeat right 8px center / 14px;
}
.panel select option { background: var(--bg); color: var(--fg); }
.panel form { display: flex; gap: 8px; }
.hint { font-size: 12px; color: var(--muted); margin: 8px 2px 0; }
.msg { margin: 12px 2px 0; font-size: 13px; color: var(--fg-2); line-height: 1.5; }
.msg:empty { display: none; }
.list-title { margin: 18px 2px 8px; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
.flows { display: flex; flex-direction: column; gap: 6px; }
.flows button {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left;
  border: 1px solid var(--border); background: transparent; color: var(--fg); border-radius: 12px;
  padding: 11px 12px 11px 14px; font-size: 14px; font-weight: 500; cursor: pointer;
  transition: border-color .15s ease, background .15s ease;
}
.flows button .ico { width: 16px; height: 16px; color: var(--muted); transition: transform .15s ease, color .15s ease; }
.flows button:hover { border-color: var(--accent); background: var(--soft); }
.flows button:hover .ico { color: var(--accent); transform: translateX(2px); }

/* ---- listening pill ---- */
.listening {
  position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%); pointer-events: none;
  display: none; align-items: center; gap: 12px; max-width: min(560px, calc(100vw - 24px));
  background: var(--pill); color: #fff; border: 1px solid var(--border); border-radius: 999px; padding: 10px 20px 10px 10px; font-size: 14px;
  box-shadow: 0 12px 36px rgba(0,0,0,.35);
}
.listening.on { display: flex; }
.listening .orb { width: 32px; height: 32px; flex: none; border-radius: 50%; background: #ef4444; display: grid; place-items: center; animation: dikhavu-orb 1s ease-in-out infinite; }
.listening .orb .ico { width: 16px; height: 16px; }
@keyframes dikhavu-orb { 50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, .25); } }
.listening .heard { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  .spot, .bubble, .cursor, .launcher { transition: none; }
  .spot.on::after, .listening .orb, .mic.live, .panel.on { animation: none; }
}
`;
}
