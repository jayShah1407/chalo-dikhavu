import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Raahi Cloud prototype against the offline explainer (1,000 tokens per answer).
let base = "";
let server: Server;
const KEY = "rh_pub_demo_bharat_bank";
const ORIGIN = "http://localhost:4500";
const body = JSON.stringify({ question: "why PAN?", lang: "en", page: { title: "KYC", path: "/kyc" }, flow: null, knowledge: "", field: null, formFields: [] });
const ask = (headers: Record<string, string> = {}) =>
  fetch(`${base}/v1/explain`, { method: "POST", headers: { authorization: `Bearer ${KEY}`, origin: ORIGIN, ...headers }, body });

beforeAll(async () => {
  process.env.RAAHI_MOCK_AI = "1";
  process.env.RAAHI_CLOUD_DATA = mkdtempSync(join(tmpdir(), "raahi-cloud-"));
  // @ts-expect-error plain JS module
  ({ server } = await import("../cloud/server.mjs"));
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

describe("Raahi Cloud", () => {
  it("rejects missing keys, unknown keys and wrong origins", async () => {
    expect((await ask({ authorization: "" })).status).toBe(401);
    expect((await ask({ authorization: "Bearer rh_pub_nope" })).status).toBe(401);
    expect((await ask({ origin: "http://evil.example" })).status).toBe(403);
  });

  it("meters tokens and stops at the free allowance with 402", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await ask();
      expect(res.status).toBe(200);
      expect((await res.json()).usage).toEqual({ tokens: 1000, remainingFree: 4000 - i * 1000 });
    }
    const over = await ask();
    expect(over.status).toBe(402);
    expect(await over.json()).toMatchObject({ error: "free_quota_exhausted", used: 5000, free: 5000 });

    const usage = await (await fetch(`${base}/v1/usage`, { headers: { authorization: `Bearer ${KEY}`, origin: ORIGIN } })).json();
    expect(usage).toMatchObject({ used: 5000, free: 5000, remaining: 0, billing: false });
  });

  it("logs token counts but never the question", () => {
    const log = readFileSync(join(process.env.RAAHI_CLOUD_DATA!, "usage.log"), "utf-8");
    expect(log.trim().split("\n")).toHaveLength(5);
    expect(log).not.toContain("why PAN");
  });
});
