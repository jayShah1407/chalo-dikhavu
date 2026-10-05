// End-to-end check in a real Chrome against the playground.
// Usage: npm run build && node scripts/serve-playground.mjs & node test/e2e.mjs
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:4400";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({ executablePath: CHROME, headless: process.env.HEADED ? false : true });
let page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log("  ✓", name);
  } catch (e) {
    failures++;
    console.log("  ✗", name, "\n     ", e.message.split("\n")[0]);
    await page.screenshot({ path: `test/e2e-fail-${failures}.png` });
  }
}

// A getter, not a constant: `page` is replaced for the do-mode tests below.
const bubble = { textContent: () => page.locator(".bubble.on .text").textContent() };
// Spoken answers end after ~1.8 s of silence, plus a short read-back, so allow time.
async function expectBubble(text) {
  await page.locator(".bubble.on .text").filter({ hasText: text }).waitFor({ timeout: 12000 });
}
/** The cursor should have glided onto the highlighted element. */
async function expectCursorOn(selector) {
  await page.waitForTimeout(1300);
  const [cx, cy] = await page.locator(".cursor").evaluate((c) => {
    const m = getComputedStyle(c).transform.match(/-?[\d.]+/g).map(Number);
    return [m[4], m[5]];
  });
  const box = await page.locator(selector).first().boundingBox();
  if (cx < box.x - 2 || cx > box.x + box.width + 2 || cy < box.y - 2 || cy > box.y + box.height + 2) {
    throw new Error(`cursor at ${cx},${cy} not on ${selector} (${JSON.stringify(box)})`);
  }
}

console.log("Raahi e2e");
await page.goto(`${BASE}/student`);

await check("typed question starts the matching flow", async () => {
  await page.locator(".launcher").click();
  await page.locator(".panel input").fill("how do I book a class");
  await page.locator(".panel input").press("Enter");
  await expectBubble("Find Teachers");
});

await check("cursor lands on the highlighted menu link", () => expectCursorOn('aside a[href="/student/teachers"]'));

await check("clicking the real link advances across an SPA navigation", async () => {
  await page.locator('aside a[href="/student/teachers"]').click();
  await expectBubble("Choose a teacher");
});

await check("path params: teacher card → profile page", async () => {
  await page.locator('main a[href="/student/teachers/t1"]').click();
  await expectBubble("Custom one-off class");
});

await check("off-screen target is scrolled into view", async () => {
  await expectCursorOn("label.opt >> nth=1");
});

await check("click on a label advances", async () => {
  await page.locator("label.opt").nth(1).click();
  await expectBubble("date and time");
});

await check("input step advances when a value is entered", async () => {
  await page.locator("#scheduledAt").fill("2026-10-10T10:00");
  await expectBubble("note for the teacher");
});

await check("Next button advances", async () => {
  await page.locator(".bubble.on button.primary").click();
  await expectBubble("Send request");
});

await check("flow completes", async () => {
  await page.locator('button[type="submit"]').click();
  await expectBubble("All done");
});

await check("a flow resumes at the same step after a full page reload", async () => {
  await page.evaluate(() => window.guide.start("wallet"));
  await expectBubble("Open “Wallet”");
  await page.locator('aside a[href="/student/wallet"]').click();
  await expectBubble("wallet credit");
  await page.reload();
  await expectBubble("wallet credit");
  await page.keyboard.press("Escape");
  await page.locator(".bubble.on").waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
  if (await page.locator(".bubble.on").count()) throw new Error("Escape did not stop the flow");
});

await check("Hindi: question and guidance in Hindi", async () => {
  await page.evaluate(() => window.guide.setLanguage("hi"));
  await page.evaluate(() => window.guide.ask("टीचर कैसे ढूंढें"));
  await expectBubble("Find Teachers");
  const text = await bubble.textContent();
  if (!text.includes("मेनू")) throw new Error(`expected Hindi text, got: ${text}`);
  await page.evaluate(() => window.guide.stop());
});

await check("unknown question shows suggestions instead of guessing", async () => {
  await page.evaluate(() => window.guide.setLanguage("en"));
  await page.evaluate(() => window.guide.ask("what is the weather"));
  await page.locator(".panel.on .msg").filter({ hasText: "don't have a guide" }).waitFor({ timeout: 3000 });
});

await check("missing element shows a friendly message, not a crash", async () => {
  await page.goto(`${BASE}/student/enrollments`);
  await page.evaluate(() => document.querySelector('aside a[href="/student/wallet"]').remove());
  await page.evaluate(() => window.guide.start("wallet"));
  await page.locator(".bubble.on").filter({ hasText: "can't find" }).waitFor({ timeout: 12000 });
});

// ---- "do it with me": the whole bank form from one `form:` step ----------------

// Headless Chrome has no microphone, so stand in a fake recognizer. Like Chrome's
// continuous mode it stays open until stop()/abort(), and it "hears" whatever the
// test puts in window.__say while it's open. The test speaks when it sees the question.
page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  // Newer Chrome has the unprefixed API too, and Raahi prefers it: replace both.
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() {
      const tick = () => {
        if (this.closed) return;
        if (window.__say) {
          const result = Object.assign([{ transcript: window.__say }], { isFinal: true });
          window.__say = null;
          this.onresult?.({ resultIndex: 0, results: [result] });
        }
        setTimeout(tick, 50);
      };
      tick();
    }
    stop() {
      setTimeout(() => this.end(), 100);
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
await page.goto(`${BASE}/bank?quiet`);
const answerBox = page.locator(".bubble.on .answer input");
async function typeAnswer(text) {
  await answerBox.waitFor({ timeout: 5000 });
  await answerBox.fill(text);
  await answerBox.press("Enter");
}

/** Wait for a question, then "say" the answer once the mic is open. */
async function sayTo(question, text) {
  await expectBubble(question);
  await page.locator(".bubble.on .answer-hint", { hasText: "Listening" }).waitFor({ timeout: 6000 });
  await page.evaluate((t) => (window.__say = t), text);
}

await check("do mode: asks 'do it with me' or 'just show me' for form flows", async () => {
  await page.evaluate(() => window.guide.ask("I want to open a bank account"));
  await expectBubble("fill this in with you");
  await page.locator(".bubble.on button.primary").click(); // Do it with me
});

await check("do mode: clicks buttons for the user (with the cursor)", async () => {
  await page.waitForURL("**/bank/open-account", { timeout: 8000 });
});

await check("generated question + spoken answer + read-back confirmation", async () => {
  await sayTo("What's your full name?", "jay shah");
  await sayTo("I heard: Jay Shah", "yes");
  await sayTo("mobile number", "nine eight two five zero one two three four five");
  await sayTo("I heard: 98250 12345", "haan"); // Hinglish yes
});

await check("typed answers go straight in", async () => {
  await expectBubble("What's your email?");
  await typeAnswer("jay@example.com");
});

await check("dates, PAN, select and radio questions", async () => {
  await sayTo("date of birth", "14 July 1998");
  await sayTo("I heard: 14 July 1998", "yes");
  await expectBubble("What's your PAN?");
  await typeAnswer("abcde1234f");
  await sayTo("Which account type? You can say: Savings, Current, Salary.", "savings");
  await sayTo("I heard: Savings", "yes");
  await sayTo("Which gender?", "the second one");
  await sayTo("I heard: Female", "ji");
});

await check("password is never asked for: user types it", async () => {
  await expectBubble("fill in “Set a password” yourself");
  if (await answerBox.count()) throw new Error("sensitive field showed an answer box");
  await page.locator("#password").fill("s3cret!");
  await page.locator("#password").blur();
});

await check("checkbox question, then the user presses submit themselves", async () => {
  await sayTo("Should I tick", "haan"); // checkboxes need no read-back
  await expectBubble("then press “Open account” yourself");
  await page.waitForTimeout(800);
  if (await page.locator("#result").textContent()) throw new Error("form was submitted without the user");
  await page.locator('button[type="submit"]').click();
  await expectBubble("All done");
});

await check("the real form received every value", async () => {
  const got = JSON.parse(await page.locator("#result").textContent());
  const want = {
    fullName: "Jay Shah", mobile: "9825012345", email: "jay@example.com", dob: "1998-07-14", pan: "ABCDE1234F",
    accountType: "savings", gender: "female", password: "(set)", terms: true,
  };
  for (const [k, v] of Object.entries(want)) {
    if (got[k] !== v) throw new Error(`${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(got[k])}`);
  }
});

await check("show mode: same form, generated pointer text, user fills it", async () => {
  await page.goto(`${BASE}/bank/open-account?quiet`);
  await page.evaluate(() => window.guide.start("open-account", "show"));
  await expectBubble("Click “Open an account”.");
  await page.locator('main a[href="/bank/open-account"]').click();
  await expectBubble("Enter your full name here.");
  await page.locator("#fullName").fill("Asha");
  await page.locator("#fullName").blur();
  await expectBubble("Enter your mobile number here.");
  await page.evaluate(() => window.guide.stop());
});

await check("no page errors", async () => {
  if (errors.length) throw new Error(errors.join(" | "));
});

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
