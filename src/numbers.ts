/**
 * Spoken numbers in English, Hinglish, Hindi and Gujarati. Two readings:
 *
 * - spokenDigits: a run of digits, for phone numbers, PIN codes, account numbers.
 *   "nine eight double two", "ninety eight twenty five", "अट्ठानवे पच्चीस" → "982", "9825", "9825".
 * - spokenNumber: a quantity, for amounts and ages.
 *   "two lakh fifty thousand", "saadhe teen lakh", "डेढ़ लाख" → 250000, 350000, 150000.
 */

const EN: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

// Not "no", "to" or "for": "mobile no is…", "set it to…" would turn into digits.
const HINGLISH: Record<string, number> = {
  shunya: 0, ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5, panch: 5,
  chhe: 6, che: 6, chah: 6, chhah: 6, saat: 7, aath: 8, nau: 9,
  das: 10, dus: 10, gyarah: 11, gyara: 11, barah: 12, bara: 12, terah: 13, tera: 13,
  chaudah: 14, chauda: 14, pandrah: 15, pandra: 15, solah: 16, sola: 16, satrah: 17, satra: 17,
  atharah: 18, athara: 18, unnis: 19, bees: 20, bis: 20, pachchis: 25, pachis: 25,
  tees: 30, tis: 30, chalis: 40, chaalis: 40, pachas: 50, pachaas: 50, saath: 60, sath: 60,
  sattar: 70, assi: 80, nabbe: 90,
};

// Hindi has a separate word for every number up to 99.
const HI_0_99 = (
  "शून्य एक दो तीन चार पाँच छह सात आठ नौ " +
  "दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस " +
  "बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस " +
  "तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस " +
  "चालीस इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास " +
  "पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ " +
  "साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर " +
  "सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी " +
  "अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी " +
  "नब्बे इक्यानबे बानवे तिरानवे चौरानवे पचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे"
).split(" ");

/** Other common spellings, as speech-to-text writes them. */
const HI_VARIANTS: Record<string, number> = {
  "पांच": 5, "छः": 6, "छे": 6, "पन्द्रह": 15, "बाइस": 22, "तेइस": 23, "सत्ताइस": 27, "अट्ठाइस": 28, "अठ्ठाईस": 28,
  "चवालीस": 44, "उन्नासी": 79, "इक्यानवे": 91, "बानबे": 92, "तिरानबे": 93, "चौरानबे": 94, "पंचानवे": 95,
  "पंचानबे": 95, "छियानबे": 96, "सत्तानबे": 97, "अट्ठानबे": 98, "अठ्ठानवे": 98, "निन्यानबे": 99,
};

const GU: Record<string, number> = {
  "શૂન્ય": 0, "એક": 1, "બે": 2, "ત્રણ": 3, "ચાર": 4, "પાંચ": 5, "છ": 6, "સાત": 7, "આઠ": 8, "નવ": 9, "દસ": 10,
};

const SCALES: Record<string, number> = {
  hundred: 100, sau: 100, "सौ": 100, "સો": 100,
  thousand: 1000, hazaar: 1000, hazar: 1000, hajar: 1000, "हजार": 1000, "હજાર": 1000,
  lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, "लाख": 1e5, "લાખ": 1e5,
  million: 1e6,
  crore: 1e7, crores: 1e7, karod: 1e7, karor: 1e7, "करोड": 1e7, "કરોડ": 1e7,
};

/** Fractions said before a number: "saadhe teen" = 3.5, "sava do" = 2.25, "paune do" = 1.75. */
const BEFORE: Record<string, number> = {
  saadhe: 0.5, sadhe: 0.5, "साढे": 0.5, "સાડા": 0.5,
  sava: 0.25, savaa: 0.25, "सवा": 0.25, "સવા": 0.25,
  paune: -0.25, "पौने": -0.25, "પોણા": -0.25,
};
/** Fractions that are numbers on their own: "dedh lakh" = 1.5 lakh, "dhai" = 2.5. */
const ALONE: Record<string, number> = {
  dedh: 1.5, derh: 1.5, "डेढ": 1.5, "દોઢ": 1.5,
  dhai: 2.5, dhaai: 2.5, adhai: 2.5, "ढाई": 2.5, "અઢી": 2.5,
};

const REPEAT: Record<string, number> = { double: 2, triple: 3, "डबल": 2, "ट्रिपल": 3, "ડબલ": 2, "ટ્રિપલ": 3 };

/** Speech-to-text writes "हज़ार" and "हजार" alike; compare without the nukta dot. */
const key = (w: string) => w.normalize("NFC").toLowerCase().replace(/़/g, "");

const WORDS = new Map<string, number>();
for (const [w, n] of Object.entries({ ...EN, ...HINGLISH, ...HI_VARIANTS, ...GU })) WORDS.set(key(w), n);
HI_0_99.forEach((w, n) => WORDS.set(key(w), n));
const lookup = (table: Record<string, number>) => new Map(Object.entries(table).map(([w, n]) => [key(w), n]));
const SCALE = lookup(SCALES);
const FRACTION_BEFORE = lookup(BEFORE);
const FRACTION_ALONE = lookup(ALONE);
const REPEATS = lookup(REPEAT);

/** Devanagari/Gujarati digits → ASCII. */
export function asciiDigits(s: string): string {
  return s
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x966))
    .replace(/[૦-૯]/g, (d) => String(d.charCodeAt(0) - 0xae6));
}

/** The number a single word stands for (0–99), or undefined. Scales and fractions excluded. */
export function wordValue(word: string): number | undefined {
  return WORDS.get(key(word));
}

/** Is this word part of a spoken number (a number word, scale, fraction or "double")? */
export function isNumberWord(word: string): boolean {
  const k = key(word);
  return WORDS.has(k) || SCALE.has(k) || FRACTION_BEFORE.has(k) || FRACTION_ALONE.has(k) || REPEATS.has(k);
}

const words = (text: string) => asciiDigits(text).split(/[\s,-]+/).filter(Boolean);

/**
 * Digits as said one after another. "nine eight double two 5 4" → "982254",
 * "ninety eight twenty five" → "9825", "nine hundred" → "900". Other words are ignored.
 */
export function spokenDigits(text: string): string {
  let out = "";
  let repeat = 1;
  let tens: number | null = null;
  const flush = () => {
    if (tens !== null) out += String(tens);
    tens = null;
  };
  for (const raw of words(text)) {
    const w = raw.replace(/[.]+$/, "");
    const k = key(w);
    if (REPEATS.has(k)) {
      flush();
      repeat = REPEATS.get(k)!;
      continue;
    }
    if (/^\d+$/.test(w)) {
      flush();
      out += w.length === 1 ? w.repeat(repeat) : w;
      repeat = 1;
      continue;
    }
    const scale = SCALE.get(k);
    if (scale === 100 || scale === 1000) {
      flush();
      if (out) out += scale === 100 ? "00" : "000";
      continue;
    }
    const n = WORDS.get(k);
    if (n === undefined) {
      flush();
      continue;
    }
    if (n >= 20 && n % 10 === 0) {
      // "ninety" may be followed by "eight": wait and see.
      flush();
      tens = n;
      continue;
    }
    if (tens !== null && n > 0 && n < 10) {
      out += String(tens + n);
      tens = null;
      continue;
    }
    flush();
    out += n < 10 ? String(n).repeat(repeat) : String(n);
    repeat = 1;
  }
  flush();
  return out;
}

/**
 * A quantity. "two lakh fifty thousand" → 250000, "saadhe teen lakh" → 350000,
 * "1.5 lakh" → 150000, "₹ 2,50,000" → 250000. Without a scale word, digits are read
 * in sequence: "nine eight" → 98. Null if there's no number at all.
 */
export function spokenNumber(text: string): number | null {
  const cleaned = asciiDigits(text)
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, "$1")
    .replace(/₹|\brs\.?|\brupees?\b|\binr\b|रुपये|रुपए|रुपया|રૂપિયા/g, " ");
  const tokens = cleaned.split(/\s+/).map((t) => t.replace(/^[^\p{L}\p{M}\d]+|[^\p{L}\p{M}\d]+$/gu, "")).filter(Boolean);
  const hasScale = tokens.some((t) => SCALE.has(key(t)) || FRACTION_BEFORE.has(key(t)) || FRACTION_ALONE.has(key(t)));
  if (!hasScale) {
    const plain = tokens.find((t) => /^\d+\.\d+$/.test(t));
    if (plain) return Number(plain);
    const digits = spokenDigits(cleaned);
    return digits ? Number(digits) : null;
  }
  let total = 0;
  let current = 0;
  let adjust = 0;
  let found = false;
  for (const t of tokens) {
    const k = key(t);
    const scale = SCALE.get(k);
    if (scale !== undefined) {
      found = true;
      if (scale === 100) current = (current || 1) * 100;
      else {
        total += (current || 1) * scale;
        current = 0;
      }
      continue;
    }
    if (FRACTION_BEFORE.has(k)) {
      adjust = FRACTION_BEFORE.get(k)!;
      continue;
    }
    let n = /^\d+(\.\d+)?$/.test(t) ? Number(t) : FRACTION_ALONE.get(k) ?? WORDS.get(k);
    if (n === undefined) continue; // "about", "and", "only"
    found = true;
    n += adjust;
    adjust = 0;
    current += n;
  }
  return found ? Math.round((total + current) * 100) / 100 : null;
}
