# raahi

**An open-source AI cursor guide.** A live cursor walks your users through your product step by step, in their own language, using your recorded voice.

- 🧭 **Shows, doesn't tell.** The cursor glides to each button, highlights it and waits for the user to click.
- 🗣️ **Ask by voice or text.** Hold <kbd>Space</kbd> and say "teacher kaise dhunde", or type "how do I book a class". Raahi picks the right guide.
- 🇮🇳 **India-first languages.** Works with English, Hindi and Hinglish out of the box, and the UI is also translated into Gujarati. Any language works for your own step text and recordings.
- 🎙️ **Human voice.** Attach your own recordings per step and per language. Browser text-to-speech is the fallback.
- 🔒 **Self-hosted, no backend.** Zero dependencies, about 30 KB, and nothing leaves the browser except the browser's own speech recognition.
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

## API

```ts
guide.start("find-teacher");       // run a flow
guide.ask("how do I book a class"); // same as the user asking
guide.stop();
guide.setLanguage("hi");
guide.destroy();
```

The `onEvent` option receives `flow:start`, `flow:end`, `step:show`, `step:missing` and `ask`. Use these for analytics, for example which questions have no guide yet, or where users stop.

## Development

```bash
npm install
npm test               # unit tests
npm run build
npm run playground     # demo SPA at http://localhost:4400/student
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
