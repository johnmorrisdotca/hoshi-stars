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
  familyHeader(options: { id: string; links?: { href: string; say: string; group?: "resources"; also?: readonly string[] }[]; current?: string }): string;
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

const TEMPLATE = { version: "2026-11-27", sha256: "7ef6eeceabc7d049a6b5547a989e0d37cc55b9c704958375199954dc71202391" };
const WRITER_SHA = "dfd4c27b70fe5d7d5f82724180cc739812f0dd13d209c41c053dbdc61bf90188";
const CSS_SHA = "4d4f5775c436759b8032c106481b4efba1a275d59a0d983860170276972f5d91";

test("the family template, the README writer and family.css are the recorded files, byte for byte", () => {
  assert.equal(template.FAMILY_TEMPLATE_VERSION, TEMPLATE.version);
  assert.equal(sha("scripts/family-template.mjs"), TEMPLATE.sha256);
  assert.equal(sha("scripts/family-readme.mjs"), WRITER_SHA);
  assert.equal(sha("demo/family.css"), CSS_SHA);
});

test("it lists every package of the family, in order, each with its Japanese name and a line on it", () => {
  assert.equal(template.FAMILY.length, 41);
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

test("this package is on npm: the header has the npm pill and the footer the install line", () => {
  assert.ok(!template.FAMILY_NOT_ON_NPM.includes(id));
  assert.ok(template.familyHeader({ id }).includes("npmjs.com"));
  assert.ok(template.familyFooter({ id }).includes(`npm install @johnmorrisdotca/${id}`));
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

test("a header marks the page being read, and only that one, and school pages sit in Resources", () => {
  const links = [
    { href: "index.html", say: "pageMap" },
    { href: "constellations.html", say: "pageGallery", also: ["constellation.html"] },
    { href: "kids.html", say: "pageKids", group: "resources" as const },
    { href: "tap-dots.html", say: "pageTap", group: "resources" as const },
    { href: "docs/index.html", say: "pageDocs" },
  ];
  const kids = template.familyHeader({ id, links, current: "kids.html" });
  assert.ok(kids.indexOf('href="index.html"') < kids.indexOf('href="constellations.html"'), "Map is the first page link");
  assert.match(kids, /<kazoku-menu which="resources" aria-current="page">/);
  assert.match(kids, /<a href="kids.html" data-say="pageKids" aria-current="page"><\/a>/);
  assert.doesNotMatch(kids, /href="constellations.html"[^>]*aria-current/);
  assert.equal(kids.match(/aria-current="page"/g)?.length, 2); // the menu and its link
  const star = template.familyHeader({ id, links, current: "constellation.html" });
  assert.match(star, /<a href="constellations.html" data-say="pageGallery" aria-current="page">/);
  assert.equal(star.match(/aria-current="page"/g)?.length, 1);
  const home = template.familyHeader({ id, links, current: "index.html" });
  assert.match(home, /<a href="index.html" data-say="pageMap" aria-current="page">/);
  assert.doesNotMatch(home, /kazoku-menu which="resources" aria-current/);
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
