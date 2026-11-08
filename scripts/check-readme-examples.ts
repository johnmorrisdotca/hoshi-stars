// Runs the examples of the README and of every guide in docs/guides/ (`pnpm test:readme`, after a build). Every fenced `js` or `ts` block is written to its own
// file under .readme-examples/, which imports the package by its name exactly as a reader would (the package names itself through its `exports`, so this is the
// built package in this checkout), and run. A block's `console.log(x); // 4` says what it prints, and the comment lines that end a block say what the block
// printed: both are compared with the output. Flags on the fence: `no-run` does not run the block, `no-check` skips it (an excerpt). Every export of every entry point
// must be named in the README or a guide. A block that fails is named by its page and line.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = join(root, ".readme-examples");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const pages: Array<[string, string]> = [["README.md", readFileSync(join(root, "README.md"), "utf8")]];
// The guides, in English: their Japanese twins (docs/guides/ja) hold the same code, which `pnpm docs:check` compares block for block.
for (const name of readdirSync(join(root, "docs", "guides")).filter((n) => n.endsWith(".md"))) pages.push([`docs/guides/${name}`, readFileSync(join(root, "docs", "guides", name), "utf8")]);

let failed = 0;
let ran = 0;
for (const [file, text] of pages) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const open = /^```(\w+)([^\n]*)$/.exec(lines[i]!);
    if (!open) continue;
    let end = i + 1;
    while (end < lines.length && lines[end] !== "```") end++;
    const body = lines.slice(i + 1, end);
    const flags = open[2]!.trim().split(/\s+/);
    const where = `${file} line ${i + 1}`;
    i = end;
    if ((open[1] !== "js" && open[1] !== "ts") || flags.includes("no-check")) continue;
    // What the block says it prints.
    const inline: string[] = [];
    let allInline = true;
    for (const line of body) {
      const log = /^console\.log\(.*\);\s*\/\/ ?(.*)$/.exec(line);
      if (log) inline.push(log[1]!);
      else if (/^console\.log\(/.test(line)) allInline = false;
    }
    let tail = body.length;
    while (tail > 0 && (body[tail - 1]!.startsWith("// ") || body[tail - 1] === "//")) tail--;
    const trailing = tail < body.length ? body.slice(tail).map((l) => l.slice(3)) : null;
    const path = join(work, `${file.replace(/[^\w]+/g, "-")}-line-${i}.${open[1] === "ts" ? "ts" : "mjs"}`);
    writeFileSync(path, `${body.join("\n")}\nexport {};\n`);
    if (flags.includes("no-run")) continue;
    ran++;
    const result = spawnSync(process.execPath, [path], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) {
      failed++;
      console.error(`FAIL ${where}\n${result.stderr.split("\n").slice(0, 8).join("\n")}`);
      continue;
    }
    const printed = result.stdout.trimEnd().split("\n");
    const expected = inline.length > 0 && allInline ? inline : trailing;
    if (expected && JSON.stringify(printed) !== JSON.stringify(expected)) {
      failed++;
      console.error(`FAIL ${where}: it printed\n  ${printed.join("\n  ")}\nbut the block says\n  ${expected.join("\n  ")}`);
    }
  }
}
console.log(`${ran} examples run, ${failed} failed`);

// Every export of every entry point is named in the README or a guide.
const words = pages.map(([, text]) => text).join("\n");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { exports: Record<string, { import?: string }> };
let count = 0;
for (const [entry, target] of Object.entries(pkg.exports)) {
  if (target.import === undefined) continue;
  const lib = (await import(pathToFileURL(join(root, target.import)).href)) as Record<string, unknown>;
  const missing = Object.keys(lib).filter((name) => !new RegExp(`\\b${name}\\b`).test(words));
  count += Object.keys(lib).length;
  if (missing.length > 0) {
    failed++;
    console.error(`FAIL the README and the guides do not name these exports of ${entry}: ${missing.join(", ")}`);
  }
}
if (failed === 0) console.log(`ok   the README and the guides name every export (${count})`);

// Every picture the README and the guides name is in docs/images (`pnpm images` makes them).
const pictures = new Set<string>();
for (const [file, text] of pages) {
  for (const m of text.matchAll(/(?:docs\/images\/|\.\.\/images\/|\(images\/)([\w.-]+\.(?:png|jpe?g|webp|gif|svg))/g)) pictures.add(`${file}: ${m[1]}`);
}
const absent = [...pictures].filter((entry) => !existsSync(join(root, "docs", "images", entry.split(": ")[1]!)));
if (absent.length > 0) {
  failed++;
  console.error(`FAIL these pictures are named but are not in docs/images (run pnpm images):\n  ${absent.join("\n  ")}`);
} else console.log(`ok   every picture the README and the guides name exists (${new Set([...pictures].map((e) => e.split(": ")[1])).size})`);
process.exit(failed > 0 ? 1 : 0);
