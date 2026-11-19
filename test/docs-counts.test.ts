// The star counts the README and NOTICE.md state, held to the data they count: change a table and these fail until the words say what the data says.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { catalogueCounts } from "../src/catalogue.ts";
import { NEARBY_IN_FAINT } from "../src/catalogue-faint.ts";
import { nearbyLayer } from "../src/catalogue-nearby.ts";
import { NEARBY_FAINT_ROWS } from "../src/data/nearby-faint.ts";
import { nearbyStars } from "../src/nearby.ts";
import { stars } from "../src/stars.ts";

const read = (file: string): string => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const readme = read("README.md");
const notice = read("NOTICE.md");
const n = (value: number): string => value.toLocaleString("en-US");

const bright = stars();
const nearby = nearbyStars();
const faintTotal = (JSON.parse(read("faint-tiles/index.json")) as { stars: number }).stars;
const alsoNearby = NEARBY_FAINT_ROWS.split("\n").length;
const [brightCount, nearbyCount] = catalogueCounts({ layers: ["bright", nearbyLayer] }) as [ReturnType<typeof catalogueCounts>[number], ReturnType<typeof catalogueCounts>[number]];

test("the README says how many bright stars reach each magnitude", () => {
  const to = (magnitude: number): string => n(bright.filter((star) => star.magnitude <= magnitude).length);
  assert.ok(readme.includes(`Counts: ${to(1)} stars to magnitude 1, ${to(2)} to 2, ${to(3)} to 3, ${to(4)} to 4, ${to(5)} to 5 and ${to(6)} to 6.`));
  assert.equal(bright.length, brightCount.stars);
});

test("the README's table of tiers and grades is the catalogue's", () => {
  const row = (label: string, total: number, grades: { A: number; B: number; C: number }): string => `| ${label} | ${n(total)} | ${n(grades.A)} | ${n(grades.B)} | ${n(grades.C)} |`;
  assert.ok(readme.includes(row("Bright (the main import)", brightCount.stars, brightCount.grades)), "bright row");
  assert.ok(readme.includes(row("Nearby (`/nearby`)", nearbyCount.stars, nearbyCount.grades)), "nearby row");
  assert.ok(readme.includes(row("Faint (`/faint`)", faintTotal, { A: 0, B: 0, C: faintTotal })), "faint row");
  const all = { A: brightCount.grades.A + nearbyCount.grades.A, B: brightCount.grades.B + nearbyCount.grades.B, C: brightCount.grades.C + nearbyCount.grades.C + faintTotal - alsoNearby };
  assert.ok(readme.includes(row("**All three, each star once**", brightCount.stars + nearbyCount.stars + faintTotal - alsoNearby, all).replace(/\| ([\d,]+)(?= \|)/g, "| **$1**")), "all row");
  const guide = read("docs/guides/accuracy.md");
  const both = { A: brightCount.grades.A + nearbyCount.grades.A, B: brightCount.grades.B + nearbyCount.grades.B, C: brightCount.grades.C + nearbyCount.grades.C };
  assert.ok(guide.includes(row("Nearby (`/nearby`)", nearbyCount.stars, nearbyCount.grades)), "guide: nearby row");
  assert.ok(guide.includes(row("**Bright and nearby (`/catalogue` with the nearby layer)**", brightCount.stars + nearbyCount.stars, both).replace(/\| ([\d,]+)(?= \|)/g, "| **$1**")), "guide: bright and nearby row");
  assert.ok(guide.includes(`The last row counts the ${n(alsoNearby)} faint stars`));
  assert.ok(readme.includes(`the ${n(alsoNearby)} faint stars that are also nearby stars are counted once`));
  assert.equal(alsoNearby, NEARBY_IN_FAINT.matched + NEARBY_IN_FAINT.ambiguousSettled);
});

test("the README's other counts are the data's", () => {
  assert.ok(readme.includes(`adds the ${n(nearby.length)} stars of the Yale parallax catalogue`));
  assert.ok(readme.includes(`the ${n(bright.filter((star) => star.parallaxMas > 0).length)} stars of the ${n(bright.length)} that have a parallax`));
  assert.ok(readme.includes(`(${n(bright.filter((star) => star.parallaxErrorMas !== undefined).length)} of them do)`));
  assert.ok(readme.includes(`The faint stars, ${n(faintTotal)} of them to magnitude 12`));
});

test("NOTICE.md counts the bright stars' parallaxes by where each comes from", () => {
  const from = (source: string): number => bright.filter((star) => star.parallaxSource === source).length;
  assert.ok(notice.includes(`the ${n(bright.length)} stars to visual magnitude 6.0`));
  assert.ok(notice.includes(`${n(from("GCTP") + from("literature"))} stars before the stars of the next entry took a published distance (${n(from("GCTP"))} after it)`));
  assert.ok(notice.includes(`parallax to a whole milliarcsecond with no error (${n(from("BSC"))} stars)`));
  assert.ok(notice.includes(`dynamical parallax (code D, ${n(from("dynamical"))} stars)`));
});

test("NOTICE.md counts the nearby stars as the table does", () => {
  const coarse = nearby.filter((star) => star.positionSource !== "2MASS").length;
  assert.ok(notice.includes(`**${n(nearby.length)} are new and written out**`));
  assert.ok(notice.includes(`Of the new: ${n(nearby.length - coarse)} have a 2MASS position and ${n(coarse)} keep the catalogue position (flagged coarse); ${n(nearby.filter((star) => star.flags.ambiguousMatch).length)} are flagged ambiguous; ${n(nearby.filter((star) => star.flags.excludedFromSpace).length)} have a parallax of 0 or less`));
  assert.ok(notice.includes(`${n(NEARBY_IN_FAINT.matched)} are matched, ${n(NEARBY_IN_FAINT.ambiguous)} ambiguous (${n(NEARBY_IN_FAINT.ambiguousSettled)} of them settled by the nearest pair; the rule is in the accuracy guide) and ${n(NEARBY_IN_FAINT.new)} new`));
  assert.ok(notice.includes(`**${n(NEARBY_IN_FAINT.ucac4Positions)} take UCAC4's position**`));
});

test("the README's sizes are those of docs/bundle-size.json", () => {
  const sizes = (JSON.parse(read("docs/bundle-size.json")) as { entries: Record<string, { gzip: number }> }).entries;
  const kb = (entry: string): string => (sizes[entry]!.gzip / 1000).toFixed(1);
  assert.ok(readme.includes(`(\`chartSvg\`) is ${kb("./chart")} kB minified and gzipped, and \`/chart/element\` and \`/chart/define\` ${kb("./chart/element")} kB: the bright catalogue (${kb(".")} kB)`));
  assert.ok(readme.includes(`(${Math.round(sizes["./catalogue"]!.gzip / 1000)} kB gzipped); the nearby stars (\`nearbyLayer\` from \`/catalogue/nearby\`, ${Math.round(sizes["./catalogue/nearby"]!.gzip / 1000)} kB more) and the faint stars a page loaded (\`faintLayer(stars)\` from \`/catalogue/faint\`, ${Math.round(sizes["./catalogue/faint"]!.gzip / 1000)} kB more)`));
});
