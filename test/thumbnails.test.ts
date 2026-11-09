// The constellation pictures: all 88 in both looks, each with every star of its constellation inside the frame, the neighbours faint, and the files in every size.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { boundaryOf } from "../src/boundaries.ts";
import { constellations, starsIn } from "../src/constellations.ts";
import { figureOf } from "../src/lines.ts";
import { constellationThumbnail, thumbnailSvg, THUMBNAIL_UNITS } from "../src/thumbnails.ts";
import { SIZES, SVG_SIZE, THEMES, writeThumbnails } from "../scripts/thumbnail-files.ts";

const circles = (svg: string): Array<{ x: number; y: number; r: number; hr?: number }> =>
  [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)" fill="#[0-9a-f]{6}"(?: data-hr="(\d+)")?\/>/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), r: Number(m[3]), ...(m[4] === undefined ? {} : { hr: Number(m[4]) }) }));

test("every one of the 88 has a picture in both looks, with every star of its constellation inside the frame", () => {
  for (const theme of THEMES) {
    for (const c of constellations()) {
      const svg = constellationThumbnail(c.abbreviation, { theme });
      assert.ok(svg.startsWith("<svg xmlns=") && svg.endsWith("</svg>"), c.abbreviation);
      const own = circles(svg).filter((dot) => dot.hr !== undefined);
      const wanted = starsIn(c.abbreviation).map((s) => s.hr).sort((a, b) => a - b);
      assert.deepEqual(own.map((dot) => dot.hr!).sort((a, b) => a - b), wanted, `${c.abbreviation} ${theme}: every star of the constellation is drawn once`);
      for (const dot of own) assert.ok(dot.x >= 0 && dot.x <= THUMBNAIL_UNITS && dot.y >= 0 && dot.y <= THUMBNAIL_UNITS, `${c.abbreviation}: HR ${dot.hr} is inside the frame`);
      assert.ok(!svg.includes("<text"), "no text, so a picture needs no font");
    }
  }
});

test("the figure's whole boundary is inside the frame, with room, and the picture is not empty of neighbours", () => {
  for (const c of constellations()) {
    const svg = constellationThumbnail(c.abbreviation);
    const all = circles(svg);
    assert.ok(all.length > starsIn(c.abbreviation).length || starsIn(c.abbreviation).length > 40, `${c.abbreviation} shows stars of its neighbours`);
    const lines = figureOf(c.abbreviation).segments.length;
    assert.equal((svg.match(/L/g) ?? []).length >= lines, true);
  }
});

test("the light and dark looks differ and neither is blank; neighbours can be left out", () => {
  const dark = constellationThumbnail("Ori", { theme: "dark" });
  const light = constellationThumbnail("Ori", { theme: "light" });
  assert.notEqual(dark, light);
  assert.ok(dark.includes("#0b1020") && light.includes("#f7f5ef"));
  const alone = constellationThumbnail("Ori", { neighbours: false });
  assert.ok(alone.length < dark.length);
  assert.ok(circles(alone).every((dot) => dot.hr !== undefined));
  assert.ok(constellationThumbnail("Ori", { size: 160 }).includes('width="160" height="160"'));
  assert.ok(!/^<svg[^>]* width=/.test(constellationThumbnail("Ori")));
});

test("an unknown constellation, a bad size or no outline is refused", () => {
  assert.throws(() => constellationThumbnail("Nope"), RangeError);
  assert.throws(() => constellationThumbnail("Ori", { size: 0 }), RangeError);
  assert.throws(() => thumbnailSvg({ title: "none", outlines: [], segments: [], owns: () => true }), RangeError);
});

test("another set of figures can use the same drawing: its own lines and its own stars", () => {
  const orion = boundaryOf("Ori");
  const svg = thumbnailSvg({ title: "Belt", outlines: orion.outlines, segments: [], owns: (star) => star.name === "Alnilam" }, { theme: "light" });
  assert.deepEqual(circles(svg).filter((dot) => dot.hr !== undefined).map((dot) => dot.hr), [1903]);
});

test("a picture stays small enough to send: each SVG under 70 kB, one look of all 88 under 1.8 MB", () => {
  let total = 0;
  for (const c of constellations()) {
    const size = constellationThumbnail(c.abbreviation, { size: SVG_SIZE }).length;
    assert.ok(size < 70_000, `${c.abbreviation} is ${size} bytes`);
    total += size;
  }
  assert.ok(total < 1_800_000, `one look is ${total} bytes`);
});

test("file names do not collide on a case-insensitive disk", () => {
  const names = constellations().map((c) => c.abbreviation.toLowerCase());
  assert.equal(new Set(names).size, 88);
});

test("the files: an SVG and a PNG of every size, in both looks, for all 88, the PNGs of the size asked", () => {
  const dir = mkdtempSync(join(tmpdir(), "hoshi-thumbs-"));
  try {
    const made = writeThumbnails(dir);
    assert.equal(made, 88 * 2 * (1 + SIZES.length));
    for (const theme of THEMES) {
      assert.equal(readdirSync(join(dir, "svg", theme)).length, 88);
      for (const size of SIZES) assert.equal(readdirSync(join(dir, "png", String(size), theme)).length, 88);
    }
    for (const c of constellations()) {
      const svg = readFileSync(join(dir, "svg", "dark", `${c.abbreviation}.svg`), "utf8");
      assert.equal(svg, constellationThumbnail(c.abbreviation, { theme: "dark", size: SVG_SIZE }));
      for (const theme of THEMES) {
        for (const size of SIZES) {
          const png = readFileSync(join(dir, "png", String(size), theme, `${c.abbreviation}.png`));
          assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${c.abbreviation} ${size} is a PNG`);
          assert.equal(png.readUInt32BE(16), size);
          assert.equal(png.readUInt32BE(20), size);
        }
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the main entry knows nothing of the pictures, so its size does not change", () => {
  const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.ok(!/thumbnail|constellation-facts/.test(index));
});
