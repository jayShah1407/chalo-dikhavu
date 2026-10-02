# raahi

**An open-source AI cursor guide.** A live cursor walks your users through your product step by step, in their own language, using your recorded voice.

- 🧭 **Shows, doesn't tell.** The cursor glides to each button, highlights it and waits for the user to click.
- 🤝 **Or does it with them.** Say "I want to open an account", and Raahi asks for each value by voice, reads it back, and fills the real form while the cursor shows where each value goes. You write one line per form, and Raahi writes the questions from the fields.
- 🗣️ **Ask by voice or text.** Hold <kbd>Space</kbd> and say "teacher kaise dhunde", or type "how do I book a class". Raahi picks the right guide.
- 🇮🇳 **India-first languages.** Works with English, Hindi and Hinglish out of the box, and the UI is also translated into Gujarati. Any language works for your own step text and recordings.
- 🎙️ **Human voice.** Attach your own recordings per step and per language. Browser text-to-speech is the fallback.
- 🔒 **Self-hosted, no backend.** Zero dependencies, about 19 KB gzipped, and nothing leaves the browser except the browser's own speech recognition.
- 🛠️ **Hard to break.** Targets can use CSS, visible text or aria labels, with fallbacks. It re-finds elements after React re-renders and resumes after page reloads.

## Install

```bash
npm install raahi
```

```ts
import { init } from "raahi";

const guide = init({
  flows,                      // see below
  language: "en",
  languages: ["en", "hi"],
  color: "#0b5fd9",
  navigate: (path) => router.push(path), // optional: use your SPA router
});
```

Or with a script tag:

```html
<script src="https://unpkg.com/raahi"></script>
<script>Raahi.init({ flows: [...] });</script>
```

## Writing a flow

```ts
const flows = [
  {
    id: "find-teacher",
    title: { en: "Find a teacher", hi: "टीचर कैसे ढूंढें" },
    keywords: { en: ["search tutor"], hi: ["teacher dhundhna"] },
    steps: [
      {
        path: "/student/*",                           // where this step lives
        target: 'aside a[href="/student/teachers"]', // CSS selector…
        say: { en: "Click “Find Teachers”.", hi: "“Find Teachers” पर क्लिक करें।" },
        audio: { en: "/voice/en/find-1.mp3", hi: "/voice/hi/find-1.mp3" },
      },
      {
        path: "/student/teachers",
        target: { selector: "button", text: "Subject" }, // …or visible text
        advance: "next",
        say: "Filter by subject here.",
      },
    ],
  },
];
```

| Step field | Meaning |
|---|---|
| `target` | A CSS selector, `{ selector?, text?, index? }`, or an array of fallbacks. Leave it out for a centered message. |
| `path` | The page for this step, e.g. `/pricing`, `/teachers/:id` or `/app/*`. Static paths are opened automatically. For paths with params, Raahi waits for the user to get there. |
| `say` | Bubble text, as a string or `{ en, hi, … }`. |
| `audio` | A recorded clip URL, as a string or `{ en, hi, … }`. Falls back to text-to-speech. |
| `advance` | `"click"` (default with a target), `"next"` (default without one), `"input"` or `"auto"` (after `delay` ms). |
| `timeout` | How long to wait for the target to appear, in ms. Default 8000. |
| `action` | `"click"` or `"fill"`. In "do it with me" mode, Raahi does this for the user. See below. |
| `form` | A whole form in one step. See below. |

## "Do it with me": forms in one line

For complex forms like bank accounts, KYC or government portals, Raahi can fill the form *with* the user. Point it at the form:

```ts
{
  id: "open-account",
  title: { en: "Open a bank account", hi: "बैंक खाता खोलें" },
  keywords: { en: ["open account", "new account"], hi: ["khata kholna"] },
  steps: [
    { path: "/", target: { text: "Open an account" }, action: "click" },
    { path: "/open-account", form: "#account-form" },   // ← that's the whole form
  ],
}
```

When the flow starts, the user picks **Do it with me** or **Just show me**. Raahi then goes through every field in page order and generates the question from its label, placeholder, `type`, `autocomplete` and `name`:

| Field | Raahi asks | Understands answers like |
|---|---|---|
| `<label>Full name</label><input>` | "What's your full name?" | "jay shah" → `Jay Shah` |
| `type="tel"`, or a label like "Mobile" | "What's your mobile number?" | "nine eight double two…", "नौ आठ…", "+91 98…" |
| `type="email"` | "What's your email?" | "jay dot shah at gmail dot com" |
| `type="date"`, or "Date of birth" | "What's your date of birth?" | "14 July 1998", "14/07/1998", "14 जुलाई 1998" |
| "PAN" | "What's your PAN?" | "a b c d e 1 2 3 4 f" → `ABCDE1234F` |
| `<select>` / radio group | "Which account type? You can say: Savings, Current." | "savings", "the second one", "दूसरा" |
| checkbox | "Should I tick “I agree to the terms”?" | "yes", "haan", "नहीं" |

Every spoken answer is read back for confirmation ("I heard: 98250 12345. Is that right?"). Typed answers go straight in. Values are filled the way a real user would type them, so React, Vue and Angular forms see them.

**Safety rules (always on):**
- **Passwords, OTPs, PINs, CVV, card and Aadhaar numbers are never listened to or filled.** Raahi points at the field and asks the user to type it themselves. Detection uses `type`, `autocomplete` and labels. Mark any other field with `sensitive: true`.
- **Submit buttons are pressed by the user.** Raahi says "Please check everything, then press “Open account” yourself" and waits. Nothing is ever submitted for them. Override this per step with `confirm: "auto"` only for non-final buttons like "Next".

Tweak individual fields with `fields`, keyed by CSS selector:

```ts
{ form: "#account-form", fields: {
    "#referral": { skip: true },
    "#nominee":  { ask: { en: "Who should be your nominee?", hi: "आपका नॉमिनी कौन होगा?" } },
    "#branch":   { value: "Ahmedabad" },          // fill without asking
    "#mother":   { sensitive: true },             // user types it
} }
```

The same options (`ask`, `value`, `sensitive`, `optional`) also work on a single `{ target, action: "fill" }` step.

## API

```ts
guide.start("find-teacher");       // run a flow
guide.start("open-account", "do"); // skip the choice: "do" (fill with them) or "show"
guide.ask("how do I book a class"); // same as the user asking
guide.stop();
guide.setLanguage("hi");
guide.destroy();
```

The `onEvent` option receives `flow:start`, `flow:end`, `step:show`, `step:missing`, `ask`, `field:filled` and `field:manual`. Use these for analytics, for example which questions have no guide yet, or where users stop. Field events include the field's label but **never its value**.

## Development

```bash
npm install
npm test               # unit tests
npm run build
npm run playground     # demo SPA: http://localhost:4400/student and /bank (account-opening demo)
npm run e2e            # real-browser test against the playground (needs Chrome)
```

### Try it on your own local site without changing its code

`dev-extension/` is an unpacked Chrome extension. It injects the local build and a flows file into `http://localhost:3001`.

1. Run `npm run extension`. This builds and copies `dist/` and `examples/tution-techer/flows.js` into the extension.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the `dev-extension` folder.
3. Open your site. The **Need help?** button appears at the bottom right.

After changing code or flows, run `npm run extension` again and click reload on the extension.

Shortcut: `npm run try` builds everything and opens a separate Chromium window with the extension already loaded (first time: `npx playwright-core install chromium`).

## License

MIT
