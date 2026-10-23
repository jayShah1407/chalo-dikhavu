// Open a Chromium window with the dev extension loaded, on a throwaway profile.
// Branded Chrome no longer allows --load-extension, so this uses Playwright's Chromium
// (install once with: npx playwright-core install chromium).
// Usage: node scripts/open-with-extension.mjs [url]   (HEADLESS=1 for a quick check)
import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const url = process.argv[2] ?? "http://localhost:3001/student";
const ext = resolve("dev-extension");
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "chalo-dikhavu-")), {
  channel: "chromium",
  headless: !!process.env.HEADLESS,
  viewport: null,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(url);

if (process.env.HEADLESS) {
  // Smoke check: the extension injected Chalo Dikhavu and it can run a flow.
  await page.locator("[data-dikhavu-root]").waitFor({ state: "attached", timeout: 10000 });
  await page.locator(".launcher").click();
  await page.locator(".panel input").fill("refund kab milega");
  await page.locator(".panel input").press("Enter");
  await page.locator(".bubble.on .text").filter({ hasText: "Wallet" }).waitFor({ timeout: 5000 });
  console.log("extension OK: injected and started the wallet flow");
  await context.close();
} else {
  console.log(`Opened ${url} with the Chalo Dikhavu dev extension. Close the window to exit.`);
  await new Promise((r) => context.on("close", r));
}
