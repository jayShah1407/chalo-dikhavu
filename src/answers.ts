import type { FieldInfo, FieldOption } from "./fields";
import { scoreText } from "./intent";

/**
 * Turn what someone said (or typed) into a value a field accepts.
 * Speech-to-text gives "nine eight two five…", "jay dot shah at gmail dot com",
 * "चौदह जुलाई 1998"; forms want "9825…", "jay.shah@gmail.com", "1998-07-14".
 */

export type Parsed = { ok: true; value: string; display: string } | { ok: false };

const DIGIT_WORDS: Record<string, string> = {
  // Not "no", "to" or "for": "mobile no is…", "set it to…" would turn into digits.
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9",
  // Hinglish
  shunya: "0", ek: "1", do: "2", teen: "3", tin: "3", char: "4", chaar: "4", paanch: "5", panch: "5",
  chhe: "6", che: "6", chah: "6", saat: "7", aath: "8", nau: "9",
  // Hindi
  "शून्य": "0", "एक": "1", "दो": "2", "तीन": "3", "चार": "4", "पाँच": "5", "पांच": "5",
  "छह": "6", "छः": "6", "छे": "6", "सात": "7", "आठ": "8", "नौ": "9",
  // Gujarati
  "એક": "1", "બે": "2", "ત્રણ": "3", "ચાર": "4", "પાંચ": "5", "છ": "6", "સાત": "7", "આઠ": "8", "નવ": "9", "શૂન્ય": "0",
};
const REPEAT: Record<string, number> = { double: 2, triple: 3, "डबल": 2, "ट्रिपल": 3 };

/** Devanagari/Gujarati digits → ASCII. */
function asciiDigits(s: string): string {
  return s
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x966))
    .replace(/[૦-૯]/g, (d) => String(d.charCodeAt(0) - 0xae6));
}

/** "nine eight double two 5 4" → "982254". Words that aren't digits are ignored. */
export function spokenDigits(text: string): string {
  let out = "";
  let repeat = 1;
  for (const raw of asciiDigits(text).toLowerCase().split(/[\s,.-]+/)) {
    if (!raw) continue;
    if (REPEAT[raw]) {
      repeat = REPEAT[raw];
      continue;
    }
    const d = /^\d+$/.test(raw) ? raw : DIGIT_WORDS[raw];
    if (d) {
      out += d.length === 1 ? d.repeat(repeat) : d;
      repeat = 1;
    }
  }
  return out;
}

export function parseEmail(text: string): Parsed {
  const value = asciiDigits(text)
    .toLowerCase()
    .replace(/\b(at the rate( of)?|at)\b|एट द रेट|एट/g, "@")
    .replace(/\b(dot|period)\b|डॉट/g, ".")
    .replace(/\b(underscore)\b|अंडरस्कोर/g, "_")
    .replace(/\b(dash|hyphen)\b/g, "-")
    .replace(/\s+/g, "")
    .replace(/\.$/, "");
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(value) ? { ok: true, value, display: value } : { ok: false };
}

export function parsePhone(text: string): Parsed {
  let digits = spokenDigits(text.replace(/\+/g, " "));
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length < 7 || digits.length > 13) return { ok: false };
  return { ok: true, value: digits, display: digits.replace(/(\d{5})(\d+)/, "$1 $2") };
}

const MONTHS: Array<string[]> = [
  ["jan", "january", "जनवरी", "જાન્યુઆરી"],
  ["feb", "february", "फ़रवरी", "फरवरी", "ફેબ્રુઆરી"],
  ["mar", "march", "मार्च", "માર્ચ"],
  ["apr", "april", "अप्रैल", "એપ્રિલ"],
  ["may", "मई", "મે"],
  ["jun", "june", "जून", "જૂન"],
  ["jul", "july", "जुलाई", "જુલાઈ"],
  ["aug", "august", "अगस्त", "ઑગસ્ટ", "ઓગસ્ટ"],
  ["sep", "sept", "september", "सितंबर", "सितम्बर", "સપ્ટેમ્બર"],
  ["oct", "october", "अक्टूबर", "ઑક્ટોબર", "ઓક્ટોબર"],
  ["nov", "november", "नवंबर", "नवम्बर", "નવેમ્બર"],
  ["dec", "december", "दिसंबर", "दिसम्बर", "ડિસેમ્બર"],
];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthOf(word: string): number {
  const w = word.toLowerCase();
  const i = MONTHS.findIndex((names) => names.includes(w));
  return i >= 0 ? i + 1 : 0;
}

/** "14 July 1998", "July 14th, 1998", "14/7/1998", "1998-07-14", "14 जुलाई 1998". Day-first, Indian style. */
export function parseDate(text: string, iso: boolean): Parsed {
  const t = asciiDigits(text).toLowerCase().replace(/(\d+)(st|nd|rd|th)\b/g, "$1").replace(/,/g, " ");
  let d = 0, m = 0, y = 0;
  let match: RegExpMatchArray | null;
  if ((match = t.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/))) {
    [y, m, d] = [+match[1], +match[2], +match[3]];
  } else if ((match = t.match(/\b(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})\b/))) {
    [d, m, y] = [+match[1], +match[2], +match[3]];
  } else {
    const words = t.split(/\s+/).filter(Boolean);
    const mi = words.findIndex((w) => monthOf(w));
    if (mi >= 0) {
      m = monthOf(words[mi]);
      const nums = words.filter((w) => /^\d+$/.test(w)).map(Number);
      y = nums.find((n) => n > 31) ?? 0;
      d = nums.find((n) => n >= 1 && n <= 31) ?? 0;
    }
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = y >= 1900 && y <= 2100 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  if (!valid) return { ok: false };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    ok: true,
    value: iso ? `${y}-${pad(m)}-${pad(d)}` : `${pad(d)}/${pad(m)}/${y}`,
    display: `${d} ${MONTH_NAMES[m - 1]} ${y}`,
  };
}

// Whole words only: "ना" must not match inside "नाम", nor "मत" inside "मतलब".
const YES = new Set([
  "yes", "yeah", "yep", "yup", "yea", "correct", "right", "sure", "ok", "okay",
  "haan", "haa", "ha", "han", "ji", "theek", "thik", "sahi",
  "हाँ", "हां", "हा", "जी", "सही", "ठीक", "હા", "બરાબર",
]);
const NO = new Set([
  "no", "nope", "nah", "not", "wrong", "nahi", "nahin", "na", "galat", "mat",
  "नहीं", "नही", "ना", "गलत", "ग़लत", "मत", "ના", "નહીં", "નહિ", "ખોટું",
]);

/** true / false / null (couldn't tell). "No" wins over "yes" in "no, that's not right". */
export function parseYesNo(text: string): boolean | null {
  const words = text.toLowerCase().split(/[^\p{L}\p{M}]+/u).filter(Boolean);
  if (words.some((w) => NO.has(w))) return false;
  if (words.some((w) => YES.has(w))) return true;
  return null;
}

const ORDINALS: Array<RegExp> = [
  // Not bare "one"/"two": "the second one" must mean the second option.
  /\b(first|1st|pehla|pahla)\b|पहला|पहली|પહેલું/,
  /\b(second|2nd|dusra|doosra)\b|दूसरा|दूसरी|બીજું/,
  /\b(third|3rd|teesra|tisra)\b|तीसरा|तीसरी|ત્રીજું/,
  /\b(fourth|4th|chautha)\b|चौथा|चौथी/,
];

/** Pick an option by name ("savings"), by position ("the second one", "दूसरा") or by number. */
export function parseChoice(text: string, options: FieldOption[]): Parsed {
  if (!options.length) return { ok: false };
  const scored = options
    .map((o) => ({ o, score: Math.max(scoreText(text, o.label), scoreText(text, o.value)) }))
    .sort((a, b) => b.score - a.score);
  let pick: FieldOption | undefined = scored[0].score >= 0.5 ? scored[0].o : undefined;
  if (!pick) {
    const t = asciiDigits(text).toLowerCase().trim();
    const byOrdinal = ORDINALS.findIndex((re) => re.test(t));
    if (byOrdinal >= 0) pick = options[byOrdinal];
    else {
      // "2", "two", "do" (Hindi for two).
      const n = spokenDigits(t);
      if (/^\d$/.test(n)) pick = options[+n - 1];
    }
  }
  return pick ? { ok: true, value: pick.value, display: pick.label } : { ok: false };
}

function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w));
}

/** Parse an answer for a field. Typed answers are trusted more: they skip speech fixes. */
export function parseAnswer(info: FieldInfo, text: string, typed = false): Parsed {
  const raw = text.trim().replace(/[.!?।]+$/, "");
  if (!raw) return { ok: false };
  switch (info.kind) {
    case "email":
      return typed && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(raw) ? { ok: true, value: raw, display: raw } : parseEmail(raw);
    case "phone":
      return parsePhone(raw);
    case "pincode": {
      const pin = spokenDigits(raw);
      return pin.length === 6 ? { ok: true, value: pin, display: pin.split("").join(" ") } : { ok: false };
    }
    case "number": {
      const n = asciiDigits(raw).replace(/[, ]/g, "");
      if (/^-?\d+(\.\d+)?$/.test(n)) return { ok: true, value: n, display: n };
      const d = spokenDigits(raw);
      return d ? { ok: true, value: d, display: d } : { ok: false };
    }
    case "date":
      return parseDate(raw, info.isoDate);
    case "pan": {
      // Speech tends to split letters: "a b c p e 1 2 3 4 f".
      const pan = asciiDigits(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
      return /^[A-Z]{5}\d{4}[A-Z]$/.test(pan) ? { ok: true, value: pan, display: pan.split("").join(" ") } : { ok: false };
    }
    case "choice":
      return parseChoice(raw, info.options);
    case "check": {
      const yes = parseYesNo(raw);
      return yes === null ? { ok: false } : { ok: true, value: yes ? "yes" : "no", display: yes ? "✓" : "✗" };
    }
    case "name": {
      const name = typed ? raw : titleCase(raw);
      return { ok: true, value: name, display: name };
    }
    default:
      return { ok: true, value: raw, display: raw };
  }
}
