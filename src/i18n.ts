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
  | "popular"
  | "modeQuestion"
  | "doMode"
  | "showMode"
  | "answerPlaceholder"
  | "askText"
  | "askChoice"
  | "askCheck"
  | "heard"
  | "yes"
  | "no"
  | "retry"
  | "typeYourself"
  | "fillYourself"
  | "pressYourself"
  | "clicking"
  | "enterHere"
  | "chooseHere"
  | "tickHere"
  | "clickHere";

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
    modeQuestion: "I can fill this in with you step by step, or just show you where everything is.",
    doMode: "Do it with me",
    showMode: "Just show me",
    answerPlaceholder: "Say it, or type here…",
    askText: "What's your {label}?",
    askChoice: "Which {label}? You can say: {options}.",
    askCheck: "Should I tick “{label}”?",
    heard: "I heard: {value}. Is that right?",
    yes: "Yes",
    no: "No, change it",
    retry: "Sorry, I didn't catch that. Please say it again, or type it.",
    typeYourself: "Please fill in “{label}” yourself. For your safety, I don't listen to this one.",
    fillYourself: "Please fill in {label} yourself, then press Next.",
    pressYourself: "Please check everything, then press “{label}” yourself.",
    clicking: "Clicking “{label}”…",
    enterHere: "Enter your {label} here.",
    chooseHere: "Choose {label} here.",
    tickHere: "Tick “{label}” if it applies.",
    clickHere: "Click “{label}”.",
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
    modeQuestion: "मैं आपके साथ यह स्टेप-बाय-स्टेप भर सकता हूँ, या सिर्फ़ दिखा सकता हूँ कि क्या कहाँ है।",
    doMode: "मेरे साथ करें",
    showMode: "सिर्फ़ दिखाएँ",
    answerPlaceholder: "बोलें, या यहाँ लिखें…",
    askText: "आपका {label} क्या है?",
    askChoice: "{label} में क्या चुनें? आप बोल सकते हैं: {options}।",
    askCheck: "क्या मैं “{label}” पर टिक करूँ?",
    heard: "मैंने सुना: {value}। क्या यह सही है?",
    yes: "हाँ",
    no: "नहीं, बदलें",
    retry: "माफ़ करें, मैं समझ नहीं पाया। फिर से बोलें या लिखें।",
    typeYourself: "कृपया “{label}” खुद भरें। आपकी सुरक्षा के लिए मैं इसे नहीं सुनता।",
    fillYourself: "कृपया {label} खुद भरें, फिर “आगे” दबाएँ।",
    pressYourself: "सब कुछ जाँच लें, फिर “{label}” खुद दबाएँ।",
    clicking: "“{label}” पर क्लिक कर रहा हूँ…",
    enterHere: "अपना {label} यहाँ भरें।",
    chooseHere: "{label} यहाँ चुनें।",
    tickHere: "अगर लागू हो तो “{label}” पर टिक करें।",
    clickHere: "“{label}” पर क्लिक करें।",
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
    modeQuestion: "હું તમારી સાથે આ સ્ટેપ-બાય-સ્ટેપ ભરી શકું, અથવા ફક્ત બતાવી શકું કે શું ક્યાં છે.",
    doMode: "મારી સાથે કરો",
    showMode: "ફક્ત બતાવો",
    answerPlaceholder: "બોલો, અથવા અહીં લખો…",
    askText: "તમારું {label} શું છે?",
    askChoice: "{label} માં શું પસંદ કરવું? તમે બોલી શકો: {options}.",
    askCheck: "શું હું “{label}” પર ટિક કરું?",
    heard: "મેં સાંભળ્યું: {value}. શું આ સાચું છે?",
    yes: "હા",
    no: "ના, બદલો",
    retry: "માફ કરશો, મને સમજાયું નહીં. ફરી બોલો અથવા લખો.",
    typeYourself: "કૃપા કરીને “{label}” જાતે ભરો. તમારી સુરક્ષા માટે હું આ સાંભળતો નથી.",
    fillYourself: "કૃપા કરીને {label} જાતે ભરો, પછી “આગળ” દબાવો.",
    pressYourself: "બધું તપાસી લો, પછી “{label}” જાતે દબાવો.",
    clicking: "“{label}” પર ક્લિક કરું છું…",
    enterHere: "તમારું {label} અહીં ભરો.",
    chooseHere: "{label} અહીં પસંદ કરો.",
    tickHere: "લાગુ પડે તો “{label}” પર ટિક કરો.",
    clickHere: "“{label}” પર ક્લિક કરો.",
  },
};

/** Interface text, with {placeholders} filled from `vars`. */
export function ui(lang: string, key: UiKey, vars: Record<string, string | number> = {}): string {
  const text = (UI[lang] ?? UI.en)[key];
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}
