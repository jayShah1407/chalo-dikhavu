import type { FieldInfo, FieldOption } from "./fields";
import type { UiKey } from "./i18n";
import { scoreText } from "./intent";
import { asciiDigits, isNumberWord, spokenDigits, spokenNumber, wordValue } from "./numbers";
import { hasIndicScript, romaniseName } from "./translit";

/**
 * Turn what someone said (or typed) into a value a field accepts.
 * Speech-to-text gives "nine eight two five…", "jay dot shah at gmail dot com",
 * "चौदह जुलाई 1998"; forms want "9825…", "jay.shah@gmail.com", "1998-07-14".
 */

/** Why an answer didn't fit, so the guide can say something more useful than "say it again". */
export type Hint = Extract<UiKey, `hint${string}`>;
export type Parsed =
  | { ok: true; value: string; display: string }
  | { ok: false; why?: Hint; vars?: Record<string, string | number> };

export { spokenDigits, spokenNumber };

const fail = (why?: Hint, vars?: Record<string, string | number>): Parsed => (why ? { ok: false, why, vars } : { ok: false });

/** Words for email symbols and common domains, as English or Hindi/Gujarati speech-to-text writes them. */
const EMAIL_WORDS = new Map<string, string>(Object.entries({
  at: "@", "एट": "@", "ऐट": "@", "એટ": "@",
  dot: ".", period: ".", "डॉट": ".", "डोट": ".", "ડોટ": ".", "ડૉટ": ".",
  underscore: "_", "अंडरस्कोर": "_", "અંડરસ્કોર": "_",
  dash: "-", hyphen: "-", "डैश": "-", "हाइफ़न": "-", "हाइफन": "-",
  "जीमेल": "gmail", "જીમેલ": "gmail", "याहू": "yahoo", "યાહૂ": "yahoo", "हॉटमेल": "hotmail", "આઉટલુક": "outlook",
  "आउटलुक": "outlook", "रेडिफमेल": "rediffmail", "रेडिफ़मेल": "rediffmail", "आईक्लाउड": "icloud",
  "कॉम": "com", "कोम": "com", "કોમ": "com", "કૉમ": "com", "इन": "in", "ઇન": "in", "નેટ": "net", "नेट": "net",
  "ऑर्ग": "org", "को": "co", "કો": "co",
  capital: "", small: "",
}));

export function parseEmail(text: string): Parsed {
  const tokens = asciiDigits(text)
    .toLowerCase()
    .replace(/\bat the rate( of)?\b|एट द रेट( ऑफ़?)?|ऐट द रेट|એટ ધ રેટ/g, " @ ")
    .split(/\s+/)
    .filter(Boolean);
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const word = EMAIL_WORDS.get(t);
    if (word !== undefined) {
      out += word;
      continue;
    }
    // "jay one four" → "jay14": two or more digit words in a row are digits, one alone may be a word.
    if (isNumberWord(t) && !/^\d+$/.test(t)) {
      let j = i;
      while (j < tokens.length && isNumberWord(tokens[j])) j++;
      const run = tokens.slice(i, j).join(" ");
      if (j - i >= 2 || ((wordValue(t) ?? 99) < 10 && /\d$/.test(out))) {
        out += spokenDigits(run);
        i = j - 1;
        continue;
      }
    }
    // A Hindi/Gujarati-script word in the address: write it in English letters ("जय" → "jay").
    out += hasIndicScript(t) ? romaniseName(t).toLowerCase() : t;
  }
  const value = out.replace(/\.$/, "");
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(value) ? { ok: true, value, display: value } : fail("hintEmail");
}

/**
 * Indian mobile numbers have 10 digits after +91 or a leading 0; anything else is
 * almost always a digit lost or doubled by speech-to-text, so ask again. Typed
 * numbers are trusted more (landlines, short numbers). "+44 …" is kept as is.
 */
export function parsePhone(text: string, typed = false): Parsed {
  const international = /^\s*(\+|plus\b)/i.test(text);
  let digits = spokenDigits(text.replace(/\+/g, " "));
  if (international && !digits.startsWith("91") && digits.length >= 7 && digits.length <= 15) {
    return { ok: true, value: `+${digits}`, display: `+${digits}` };
  }
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  const fits = typed ? digits.length >= 6 && digits.length <= 15 : digits.length === 10;
  if (!fits) return digits.length ? fail("hintPhone", { count: digits.length }) : fail();
  return { ok: true, value: digits, display: digits.length === 10 ? digits.replace(/(\d{5})(\d+)/, "$1 $2") : digits };
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

const ORDINAL_WORDS = new Map<string, string>(Object.entries({
  first: "one", second: "two", third: "three", fourth: "four", fifth: "five", sixth: "six", seventh: "seven",
  eighth: "eight", ninth: "nine", tenth: "ten", eleventh: "eleven", twelfth: "twelve", thirteenth: "thirteen",
  fourteenth: "fourteen", fifteenth: "fifteen", sixteenth: "sixteen", seventeenth: "seventeen",
  eighteenth: "eighteen", nineteenth: "nineteen", twentieth: "twenty", thirtieth: "thirty",
}));

/**
 * Number words → digits, run by run: "fourteenth of july nineteen ninety eight" →
 * "14 of july 1998", "चौदह जुलाई उन्नीस सौ अट्ठानवे" → "14 जुलाई 1998".
 */
function numberWordsToDigits(text: string): string {
  const raw = text.split(/\s+/).filter(Boolean);
  const tokens = raw.map((w) => ORDINAL_WORDS.get(w) ?? w);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    // "may" is a month, not a number.
    if (!isNumberWord(tokens[i]) || /^\d+$/.test(tokens[i]) || monthOf(tokens[i])) {
      out.push(tokens[i]);
      continue;
    }
    let j = i;
    while (j < tokens.length && isNumberWord(tokens[j]) && !/^\d+$/.test(tokens[j]) && !monthOf(tokens[j])) {
      // An ordinal ends the day: "twenty first | two thousand five".
      if (ORDINAL_WORDS.has(raw[j++])) break;
    }
    const run = tokens.slice(i, j).join(" ");
    const n = spokenNumber(run);
    // "nineteen ninety eight" reads digit-by-pair (1998); "two thousand five" as a quantity (2005).
    out.push(/hundred|thousand|sau|hazaa?r|सौ|हज़?ार|સો|હજાર/.test(run) ? String(n ?? "") : spokenDigits(run));
    i = j - 1;
  }
  return out.join(" ");
}

/** "98" → 1998, "05" → 2005: two-digit years up to this year are this century. */
function fullYear(y: number): number {
  if (y >= 100) return y;
  const now = new Date().getFullYear() % 100;
  return y <= now ? 2000 + y : 1900 + y;
}

/** Field date formats like "DD-MM-YYYY", "YYYY/MM/DD", "MM/DD/YYYY". */
function formatDate(format: string, d: number, m: number, y: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return format.replace(/YYYY|YY|MM|DD/g, (t) => (t === "YYYY" ? String(y) : t === "YY" ? pad(y % 100) : t === "MM" ? pad(m) : pad(d)));
}

/**
 * "14 July 1998", "July 14th, 1998", "14/7/98", "fourteenth July nineteen ninety eight",
 * "चौदह जुलाई 1998". Day-first, Indian style, unless the field's `format` says month-first.
 * Output: ISO for date inputs, else the field's format, else dd/mm/yyyy.
 */
export function parseDate(text: string, iso: boolean, format?: string): Parsed {
  const t = numberWordsToDigits(asciiDigits(text).toLowerCase().replace(/(\d+)(st|nd|rd|th)\b/g, "$1").replace(/,/g, " "));
  const monthFirst = !!format && format.indexOf("MM") < format.indexOf("DD") && !format.startsWith("YY");
  let d = 0, m = 0, y = 0;
  let match: RegExpMatchArray | null;
  if ((match = t.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/))) {
    [y, m, d] = [+match[1], +match[2], +match[3]];
  } else if ((match = t.match(/\b(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4}|\d{2})\b/))) {
    [d, m, y] = monthFirst ? [+match[2], +match[1], fullYear(+match[3])] : [+match[1], +match[2], fullYear(+match[3])];
  } else {
    const words = t.split(/\s+/).filter(Boolean);
    const mi = words.findIndex((w) => monthOf(w));
    if (mi >= 0) {
      m = monthOf(words[mi]);
      const nums = words.filter((w) => /^\d+$/.test(w)).map(Number);
      // "14 July 1998", "July 14 98", "1998 July 14": a number over 31 is the year, else the second one is.
      const yi = nums.findIndex((n) => n > 31);
      const yearIndex = yi >= 0 ? yi : nums.length >= 2 ? 1 : -1;
      if (yearIndex >= 0) y = fullYear(nums[yearIndex]);
      d = nums.find((n, i) => i !== yearIndex && n >= 1 && n <= 31) ?? 0;
    }
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = y >= 1900 && y <= 2100 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  if (!valid) return fail("hintDate");
  return {
    ok: true,
    value: iso ? formatDate("YYYY-MM-DD", d, m, y) : formatDate(format ?? "DD/MM/YYYY", d, m, y),
    display: `${d} ${MONTH_NAMES[m - 1]} ${y}`,
  };
}

// Whole words only: "ना" must not match inside "नाम", nor "मत" inside "मतलब".
const YES = new Set([
  "yes", "yeah", "yep", "yup", "yea", "correct", "right", "sure", "ok", "okay", "absolutely", "exactly",
  "perfect", "definitely", "haan", "haa", "ha", "han", "haanji", "hanji", "ji", "theek", "thik", "sahi", "bilkul",
  "barabar", "हाँ", "हां", "हा", "हांजी", "जी", "सही", "ठीक", "बिल्कुल", "बिलकुल", "હા", "હાજી", "બરાબર", "સાચું", "સાચુ",
]);
const NO = new Set([
  "no", "nope", "nah", "not", "wrong", "incorrect", "nahi", "nahin", "nai", "na", "galat", "mat",
  "नहीं", "नही", "ना", "गलत", "ग़लत", "मत", "ના", "નહીં", "નહિ", "ખોટું", "ખોટુ",
]);
/** Phrases whose words say "no" but mean yes. */
const MEANS_YES = /\b(no problem|no issues?|not wrong|nothing wrong|galat nahi|of course)\b|ग़?गलत नहीं|ખોટું નથી/g;
/** "Not sure", "pata nahi": neither answer. */
const UNSURE = /\b(not sure|don'?t know|do not know|pata nahi|maybe|may be)\b|पता नहीं|मालूम नहीं|ખબર નથી/;

/** true / false / null (couldn't tell). "No" wins over "yes" in "no, that's not right". */
export function parseYesNo(text: string): boolean | null {
  const t = text.toLowerCase();
  if (UNSURE.test(t)) return null;
  const words = t.replace(MEANS_YES, " yes ").split(/[^\p{L}\p{M}']+/u).filter(Boolean);
  // "sahi hai na?" and "haan na": a trailing "na" asks for agreement, it doesn't say no.
  if (words.length > 1 && (words[words.length - 1] === "na" || words[words.length - 1] === "ना") && words.some((w) => YES.has(w))) words.pop();
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

/** Letter names as Hindi/Gujarati speech-to-text writes them: "एसबीआई" = S B I. */
const INDIC_LETTERS: Array<[string, string]> = ([
  ["डब्ल्यू", "W"], ["डबल्यू", "W"], ["क्यू", "Q"], ["एक्स", "X"], ["ज़ेड", "Z"], ["जेड", "Z"], ["ज़ेड", "Z"], ["वाई", "Y"],
  ["एफ", "F"], ["एफ़", "F"], ["एच", "H"], ["आई", "I"], ["जे", "J"], ["के", "K"], ["एल", "L"], ["एम", "M"], ["एन", "N"],
  ["पी", "P"], ["आर", "R"], ["एस", "S"], ["टी", "T"], ["यू", "U"], ["वी", "V"], ["बी", "B"], ["सी", "C"], ["डी", "D"],
  ["जी", "G"], ["ओ", "O"], ["ए", "A"], ["ई", "E"],
  ["એ", "A"], ["બી", "B"], ["સી", "C"], ["ડી", "D"], ["ઈ", "E"], ["એફ", "F"], ["જી", "G"], ["એચ", "H"], ["આઈ", "I"],
  ["જે", "J"], ["કે", "K"], ["એલ", "L"], ["એમ", "M"], ["એન", "N"], ["ઓ", "O"], ["પી", "P"], ["ક્યૂ", "Q"], ["આર", "R"],
  ["એસ", "S"], ["ટી", "T"], ["યુ", "U"], ["વી", "V"], ["એક્સ", "X"], ["વાય", "Y"], ["ઝેડ", "Z"],
] as Array<[string, string]>).sort((a, b) => b[0].length - a[0].length);

function indicLetters(word: string): string | null {
  let out = "";
  for (let rest = word; rest; ) {
    const hit = INDIC_LETTERS.find(([name]) => rest.startsWith(name));
    if (!hit) return null;
    out += hit[1];
    rest = rest.slice(hit[0].length);
  }
  return out;
}

/** Words around a spelled-out code that aren't part of it. */
const CODE_FILLER = new Set([
  "is", "the", "my", "it", "its", "code", "number", "no", "and", "please", "id", "hai", "mera", "meri", "ka", "ki",
  "capital", "small", "letter", "then", "space", "dash", "hyphen", "slash", "है", "मेरा", "मेरी", "का", "की", "છે",
  "pan", "ifsc", "card", "gst", "gstin", "account", "passport", "voter", "पैन", "कोड", "नंबर",
]);

/**
 * A spelled-out code: "s b i n zero zero zero one two three four" → "SBIN0001234".
 * Understands "S for Sugar" / "S as in Sugar", "double zero", digit words in any of
 * the four languages, and Hindi-script letter names ("एस बी आई").
 */
export function spokenCode(text: string): string {
  const tokens = asciiDigits(text).replace(/[,.;:/]/g, " ").split(/\s+/).filter(Boolean);
  let out = "";
  let repeat = 1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const lower = t.toLowerCase();
    // "S for Sugar", "S as in Sugar", "S से Sugar": keep the letter, drop the example word.
    const next = tokens[i + 1]?.toLowerCase();
    if (/^[a-z]$/i.test(t) && (next === "for" || next === "से" || (next === "as" && tokens[i + 2]?.toLowerCase() === "in"))) {
      out += t.toUpperCase().repeat(repeat);
      repeat = 1;
      i += next === "as" ? 3 : 2;
      continue;
    }
    if (lower === "double" || lower === "triple" || t === "डबल" || t === "ट्रिपल") {
      repeat = lower === "triple" || t === "ट्रिपल" ? 3 : 2;
      continue;
    }
    if (CODE_FILLER.has(lower)) continue;
    if (/^[a-z0-9]+$/i.test(t)) {
      if (t.length > 1 && /^[a-z]+$/i.test(t) && wordValue(lower) !== undefined) out += spokenDigits(lower).repeat(repeat);
      else out += (t.length === 1 ? t.repeat(repeat) : t).toUpperCase();
      repeat = 1;
      continue;
    }
    const value = wordValue(t);
    if (value !== undefined) {
      out += spokenDigits(t).repeat(value < 10 ? repeat : 1);
      repeat = 1;
      continue;
    }
    const letters = indicLetters(t);
    if (letters) {
      out += letters.length === 1 ? letters.repeat(repeat) : letters;
      repeat = 1;
    }
  }
  return out;
}

/** PAN: 5 letters, 4 digits, 1 letter. Fix the O/0 mix-ups speech makes in the wrong places. */
function parsePan(raw: string): Parsed {
  const code = spokenCode(raw);
  if (code.length !== 10) return fail("hintPan");
  const pan = code
    .split("")
    .map((c, i) => (i >= 5 && i <= 8 ? c.replace("O", "0") : c.replace("0", "O")))
    .join("");
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(pan) ? { ok: true, value: pan, display: pan.split("").join(" ") } : fail("hintPan");
}

/** IFSC: 4 letters, a zero, then 6 letters or digits (SBIN0001234). */
function parseIfsc(raw: string): Parsed {
  const code = spokenCode(raw);
  const ifsc = code.length === 11 ? code.slice(0, 4).replace(/0/g, "O") + code[4].replace("O", "0") + code.slice(5) : code;
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc) ? { ok: true, value: ifsc, display: ifsc } : fail("hintIfsc");
}

function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w));
}

// "my name is …", "my mobile number is …", "it's …", "I am …", "myself …"
const LEAD_EN = /^(?:(?:my|the)\s+(?:[\p{L}'’]+\s+){1,3}?(?:is|was|are)|it'?s|it is|this is|i am|i'm|its|myself|call me)\s+/iu;
// "mera naam …", "mere papa ka naam …", "मेरा नाम …", "મારું નામ …"
const LEAD_HI =
  /^(?:mera|meri|mere|मेरा|मेरी|मेरे|મારું|મારો|મારી|મારા)\s+(?:(?:naam|name|number|nambar|no|mobile|phone|email|id|pata|address|pin|pincode|code|janam|janm|tithi|date|birth|pan|card|papa|pitaji|pita|father|husband|pati|wife|patni|ka|ki|ke|नाम|नंबर|मोबाइल|फ़ोन|फोन|ईमेल|पता|पिन|कोड|जन्म|तिथि|तारीख|पैन|कार्ड|पिता|पिताजी|पापा|पति|पत्नी|का|की|के|નામ|નંબર|મોબાઇલ|સરનામું|પિતા|પતિ|નો|ની|નું)\s+){1,4}/iu;
// "naam Jay Shah hai", "नाम जय शाह है": the noun without "my"
const LEAD_NOUN = /^(?:naam|नाम|નામ)\s+/iu;
// "mera naam hai Jay": a "hai" right after the lead-in
const LEAD_HAI = /^(?:hai|है|છે)\s+/iu;
// "… hai", "… है", "… છે"
const TRAIL = /\s+(?:hai|he|hain|है|हैं|chhe|che|છે)$/iu;

/** Remove lead-ins people naturally say around an answer: "my name is Jay Shah" → "Jay Shah". */
export function stripLeadIn(text: string): string {
  const cut = text.replace(LEAD_EN, "").replace(LEAD_HI, "").replace(LEAD_NOUN, "").replace(LEAD_HAI, "").replace(TRAIL, "").trim();
  return cut || text;
}

/**
 * Could this be someone's name? Speech-to-text turns short Indian names into
 * letters ("Jay" → "G") or stray words; better to ask again than to fill "G".
 */
export function plausibleName(name: string): boolean {
  if (!/^[\p{L}\p{M}][\p{L}\p{M}.'’ -]*$/u.test(name)) return false; // letters only, no digits
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 6) return false;
  if (!words.some((w) => w.replace(/[.'’-]/g, "").length >= 2)) return false; // "G", "J K"
  return parseYesNo(name) === null; // "yes", "haan", "no" are answers to a different question
}

/** Compile a field's `pattern` attribute the way the browser does (whole value, `v` flag). */
function patternOf(pattern: string): RegExp | null {
  for (const flags of ["v", "u"]) {
    try {
      return new RegExp(`^(?:${pattern})$`, flags);
    } catch {
      // Older browsers don't know "v"; some patterns are invalid under it. Try the next.
    }
  }
  return null;
}

/**
 * Check a parsed value against the field's own rules (maxlength, minlength,
 * pattern, min, max), so a value the site would reject is caught before it's typed.
 */
export function checkConstraints(info: FieldInfo, parsed: Parsed): Parsed {
  const el = info.el as HTMLInputElement | undefined;
  if (!parsed.ok || !el || info.kind === "choice" || info.kind === "check" || !("value" in el)) return parsed;
  const v = parsed.value;
  if (el.maxLength > 0 && v.length > el.maxLength) return fail("hintTooLong", { max: el.maxLength, count: v.length });
  if (el.minLength > 0 && v.length < el.minLength) return fail("hintTooShort", { min: el.minLength });
  const pattern = el.getAttribute("pattern");
  if (pattern && !patternOf(pattern)?.test(v)) return fail("hintFormat");
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  const min = el.getAttribute("min");
  const max = el.getAttribute("max");
  if (type === "number") {
    if (min !== null && min !== "" && Number(v) < Number(min)) return fail("hintMin", { min });
    if (max !== null && max !== "" && Number(v) > Number(max)) return fail("hintMax", { max });
  }
  if (type === "date") {
    // ISO dates compare correctly as strings; say them the way people do.
    const say = (iso: string) => {
      const d = parseDate(iso, true);
      return d.ok ? d.display : iso;
    };
    if (min && v < min) return fail("hintMin", { min: say(min) });
    if (max && v > max) return fail("hintMax", { max: say(max) });
  }
  return parsed;
}

/** Parse an answer for a field. Typed answers are trusted more: they skip speech fixes. */
export function parseAnswer(info: FieldInfo, text: string, typed = false): Parsed {
  return checkConstraints(info, parseValue(info, text, typed));
}

function parseValue(info: FieldInfo, text: string, typed: boolean): Parsed {
  let raw = text.trim().replace(/[.!?।]+$/, "");
  if (!typed) raw = stripLeadIn(raw);
  if (!raw) return { ok: false };
  switch (info.kind) {
    case "email":
      return typed && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(raw) ? { ok: true, value: raw, display: raw } : parseEmail(raw);
    case "phone":
      return parsePhone(raw, typed);
    case "pincode": {
      const pin = spokenDigits(raw);
      if (pin.length !== 6) return pin.length ? fail("hintPin", { count: pin.length }) : fail();
      return { ok: true, value: pin, display: pin.split("").join(" ") };
    }
    case "number": {
      const plain = asciiDigits(raw).replace(/[, ]/g, "");
      if (/^-?\d+(\.\d+)?$/.test(plain)) return { ok: true, value: plain, display: plain };
      const n = spokenNumber(raw);
      return n === null ? fail() : { ok: true, value: String(n), display: n.toLocaleString("en-IN") };
    }
    case "date":
      return parseDate(raw, info.isoDate, info.dateFormat);
    case "pan":
      return parsePan(raw);
    case "ifsc":
      return parseIfsc(raw);
    case "code": {
      if (typed) return { ok: true, value: raw.trim(), display: raw.trim() };
      const code = spokenCode(raw);
      return code.length >= 2 ? { ok: true, value: code, display: code } : fail("hintFormat");
    }
    case "choice":
      return parseChoice(raw, info.options);
    case "check": {
      const yes = parseYesNo(raw);
      return yes === null ? { ok: false } : { ok: true, value: yes ? "yes" : "no", display: yes ? "✓" : "✗" };
    }
    case "name": {
      let name = typed ? raw : titleCase(raw);
      // Said in Hindi/Gujarati script, but the form is in English (e.g. name as on PAN).
      if (hasIndicScript(name) && !hasIndicScript(info.label) && /[A-Za-z]/.test(info.label)) name = romaniseName(name);
      if (!plausibleName(name)) return fail("hintName");
      return { ok: true, value: name, display: name };
    }
    default:
      return { ok: true, value: raw, display: raw };
  }
}
