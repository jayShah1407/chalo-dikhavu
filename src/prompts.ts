import type { FieldInfo } from "./fields";
import { ui } from "./i18n";

/** "Full Name" → "full name" mid-sentence in English, but keep "PAN", "IFSC", "Aadhaar". */
function inSentence(label: string, lang: string): string {
  if (lang !== "en") return label;
  return label
    .split(" ")
    .map((w) => (/^[^A-Za-z0-9]*[A-Z0-9]{2,}[^A-Za-z0-9]*$/.test(w) ? w : w.toLowerCase()))
    .join(" ");
}

/** Labels like "Are you a politically exposed person (PEP)?" are already the question. */
const isQuestionLabel = (label: string) => /[?？]\s*$/.test(label);

function short(text: string): string {
  return text.length > 40 ? text.slice(0, 38).trimEnd() + "…" : text;
}

/** The question for "do it with me" mode: "What's your mobile number?" */
export function questionFor(info: FieldInfo, lang: string): string {
  const label = inSentence(info.label, lang);
  if (info.kind === "choice") {
    const options = info.options.slice(0, 5).map((o) => short(o.label)).join(", ");
    if (isQuestionLabel(info.label)) return `${info.label} ${ui(lang, "youCanSay", { options })}`;
    return ui(lang, "askChoice", { label, options });
  }
  if (isQuestionLabel(info.label)) return info.label;
  if (info.kind === "check") return ui(lang, "askCheck", { label: info.label });
  return ui(lang, "askText", { label });
}

/** The pointer text for "just show me" mode: "Enter your mobile number here." */
export function guideTextFor(info: FieldInfo, lang: string): string {
  const label = inSentence(info.label, lang);
  if (info.kind === "choice") return ui(lang, "chooseHere", { label: info.label });
  if (info.kind === "check") return ui(lang, "tickHere", { label: info.label });
  return ui(lang, "enterHere", { label });
}

/** Visible name of a button or link, for "Click “Open account”." */
export function buttonLabel(el: Element): string {
  const input = el as HTMLInputElement;
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.trim();
  // A card-style link reads "Open an account / Savings, current or salary": name it by
  // its first visible line, not all its text run together.
  const rendered = (el as HTMLElement).innerText;
  const lines = (rendered ?? el.textContent ?? "").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const text = rendered ? lines[0] ?? "" : lines.join(" ");
  return short(text) || (el.tagName === "INPUT" ? input.value : "") || el.getAttribute("title") || "";
}
