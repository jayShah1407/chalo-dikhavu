// End-to-end: the Bharat Demo Bank KYC, done with Chalo Dikhavu in "do it with me" mode, in real Chrome.
// Starts its own demo server with offline AI answers (no API key, no cost).
// Usage: npm run build && node test/e2e-kyc.mjs      (HEADED=1 to watch)
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const PORT = 4501;
const BASE = `http://localhost:${PORT}`;
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const server = spawn(process.execPath, ["scripts/serve-kyc.mjs"], { env: { ...process.env, PORT: String(PORT), DIKHAVU_MOCK_AI: "1" }, stdio: "pipe" });
await new Promise((resolve, reject) => {
  server.stdout.on("data", (d) => String(d).includes("KYC demo") && resolve());
  server.on("exit", (code) => reject(new Error(`server exited ${code}`)));
});

const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.HEADED, slowMo: process.env.HEADED ? 150 : 0 });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// No microphone in headless Chrome. This fake behaves like Chrome's real one:
// continuous sessions that the browser itself ends after ~4 s of silence, speech
// split into segments, and it hears whatever the test puts in window.__say while
// open. window.__deny = true makes it fail like a blocked microphone.
await page.addInitScript(() => {
  window.__listens = 0;
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() {
      window.__listens++;
      this.segments = [];
      if (window.__deny) {
        setTimeout(() => (this.onerror?.({ error: "not-allowed" }), this.end()), 50);
        return;
      }
      const began = Date.now();
      const tick = () => {
        if (this.closed) return;
        if (window.__say) {
          // A string, or an array of guesses (best first) like Chrome's maxAlternatives.
          this.segments.push([].concat(window.__say));
          window.__say = null;
          const results = this.segments.map((alts) => Object.assign(alts.map((transcript) => ({ transcript })), { isFinal: true }));
          this.onresult?.({ resultIndex: 0, results });
        } else if (!this.segments.length && Date.now() - began > 4000) {
          this.onerror?.({ error: "no-speech" });
          return this.end();
        }
        setTimeout(tick, 50);
      };
      tick();
    }
    stop() {
      setTimeout(() => this.end(), 150);
    }
    abort() {
      this.end();
    }
    end() {
      if (this.closed) return;
      this.closed = true;
      this.onend?.();
    }
  };
});

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log("  ✓", name);
  } catch (e) {
    failures++;
    console.log("  ✗", name, "\n     ", e.message.split("\n")[0]);
    await page.screenshot({ path: `test/e2e-kyc-fail-${failures}.png` });
  }
}
const bubbleText = () => page.locator(".bubble.on .text");
const expectBubble = (text, timeout = 6000) => bubbleText().filter({ hasText: text }).waitFor({ timeout });
async function answer(question, text) {
  await expectBubble(question);
  const box = page.locator(".bubble.on .answer input");
  await box.fill(text);
  await box.press("Enter");
}
const bubbleButton = (label) => page.locator(".bubble.on button", { hasText: label });

console.log("Chalo Dikhavu KYC e2e");
await page.goto(`${BASE}/?quiet`);

await check("asking for KYC offers 'do it with me' and opens the KYC form", async () => {
  await page.evaluate(() => window.guide.ask("I want to complete my KYC"));
  await expectBubble("fill this in with you");
  await bubbleButton("Do it with me").click();
  await page.waitForURL("**/kyc", { timeout: 8000 });
});

const hintOf = () => page.locator(".bubble.on .answer-hint");
const sayWhenListening = async (what) => {
  await hintOf().filter({ hasText: "Listening" }).waitFor({ timeout: 6000 });
  await page.evaluate((w) => (window.__say = w), what);
};

await check("name heard as 'G' (real report): not accepted, asked again", async () => {
  await expectBubble("What's your full name (as on PAN card)?");
  await sayWhenListening("G");
  await expectBubble("Sorry, I didn't catch that", 8000);
});

await check("name: the recognizer's second guess is used when the first makes no sense", async () => {
  await sayWhenListening(["G", "Jay Sha"]);
  await expectBubble("I heard: Jay Sha", 8000);
});

await check("name: fix the read-back by typing, without speaking again", async () => {
  const box = page.locator(".bubble.on .answer input");
  if ((await box.inputValue()) !== "Jay Sha") throw new Error("heard value not pre-filled for editing");
  await box.fill("Jay Shah");
  await box.press("Enter");
  await expectBubble("What's your date of birth?", 8000);
  if ((await page.locator("#fullName").inputValue()) !== "Jay Shah") throw new Error("corrected name not filled");
});

await check("step 1: personal details from generated questions", async () => {
  await answer("What's your date of birth?", "14/07/1998");
  await answer("Which marital status?", "single");
  await answer("Which gender? You can say: Male, Female, Transgender.", "male");
});

const hint = () => page.locator(".bubble.on .answer-hint");

await check("silence: a clear 'didn't hear anything' message, not a frozen flow; 🎤 listens again", async () => {
  await expectBubble("What's your father's or spouse's name?");
  await hint().filter({ hasText: "Listening" }).waitFor({ timeout: 3000 });
  // Nobody speaks. Chrome ends its session after ~4 s; Chalo Dikhavu keeps listening up to 8 s, then says so.
  await hint().filter({ hasText: "didn't hear anything" }).waitFor({ timeout: 12000 });
  await page.locator(".bubble.on .answer .mic").click();
  await hint().filter({ hasText: "Listening" }).waitFor({ timeout: 2000 });
  await page.evaluate(() => (window.__say = "Rakesh Shah"));
  await expectBubble("I heard: Rakesh Shah", 8000);
  await page.evaluate(() => (window.__say = "yes"));
});

await check("the guide's own voice coming back through the mic is ignored", async () => {
  await expectBubble("What's your mobile number?", 8000);
  await hint().filter({ hasText: "Listening" }).waitFor({ timeout: 4000 });
  await page.evaluate(() => (window.__say = "what's your mobile number")); // the speakers
  await page.waitForTimeout(600);
  await page.evaluate(() => (window.__say = "nine eight two five zero one two three four five"));
  await expectBubble("I heard: 98250 12345", 8000);
  await page.evaluate(() => (window.__say = "haan"));
});

await check("typed answer after voice ones", async () => {
  await answer("What's your email?", "jay@example.com");
});

await check("Chalo Dikhavu presses 'Continue' between steps (confirm: auto)", async () => {
  await expectBubble("What's your PAN?");
  await page.locator("#kyc-identity.current").waitFor({ timeout: 3000 });
});

await check("a spoken question instead of an answer gets an AI explanation, then the question again", async () => {
  await page.evaluate(() => (window.__say = "PAN kyu chahiye"));
  await expectBubble("(Demo answer) You asked about “PAN”", 8000);
  const text = await bubbleText().textContent();
  if (!text.includes("What's your PAN?")) throw new Error(`question not repeated: ${text}`);
  const box = page.locator(".bubble.on .answer input");
  await box.fill("abcde1234f");
  await box.press("Enter");
});

await check("Aadhaar: never heard, user types it; 'Why?' gives the bank's own approved answer", async () => {
  await expectBubble("fill in “Aadhaar number” yourself");
  if (await page.locator(".bubble.on .answer input").count()) throw new Error("sensitive field offered an answer box");
  await bubbleButton("Why is this needed?").click();
  await expectBubble("Aadhaar is optional here");
  await page.locator("#aadhaar").fill("123412341234");
  await page.locator("#aadhaar").blur();
});

await check("selects and question-style radio labels", async () => {
  await answer("Which occupation?", "salaried");
  await answer("Which annual income?", "5 to 10 lakh");
  await expectBubble("Are you a politically exposed person (PEP)? You can say: No, Yes.");
  await bubbleButton("Why is this needed?").click();
  await expectBubble("prominent public role");
  await answer("Are you a politically exposed person (PEP)?", "no");
  await answer("Are you a tax resident of any country other than India?", "no");
});

await check("step 3: address, skipping an optional field", async () => {
  await answer("What's your address line 1?", "12, Shanti Nagar, CG Road");
  await expectBubble("What's your address line 2?");
  await bubbleButton("Skip").click();
  // A blocked microphone says so (instead of silently doing nothing), and typing still works.
  await expectBubble("What's your city?");
  await page.evaluate(() => (window.__deny = true));
  await page.locator(".bubble.on .answer .mic").click();
  await hint().filter({ hasText: "microphone is blocked" }).waitFor({ timeout: 4000 });
  await answer("What's your city?", "Ahmedabad");
  // Voice is now off for the session: no 🎤 button offered on the next question.
  await expectBubble("Which state?");
  if (await page.locator(".bubble.on .answer .mic").count()) throw new Error("mic offered after it was blocked");
  await answer("Which state?", "Gujarat");
  await answer("What's your PIN code?", "380001");
  await answer("Should I tick “My correspondence address is the same as above”?", "yes");
});

await check("step 4: uploads are left to the user", async () => {
  await expectBubble("upload “Upload PAN card” yourself");
  const file = join(tmpdir(), "pan-card-demo.png");
  writeFileSync(file, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
  await page.locator("#panCopy").setInputFiles(file);
  await expectBubble("upload “Upload your signature” yourself");
  await bubbleButton("Next").click();
  await answer("Should I tick “I agree that Bharat Demo Bank may verify my details", "haan");
});

await check("step 5: the user presses 'Submit KYC' themselves", async () => {
  await answer("Should I tick “I declare that the information given above is true and complete”?", "yes");
  await expectBubble("then press “Submit KYC” yourself");
  await page.waitForTimeout(800);
  if (page.url().endsWith("/kyc/done")) throw new Error("KYC was submitted without the user");
  await page.locator('button[type="submit"]', { hasText: "Submit KYC" }).click();
  await page.waitForURL("**/kyc/done", { timeout: 5000 });
  await expectBubble("All done");
});

await check("the bank's form received every value", async () => {
  const got = JSON.parse(await page.locator("#submitted").textContent());
  const want = {
    fullName: "Jay Shah", dob: "1998-07-14", maritalStatus: "single", gender: "male", parentName: "Rakesh Shah",
    mobile: "9825012345", email: "jay@example.com", pan: "ABCDE1234F", aadhaar: "XXXX XXXX 1234",
    occupation: "salaried", income: "5-10", pep: "no", foreignTax: "no", addr1: "12, Shanti Nagar, CG Road",
    addr2: "", city: "Ahmedabad", state: "Gujarat", pincode: "380001", sameAddress: true,
    panCopy: "pan-card-demo.png", signature: "", consent: true,
  };
  for (const [k, v] of Object.entries(want)) {
    if (got[k] !== v) throw new Error(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(got[k])}`);
  }
});

await check("help panel: 'what is the purpose of KYC?' is answered, not started as a guide", async () => {
  await page.evaluate(() => window.guide.ask("what is the purpose of KYC?"));
  await page.locator(".panel.on .msg").filter({ hasText: "(Demo answer)" }).waitFor({ timeout: 6000 });
  if (await page.locator(".bubble.on").count()) throw new Error("a guide started instead of answering");
  await page.locator(".panel.on .list-title", { hasText: "Related guides" }).waitFor({ timeout: 2000 });
  await page.locator(".panel.on .flows button", { hasText: "Complete your KYC" }).waitFor({ timeout: 2000 });
});

await check("no page errors", async () => {
  if (errors.length) throw new Error(errors.join(" | "));
});

await browser.close();
server.kill();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
