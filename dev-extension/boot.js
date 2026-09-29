// Runs after raahi.global.js (window.Raahi) and flows.js (RAAHI_FLOWS).
Raahi.init({
  flows: globalThis.RAAHI_FLOWS,
  language: "en",
  languages: ["en", "hi"],
  color: "#0b5fd9",
  onEvent: (e) => console.debug("[raahi]", e),
});
