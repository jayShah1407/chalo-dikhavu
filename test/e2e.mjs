// End-to-end check in a real Chrome against the playground.
// Usage: npm run build && node scripts/serve-playground.mjs & node test/e2e.mjs
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:4400";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await chromium.launch({ executablePath: CHROME, headless: process.env.HEADED ? false : true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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

const bubble = page.locator(".bubble.on .text");
async function expectBubble(text) {
  await bubble.filter({ hasText: text }).waitFor({ timeout: 5000 });
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

await check("no page errors", async () => {
  if (errors.length) throw new Error(errors.join(" | "));
});

await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
