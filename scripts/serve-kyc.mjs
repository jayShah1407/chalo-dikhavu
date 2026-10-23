// Bharat Demo Bank KYC demo on http://localhost:4500, standing in for the bank's own server:
// it serves the site and answers /api/explain with offline demo answers (no API key, no cost).
//
//   node scripts/serve-kyc.mjs
//
// /api/explain shows the endpoint contract: POST an ExplainRequest, reply { answer }.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const PORT = Number(process.env.PORT ?? 4500);

const files = {
  "/chalo-dikhavu.global.js": ["dist/chalo-dikhavu.global.js", "text/javascript"],
  "/kyc-flows.js": ["examples/bank-kyc/kyc-flows.js", "text/javascript"],
};

/** Offline stand-in for a real AI answer. Echoes the field so the plumbing is visible. */
function demoAnswer(req) {
  const about = req.field?.label ? `“${req.field.label}”` : req.flow?.title ? `“${req.flow.title}”` : "this page";
  return req.lang === "hi"
    ? `(डेमो उत्तर) आपने ${about} के बारे में पूछा। असली जवाबों के लिए अपना AI endpoint जोड़ें।`
    : `(Demo answer) You asked about ${about}. Connect your own AI endpoint for real answers.`;
}

async function explain(req, res) {
  if (req.method !== "POST") return res.writeHead(405).end();
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64 * 1024) return res.writeHead(413).end();
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return res.writeHead(400).end();
  }
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ answer: demoAnswer(parsed ?? {}) }));
}

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/api/explain") return explain(req, res);
  const [file, type] = files[path] ?? ["examples/bank-kyc/index.html", "text/html; charset=utf-8"];
  try {
    res.writeHead(200, { "content-type": type });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Run `npm run build` first.");
  }
}).listen(PORT, () => {
  console.log(`Bharat Demo Bank (KYC demo): http://localhost:${PORT}`);
  console.log("AI answers: offline demo answers");
});
