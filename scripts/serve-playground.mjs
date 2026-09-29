// Serve the playground SPA on http://localhost:4400 with the local build and demo flows.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const PORT = Number(process.env.PORT ?? 4400);
const files = {
  "/raahi.global.js": "dist/raahi.global.js",
  "/flows.js": "examples/tution-techer/flows.js",
};

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  const file = files[path];
  try {
    let body = await readFile(file ?? "examples/playground/index.html", "utf-8");
    // BARE=1 serves the page without Raahi, to test injection by the dev extension.
    if (!file && process.env.BARE) body = body.replace(/<script src="\/raahi[\s\S]*<\/script>\s*(?=<\/body>)/, "");
    res.writeHead(200, { "content-type": file ? "text/javascript" : "text/html; charset=utf-8" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Run `npm run build` first.");
  }
}).listen(PORT, () => console.log(`Raahi playground: http://localhost:${PORT}/student`));
