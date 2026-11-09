// Every way of using the package that the guides show, run against the package as npm packs it: the files in examples/ are copied beside a copy of the packed package
// (.usage/node_modules/@johnmorrisdotca/hoshi-stars) and each one is built, type-checked or run, and the ones with a page are opened in a browser, which must show a
// sky chart. The guides must hold these files' text, word for word, so what a reader copies is what was tested.
// `pnpm test:usage` (builds the package and the site first). One browser, one page at a time.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "@playwright/test";
import { build as esbuild } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const at = (...parts: string[]) => join(root, ...parts);
const usage = at(".usage");
const NAME = "@johnmorrisdotca/hoshi-stars";
const require = createRequire(import.meta.url);

/** Run a program and, if it fails, say what it printed. */
const sh = (program: string, args: string[], cwd: string): string => {
  try {
    return execFileSync(program, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const out = error as { stdout?: string; stderr?: string };
    throw new Error(`${program} ${args.join(" ")} failed:\n${out.stdout ?? ""}${out.stderr ?? ""}`);
  }
};

const only = process.argv.slice(2);
const results: string[] = [];
const failures: string[] = [];
const step = async (name: string, run: () => Promise<void> | void): Promise<void> => {
  if (only.length > 0 && !only.includes(name)) return;
  const started = Date.now();
  try {
    await run();
    results.push(`ok   ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    results.push(`FAIL ${name}`);
  }
  console.log(results[results.length - 1]);
};

// 1. The package as npm packs it, installed beside the examples.
rmSync(usage, { recursive: true, force: true });
mkdirSync(usage, { recursive: true });
const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", usage], { cwd: root, encoding: "utf8" })) as { filename: string }[];
const tarball = join(usage, packed[0]!.filename);
const installed = join(usage, "node_modules", "@johnmorrisdotca", "hoshi-stars");
mkdirSync(installed, { recursive: true });
execFileSync("tar", ["-xzf", tarball, "-C", installed, "--strip-components=1"]);
cpSync(at("examples"), join(usage, "examples"), { recursive: true });
const examples = (name: string) => join(usage, "examples", name);

// 2. A page that is a folder of built files, served to the browser without a port.
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp" };
const serve = async (page: Page, origin: string, folder: string, prefix = ""): Promise<void> => {
  await page.route(`${origin}${prefix}/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname.slice(prefix.length);
    const file = join(folder, decodeURIComponent(pathname.endsWith("/") ? `${pathname}index.html` : pathname));
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ body: readFileSync(file), contentType: TYPES[extname(file)] ?? "application/octet-stream" });
  });
};

const opened = async (browser: Browser, run: (page: Page, errors: string[]) => Promise<void>): Promise<void> => {
  const context = await browser.newContext({ viewport: { width: 800, height: 700 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  try {
    await run(page, errors);
  } finally {
    await context.close();
  }
  if (errors.length > 0) throw new Error(`the page reported errors:\n${errors.join("\n")}`);
};

/** A chart is drawn: an <svg> with an aria-label, stars (circles) and lines. */
const seesSky = async (page: Page, selector = "svg"): Promise<void> => {
  const svg = page.locator(selector).first();
  await svg.waitFor({ state: "attached", timeout: 20_000 });
  const label = (await svg.getAttribute("aria-label")) ?? "";
  if (label.trim() === "") throw new Error("the drawing has no aria-label");
  const stars = await svg.locator("circle").count();
  const lines = await svg.locator("line").count();
  if (stars < 30 || lines < 8) throw new Error(`the chart has ${stars} stars and ${lines} lines`);
};

/** A CDN's answer: a file of the installed package, under the address the page asks for. */
const cdn = async (page: Page, host: string, base: string): Promise<void> => {
  await page.route(`${host}/**`, (route) => {
    const { pathname } = new URL(route.request().url());
    const file = pathname.startsWith(base) ? join(installed, pathname.slice(base.length)) : "";
    if (file === "" || !existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ body: readFileSync(file), contentType: "text/javascript" });
  });
};
const pageOf = (file: string) => readFileSync(file, "utf8");
const showPage = async (page: Page, file: string): Promise<void> => {
  await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples(""), file)), contentType: "text/html" }));
  await page.goto("https://page.test/");
};

const browser = await chromium.launch();

await step("node", () => {
  const out = execFileSync(process.execPath, [join(examples("node"), "server.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  if (out !== "hoshi-sky.svg 9 lines in the Great Bear") throw new Error(`unexpected output: ${out}`);
});

await step("black-holes", () => {
  const out = execFileSync(process.execPath, [join(examples("node"), "black-holes.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  const expected = ["301 black holes: 78 stellar, 5 quiet, 218 supermassive", "Cygnus X-1: 21.2 Suns, 7241 light-years, companion HDE 226868", "mass from Miller-Jones 2021, Science 371, 1046"].join("\n");
  if (out !== expected) throw new Error(`unexpected output: ${out}`);
});

await step("typescript", () => {
  writeFileSync(join(examples("typescript"), "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true, lib: ["es2023", "dom", "dom.iterable"], types: [], skipLibCheck: true }, include: ["index.ts"] }));
  sh(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", join(examples("typescript"), "tsconfig.json")], usage);
  // The same file, run: types are erased, so it is plain JavaScript to Node.
  const run = execFileSync(process.execPath, [join(examples("typescript"), "index.ts")], { cwd: usage, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (run.trim() !== "Sirius 9 true true 7") throw new Error(`unexpected output: ${run}`);
});

await step("cdn-jsdelivr", async () => {
  await opened(browser, async (page) => {
    await cdn(page, "https://cdn.jsdelivr.net", "/npm/@johnmorrisdotca/hoshi-stars/");
    await showPage(page, "cdn-jsdelivr.html");
    await seesSky(page, "#sky svg");
  });
});

await step("cdn-unpkg", async () => {
  await opened(browser, async (page) => {
    await cdn(page, "https://unpkg.com", "/@johnmorrisdotca/hoshi-stars/");
    await showPage(page, "cdn-unpkg.html");
    await page.waitForFunction(() => /Sirius: magnitude -1\.46, 8\.5 light-years, colour #[0-9a-f]{6}/.test(document.querySelector("#facts")?.textContent ?? ""), undefined, { timeout: 20_000 });
  });
});

await step("iframe", async () => {
  if (!existsSync(at("site", "embed.html"))) throw new Error("site/ is not built: `pnpm test:usage` builds it");
  await opened(browser, async (page) => {
    await serve(page, "https://johnmorrisdotca.github.io", at("site"), "/hoshi-stars");
    await showPage(page, "iframe.html");
    const frame = page.frameLocator("iframe");
    await frame.locator("svg circle").first().waitFor({ state: "attached", timeout: 20_000 });
    if ((await frame.locator("svg text", { hasText: "Orion" }).count()) === 0) throw new Error("the embed ignored its address: no Orion");
  });
});

// The bundlers and frameworks: built, then opened.
const { build: viteBuild } = await import("vite");
const viteApp = async (name: string, plugins: unknown[] = []): Promise<void> => {
  const dir = examples(name);
  const out = join(usage, "out", name);
  await viteBuild({ root: dir, plugins: plugins as never[], logLevel: "warn", build: { outDir: out, emptyOutDir: true }, base: "./", configFile: false });
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesSky(page);
  });
};

await step("vite", () => viteApp("vite"));
await step("react", () => viteApp("react"));
await step("vue", async () => viteApp("vue", [(await import("@vitejs/plugin-vue")).default()]));
await step("svelte", async () => viteApp("svelte", [(await import("@sveltejs/vite-plugin-svelte")).svelte()]));

await step("react-ssr", async () => {
  const script = join(usage, "ssr-react.tsx");
  writeFileSync(script, `import { renderToString } from "react-dom/server";\nimport { Orion } from "./examples/react/Orion";\nconst html = renderToString(<Orion />);\nif (!html.includes("<svg")) throw new Error("no drawing in " + html);\nconsole.log(html);\n`);
  const out = join(usage, "ssr-react.mjs");
  await esbuild({ entryPoints: [script], outfile: out, bundle: true, platform: "node", format: "esm", jsx: "automatic", absWorkingDir: root, logLevel: "silent", external: ["react", "react-dom"], splitting: false });
  const html = execFileSync(process.execPath, [out], { cwd: root, encoding: "utf8" });
  if (!html.includes('aria-label="Orion"')) throw new Error(`the server render lost the label: ${html.slice(0, 300)}`);
});

await step("webpack", async () => {
  const { default: webpack } = await import("webpack");
  const dir = examples("webpack");
  const config = (await import(pathToFileURL(join(dir, "webpack.config.mjs")).href)).default as Record<string, unknown>;
  const stats = await new Promise<import("webpack").Stats>((resolve, reject) => {
    webpack({ ...config, context: dir, output: { ...(config["output"] as object), path: join(usage, "out", "webpack") } } as import("webpack").Configuration, (error, result) => (error || !result ? reject(error ?? new Error("no result")) : resolve(result)));
  });
  if (stats.hasErrors()) throw new Error(stats.toString({ colors: false, errors: true }));
  const out = join(usage, "out", "webpack");
  writeFileSync(join(out, "index.html"), `<!doctype html><html><body><script src="main.js"></script></body></html>`);
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesSky(page, "#sky svg");
  });
});

await step("angular", async () => {
  const dir = examples("angular");
  const out = join(usage, "out", "angular");
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "esnext", experimentalDecorators: true, useDefineForClassFields: false } }));
  await esbuild({ entryPoints: [join(dir, "main.ts")], outdir: out, bundle: true, splitting: true, format: "esm", tsconfig: join(dir, "tsconfig.json"), absWorkingDir: root, logLevel: "silent", minify: true });
  writeFileSync(join(out, "index.html"), readFileSync(join(dir, "index.html")));
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesSky(page);
  });
});

await browser.close();

// 3. The guides hold what was tested, word for word.
const everything = only.length === 0;
const FILES: Record<string, string[]> = {
  "cdn-jsdelivr.html": ["docs/guides/html-and-cdn.md", "docs/guides/ja/html-and-cdn.md"],
  "cdn-unpkg.html": ["docs/guides/html-and-cdn.md", "docs/guides/ja/html-and-cdn.md"],
  "iframe.html": ["README.md", "docs/guides/embed-in-an-iframe.md", "docs/guides/ja/embed-in-an-iframe.md"],
  "vite/main.ts": ["docs/guides/bundlers.md", "docs/guides/ja/bundlers.md"],
  "vite/index.html": ["docs/guides/bundlers.md", "docs/guides/ja/bundlers.md"],
  "webpack/src/index.js": ["docs/guides/bundlers.md", "docs/guides/ja/bundlers.md"],
  "webpack/webpack.config.mjs": ["docs/guides/bundlers.md", "docs/guides/ja/bundlers.md"],
  "react/Orion.tsx": ["README.md", "docs/guides/frameworks.md", "docs/guides/ja/frameworks.md"],
  "vue/Orion.vue": ["docs/guides/frameworks.md", "docs/guides/ja/frameworks.md"],
  "vue/main.ts": ["docs/guides/frameworks.md", "docs/guides/ja/frameworks.md"],
  "svelte/Orion.svelte": ["docs/guides/frameworks.md", "docs/guides/ja/frameworks.md"],
  "angular/orion.component.ts": ["docs/guides/frameworks.md", "docs/guides/ja/frameworks.md"],
  "typescript/index.ts": ["docs/guides/typescript-and-node.md", "docs/guides/ja/typescript-and-node.md"],
  "node/server.mjs": ["docs/guides/typescript-and-node.md", "docs/guides/ja/typescript-and-node.md"],
  "node/black-holes.mjs": ["docs/guides/black-holes.md", "docs/guides/ja/black-holes.md"],
  "serve/server.mjs": ["docs/guides/serve-it-yourself.md", "docs/guides/ja/serve-it-yourself.md"],
};
const normal = (text: string) => text.replace(/\r\n/g, "\n").trim();
for (const [file, places] of everything ? Object.entries(FILES) : []) {
  const code = normal(readFileSync(at("examples", file), "utf8"));
  for (const place of places) {
    if (!normal(readFileSync(at(place), "utf8")).includes(code)) failures.push(`${place} does not hold examples/${file} word for word`);
  }
}
const unlisted = (folder: string): string[] => readdirSync(at("examples", folder), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? unlisted(join(folder, entry.name)) : [relative("", join(folder, entry.name)).split("\\").join("/")]));
const known = new Set([...Object.keys(FILES), "angular/index.html", "angular/main.ts", "react/index.html", "react/main.tsx", "svelte/index.html", "svelte/main.ts", "vue/index.html"]);
for (const file of everything ? unlisted("") : []) if (!known.has(file)) failures.push(`examples/${file} is not listed in scripts/check-usage.ts: say where the guides show it`);

console.log(failures.length === 0 ? `\nusage ok: ${results.length} ways to use ${NAME}` : `\n${failures.length} failure${failures.length === 1 ? "" : "s"}:\n- ${failures.join("\n- ")}`);
if (failures.length > 0) process.exit(1);
