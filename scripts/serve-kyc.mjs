// Bharat Demo Bank KYC demo on http://localhost:4500, standing in for the bank's own server:
// it serves the site and answers /api/explain with chalo-dikhavu/server ("bring your own key").
//
//   ANTHROPIC_API_KEY=... node scripts/serve-kyc.mjs     real answers from Claude
//   node scripts/serve-kyc.mjs                           no key: offline demo answers, no cost
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createExplainer, createMockExplainer, createNodeHandler } from "../dist/server.js";

const PORT = Number(process.env.PORT ?? 4500);
const real = !!process.env.ANTHROPIC_API_KEY && !process.env.DIKHAVU_MOCK_AI;
const explain = real
  ? createExplainer({ instructions: "You are helping customers of Bharat Demo Bank complete their KYC." })
  : createMockExplainer();
const api = createNodeHandler(explain, {
  onUsage: (u) => console.log(`[explain] ${u.totalTokens} tokens (in ${u.inputTokens}, out ${u.outputTokens}, cache read ${u.cacheReadTokens})`),
});

const files = {
  "/chalo-dikhavu.global.js": ["dist/chalo-dikhavu.global.js", "text/javascript"],
  "/kyc-flows.js": ["examples/bank-kyc/kyc-flows.js", "text/javascript"],
};

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/api/explain") return api(req, res);
  const [file, type] = files[path] ?? ["examples/bank-kyc/index.html", "text/html; charset=utf-8"];
  try {
    res.writeHead(200, { "content-type": type });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Run `npm run build` first.");
  }
}).listen(PORT, () => {
  console.log(`Bharat Demo Bank (KYC demo): http://localhost:${PORT}`);
  console.log(real ? "AI answers: Claude (ANTHROPIC_API_KEY)" : "AI answers: offline demo answers (set ANTHROPIC_API_KEY for real ones)");
});
