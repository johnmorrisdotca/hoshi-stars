// What this package holds the same way as every package of the family: the shared template and the README writer, the one list of the family, and the README
// block written from it. This copy is the template of 2026-11-03 (hako-devices') with Hoshi Stars added to the list (thirty-seven packages, the geography group, a line in English and Japanese, and its row in FAMILY_NOT_ON_NPM until the first publish), and the README writer's number words reaching thirty-seven. The other packages take the same files when they are next touched.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

interface Template {
  FAMILY: { id: string; name: string; kana: string }[];
  FAMILY_GROUPS: { members: string[] }[];
  FAMILY_PITCH: Record<string, string>;
  FAMILY_NOT_ON_NPM: string[];
  FAMILY_TEMPLATE_VERSION: string;
  familyRepo(id: string): string;
  familyHeader(options: { id: string }): string;
  familyFooter(options: { id: string }): string;
}
interface Writer {
  familyBlockOf(readme: string): string | null;
  familyReadmeBlock(id: string): string;
}
const template = (await import(new URL("../scripts/family-template.mjs", import.meta.url).href)) as Template;
const writer = (await import(new URL("../scripts/family-readme.mjs", import.meta.url).href)) as Writer;

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const pkg = JSON.parse(read("package.json")) as { name: string };
const id = pkg.name.replace(/^@[^/]+\//, "");

const TEMPLATE = { version: "2026-11-03", sha256: "637a40a712b217805c5286d506cd7b5be52798b7e07b98667d3bf3fa1df1f237" };
const WRITER_SHA = "00e7e3f59bc71ae9d2c3c68379731e1976382ddcb44132a1158d2c9a4fb245d7";
const CSS_SHA = "31df0a58f422070ca4023d5498566b26bc55a5f9a0751f1520d36c61bbb562c9";

test("the family template, the README writer and family.css are the recorded files, byte for byte", () => {
  assert.equal(template.FAMILY_TEMPLATE_VERSION, TEMPLATE.version);
  assert.equal(sha("scripts/family-template.mjs"), TEMPLATE.sha256);
  assert.equal(sha("scripts/family-readme.mjs"), WRITER_SHA);
  assert.equal(sha("demo/family.css"), CSS_SHA);
});

test("it lists every package of the family, in order, each with its Japanese name and a line on it", () => {
  assert.equal(template.FAMILY.length, 37);
  assert.deepEqual(
    template.FAMILY_GROUPS.flatMap((group) => group.members),
    template.FAMILY.map((one) => one.id),
  );
  for (const group of template.FAMILY_GROUPS) assert.deepEqual(group.members, [...group.members].sort());
  for (const one of template.FAMILY) {
    const slug = one.name.toLowerCase().replaceAll(" ", "-");
    assert.ok(one.id === slug || one.id.startsWith(`${slug}-`), one.id);
    assert.match(one.kana, /\S/, one.id);
    assert.match(template.FAMILY_PITCH[one.id] ?? "", /^[^A-Z.].*[^.]$/, one.id);
  }
  assert.deepEqual(
    Object.keys(template.FAMILY_PITCH).sort(),
    template.FAMILY.map((one) => one.id).sort(),
  );
  assert.ok(template.FAMILY.some((one) => one.id === id));
});

test("this package is not on npm yet: the header has no npm pill and the footer says so; take it out of FAMILY_NOT_ON_NPM the day it is published", () => {
  assert.ok(template.FAMILY_NOT_ON_NPM.includes(id));
  assert.ok(!template.familyHeader({ id }).includes("npmjs.com"));
  assert.ok(template.familyFooter({ id }).includes("Not on npm yet"));
});

test("the demo page is made with the family's header and footer, with the kazoku-ui language picker and theme switch in the header", () => {
  const page = read("scripts/page.ts");
  for (const call of ["familyHead(", "familyHeader(", "familyFooter(", "familyUnreviewed(", "FAMILY_SCRIPT"]) assert.ok(page.includes(call), call);
  const html = read("demo/index.html");
  for (const marker of ["family:head", "family:header", "family:unreviewed", "family:footer", "family:scripts"]) assert.ok(html.includes(`<!--${marker}`), marker);
  const header = template.familyHeader({ id });
  assert.ok(header.includes("<kazoku-language-picker"));
  assert.ok(header.includes("<kazoku-theme-switch"));
});

test("the README's family is the block scripts/family-readme.mjs writes from the template, under a heading of its own, naming every package once", () => {
  const readme = read("README.md");
  const block = writer.familyBlockOf(readme);
  assert.notEqual(block, null, "README.md has no family markers");
  assert.equal(block, writer.familyReadmeBlock(id));
  assert.equal(readme.split("<!-- family:start").length - 1, 1);
  assert.match(readme, /\n#{2,3} The family\n+<!-- family:start/);
  for (const one of template.FAMILY) assert.equal((block ?? "").split(`](${template.familyRepo(one.id)})`).length - 1, 1, one.id);
});
