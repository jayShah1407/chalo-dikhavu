// Copy the latest browser build and demo flows into the unpacked dev extension.
import { copyFileSync } from "node:fs";

const example = process.argv[2] ?? "tution-techer";
copyFileSync("dist/raahi.global.js", "dev-extension/raahi.global.js");
copyFileSync(`examples/${example}/flows.js`, "dev-extension/flows.js");
console.log(`dev-extension ready with examples/${example} — reload it in chrome://extensions`);
