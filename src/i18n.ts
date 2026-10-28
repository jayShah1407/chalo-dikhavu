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

export type UiKey =
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
  | "clickHere"
  | "why"
  | "thinking"
  | "aiError"
  | "continue"
  | "noWhy"
  | "youCanSay"
  | "related"
  | "listeningNow"
  | "notHeard"
  | "micBlocked"
  | "micUnavailable"
  | "sayYesNo"
  | "fixBelow"
  | "uploadYourself"
  | "hintPhone"
  | "hintPin"
  | "hintPan"
  | "hintIfsc"
  | "hintDate"
  | "hintEmail"
  | "hintName"
  | "hintTooLong"
  | "hintTooShort"
  | "hintFormat"
  | "hintMin"
  | "hintMax"
  | "siteInvalid";

const UI: Record<string, Record<UiKey, string>> = {
  en: {
    help: "Need help?",
    askPlaceholder: "Ask how to do something…",
    holdToTalk: "Hold Space to talk",
    listening: "Listening…",
    next: "Next",
    skip: "Skip",
    stop: "Stop",
    done: "All done!",
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
    why: "Why is this needed?",
    thinking: "Let me check…",
    aiError: "Sorry, I couldn't get an answer right now. Please try again, or contact support.",
    continue: "Continue",
    noWhy: "I don't have an explanation for this yet. You can ask support.",
    youCanSay: "You can say: {options}.",
    related: "Related guides",
    listeningNow: "Listening… speak now",
    notHeard: "I didn't hear anything. Tap the mic button to speak, or type your answer.",
    micBlocked: "The microphone is blocked. Allow it from the lock icon in the address bar, or type your answer.",
    micUnavailable: "Voice isn't working right now. Please type your answer.",
    sayYesNo: "Please say yes or no, or tap a button.",
    fixBelow: "Not quite? Fix it in the box below, or just say it again.",
    uploadYourself: "Please upload “{label}” yourself, then press Next.",
    hintPhone: "A mobile number has 10 digits. I heard {count}.",
    hintPin: "A PIN code has 6 digits. I heard {count}.",
    hintPan: "A PAN has 10 characters, like ABCDE1234F.",
    hintIfsc: "An IFSC has 11 characters, like SBIN0001234.",
    hintDate: "Please say the date like: 14 July 1998.",
    hintEmail: "Please say it like: name at gmail dot com.",
    hintName: "I couldn't catch the name. Please say it again slowly, or type it.",
    hintTooLong: "This box takes at most {max} characters. I heard {count}.",
    hintTooShort: "This box needs at least {min} characters.",
    hintFormat: "That doesn't look right for this box. Please check and say it again, or type it.",
    hintMin: "It must be at least {min}.",
    hintMax: "It can be at most {max}.",
    siteInvalid: "The form didn't accept that: {message}",
  },
  hi: {
    help: "मदद चाहिए?",
    askPlaceholder: "पूछें कि कोई काम कैसे करें…",
    holdToTalk: "बोलने के लिए Space दबाकर रखें",
    listening: "सुन रहा हूँ…",
    next: "आगे",
    skip: "छोड़ें",
    stop: "बंद करें",
    done: "हो गया!",
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
    why: "यह क्यों ज़रूरी है?",
    thinking: "एक पल, देखता हूँ…",
    aiError: "माफ़ करें, अभी जवाब नहीं मिल पाया। फिर से कोशिश करें या सपोर्ट से संपर्क करें।",
    continue: "आगे बढ़ें",
    noWhy: "इसके लिए अभी कोई जानकारी नहीं है। आप सपोर्ट से पूछ सकते हैं।",
    youCanSay: "आप बोल सकते हैं: {options}।",
    related: "संबंधित गाइड",
    listeningNow: "सुन रहा हूँ… अब बोलिए",
    notHeard: "मुझे कुछ सुनाई नहीं दिया। बोलने के लिए माइक बटन दबाएँ, या जवाब लिखें।",
    micBlocked: "माइक्रोफ़ोन बंद है। एड्रेस बार में लॉक आइकन से इसे चालू करें, या जवाब लिखें।",
    micUnavailable: "अभी आवाज़ काम नहीं कर रही। कृपया जवाब लिखें।",
    sayYesNo: "कृपया हाँ या नहीं बोलें, या बटन दबाएँ।",
    fixBelow: "सही नहीं है? नीचे बॉक्स में ठीक करें, या फिर से बोलें।",
    uploadYourself: "कृपया “{label}” खुद अपलोड करें, फिर “आगे” दबाएँ।",
    hintPhone: "मोबाइल नंबर में 10 अंक होते हैं। मैंने {count} सुने।",
    hintPin: "पिन कोड में 6 अंक होते हैं। मैंने {count} सुने।",
    hintPan: "PAN में 10 अक्षर होते हैं, जैसे ABCDE1234F।",
    hintIfsc: "IFSC में 11 अक्षर होते हैं, जैसे SBIN0001234।",
    hintDate: "कृपया तारीख ऐसे बोलें: 14 जुलाई 1998।",
    hintEmail: "कृपया ऐसे बोलें: name एट gmail डॉट com।",
    hintName: "मैं नाम समझ नहीं पाया। धीरे-धीरे फिर से बोलें, या लिखें।",
    hintTooLong: "इस बॉक्स में ज़्यादा से ज़्यादा {max} अक्षर आते हैं। मैंने {count} सुने।",
    hintTooShort: "इस बॉक्स में कम से कम {min} अक्षर चाहिए।",
    hintFormat: "यह इस बॉक्स के लिए सही नहीं लग रहा। जाँचकर फिर से बोलें, या लिखें।",
    hintMin: "यह कम से कम {min} होना चाहिए।",
    hintMax: "यह ज़्यादा से ज़्यादा {max} हो सकता है।",
    siteInvalid: "फ़ॉर्म ने इसे स्वीकार नहीं किया: {message}",
  },
  gu: {
    help: "મદદ જોઈએ?",
    askPlaceholder: "પૂછો કે કોઈ કામ કેવી રીતે કરવું…",
    holdToTalk: "બોલવા માટે Space દબાવી રાખો",
    listening: "સાંભળી રહ્યો છું…",
    next: "આગળ",
    skip: "છોડો",
    stop: "બંધ કરો",
    done: "થઈ ગયું!",
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
    why: "આ કેમ જરૂરી છે?",
    thinking: "એક પળ, જોઉં છું…",
    aiError: "માફ કરશો, અત્યારે જવાબ મળી શક્યો નહીં. ફરી પ્રયાસ કરો અથવા સપોર્ટનો સંપર્ક કરો.",
    continue: "આગળ વધો",
    noWhy: "આ માટે હજી કોઈ માહિતી નથી. તમે સપોર્ટને પૂછી શકો.",
    youCanSay: "તમે બોલી શકો: {options}.",
    related: "સંબંધિત ગાઇડ",
    listeningNow: "સાંભળું છું… હવે બોલો",
    notHeard: "મને કંઈ સંભળાયું નહીં. બોલવા માટે માઇક બટન દબાવો, અથવા જવાબ લખો.",
    micBlocked: "માઇક્રોફોન બંધ છે. એડ્રેસ બારમાં લોક આઇકનથી ચાલુ કરો, અથવા જવાબ લખો.",
    micUnavailable: "અત્યારે અવાજ કામ કરતો નથી. કૃપા કરીને જવાબ લખો.",
    sayYesNo: "કૃપા કરીને હા કે ના બોલો, અથવા બટન દબાવો.",
    fixBelow: "બરાબર નથી? નીચેના બોક્સમાં સુધારો, અથવા ફરી બોલો.",
    uploadYourself: "કૃપા કરીને “{label}” જાતે અપલોડ કરો, પછી “આગળ” દબાવો.",
    hintPhone: "મોબાઇલ નંબરમાં 10 આંકડા હોય છે. મેં {count} સાંભળ્યા.",
    hintPin: "પિન કોડમાં 6 આંકડા હોય છે. મેં {count} સાંભળ્યા.",
    hintPan: "PAN માં 10 અક્ષર હોય છે, જેમ કે ABCDE1234F.",
    hintIfsc: "IFSC માં 11 અક્ષર હોય છે, જેમ કે SBIN0001234.",
    hintDate: "કૃપા કરીને તારીખ આ રીતે બોલો: 14 જુલાઈ 1998.",
    hintEmail: "કૃપા કરીને આ રીતે બોલો: name એટ gmail ડોટ com.",
    hintName: "હું નામ સમજી શક્યો નહીં. ધીમે ધીમે ફરી બોલો, અથવા લખો.",
    hintTooLong: "આ બોક્સમાં વધુમાં વધુ {max} અક્ષર આવે. મેં {count} સાંભળ્યા.",
    hintTooShort: "આ બોક્સમાં ઓછામાં ઓછા {min} અક્ષર જોઈએ.",
    hintFormat: "આ બોક્સ માટે આ બરાબર લાગતું નથી. તપાસીને ફરી બોલો, અથવા લખો.",
    hintMin: "તે ઓછામાં ઓછું {min} હોવું જોઈએ.",
    hintMax: "તે વધુમાં વધુ {max} હોઈ શકે.",
    siteInvalid: "ફોર્મે આ સ્વીકાર્યું નહીં: {message}",
  },
};

/** Interface text, with {placeholders} filled from `vars`. */
export function ui(lang: string, key: UiKey, vars: Record<string, string | number> = {}): string {
  const text = (UI[lang] ?? UI.en)[key];
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}
