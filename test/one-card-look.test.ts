// One card look for the three skies (MODULES-879): a figure of the Japanese or Chinese sky is drawn the way a Western constellation is, with the same parts, and a single named star is drawn inside its own constellation's figure.
import assert from "node:assert/strict";
import { test } from "node:test";
import { constellations } from "../src/constellations.ts";
import { chinese } from "../src/cultures/chinese.ts";
import { japanese } from "../src/cultures/japanese.ts";
import { figures, type CultureFigure } from "../src/lines.ts";
import { project, type SkyPoint } from "../src/projection.ts";
import { constellationThumbnail, figureThumbnail, paddedOutline, THUMBNAIL_UNITS } from "../src/thumbnails.ts";
import { cardsOf, faceOf, westernFace } from "../demo/culture-cards.ts";
import { THEMES, figureThumbnailSvg, ownPictureFigures } from "../scripts/thumbnail-files.ts";

const LINE = { dark: "#2b3a66", light: "#cdd1de" } as const;
// asterisms in a patch of sky with no other bright star inside their picture
const SPARSE = new Set(["zhou1-ding3", "gou3-guo2"]);
const own = [japanese, chinese].flatMap((culture) => ownPictureFigures(culture).map((figure) => ({ culture, figure })));

/** The faint boundary lines of a picture (the neighbours', which the Western card shows as its sky grid): the points the line passes through inside the square, sampled finely along each piece. */
function gridInside(svg: string, theme: "dark" | "light"): number {
  const path = svg.match(new RegExp(`<path d="([^"]*)" fill="none" stroke="${LINE[theme]}" stroke-width="1"`));
  assert.ok(path !== null, "the picture has its neighbour boundary lines");
  let inside = 0;
  for (const run of path[1]!.split("M").filter((part) => part !== "")) {
    const points = run.split("L").map((pair) => pair.trim().split(" ").map(Number) as [number, number]);
    for (let i = 1; i < points.length; i++) {
      for (let t = 0; t <= 1; t += 0.05) {
        const x = points[i - 1]![0] + (points[i]![0] - points[i - 1]![0]) * t;
        const y = points[i - 1]![1] + (points[i]![1] - points[i - 1]![1]) * t;
        if (x >= 0 && x <= THUMBNAIL_UNITS && y >= 0 && y <= THUMBNAIL_UNITS) inside += 1;
      }
    }
  }
  return inside;
}

/** A picture with its numbers, stars and words taken out: what is left is the parts, in order, and how each is drawn. */
const shape = (svg: string): string =>
  svg
    .replace(/<title>.*?<\/title>/, "")
    .replace(/ aria-label="[^"]*"/, "")
    .replace(/ d="[^"]*"/g, "")
    .replace(/<circle[^>]*\/>/g, "")
    .replace(/ width="[\d.]+" height="[\d.]+"/, "");

const wash = (svg: string): RegExpMatchArray | null => svg.match(/<path d="[^"]+" fill="#[0-9a-f]{6}" fill-opacity="[\d.]+" stroke="#[0-9a-f]{6}" stroke-width="1\.6" stroke-linejoin="round" stroke-dasharray="5 3"\/>/);

test("every picture of the Japanese and Chinese skies has a filled, dashed area, the boundary lines round it and the star field, as a Western card has", () => {
  assert.equal(own.length, 256);
  for (const theme of THEMES) {
    for (const c of constellations()) {
      const western = constellationThumbnail(c.abbreviation, { theme });
      assert.ok(wash(western) !== null && gridInside(western, theme) > 0, `${c.abbreviation}: the reference card has them`);
    }
    for (const { culture, figure } of own) {
      const svg = figureThumbnailSvg(figure, culture, theme);
      const name = `${culture.id} ${figure.asterism.id} ${theme}`;
      assert.ok(wash(svg) !== null, `${name}: a filled area with a dashed outline`);
      assert.ok(gridInside(svg, theme) > 0, `${name}: boundary lines cross the picture`);
      // the star field is there wherever the frame holds a star that is not the figure's; two figures lie in patches of sky with none (the Bright Star Catalogue stops at magnitude 6)
      if (!SPARSE.has(figure.asterism.id)) assert.match(svg, /<g opacity="[\d.]+">(<circle [^>]*\/>)+<\/g>/, `${name}: the faint star field`);
    }
  }
});

test("a Western card, a Chinese one and a Japanese one are the same drawing: the same parts in the same order, with the same line weights, opacities and colours", () => {
  const reference = shape(constellationThumbnail("Ori", { theme: "dark", size: 480 }));
  for (const [culture, id] of [[chinese, "bei3-dou3"], [chinese, "jiao3-xiu4"], [japanese, "subaru"], [japanese, "hokuto-shichisei"]] as const) {
    const figure = figures(culture).find((f) => f.asterism.id === id)!;
    assert.equal(shape(figureThumbnailSvg(figure, culture, "dark")), reference, `${culture.id} ${id}`);
  }
  assert.ok(shape(constellationThumbnail("Ori", { theme: "dark", size: 480 })).includes("stroke-dasharray"));
});

test("a single named star stands ringed in the same dashed outline as any figure, with the sky round it and no other figure's lines", () => {
  const singles = own.filter(({ figure }) => figure.stars.length === 1);
  assert.ok(singles.length >= 50);
  for (const { culture, figure } of singles) {
    const star = figure.stars[0]!;
    for (const theme of THEMES) {
      const svg = figureThumbnailSvg(figure, culture, theme);
      const name = `${figure.asterism.id} ${theme}`;
      const rings = [...svg.matchAll(/<g fill="none" stroke="#[0-9a-f]{6}" stroke-width="2\.6" data-ring="">((?:<circle [^>]*\/>)+)<\/g>/g)];
      assert.equal(rings.length, 1, `${name}: one ring group`);
      assert.equal([...rings[0]![1]!.matchAll(/<circle/g)].length, 1, `${name}: one ring`);
      const dot = svg.match(new RegExp(`<circle cx="([-\\d.]+)" cy="([-\\d.]+)" r="[\\d.]+" fill="#[0-9a-f]{6}" data-hr="${star.hr}"/>`));
      assert.ok(dot !== null, `${name}: the star is drawn`);
      assert.ok(rings[0]![1]!.includes(`cx="${dot[1]}" cy="${dot[2]}"`), `${name}: the ring is on the star`);
      // the card is what the figure has: no figure lines at all (its constellation's would be another figure's), and the dashed outline round the star as on any card
      assert.ok(!svg.includes('stroke-width="2.2"'), `${name}: no figure lines`);
      assert.ok(wash(svg) !== null, `${name}: the dashed outline round the star`);
    }
  }
});

test("a figure of two stars or more stands inside a soft outline that holds every one of its stars; a figure of none is refused", () => {
  const some = (culture: typeof chinese | typeof japanese, id: string): CultureFigure => figures(culture).find((f) => f.asterism.id === id)!;
  for (const figure of [some(japanese, "subaru"), some(chinese, "bei3-dou3"), some(chinese, "jiao3-xiu4"), some(chinese, "li2-gong1")]) {
    const ring = paddedOutline(figure.stars);
    assert.deepEqual(ring[0], ring[ring.length - 1], "closed");
    assert.ok(ring.length > 8, "rounded corners");
    const centre = ring[0] as SkyPoint;
    const flat = (point: SkyPoint): [number, number] => {
      const at = project("stereographic", point, { centre, scale: 100 })!;
      return [at.x, at.y];
    };
    const polygon = ring.map(flat);
    for (const star of figure.stars) {
      const [x, y] = flat(star);
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]!;
        const [xj, yj] = polygon[j]!;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      assert.ok(inside, `${figure.asterism.id}: HR ${star.hr} is inside its outline`);
    }
  }
  assert.throws(() => paddedOutline([]), RangeError);
  assert.throws(() => paddedOutline([{ rightAscension: 1, declination: 1 }], 0), RangeError);
  assert.throws(() => figureThumbnail({ title: "none", stars: [], segments: [] }), RangeError);
});

test("every card is one block, a name and one small line: the same for all three skies, in English and in Japanese, with the missing stars in the title, never a third line", () => {
  for (const id of ["western", "japanese", "chinese"] as const) {
    for (const lang of ["en", "ja"] as const) {
      for (const card of cardsOf(id, lang)) {
        const face = card.asterism === undefined ? westernFace(card.constellation!, lang) : faceOf(card, lang);
        assert.ok(face.name !== "" && face.sub !== "", `${id} ${card.id} ${lang}: a name and a line`);
        assert.ok(!/\n/.test(face.name + face.sub));
        assert.ok(face.missingText === "" || (face.label.includes(face.missingText) && !face.sub.includes(face.missingText)), `${id} ${card.id}: the missing stars are in the title`);
      }
    }
  }
});
