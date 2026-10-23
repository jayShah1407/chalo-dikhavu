/**
 * Devanagari / Gujarati → English letters, for names. A Hindi speaker says
 * "जय शाह" (and Chrome's hi-IN recognizer writes it that way), but a name field on
 * an English form, like the name on a PAN card, needs "Jay Shah". This is a
 * pragmatic name-oriented romanisation, not a scholarly one, and the user always
 * sees the result in the read-back before anything is filled.
 */

const CONSONANTS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", ळ: "l", व: "v",
  श: "sh", ष: "sh", स: "s", ह: "h",
};
// Consonant + nukta (़): borrowed sounds.
const NUKTA: Record<string, string> = { क: "q", ख: "kh", ग: "g", ज: "z", ड: "r", ढ: "rh", फ: "f" };
const VOWELS: Record<string, string> = {
  अ: "a", आ: "a", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au", ऑ: "o",
};
const MATRAS: Record<string, string> = {
  "ा": "a", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e",
};
const VIRAMA = "्";
const NUKTA_SIGN = "़";
const ANUSVARA = new Set(["ं", "ँ"]);
const VISARGA = "ः";

/** Gujarati's Unicode block mirrors Devanagari's, 0x180 higher. */
function toDevanagari(ch: string): string {
  const c = ch.codePointAt(0)!;
  return c >= 0x0a81 && c <= 0x0aef ? String.fromCodePoint(c - 0x180) : ch;
}

export function hasIndicScript(text: string): boolean {
  return /[ऀ-ॿ઀-૿]/.test(text);
}

interface Unit {
  text: string; // consonant cluster or vowel, romanised
  vowel: string | null; // explicit vowel sound, or null = inherent "a"
  consonant: boolean;
  tail: string; // anusvara/visarga
}

function romaniseWord(word: string): string {
  const chars = Array.from(word, toDevanagari);
  const units: Unit[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (CONSONANTS[ch]) {
      let sound = chars[i + 1] === NUKTA_SIGN ? (i++, NUKTA[ch] ?? CONSONANTS[ch]) : CONSONANTS[ch];
      const last = units[units.length - 1];
      // Virama on the previous consonant joins a cluster: प्र → "pr".
      if (last?.consonant && last.vowel === "") {
        last.text += sound;
        last.vowel = null;
        sound = "";
      }
      if (sound) units.push({ text: sound, vowel: null, consonant: true, tail: "" });
    } else if (MATRAS[ch] !== undefined && units.length) {
      units[units.length - 1].vowel = MATRAS[ch];
    } else if (ch === VIRAMA && units.length) {
      units[units.length - 1].vowel = "";
    } else if (VOWELS[ch]) {
      units.push({ text: "", vowel: VOWELS[ch], consonant: false, tail: "" });
    } else if (ANUSVARA.has(ch) && units.length) {
      units[units.length - 1].tail = "n";
    } else if (ch === VISARGA && units.length) {
      units[units.length - 1].tail = "h";
    } else if (/[A-Za-z0-9.'-]/.test(ch)) {
      units.push({ text: ch, vowel: "", consonant: false, tail: "" });
    }
  }

  // Hindi drops the inherent "a" at the end of a word (राम = Ram) and between a
  // vowel and a consonant that has its own vowel (कमला = Kamla, not Kamala).
  const hasVowel = (u: Unit | undefined) => !!u && (u.vowel === null || u.vowel !== "");
  let out = "";
  units.forEach((u, i) => {
    let v = u.vowel;
    if (v === null) {
      const isLast = i === units.length - 1;
      const next = units[i + 1];
      const between = i > 0 && hasVowel(units[i - 1]) && next && next.vowel !== null && next.vowel !== "";
      v = isLast || between ? "" : "a";
    }
    // Long "ee" at the end of a name reads as "i": लक्ष्मी = Lakshmi.
    if (v === "ee" && i === units.length - 1) v = "i";
    // Anusvara before b/p/m sounds is "m" (शंभु = Shambhu); before h it's "ng" (सिंह = Singh).
    const nextText = units[i + 1]?.text ?? "";
    const tail = u.tail !== "n" ? u.tail : /^[bpm]/.test(nextText) ? "m" : nextText === "h" ? "ng" : "n";
    if (tail === "ng" && units[i + 1]) units[i + 1].text = "h";
    out += u.text + v + tail;
  });
  return out;
}

/** "जय शाह" → "Jay Shah", "રાકેશ પટેલ" → "Rakesh Patel". Latin text passes through. */
export function romaniseName(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (hasIndicScript(w) ? romaniseWord(w) : w))
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
