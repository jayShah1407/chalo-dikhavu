// Runs after chalo-dikhavu.global.js (window.ChaloDikhavu) and flows.js (DIKHAVU_FLOWS).
ChaloDikhavu.init({
  flows: globalThis.DIKHAVU_FLOWS,
  language: "en",
  languages: ["en", "hi"],
  color: "#0b5fd9",
  onEvent: (e) => console.debug("[chalo-dikhavu]", e),
});
