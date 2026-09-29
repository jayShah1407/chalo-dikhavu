import type { LocalizedText } from "./types";

/** Resolve localized text: requested language, then English, then whatever exists. */
export function pick(text: LocalizedText | undefined, lang: string): string {
  if (text === undefined) return "";
  if (typeof text === "string") return text;
  return text[lang] ?? text.en ?? Object.values(text)[0] ?? "";
}

/** BCP-47 locales for speech recognition and synthesis. India-first defaults. */
const SPEECH_LOCALES: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  gu: "gu-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  bn: "bn-IN",
  pa: "pa-IN",
  ur: "ur-IN",
};

export function speechLocale(lang: string): string {
  return SPEECH_LOCALES[lang] ?? lang;
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
  gu: "ગુજરાતી",
  mr: "मराठी",
  ta: "தமிழ்",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
  bn: "বাংলা",
  pa: "ਪੰਜਾਬੀ",
  ur: "اردو",
};

type UiKey =
  | "help"
  | "askPlaceholder"
  | "holdToTalk"
  | "listening"
  | "next"
  | "skip"
  | "stop"
  | "done"
  | "notFound"
  | "noMatch"
  | "didYouMean"
  | "goingTo"
  | "waitingFor"
  | "micUnsupported"
  | "popular";

const UI: Record<string, Record<UiKey, string>> = {
  en: {
    help: "Need help?",
    askPlaceholder: "Ask how to do something…",
    holdToTalk: "Hold Space to talk",
    listening: "Listening…",
    next: "Next",
    skip: "Skip",
    stop: "Stop",
    done: "All done! 🎉",
    notFound: "I can't find this part on the page right now.",
    noMatch: "Sorry, I don't have a guide for that yet.",
    didYouMean: "Did you mean:",
    goingTo: "Taking you there…",
    waitingFor: "Open the right page to continue.",
    micUnsupported: "Voice isn't supported in this browser. Type your question instead.",
    popular: "Popular guides",
  },
  hi: {
    help: "मदद चाहिए?",
    askPlaceholder: "पूछें कि कोई काम कैसे करें…",
    holdToTalk: "बोलने के लिए Space दबाकर रखें",
    listening: "सुन रहा हूँ…",
    next: "आगे",
    skip: "छोड़ें",
    stop: "बंद करें",
    done: "हो गया! 🎉",
    notFound: "यह हिस्सा अभी पेज पर नहीं मिल रहा।",
    noMatch: "माफ़ करें, इसके लिए अभी कोई गाइड नहीं है।",
    didYouMean: "क्या आपका मतलब था:",
    goingTo: "आपको वहाँ ले जा रहा हूँ…",
    waitingFor: "आगे बढ़ने के लिए सही पेज खोलें।",
    micUnsupported: "इस ब्राउज़र में आवाज़ काम नहीं करती। अपना सवाल लिखें।",
    popular: "लोकप्रिय गाइड",
  },
  gu: {
    help: "મદદ જોઈએ?",
    askPlaceholder: "પૂછો કે કોઈ કામ કેવી રીતે કરવું…",
    holdToTalk: "બોલવા માટે Space દબાવી રાખો",
    listening: "સાંભળી રહ્યો છું…",
    next: "આગળ",
    skip: "છોડો",
    stop: "બંધ કરો",
    done: "થઈ ગયું! 🎉",
    notFound: "આ ભાગ અત્યારે પેજ પર મળતો નથી.",
    noMatch: "માફ કરશો, આ માટે હજી કોઈ ગાઇડ નથી.",
    didYouMean: "શું તમારો મતલબ હતો:",
    goingTo: "તમને ત્યાં લઈ જાઉં છું…",
    waitingFor: "આગળ વધવા માટે સાચું પેજ ખોલો.",
    micUnsupported: "આ બ્રાઉઝરમાં અવાજ ચાલતો નથી. તમારો સવાલ લખો.",
    popular: "લોકપ્રિય ગાઇડ",
  },
};

export function ui(lang: string, key: UiKey): string {
  return (UI[lang] ?? UI.en)[key];
}
