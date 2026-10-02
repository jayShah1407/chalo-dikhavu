import { pick } from "./i18n";
import type { Flow } from "./types";

/**
 * Filler words in English, Hindi and romanized Hindi ("Hinglish") that carry
 * no intent: "how do I", "kaise kare", "मुझे ... कैसे करना है".
 */
const STOPWORDS = new Set([
  // English
  "a", "an", "the", "how", "do", "does", "i", "me", "my", "to", "can", "could",
  "should", "where", "what", "is", "are", "want", "wanna", "please", "pls",
  "for", "of", "in", "on", "and", "or", "it", "this", "that", "with", "show",
  "tell", "help", "guide", "way", "some", "new",
  // Hinglish
  "kaise", "kese", "kaisay", "karu", "karun", "karen", "kare", "karna", "karni",
  "karo", "hai", "hain", "ka", "ki", "ke", "ko", "mein", "me", "mujhe", "muje",
  "kya", "kahan", "kaha", "se", "par", "pe", "batao", "bataiye", "dikhao", "ek",
  // Hindi
  "कैसे", "करूँ", "करूं", "करें", "करे", "करना", "करनी", "करो", "है", "हैं",
  "का", "की", "के", "को", "में", "मुझे", "क्या", "कहाँ", "कहां", "से", "पर",
  "बताओ", "बताइए", "दिखाओ", "एक",
  // Gujarati
  "કેવી", "રીતે", "કરવું", "કરું", "છે", "માં", "મને", "શું", "ક્યાં",
]);

/** Lowercase, drop punctuation (including the Devanagari danda), keep letters and marks of any script. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Tolerate plurals, typos and speech-to-text slips: "teachers"≈"teacher", "techer"≈"teacher". */
function similar(a: string, b: string): boolean {
  if (a === b) return true;
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  if (short.length < 4) return false;
  // Suffixes only ("teacher"→"teachers", "book"→"booking"), not new words ("class"→"classroom").
  if (long.startsWith(short) && long.length - short.length <= 3) return true;
  return editDistance(a, b) <= (short.length >= 8 ? 2 : 1);
}

function phrasesOf(flow: Flow): string[] {
  const phrases: string[] = [];
  const title = flow.title;
  if (typeof title === "string") phrases.push(title);
  else phrases.push(...Object.values(title));
  const kw = flow.keywords;
  if (Array.isArray(kw)) phrases.push(...kw);
  else if (kw) for (const list of Object.values(kw)) phrases.push(...list);
  return phrases;
}

/**
 * How well a query fits one phrase, 0..1. Mostly "how much of the phrase did
 * the user say", with a little weight on "how much of what they said was
 * about this phrase" so an exact short query beats a long rambling one.
 */
function scorePhrase(query: string[], phrase: string[]): number {
  if (!query.length || !phrase.length) return 0;
  const hits = phrase.filter((p) => query.some((q) => similar(q, p))).length;
  const used = query.filter((q) => phrase.some((p) => similar(q, p))).length;
  return 0.75 * (hits / phrase.length) + 0.25 * (used / query.length);
}

/** How well free text matches a phrase, 0..1 (typo- and plural-tolerant). */
export function scoreText(text: string, phrase: string): number {
  return scorePhrase(tokenize(text), tokenize(phrase));
}

export interface Match {
  flow: Flow;
  score: number;
}

/** Flows ranked by how well they match the query, best first. Zero scores are dropped. */
export function rankFlows(query: string, flows: Flow[]): Match[] {
  const q = tokenize(query);
  return flows
    .map((flow) => ({
      flow,
      score: Math.max(0, ...phrasesOf(flow).map((p) => scorePhrase(q, tokenize(p)))),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

export type Resolution =
  | { kind: "start"; flow: Flow }
  | { kind: "choose"; options: Flow[] }
  | { kind: "none" };

/** Decide what to do with a question: start a flow outright, offer choices, or give up. */
export function resolve(query: string, flows: Flow[]): Resolution {
  const ranked = rankFlows(query, flows);
  const [best, second] = ranked;
  if (!best || best.score < 0.35) return { kind: "none" };
  const clearWinner = best.score >= 0.6 && (!second || best.score - second.score >= 0.15);
  if (clearWinner) return { kind: "start", flow: best.flow };
  return { kind: "choose", options: ranked.filter((m) => m.score >= 0.35).slice(0, 3).map((m) => m.flow) };
}

export function flowTitle(flow: Flow, lang: string): string {
  return pick(flow.title, lang);
}
