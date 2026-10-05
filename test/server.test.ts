import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { createExplainer, createMockExplainer, createNodeHandler, validateRequest } from "../src/server";
import type { ExplainRequest } from "../src/types";

const request: ExplainRequest = {
  question: "why do you need my PAN?",
  lang: "hi",
  page: { title: "KYC", path: "/kyc" },
  flow: { id: "kyc", title: "Complete KYC" },
  knowledge: "PAN is required to open a bank account.",
  field: { label: "PAN", kind: "pan", required: true },
  formFields: ["Full name", "PAN"],
};

/** A stand-in for the Anthropic client that records what it was sent. */
function fakeClient(response: Partial<Anthropic.Beta.Messages.BetaMessage>) {
  const calls: Array<Record<string, unknown>> = [];
  const client = {
    beta: {
      messages: {
        create: async (params: Record<string, unknown>) => {
          calls.push(params);
          return {
            content: [{ type: "text", text: "आयकर नियमों के तहत PAN ज़रूरी है।" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 300, output_tokens: 120, cache_read_input_tokens: 1500, cache_creation_input_tokens: 0 },
            ...response,
          };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

describe("createExplainer", () => {
  it("calls Claude Opus 5.5 at low effort with refusal fallbacks and cached rules + knowledge", async () => {
    const { client, calls } = fakeClient({});
    const result = await createExplainer({ client })(request);

    expect(result.answer).toBe("आयकर नियमों के तहत PAN ज़रूरी है।");
    expect(result.usage).toEqual({ inputTokens: 300, outputTokens: 120, cacheReadTokens: 1500, cacheWriteTokens: 0, totalTokens: 1920 });

    const p = calls[0] as {
      model: string; fallbacks: string; betas: string[]; output_config: { effort: string };
      system: Array<{ text: string; cache_control?: unknown }>; messages: Array<{ content: string }>; thinking?: unknown;
    };
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.fallbacks).toBe("default");
    expect(p.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(p.output_config.effort).toBe("low");
    expect(p.thinking).toBeUndefined(); // Opus 5.5 always thinks; disabling it would be a 400
    expect(p.system).toHaveLength(2);
    expect(p.system[1].text).toContain("PAN is required");
    expect(p.system[1].cache_control).toEqual({ type: "ephemeral" });
    // Per-user details go in the message, after the cached prefix.
    expect(p.system.map((s) => s.text).join("")).not.toContain("Answer language");
    expect(p.messages[0].content).toContain("Answer language: Hindi (hi)");
    expect(p.messages[0].content).toContain("Current field: PAN (pan, required)");
  });

  it("returns no answer when the model declines", async () => {
    const { client } = fakeClient({ stop_reason: "refusal", content: [] });
    expect((await createExplainer({ client })(request)).answer).toBe("");
  });
});

describe("validateRequest", () => {
  it("accepts a good request and rejects bad ones", () => {
    expect(validateRequest(request)).toMatchObject({ question: request.question, lang: "hi" });
    expect(validateRequest(null)).toBe("body must be a JSON object");
    expect(validateRequest({ ...request, question: "" })).toBe("question is required");
    expect(validateRequest({ ...request, question: "x".repeat(501) })).toBe("question is too long");
    expect(validateRequest({ ...request, lang: "<script>" })).toBe("lang must be a language code");
  });
});

describe("createNodeHandler", () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  async function start(handler: Parameters<typeof createServer>[1]) {
    server = createServer(handler);
    await new Promise<void>((r) => server!.listen(0, r));
    return `http://localhost:${(server!.address() as AddressInfo).port}`;
  }

  it("answers POSTs, reports usage, and enforces CORS origins", async () => {
    let metered = 0;
    const url = await start(createNodeHandler(createMockExplainer(), {
      allowOrigins: ["http://bank.example"],
      onUsage: (u) => (metered += u.totalTokens),
    }));
    const ok = await fetch(url, { method: "POST", headers: { origin: "http://bank.example" }, body: JSON.stringify(request) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://bank.example");
    expect((await ok.json()).answer).toContain("PAN");
    expect(metered).toBe(1000);

    const other = await fetch(url, { method: "POST", headers: { origin: "http://evil.example" }, body: JSON.stringify(request) });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();

    const bad = await fetch(url, { method: "POST", body: "{not json" });
    expect(bad.status).toBe(400);
  });

  it("passes upstream rate limits through as 429", async () => {
    const url = await start(createNodeHandler(async () => {
      throw Object.assign(new Error("rate"), { status: 429 });
    }));
    const res = await fetch(url, { method: "POST", body: JSON.stringify(request) });
    expect(res.status).toBe(429);
  });
});
