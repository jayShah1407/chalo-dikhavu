import { defineConfig } from "tsup";

export default defineConfig([
  {
    // npm consumers: ESM + CJS with type declarations.
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    target: "es2020",
  },
  {
    // <script> tag / CDN / dev extension: exposes window.Raahi.
    entry: { raahi: "src/index.ts" },
    format: ["iife"],
    globalName: "Raahi",
    minify: true,
    target: "es2020",
  },
]);
