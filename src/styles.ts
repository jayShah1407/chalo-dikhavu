export function css(color: string): string {
  return `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Gujarati", sans-serif; }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; }

.spot {
  position: fixed; border-radius: 10px; pointer-events: none; opacity: 0;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.45);
  outline: 2px solid ${color}; outline-offset: 2px;
  transition: left .25s ease, top .25s ease, width .25s ease, height .25s ease, opacity .2s ease;
}
.spot.on { opacity: 1; }
.spot.on::after {
  content: ""; position: absolute; inset: -6px; border-radius: 14px;
  border: 2px solid ${color}; animation: raahi-pulse 1.6s ease-out infinite;
}
@keyframes raahi-pulse { from { opacity: .8; transform: scale(1); } to { opacity: 0; transform: scale(1.12); } }

.cursor {
  position: fixed; left: 0; top: 0; width: 28px; height: 28px; opacity: 0;
  transition: opacity .2s ease; will-change: transform;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,.35));
}
.cursor.on { opacity: 1; }
.cursor svg { width: 28px; height: 28px; display: block; }
.cursor .ring {
  position: absolute; left: -10px; top: -10px; width: 20px; height: 20px; border-radius: 50%;
  border: 3px solid ${color}; opacity: 0;
}
.cursor.tap .ring { animation: raahi-tap .6s ease-out; }
@keyframes raahi-tap { from { opacity: 1; transform: scale(.4); } to { opacity: 0; transform: scale(2.2); } }

.bubble {
  position: fixed; width: 300px; max-width: calc(100vw - 24px); pointer-events: auto;
  background: #fff; color: #0f172a; border-radius: 14px; padding: 14px 16px 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, .25); font-size: 14px; line-height: 1.45;
  opacity: 0; transform: translateY(4px); transition: opacity .2s ease, transform .2s ease;
}
.bubble.on { opacity: 1; transform: none; }
.bubble .meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 11px; color: #64748b; font-weight: 600; letter-spacing: .02em; }
.bubble .text { white-space: pre-line; }
.bubble .answer { display: flex; gap: 6px; margin-top: 10px; }
.bubble .answer input {
  flex: 1; min-width: 0; border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px 10px; font-size: 14px; color: #0f172a; background: #fff;
}
.bubble .answer input:focus { outline: 2px solid ${color}; outline-offset: -1px; border-color: transparent; }
.bubble .answer button { padding: 7px 12px; }
.bubble .answer .mic { width: 38px; height: 36px; padding: 0; border-radius: 10px; }
.bubble .answer-hint { margin: 6px 2px 0; font-size: 12px; color: #64748b; min-height: 1em; }
.bubble .answer-hint:empty { display: none; }
.bubble .answer-hint[data-state="listening"] { color: #dc2626; font-weight: 600; }
.bubble .answer-hint[data-state="listening"]::before {
  content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ef4444;
  margin-right: 6px; vertical-align: 1px; animation: raahi-orb 1s ease-in-out infinite;
}
.bubble .answer-hint[data-state="problem"] { color: #b45309; }
.bubble .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; flex-wrap: wrap; }

button.b {
  border: 0; cursor: pointer; border-radius: 999px; padding: 7px 14px; font-size: 13px; font-weight: 600;
  background: #f1f5f9; color: #334155;
}
button.b:hover { background: #e2e8f0; }
button.b.primary { background: ${color}; color: #fff; }
button.b.primary:hover { filter: brightness(1.08); }
button.icon { border: 0; background: transparent; cursor: pointer; font-size: 15px; padding: 2px 4px; border-radius: 6px; color: #475569; }
button.icon:hover { background: #f1f5f9; }

.launcher {
  position: fixed; right: 20px; bottom: 20px; pointer-events: auto; display: flex; align-items: center; gap: 8px;
  border: 0; cursor: pointer; border-radius: 999px; padding: 12px 18px 12px 14px;
  background: ${color}; color: #fff; font-size: 14px; font-weight: 600;
  box-shadow: 0 8px 24px rgba(15, 23, 42, .25);
}
.launcher .dot { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,.2); display: grid; place-items: center; font-size: 15px; }
.launcher.hidden { display: none; }

.panel {
  position: fixed; right: 20px; bottom: 84px; width: 340px; max-width: calc(100vw - 24px); pointer-events: auto;
  background: #fff; color: #0f172a; border-radius: 18px; padding: 16px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, .28); font-size: 14px;
  display: none;
}
.panel.on { display: block; }
.panel header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.panel h2 { font-size: 16px; margin: 0; font-weight: 700; }
.panel select { font-size: 12px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 3px 6px; background: #fff; color: #0f172a; }
.panel form { display: flex; gap: 6px; }
.panel input {
  flex: 1; min-width: 0; border: 1px solid #cbd5e1; border-radius: 12px; padding: 9px 12px; font-size: 14px; color: #0f172a; background: #fff;
}
.panel input:focus { outline: 2px solid ${color}; outline-offset: -1px; border-color: transparent; }
.mic {
  width: 40px; flex: none; border: 0; border-radius: 12px; cursor: pointer; font-size: 17px;
  background: #f1f5f9; user-select: none; -webkit-user-select: none; touch-action: none;
}
.mic.live { background: #ef4444; color: #fff; }
.hint { font-size: 11px; color: #64748b; margin: 6px 2px 0; }
.msg { margin: 12px 2px 0; font-size: 13px; color: #334155; }
.msg:empty { display: none; }
.list-title { margin: 14px 2px 6px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
.flows { display: flex; flex-direction: column; gap: 6px; }
.flows button {
  text-align: left; border: 1px solid #e2e8f0; background: #fff; color: #0f172a; border-radius: 12px;
  padding: 9px 12px; font-size: 13px; cursor: pointer; font-weight: 500;
}
.flows button:hover { border-color: ${color}; color: ${color}; }

.listening {
  position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%); pointer-events: none;
  display: none; align-items: center; gap: 12px; max-width: min(560px, calc(100vw - 24px));
  background: #0f172a; color: #fff; border-radius: 999px; padding: 12px 20px 12px 14px; font-size: 14px;
  box-shadow: 0 12px 36px rgba(0,0,0,.35);
}
.listening.on { display: flex; }
.listening .orb { width: 30px; height: 30px; flex: none; border-radius: 50%; background: #ef4444; display: grid; place-items: center; animation: raahi-orb 1s ease-in-out infinite; }
@keyframes raahi-orb { 50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, .25); } }
.listening .heard { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  .spot, .bubble, .cursor { transition: none; }
  .spot.on::after, .listening .orb { animation: none; }
}
`;
}
