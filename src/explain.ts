import type { FieldInfo } from "./fields";
import { pick } from "./i18n";
import type { AiOptions, ExplainRequest, Flow, LocalizedText } from "./types";

// Word lists, not regex \b: JavaScript's \b only knows ASCII letters, so it
// never matches around Hindi or Gujarati words.
const QUESTION_START = new Set([
  "why", "what", "what's", "whats", "how", "is", "are", "can", "could", "do", "does", "should", "will",
  "who", "where", "which", "kyu", "kyun", "kyon", "kya", "kaise", "kaun", "kahan", "kis",
  "क्यों", "क्यूँ", "क्या", "कैसे", "कौन", "कहाँ", "किस", "કેમ", "શું", "કેવી", "કોણ", "ક્યાં",
]);
// Not "purpose"/"safe": "for business purpose" is a fine answer to "Purpose of account".
const QUESTION_ANYWHERE = new Set([
  "why", "kyu", "kyun", "kyon", "matlab", "zaroori", "jaruri", "zaruri",
  "क्यों", "क्यूँ", "मतलब", "ज़रूरी", "जरूरी", "કેમ", "જરૂરી",
]);
const GUIDE_START = new Set(["how", "kaise", "कैसे", "કેવી"]);

const words = (text: string) => text.trim().toLowerCase().split(/[^\p{L}\p{M}\p{N}']+/u).filter(Boolean);

/**
 * Is the user asking something instead of answering? "why do you need my PAN",
 * "PAN kyu chahiye", "यह क्यों ज़रूरी है?" — while "Jay Shah" or "savings" is an answer.
 */
export function isQuestion(text: string): boolean {
  const w = words(text);
  if (/[?？]\s*$/.test(text)) return true;
  if (w.length < 2) return false;
  return QUESTION_START.has(w[0]) || w.some((x) => QUESTION_ANYWHERE.has(x));
}

/** "How do I…" is a request for a guide; "why/what/is it…" wants an explanation. */
export function wantsExplanation(text: string): boolean {
  const w = words(text);
  if (GUIDE_START.has(w[0]) || w.join(" ").includes("how to")) return false;
  return isQuestion(text);
}

/**
 * Build what the AI sees. Deliberately only labels and the developer's own
 * knowledge text: never the values typed into the form. A bank can show this
 * object to its compliance team as the complete list of what leaves the page.
 */
export function buildRequest(
  question: string,
  lang: string,
  flow: Flow | null,
  field: FieldInfo | null,
  formFields: FieldInfo[],
  siteKnowledge?: LocalizedText,
): ExplainRequest {
  const knowledge = [pick(siteKnowledge, lang), flow ? pick(flow.knowledge, lang) : ""].filter(Boolean).join("\n\n");
  return {
    question: question.slice(0, 500),
    lang,
    page: { title: document.title.slice(0, 120), path: location.pathname },
    flow: flow ? { id: flow.id, title: pick(flow.title, lang) } : null,
    knowledge: knowledge.slice(0, 12000),
    field: field ? { label: field.label, kind: field.kind, required: field.required } : null,
    formFields: formFields.map((f) => f.label).slice(0, 60),
  };
}

export class AiUnavailable extends Error {}

/** Ask the configured AI. Throws on network errors, quota exhaustion and timeouts. */
export async function callAi(ai: AiOptions, req: ExplainRequest, signal?: AbortSignal): Promise<string> {
  if (ai.answer) return (await ai.answer(req)).trim();
  if (!ai.endpoint) throw new AiUnavailable("chalo-dikhavu: ai.endpoint or ai.answer is required");
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 30000);
  signal?.addEventListener("abort", () => timeout.abort(), { once: true });
  try {
    const res = await fetch(ai.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(ai.projectKey ? { authorization: `Bearer ${ai.projectKey}` } : {}),
      },
      body: JSON.stringify(req),
      signal: timeout.signal,
    });
    const body = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
    if (!res.ok || !body.answer) throw new AiUnavailable(body.error ?? `HTTP ${res.status}`);
    return body.answer.trim();
  } finally {
    clearTimeout(timer);
  }
}
