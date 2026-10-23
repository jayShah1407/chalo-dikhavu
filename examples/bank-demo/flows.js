// Demo: opening a bank account with "do it with me".
// The whole form is ONE step — Chalo Dikhavu reads the fields and writes the questions.

globalThis.DIKHAVU_FLOWS = (globalThis.DIKHAVU_FLOWS ?? []).concat([
  {
    id: "open-account",
    title: { en: "Open a bank account", hi: "बैंक खाता खोलें" },
    keywords: {
      en: ["open account", "create account", "new account", "bank account", "savings account"],
      hi: ["khata kholna", "account kholna", "naya account", "खाता खोलना", "बैंक खाता", "अकाउंट खोलना"],
    },
    steps: [
      // No `say` needed: Chalo Dikhavu says "Clicking “Open an account”…" (do) or "Click “Open an account”." (show).
      { path: "/bank", target: { selector: "a", text: "Open an account" }, action: "click" },
      { path: "/bank/open-account", form: "#account-form" },
    ],
  },
]);
