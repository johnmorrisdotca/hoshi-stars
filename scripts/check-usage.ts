// Every way of using the package that the guides show, run against the package as npm packs it: the files in examples/ are copied beside a copy of the packed package
// (.usage/node_modules/@johnmorrisdotca/hoshi-stars) and each one is built, type-checked or run, and the ones with a page are opened in a browser, which must show a
// sky chart. The guides must hold these files' text, word for word, so what a reader copies is what was tested.
// `pnpm test:usage` (builds the package and the site first). One browser, one page at a time.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SOFTWARE_GL_ARGS, acquireBrowserLock } from "@johnmorrisdotca/kazoku-ui/testing";
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

/** The drawing holds a picture pinned to the sky by a matrix, and an outline of 49 points. */
const seesImage = async (page: Page): Promise<void> => {
  const image = page.locator("#sky svg image");
  await image.waitFor({ state: "attached", timeout: 20_000 });
  if (!/^matrix\(/.test((await image.getAttribute("transform")) ?? "")) throw new Error("the picture is not pinned to the sky");
  const outline = (await page.locator("#sky svg path").first().getAttribute("d")) ?? "";
  if ((outline.match(/[ML]/g) ?? []).length !== 49) throw new Error(`the outline has ${(outline.match(/[ML]/g) ?? []).length} points, not 49`);
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

// One browser at a time on this machine, and WebGL (the 3D embed) drawn in software, never on the graphics card.
const lock = await acquireBrowserLock();
const browser = await chromium.launch({ args: [...SOFTWARE_GL_ARGS] });

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

await step("sky-labels-node", () => {
  const out = execFileSync(process.execPath, [join(examples("sky-labels"), "labels.mjs")], { cwd: usage, encoding: "utf8" }).trim().split("\n");
  if (out.length !== 4 || out[0] !== "SIRIUS, RIGEL, PROCYON, BETELGEUSE, ALDEBARAN") throw new Error(`the names are not the five brightest in view: ${out.join(" | ")}`);
  if (out[1] !== "RIGEL, PROCYON, BETELGEUSE, ALDEBARAN, POLLUX") throw new Error(`the disc did not hide Sirius: ${out[1]}`);
  if (out[2] !== "Ori Orion 1 0.3") throw new Error(`the pointer did not raise Orion alone to full strength: ${out[2]}`);
});

await step("sky-labels-iframe", async () => {
  if (!existsSync(at("site", "embed.html"))) throw new Error("site/ is not built: `pnpm test:usage` builds it");
  await opened(browser, async (page) => {
    await serve(page, "https://johnmorrisdotca.github.io", at("site"), "/hoshi-stars");
    await showPage(page, "sky-labels/iframe.html");
    const frame = page.frameLocator("iframe");
    await frame.locator("svg circle").first().waitFor({ state: "attached", timeout: 20_000 });
    const named = await frame.locator("svg [data-star-name]").count();
    if (named !== 10) throw new Error(`the embed named ${named} stars, not 10`);
    if ((await frame.locator("svg [data-faint-lines]").getAttribute("stroke-opacity")) !== "0.16") throw new Error("the embed's lines are not at the strength its address gave");
  });
});

await step("distance-node", () => {
  const out = execFileSync(process.execPath, [join(examples("distance"), "layers.mjs")], { cwd: usage, encoding: "utf8" }).trim().split("\n");
  if (out.length !== 7 || out[0] !== "10: 9 things; bands 9 0 0 0 0 0; 0 uncertain; 3083 with no distance") throw new Error(`the nearest layer is not the 9 stars within 10 light-years: ${out.join(" | ")}`);
  if (!/^Infinity: 7672 things/.test(out[5]!) || out[6] !== "true 593 1483") throw new Error(`unexpected output: ${out.join(" | ")}`);
});

await step("distance-iframe", async () => {
  if (!existsSync(at("site", "embed.html"))) throw new Error("site/ is not built: `pnpm test:usage` builds it");
  await opened(browser, async (page) => {
    await serve(page, "https://johnmorrisdotca.github.io", at("site"), "/hoshi-stars");
    await showPage(page, "distance/iframe.html");
    const flat = page.frameLocator("iframe").first();
    await flat.locator("[data-dist-band]").first().waitFor({ state: "attached", timeout: 30_000 });
    if ((await flat.locator('.dist-legend li[data-band="0"]').count()) !== 1) throw new Error("the flat embed has no legend for the first band");
    const space = page.frameLocator("iframe").last();
    await space.locator("#sp-stage[data-state=live]").waitFor({ state: "attached", timeout: 60_000 });
    if (Number(await space.locator("#sp-stage").getAttribute("data-things")) < 500) throw new Error("the 3D embed drew too few things for 100 light-years");
  });
});

await step("constellation-3d-node", () => {
  const out = execFileSync(process.execPath, [join(examples("constellation-3d"), "node.mjs")], { cwd: usage, encoding: "utf8" }).trim().split("\n");
  if (out.length !== 9 || out[0] !== "Betelgeuse (fair): 548 ly, between 480 and 640" || out[4] !== "Alnilam (none): distance unknown" || out[5] !== "Saiph (rough): 247 ly, at least 116") throw new Error(`unexpected output: ${out.join("\n")}`);
  if (out[8] !== "{ good: 0, fair: 1, rough: 6, none: 1 }") throw new Error(`unexpected counts: ${out[8]}`);
});

await step("constellation-3d-side-view", async () => {
  await opened(browser, async (page) => {
    await cdn(page, "https://cdn.jsdelivr.net", "/npm/@johnmorrisdotca/hoshi-stars/");
    await showPage(page, "constellation-3d/side-view.html");
    const svg = page.locator("#space svg");
    await svg.waitFor({ state: "attached", timeout: 20_000 });
    const [stars, lines] = [await svg.locator("circle").count(), await svg.locator("line").count()];
    if ((await svg.getAttribute("aria-label")) !== "The Great Bear from the side" || stars !== 9 || lines < 8) throw new Error(`the side view has ${stars} stars and ${lines} lines`);
  });
});

await step("constellation-3d-iframe", async () => {
  if (!existsSync(at("site", "embed-3d.html"))) throw new Error("site/ is not built: `pnpm test:usage` builds it");
  await opened(browser, async (page) => {
    await serve(page, "https://johnmorrisdotca.github.io", at("site"), "/hoshi-stars");
    await showPage(page, "constellation-3d/iframe.html");
    const frame = page.frameLocator("iframe");
    await frame.locator("#sp-stage[data-state=live]").waitFor({ timeout: 60_000 });
    await frame.locator(".sp-label:not([hidden])").first().waitFor({ timeout: 20_000 });
    // turned to the side by its address
    const across = Number(await frame.locator("#sp-stage").getAttribute("data-across"));
    if (!(across > 0.9)) throw new Error(`the embed ignored its address: it is not turned (${across})`);
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

// The star portrait: the same ways, for the one-star picture.
const seesStar = async (page: Page, selector: string, label: RegExp): Promise<void> => {
  const svg = page.locator(selector).first();
  await svg.waitFor({ state: "attached", timeout: 20_000 });
  if (!label.test((await svg.getAttribute("aria-label")) ?? "")) throw new Error(`the picture's label is ${await svg.getAttribute("aria-label")}`);
  if ((await svg.locator("ellipse").count()) < 5) throw new Error("the portrait has no disc");
  if (!/not a photo/.test((await svg.textContent()) ?? "")) throw new Error("the portrait does not say it is not a photo");
};

await step("portrait-node", () => {
  const out = execFileSync(process.execPath, [join(examples("portrait"), "node.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  if (!/^Betelgeuse \d+ Suns across, from \d+ to \d+$/.test(out)) throw new Error(`unexpected output: ${out}`);
  const [, radius, low, high] = /(\d+) Suns across, from (\d+) to (\d+)/.exec(out)!.map(Number) as [number, number, number, number];
  if (!(radius > 100 && low < radius && radius < high)) throw new Error(`Betelgeuse's radius reads ${out}`);
});

await step("portrait-cdn", async () => {
  await opened(browser, async (page) => {
    await cdn(page, "https://cdn.jsdelivr.net", "/npm/@johnmorrisdotca/hoshi-stars/");
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples("portrait"), "cdn.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    await seesStar(page, "#star svg", /^Arcturus, drawn from its numbers$/);
  });
});

await step("portrait-iframe", async () => {
  if (!existsSync(at("site", "star.html"))) throw new Error("site/ is not built: `pnpm test:usage` builds it");
  await opened(browser, async (page) => {
    await serve(page, "https://johnmorrisdotca.github.io", at("site"), "/hoshi-stars");
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples("portrait"), "iframe.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    const frame = page.frameLocator("iframe");
    await frame.locator("svg").first().waitFor({ state: "attached", timeout: 20_000 });
    if ((await frame.locator("svg text", { hasText: "Earth's orbit" }).count()) === 0) throw new Error("the star embed page ignored its address: no comparison with Earth's orbit");
  });
});

await step("star-3d-iframe", async () => {
  await opened(browser, async (page) => {
    await serve(page, "https://johnmorrisdotca.github.io", at("site"), "/hoshi-stars");
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples("portrait"), "iframe-3d.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    const frame = page.frameLocator("iframe");
    await frame.locator('[data-testid="star-3d"][data-live="true"]').waitFor({ timeout: 60_000 });
    if (!/measured/.test((await frame.locator('[data-testid="star-3d-caption"]').textContent()) ?? "")) throw new Error("the 3D star of Altair does not say its shape is measured");
  });
});

await step("portrait-react-ssr", async () => {
  const script = join(usage, "ssr-star.tsx");
  writeFileSync(script, `import { renderToString } from "react-dom/server";\nimport { Star } from "./examples/portrait/Star";\nconst html = renderToString(<Star />);\nif (!html.includes("<svg")) throw new Error("no drawing in " + html);\nconsole.log(html);\n`);
  const out = join(usage, "ssr-star.mjs");
  await esbuild({ entryPoints: [script], outfile: out, bundle: true, platform: "node", format: "esm", jsx: "automatic", absWorkingDir: root, logLevel: "silent", external: ["react", "react-dom"], splitting: false });
  const html = execFileSync(process.execPath, [out], { cwd: root, encoding: "utf8" });
  if (!html.includes('aria-label="Sirius, drawn from its numbers"') || !html.includes("not a photo")) throw new Error(`the server render lost the picture: ${html.slice(0, 300)}`);
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

// The chart: `chartSvg` in Node, and <hoshi-chart> from a CDN and in each bundler and framework. The element's hands are kazoku-ui, the package's dependency, put beside it where npm puts it.
const kazoku = join(usage, "node_modules", "@johnmorrisdotca", "kazoku-ui");
if (!existsSync(kazoku)) cpSync(join(root, "node_modules", "@johnmorrisdotca", "kazoku-ui"), kazoku, { recursive: true, dereference: true });
/** One entry bundled, as jsDelivr's /+esm answers it. */
const bundleOf = async (file: string): Promise<string> => {
  const out = await esbuild({ entryPoints: [file], bundle: true, format: "esm", write: false, minify: true, absWorkingDir: usage, logLevel: "silent" });
  return out.outputFiles[0]!.text;
};
/** A <hoshi-chart> has drawn: its own <svg> with an accessible name, stars and lines. */
const seesChart = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => (document.querySelector("hoshi-chart")?.shadowRoot?.querySelectorAll("svg circle").length ?? 0) > 30, undefined, { timeout: 20_000 });
  const drawn = await page.evaluate(() => {
    const svg = document.querySelector("hoshi-chart")!.shadowRoot!.querySelector("svg")!;
    return { label: svg.getAttribute("aria-label") ?? "", lines: svg.querySelectorAll("line, path").length };
  });
  if (drawn.label.trim() === "" || drawn.lines < 8) throw new Error(`the chart has the name "${drawn.label}" and ${drawn.lines} lines`);
};

await step("chart-node", () => {
  const out = execFileSync(process.execPath, [join(examples("chart"), "node.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  if (out !== "subaru.svg true true") throw new Error(`unexpected output: ${out}`);
});

await step("chart-cdn", async () => {
  await opened(browser, async (page) => {
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname !== "/npm/@johnmorrisdotca/hoshi-stars/chart/define/+esm") return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ body: await bundleOf(join(installed, "dist", "chart", "define.js")), contentType: "text/javascript" });
    });
    await showPage(page, "chart/cdn.html");
    await seesChart(page);
  });
});

// How well a star is known: `chartSvg` with the uncertainty look and a pick's grade in Node, and <hoshi-chart> from a CDN with `show-uncertainty` and a tap that says the grade and the range.
await step("chart-uncertainty-node", () => {
  const out = execFileSync(process.execPath, [join(examples("chart"), "uncertainty.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  if (out !== "orion-uncertain.svg true B 480-640 1.5") throw new Error(`unexpected output: ${out}`);
});

await step("chart-uncertainty-cdn", async () => {
  await opened(browser, async (page) => {
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname !== "/npm/@johnmorrisdotca/hoshi-stars/chart/define/+esm") return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ body: await bundleOf(join(installed, "dist", "chart", "define.js")), contentType: "text/javascript" });
    });
    await showPage(page, "chart/uncertainty.html");
    await seesChart(page);
    if ((await page.evaluate(() => document.querySelector("hoshi-chart")!.shadowRoot!.querySelectorAll('circle[data-uncertain="C"]').length)) === 0) throw new Error("no star is drawn dimmer with show-uncertainty");
    const box = (await page.locator("hoshi-chart").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => document.getElementById("card")!.textContent!.includes("grade B"), undefined, { timeout: 10_000 });
  });
});

// Your own markers: `chartSvg` in Node with a time range and a track, and <hoshi-chart> from a CDN with the markers set as a property, a slider for the time range, and a click that says which marker.
await step("markers-node", () => {
  const out = execFileSync(process.execPath, [join(examples("markers"), "node.mjs")], { cwd: usage, encoding: "utf8" }).trim().split("\n")[0];
  if (out !== "november.svg 3 markers, 1 track, 6 days") throw new Error(`unexpected output: ${out}`);
});

await step("markers-cdn", async () => {
  await opened(browser, async (page) => {
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname !== "/npm/@johnmorrisdotca/hoshi-stars/chart/define/+esm") return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ body: await bundleOf(join(installed, "dist", "chart", "define.js")), contentType: "text/javascript" });
    });
    await showPage(page, "markers/cdn.html");
    await seesChart(page);
    const ids = () => page.evaluate(() => [...document.querySelector("hoshi-chart")!.shadowRoot!.querySelectorAll("g[data-marker]")].map((g) => g.getAttribute("data-marker")));
    await page.waitForFunction(() => (document.querySelector("hoshi-chart")?.shadowRoot?.querySelectorAll("g[data-marker]").length ?? 0) === 3, undefined, { timeout: 20_000 });
    if ((await page.evaluate(() => document.querySelector("hoshi-chart")!.shadowRoot!.querySelectorAll("path[data-track]").length)) !== 1) throw new Error("the markers are not joined by the tracks attribute");
    const at = await page.evaluate(() => {
      const box = document.querySelector("hoshi-chart")!.shadowRoot!.querySelector('g[data-marker="second"] circle')!.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    await page.mouse.click(at.x, at.y);
    await page.waitForFunction(() => document.getElementById("card")!.textContent!.startsWith("Second night"), undefined, { timeout: 10_000 });
    await page.evaluate(() => {
      const day = document.getElementById("day") as HTMLInputElement;
      day.value = "6";
      day.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelector("hoshi-chart")!.shadowRoot!.querySelectorAll("g[data-marker]").length === 2, undefined, { timeout: 10_000 });
    const left = await ids();
    if (left.join() !== "first,second") throw new Error(`the time range left ${left.join()}`);
  });
});

// Planets and the Moon on the chart: `chartSvg` in Node with a list of bodies and the ecliptic layer, and <hoshi-chart> from a CDN with `bodies` set as a property, a tap that says which body, and the ecliptic switched off.
await step("bodies-node", () => {
  const out = execFileSync(process.execPath, [join(examples("bodies"), "node.mjs")], { cwd: usage, encoding: "utf8" }).trim().split("\n")[0];
  if (out !== "planets.svg 2 bodies, with the ecliptic") throw new Error(`unexpected output: ${out}`);
});

await step("bodies-cdn", async () => {
  await opened(browser, async (page) => {
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname !== "/npm/@johnmorrisdotca/hoshi-stars/chart/define/+esm") return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ body: await bundleOf(join(installed, "dist", "chart", "define.js")), contentType: "text/javascript" });
    });
    await showPage(page, "bodies/cdn.html");
    await seesChart(page);
    const count = (selector: string) => page.evaluate((s) => document.querySelector("hoshi-chart")!.shadowRoot!.querySelectorAll(s).length, selector);
    await page.waitForFunction(() => (document.querySelector("hoshi-chart")?.shadowRoot?.querySelectorAll("g[data-body]").length ?? 0) === 2, undefined, { timeout: 20_000 });
    if ((await count('path[data-layer="ecliptic"]')) !== 1) throw new Error("the ecliptic layer draws no line");
    if ((await count("path[data-lit]")) !== 1) throw new Error("the Moon is not drawn with its phase");
    const at = await page.evaluate(() => {
      const box = document.querySelector("hoshi-chart")!.shadowRoot!.querySelector('g[data-body="moon"] circle')!.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    await page.mouse.click(at.x, at.y);
    await page.waitForFunction(() => document.getElementById("card")!.textContent === "Moon (月), moon", undefined, { timeout: 10_000 });
    await page.locator("#line").uncheck();
    await page.waitForFunction(() => document.querySelector("hoshi-chart")!.shadowRoot!.querySelectorAll('path[data-layer="ecliptic"]').length === 0, undefined, { timeout: 10_000 });
  });
});

const chartApp = async (name: string, plugins: unknown[] = []): Promise<void> => {
  const dir = examples(join("chart", name));
  const out = join(usage, "out", `chart-${name}`);
  await viteBuild({ root: dir, plugins: plugins as never[], logLevel: "warn", build: { outDir: out, emptyOutDir: true }, base: "./", configFile: false });
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesChart(page);
  });
};
await step("chart-vite", () => chartApp("vite"));
await step("chart-react", () => chartApp("react"));
await step("chart-vue", async () => chartApp("vue", [(await import("@vitejs/plugin-vue")).default({ template: { compilerOptions: { isCustomElement: (tag: string) => tag.startsWith("hoshi-") } } })]));
await step("chart-svelte", async () => chartApp("svelte", [(await import("@sveltejs/vite-plugin-svelte")).svelte()]));
await step("chart-angular", async () => {
  const dir = examples(join("chart", "angular"));
  const out = join(usage, "out", "chart-angular");
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "esnext", experimentalDecorators: true, useDefineForClassFields: false } }));
  await esbuild({ entryPoints: [join(dir, "main.ts")], outdir: out, bundle: true, splitting: true, format: "esm", tsconfig: join(dir, "tsconfig.json"), absWorkingDir: root, logLevel: "silent", minify: true });
  writeFileSync(join(out, "index.html"), readFileSync(join(dir, "index.html")));
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesChart(page);
  });
});

// The package installed as a reader installs it, in a project of its own: npm brings kazoku-ui with it, and a Vite app that imports only /chart/define builds and moves (as an optional peer it did not
// build: Vite stopped at kazoku-ui's missing export).
await step("chart-installed", async () => {
  const app = join(usage, "installed");
  mkdirSync(app, { recursive: true });
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "installed-app", private: true, type: "module" }));
  sh("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", "--no-package-lock", tarball], app);
  if (!existsSync(join(app, "node_modules", "@johnmorrisdotca", "kazoku-ui", "package.json"))) throw new Error("npm did not install kazoku-ui with the package");
  writeFileSync(join(app, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><script type="module" src="./main.js"></script></head><body><hoshi-chart style="width:640px;height:400px"></hoshi-chart></body></html>`);
  writeFileSync(join(app, "main.js"), `import "@johnmorrisdotca/hoshi-stars/chart/define";\n`);
  const out = join(usage, "out", "chart-installed");
  await viteBuild({ root: app, logLevel: "warn", build: { outDir: out, emptyOutDir: true }, base: "./", configFile: false });
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesChart(page);
    const before = await page.evaluate(() => (document.querySelector("hoshi-chart") as unknown as { view: { ra: number } }).view.ra);
    await page.mouse.move(320, 200);
    await page.mouse.down();
    await page.mouse.move(420, 230, { steps: 8 });
    await page.mouse.up();
    const after = await page.evaluate(() => (document.querySelector("hoshi-chart") as unknown as { view: { ra: number } }).view.ra);
    if (Math.abs(after - before) < 1) throw new Error(`a drag did not move the sky: ra ${before} then ${after}`);
  });
});

await step("door-node", () => {
  const out = execFileSync(process.execPath, [join(examples("door"), "source.mjs")], { cwd: usage, encoding: "utf8" }).trim().split("\n");
  if (out.length !== 4 || !out[0]!.startsWith("2 stars")) throw new Error(`the source was not drawn: ${out.join(" | ")}`);
  if (!/CC BY-NC 4\.0; non-commercial/.test(out[1]!)) throw new Error(`the English credit does not say non-commercial beside the licence: ${out[1]}`);
  if (!/CC BY-NC 4\.0、非営利のみ/.test(out[2]!)) throw new Error(`the Japanese credit does not say 非営利のみ beside the licence: ${out[2]}`);
  if (out[3] !== "0 stars with the source off") throw new Error(`switching the source off did not bring back the first picture: ${out[3]}`);
});

await step("deep-sky-node", () => {
  const out = execFileSync(process.execPath, [join(examples("deep-sky"), "outline.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  if (out !== "M31 190.5 61.7 35 pictures/M31.webp") throw new Error(`unexpected output: ${out}`);
  const svg = readFileSync(join(tmpdir(), "hoshi-m31.svg"), "utf8");
  if ((svg.match(/<path /g) ?? []).length !== 2 || !svg.includes("M")) throw new Error("the drawing lost its outline or its frame");
});

await step("deep-sky-picture", async () => {
  if (!existsSync(at("site", "pictures", "M31.webp"))) throw new Error("site/ is not built: `pnpm test:usage` builds it");
  await opened(browser, async (page) => {
    await cdn(page, "https://cdn.jsdelivr.net", "/npm/@johnmorrisdotca/hoshi-stars/");
    // the pictures are not in the npm package: the page asks the demo site for them, which here is the built site
    await serve(page, "https://johnmorrisdotca.github.io", at("site"), "/hoshi-stars");
    const arrived = page.waitForResponse((response) => response.url() === "https://johnmorrisdotca.github.io/hoshi-stars/pictures/M31.webp", { timeout: 20_000 });
    await showPage(page, "deep-sky/picture.html");
    const picture = await arrived;
    if (!picture.ok() || (await picture.body()).length < 5000) throw new Error("the picture of M31 did not arrive from the demo site");
    await seesImage(page);
  });
});

await step("accuracy", () => {
  const out = execFileSync(process.execPath, [join(examples("node"), "accuracy.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  const expected = ["Sirius: grade A, distance good (0.6%), parallax from GCTP", "position from BSC, to 1.4 arcsec, stated error undefined", "Betelgeuse: grade B, parallax from literature, fair distance", "Proxima Centauri: grade A, position from 2MASS (+-0.1 arcsec)"].join("\n");
  if (out !== expected) throw new Error(`unexpected output: ${out}`);
});

await step("min-grade", () => {
  const out = execFileSync(process.execPath, [join(examples("node"), "min-grade.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  const expected = ["68 of 5080 bright stars are grade A; 1517 nearby stars are B or better", "Procyon: 5.2, 5.2 to 5.3 light-years", "Ran: 8.0, 7.9 to 8.0 light-years", "Rigil Kentaurus: 9.5, 9.4 to 9.5 light-years, tied with a neighbour", "Toliman: 9.5, 9.4 to 9.5 light-years, tied with a neighbour"].join("\n");
  if (out !== expected) throw new Error(`unexpected output: ${out}`);
});

await step("near-stars", () => {
  const out = execFileSync(process.execPath, [join(examples("node"), "near-stars.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  const expected = ["73 systems within 20 light-years, the nearest Alpha Centauri", "Barnard's Star (バーナード星): 5.98 light-years, M5 V", "position from 2MASS, distance from GCTP, Oph", "TRAPPIST-1: 7 planets, periods 1.51, 2.42, 4.05, 6.10, 9.21, 12.35, 18.77 days"].join("\n");
  if (out !== expected) throw new Error(`unexpected output: ${out}`);
});

await step("tonight", () => {
  const out = execFileSync(process.execPath, [join(examples("node"), "tonight.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  const expected = ["night, limit 5: 543 stars, the brightest Sirius", "day: 0 stars", "Polaris 50 degrees up, easy"].join("\n");
  if (out !== expected) throw new Error(`unexpected output: ${out}`);
});

await browser.close();
lock.release();

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
  "constellation-3d/node.mjs": ["docs/guides/constellation-in-3d.md", "docs/guides/ja/constellation-in-3d.md"],
  "constellation-3d/side-view.html": ["docs/guides/constellation-in-3d.md", "docs/guides/ja/constellation-in-3d.md"],
  "constellation-3d/iframe.html": ["docs/guides/constellation-in-3d.md", "docs/guides/ja/constellation-in-3d.md"],
  "portrait/node.mjs": ["docs/guides/star-profile.md", "docs/guides/ja/star-profile.md"],
  "portrait/cdn.html": ["docs/guides/star-profile.md", "docs/guides/ja/star-profile.md"],
  "portrait/iframe.html": ["docs/guides/star-profile.md", "docs/guides/ja/star-profile.md"],
  "portrait/iframe-3d.html": ["docs/guides/star-in-3d.md", "docs/guides/ja/star-in-3d.md"],
  "portrait/Star.tsx": ["docs/guides/star-profile.md", "docs/guides/ja/star-profile.md"],
  "sky-labels/labels.mjs": ["README.md", "docs/guides/sky-names-and-lines.md", "docs/guides/ja/sky-names-and-lines.md"],
  "sky-labels/iframe.html": ["docs/guides/sky-names-and-lines.md", "docs/guides/ja/sky-names-and-lines.md"],
  "distance/layers.mjs": ["README.md", "docs/guides/sky-by-distance.md", "docs/guides/ja/sky-by-distance.md"],
  "distance/iframe.html": ["docs/guides/sky-by-distance.md", "docs/guides/ja/sky-by-distance.md"],
  "door/source.mjs": ["README.md", "docs/guides/data-door.md", "docs/guides/ja/data-door.md"],
  "deep-sky/outline.mjs": ["docs/guides/deep-sky-pictures.md", "docs/guides/ja/deep-sky-pictures.md"],
  "deep-sky/picture.html": ["docs/guides/deep-sky-pictures.md", "docs/guides/ja/deep-sky-pictures.md"],
  "node/accuracy.mjs": ["docs/guides/accuracy.md", "docs/guides/ja/accuracy.md"],
  "node/min-grade.mjs": ["docs/guides/accuracy.md", "docs/guides/ja/accuracy.md"],
  "node/tonight.mjs": ["docs/guides/tonight.md", "docs/guides/ja/tonight.md"],
  "node/near-stars.mjs": ["docs/guides/near-stars.md", "docs/guides/ja/near-stars.md"],
  "chart/node.mjs": ["README.md", "docs/guides/sky-chart.md", "docs/guides/ja/sky-chart.md"],
  "chart/cdn.html": ["README.md", "docs/guides/sky-chart.md", "docs/guides/ja/sky-chart.md"],
  "chart/uncertainty.mjs": ["docs/guides/sky-chart.md", "docs/guides/ja/sky-chart.md"],
  "chart/uncertainty.html": ["docs/guides/sky-chart.md", "docs/guides/ja/sky-chart.md"],
  "markers/node.mjs": ["docs/guides/sky-chart-markers.md", "docs/guides/ja/sky-chart-markers.md"],
  "markers/cdn.html": ["docs/guides/sky-chart-markers.md", "docs/guides/ja/sky-chart-markers.md"],
  "bodies/node.mjs": ["docs/guides/sky-chart-bodies.md", "docs/guides/ja/sky-chart-bodies.md"],
  "bodies/cdn.html": ["docs/guides/sky-chart-bodies.md", "docs/guides/ja/sky-chart-bodies.md"],
  "chart/vite/main.ts": ["docs/guides/sky-chart.md", "docs/guides/ja/sky-chart.md"],
  "chart/react/SkyChart.tsx": ["docs/guides/sky-chart.md", "docs/guides/ja/sky-chart.md"],
  "chart/vue/SkyChart.vue": ["docs/guides/sky-chart.md", "docs/guides/ja/sky-chart.md"],
  "chart/svelte/SkyChart.svelte": ["docs/guides/sky-chart.md", "docs/guides/ja/sky-chart.md"],
  "chart/angular/sky-chart.component.ts": ["docs/guides/sky-chart.md", "docs/guides/ja/sky-chart.md"],
};
const normal = (text: string) => text.replace(/\r\n/g, "\n").trim();
for (const [file, places] of everything ? Object.entries(FILES) : []) {
  const code = normal(readFileSync(at("examples", file), "utf8"));
  for (const place of places) {
    if (!normal(readFileSync(at(place), "utf8")).includes(code)) failures.push(`${place} does not hold examples/${file} word for word`);
  }
}
const unlisted = (folder: string): string[] => readdirSync(at("examples", folder), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? unlisted(join(folder, entry.name)) : [relative("", join(folder, entry.name)).split("\\").join("/")]));
const known = new Set([...Object.keys(FILES), "angular/index.html", "angular/main.ts", "react/index.html", "react/main.tsx", "svelte/index.html", "svelte/main.ts", "vue/index.html", "chart/vite/index.html", "chart/react/index.html", "chart/react/main.tsx", "chart/vue/index.html", "chart/vue/main.ts", "chart/svelte/index.html", "chart/svelte/main.ts", "chart/angular/index.html", "chart/angular/main.ts"]);
for (const file of everything ? unlisted("") : []) if (!known.has(file)) failures.push(`examples/${file} is not listed in scripts/check-usage.ts: say where the guides show it`);

console.log(failures.length === 0 ? `\nusage ok: ${results.length} ways to use ${NAME}` : `\n${failures.length} failure${failures.length === 1 ? "" : "s"}:\n- ${failures.join("\n- ")}`);
if (failures.length > 0) process.exit(1);
