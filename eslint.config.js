import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "site/", "node_modules/", "test-results/", "playwright-report/", ".readme-examples/", ".cache/", ".usage/", ".docs-examples/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["scripts/**/*.mjs", "e2e/**/*.mjs", "examples/**/*.{js,mjs}", "playwright.config.mjs"], languageOptions: { globals: { console: "readonly", process: "readonly", URL: "readonly", Buffer: "readonly", document: "readonly", window: "readonly", fetch: "readonly", setTimeout: "readonly" } } },
  { files: ["demo/**/*.js"], languageOptions: { globals: { document: "readonly", window: "readonly", location: "readonly", history: "readonly", navigator: "readonly", URLSearchParams: "readonly", localStorage: "readonly", matchMedia: "readonly", Blob: "readonly", URL: "readonly", console: "readonly", requestAnimationFrame: "readonly", setTimeout: "readonly", CSS: "readonly", IntersectionObserver: "readonly", FileReader: "readonly" } } },
);
