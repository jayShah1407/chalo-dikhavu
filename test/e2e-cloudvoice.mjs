// End-to-end: Cloud voice in real Chrome. A stand-in Cloud serves /v1/tts and /v1/stt, and
// Chrome's fake microphone plays a recording: silence, a tone (the "answer"), then silence.
// Checks the question is spoken by the Cloud, the answer is recorded, cut at the silence and
// transcribed, and the read-back of the user's value never goes to the Cloud.
// Usage: npm run build && node test/e2e-cloudvoice.mjs      (HEADED=1 to watch)
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

// 16 kHz mono WAV: 0.6 s quiet, 1.4 s of a 220 Hz tone, 6 s quiet.
function wav() {
  const rate = 16000, secs = 8, n = rate * secs;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const v = t > 0.6 && t < 2.0 ? Math.sin(2 * Math.PI * 220 * t) * 0.5 : (Math.random() - 0.5) * 0.002;
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}
const micFile = join(tmpdir(), "chalo-dikhavu-answer.wav");
writeFileSync(micFile, wav());

// A valid, tiny MP3 frame so <audio> really plays something.
const SILENT_MP3 = Buffer.from("//NExAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV", "base64");

const spoken = [];
const heard = [];
const PAGE = `<!doctype html><meta charset="utf-8"><title>Voice</title>
<form id="f"><label for="name">Full name</label><input id="name"><button type="button">Done</button></form>
<script src="/sdk.js"></script>
<script>window.guide = ChaloDikhavu.init({ tts: true, voice: { endpoint: "/v1", projectKey: "cd_pub_test", listen: true },
  flows: [{ id: "f", title: "Fill", steps: [{ form: "#f" }] }] });</script>`;

const server = createServer((req, res) => {
  const body = [];
  req.on("data", (c) => body.push(c));
  req.on("end", () => {
    const raw = Buffer.concat(body);
    if (req.url === "/") return res.writeHead(200, { "content-type": "text/html" }).end(PAGE);
    if (req.url === "/sdk.js") return res.writeHead(200, { "content-type": "text/javascript" }).end(readFileSync("dist/chalo-dikhavu.global.js"));
    if (req.url === "/v1/tts") {
      spoken.push(JSON.parse(raw.toString()).text);
      return res.writeHead(200, { "content-type": "audio/mpeg" }).end(SILENT_MP3);
    }
    if (req.url === "/v1/stt") {
      heard.push({ bytes: raw.length, auth: req.headers.authorization, lang: /name="lang"\r\n\r\n(\w+)/.exec(raw.toString("latin1"))?.[1] });
      return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ text: "Jay Shah" }));
    }
    res.writeHead(404).end();
  });
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: !process.env.HEADED,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${micFile}%noloop`, "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// No Web Speech recognition, like Firefox: only the Cloud can listen.
await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });

let failed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n    ${e.message.split("\n")[0]}`);
  }
};
const bubble = page.locator(".bubble.on .text");

await page.goto(BASE);
await page.evaluate(() => window.guide.start("f", "do"));

await check("the question is spoken by the Cloud", async () => {
  await bubble.filter({ hasText: /full name/i }).waitFor({ timeout: 10000 });
  await page.waitForFunction(() => true, null, { timeout: 100 });
  for (let i = 0; i < 50 && !spoken.some((t) => /full name/i.test(t)); i++) await new Promise((r) => setTimeout(r, 100));
  if (!spoken.some((t) => /full name/i.test(t))) throw new Error(`tts got: ${JSON.stringify(spoken)}`);
});

await check("the answer is recorded, cut at the silence and transcribed by the Cloud", async () => {
  await bubble.filter({ hasText: /Jay Shah/ }).waitFor({ timeout: 20000 });
  if (heard.length !== 1) throw new Error(`stt calls: ${heard.length}`);
  if (heard[0].bytes < 2000) throw new Error(`recording too small: ${heard[0].bytes} bytes`);
  if (heard[0].auth !== "Bearer cd_pub_test") throw new Error("no project key");
  if (heard[0].lang !== "en") throw new Error(`lang: ${heard[0].lang}`);
});

await check("the read-back of the user's answer never goes to the Cloud", async () => {
  await new Promise((r) => setTimeout(r, 1500));
  const leaked = spoken.filter((t) => t.includes("Jay Shah"));
  if (leaked.length) throw new Error(`sent: ${JSON.stringify(leaked)}`);
});

await check("confirming fills the field", async () => {
  const input = page.locator(".bubble.on form.answer input");
  await input.fill("yes");
  await input.press("Enter");
  await page.waitForFunction(() => document.querySelector("#name").value === "Jay Shah", null, { timeout: 5000 });
});

await check("no page errors", async () => {
  if (errors.length) throw new Error(errors.join("; "));
});

await browser.close();
server.close();
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
