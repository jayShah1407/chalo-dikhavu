// Raahi Cloud (prototype): hosted AI answers for sites that don't run their own backend.
//
//   POST /v1/explain   Authorization: Bearer <project key>   body: ExplainRequest  → { answer, usage }
//   GET  /v1/usage     Authorization: Bearer <project key>                         → { used, free, remaining, billing }
//
// Each project has a public key that only works from its allowed origins, a free token
// allowance, and a running token count. When the allowance is used up and billing isn't
// enabled, requests get 402 and the SDK tells the user politely that answers are unavailable.
//
// Run:  ANTHROPIC_API_KEY=... node cloud/server.mjs        (RAAHI_MOCK_AI=1 for no key / no cost)
// Data: cloud/data/projects.json (created from projects.example.json on first run)

import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { corsHeaders, createExplainer, createMockExplainer, readJson, validateRequest } from "../dist/server.js";

const here = dirname(fileURLToPath(import.meta.url));
const DATA = process.env.RAAHI_CLOUD_DATA ?? join(here, "data");
const PROJECTS = join(DATA, "projects.json");
const USAGE_LOG = join(DATA, "usage.log");
const PORT = Number(process.env.PORT ?? 4600);
/** Tokens each new project gets free. */
export const DEFAULT_FREE_TOKENS = Number(process.env.RAAHI_FREE_TOKENS ?? 5000);

mkdirSync(DATA, { recursive: true });
if (!existsSync(PROJECTS)) copyFileSync(join(here, "projects.example.json"), PROJECTS);

function loadProjects() {
  return JSON.parse(readFileSync(PROJECTS, "utf-8"));
}
function saveProjects(projects) {
  writeFileSync(PROJECTS, JSON.stringify(projects, null, 2));
}

const explain = process.env.RAAHI_MOCK_AI ? createMockExplainer() : createExplainer();

// Simple per-key rate limit: a burst guard, not billing.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.RAAHI_RATE_LIMIT ?? 30);
const hits = new Map();
function rateLimited(key) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

function projectFor(req) {
  const key = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return { error: [401, "missing project key"] };
  const project = loadProjects().find((p) => p.key === key);
  if (!project) return { error: [401, "unknown project key"] };
  // Project keys are public (they ship in page source), so the origin is what protects them.
  const origin = req.headers.origin;
  if (project.allowedOrigins?.length && !project.allowedOrigins.includes(origin)) {
    return { error: [403, "origin not allowed for this key"] };
  }
  return { project };
}

const remaining = (p) => Math.max(0, (p.freeTokens ?? DEFAULT_FREE_TOKENS) - p.usedTokens);

export const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const projects = loadProjects();
  const keyed = projects.find((p) => p.key === (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim());
  const cors = corsHeaders(req.headers.origin, keyed?.allowedOrigins?.length ? keyed.allowedOrigins : ["*"]);

  if (req.method === "OPTIONS") {
    // Preflight carries no Authorization header, so answer it permissively; the real request is checked.
    res.writeHead(204, corsHeaders(req.headers.origin, ["*"]));
    return res.end();
  }

  if (url.pathname === "/v1/usage" && req.method === "GET") {
    const { project, error } = projectFor(req);
    if (error) return send(res, error[0], { error: error[1] }, cors);
    return send(res, 200, {
      project: project.name,
      used: project.usedTokens,
      free: project.freeTokens ?? DEFAULT_FREE_TOKENS,
      remaining: remaining(project),
      billing: !!project.billing,
    }, cors);
  }

  if (url.pathname !== "/v1/explain" || req.method !== "POST") return send(res, 404, { error: "not found" }, cors);

  const { project, error } = projectFor(req);
  if (error) return send(res, error[0], { error: error[1] }, cors);
  if (rateLimited(project.key)) return send(res, 429, { error: "rate limited" }, cors);
  if (!project.billing && remaining(project) <= 0) {
    return send(res, 402, { error: "free_quota_exhausted", used: project.usedTokens, free: project.freeTokens ?? DEFAULT_FREE_TOKENS }, cors);
  }

  let body;
  try {
    body = validateRequest(await readJson(req));
  } catch (e) {
    return send(res, 400, { error: e.message }, cors);
  }
  if (typeof body === "string") return send(res, 400, { error: body }, cors);

  let result;
  try {
    result = await explain(body);
  } catch (e) {
    if (e?.status === 429) return send(res, 429, { error: "rate limited, try again shortly" }, cors);
    console.error("raahi cloud: explain failed", e);
    return send(res, 502, { error: "upstream error" }, cors);
  }

  // Meter every billed token, cached ones included. Store counts only, never the question.
  const latest = loadProjects();
  const p = latest.find((x) => x.key === project.key);
  p.usedTokens += result.usage.totalTokens;
  saveProjects(latest);
  appendFileSync(USAGE_LOG, JSON.stringify({ t: new Date().toISOString(), project: p.name, ...result.usage }) + "\n");

  if (!result.answer) return send(res, 502, { error: "no answer" }, cors);
  send(res, 200, { answer: result.answer, usage: { tokens: result.usage.totalTokens, remainingFree: remaining(p) } }, cors);
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, () => {
    console.log(`Raahi Cloud (prototype) on http://localhost:${PORT}  ${process.env.RAAHI_MOCK_AI ? "[mock AI]" : "[Claude]"}`);
  });
}
