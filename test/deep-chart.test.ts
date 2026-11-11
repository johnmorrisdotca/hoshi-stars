// The deep-sky part of the demo's chart: every object at its true size, in each of the seven projections; pictures asked for only when big enough, laid in the right place, kept to five; a mark
// dotted where no size is measured; the layers; the bright stars inside a cluster.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, DEFAULT_VIEW, toScreen, type ChartOptions } from "../demo/chart.ts";
import { choosePictures, deepLimit, KEEP_MARGIN, markOpacity, MAX_PICTURES, visibleArea } from "../demo/deep-draw.ts";
import { DEFAULT_LAYERS, layersOf, layersText } from "../demo/choice.ts";
import { deepSkyObject } from "../src/deep-sky-ngc-ic.ts";
import { deepSkyPicture, deepSkyPictures, pictureCorners } from "../src/deep-sky-pictures.ts";
import { deepSky } from "../src/deep-sky-ngc-ic.ts";
import { deepSkyShape } from "../src/deep-sky-shape-ngc-ic.ts";
import { PROJECTIONS } from "../src/projection.ts";
import { starsInside } from "../src/deep-sky-members.ts";
import { deepSkyShape as messierShape } from "../src/deep-sky-shape.ts";

const size = { width: 800, height: 520 };
const options = (extra: Partial<ChartOptions>): ChartOptions => ({ ...DEFAULT_VIEW, ...size, zoom: 1, magnitude: 5, layers: new Set(["deep", "pictures"] as const), lang: "en", ...extra });
const at = (id: string): { ra: number; dec: number } => ({ ra: deepSkyObject(id)!.rightAscension, dec: deepSkyObject(id)!.declination });
const mark = (svg: string, id: string): string => new RegExp(`<g data-deep="${id}">(.*?)</g>`, "s").exec(svg)?.[1] ?? "";
const width = (svg: string, id: string): number => {
  const xs = [...mark(svg, id).matchAll(/[ML](-?[\d.]+) -?[\d.]+/g)].map((m) => Number(m[1]));
  return Math.max(...xs) - Math.min(...xs);
};

test("Andromeda is drawn at its true size and grows with the zoom, in every projection", () => {
  for (const projection of PROJECTIONS) {
    if (projection === "gnomonic") continue;
    const a = chart(options({ projection, ...at("M31"), zoom: 30 }));
    const b = chart(options({ projection, ...at("M31"), zoom: 60 }));
    assert.ok(mark(a.svg, "M31").includes("<path"), `${projection} draws M31`);
    const ratio = width(b.svg, "M31") / width(a.svg, "M31");
    assert.ok(ratio > 1.6 && ratio < 2.4, `${projection}: the outline is ${ratio.toFixed(2)} times as wide at twice the zoom`);
  }
});

test("a galaxy's outline lies along its measured angle on the screen: 35 degrees east of north, with east on the left, tips the top of M31 to the left", () => {
  const path = /d="([^"]+)"/.exec(mark(chart(options({ ...at("M31"), zoom: 30 })).svg, "M31"))![1]!;
  const points = [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
  const top = points.reduce((best, p) => (p[1] < best[1] ? p : best));
  assert.ok(top[0] < size.width / 2 - 20, `the highest point of the outline is at x = ${top[0]}`);
  const left = points.reduce((best, p) => (p[0] < best[0] ? p : best));
  assert.ok(Math.abs(Math.atan2(top[0] - size.width / 2, size.height / 2 - top[1]) * 180 / Math.PI) < 60);
  assert.ok(left[1] < size.height / 2 + 200);
});

test("a mark is dotted where no size is measured, and solid where it is", () => {
  const withSize = mark(chart(options({ ...at("M13"), zoom: 200 })).svg, "M13");
  assert.ok(!withSize.includes("stroke-dasharray"), "M13's outline is solid");
  const none = mark(chart(options({ ...at("M40"), zoom: 20 })).svg, "M40");
  assert.ok(none.includes("stroke-dasharray"), "M40, which has no size, is a dotted symbol");
});

/** How much of a picture is on the chart, in square pixels, worked out here from its corners. */
const areaOf = (id: string, view: { ra: number; dec: number; zoom: number }): number => {
  const quad = pictureCorners(deepSkyPictures().find((p) => p.id === id)!).map((point) => toScreen({ ...DEFAULT_VIEW, ...view }, size.width, size.height, point)!);
  return visibleArea(quad, size.width, size.height);
};

test("a picture is asked for only when its field is wide enough, never more than five (at most 90 kB each, so within a 500 kB budget), the one most on the screen first", () => {
  assert.ok(MAX_PICTURES * 90_000 <= 500_000);
  assert.deepEqual(chart(options({ ...DEFAULT_VIEW, zoom: 3 })).wanted, []);
  const seen = chart(options({ ...at("M51"), zoom: 300 }));
  assert.ok(seen.wanted.includes("M51"), seen.wanted.join(","));
  assert.ok(seen.wanted.length <= MAX_PICTURES);
  const crowded = chart(options({ ...at("M8"), zoom: 40 }));
  assert.ok(crowded.wanted.length <= MAX_PICTURES);
  // the Leo triplet and M81 with M82: several pictures in view, in the order of how much of each is on the chart
  for (const view of [{ ra: 169.9, dec: 13.0, zoom: 200 }, { ra: 148.9, dec: 69.3, zoom: 300 }]) {
    const wanted = chart(options(view)).wanted;
    assert.ok(wanted.length >= 3, wanted.join(","));
    const areas = wanted.map((id) => areaOf(id, view));
    assert.deepEqual(areas, [...areas].sort((a, b) => b - a), `${wanted.join(",")}: ${areas.map((a) => a.toFixed(0)).join(",")}`);
  }
});

test("visibleArea counts only the part of a picture on the chart, so one mostly off the screen cannot take a place", () => {
  assert.equal(visibleArea([[0, 0], [100, 0], [100, 50], [0, 50]], 800, 520), 5000);
  assert.equal(visibleArea([[-50, 0], [50, 0], [50, 50], [-50, 50]], 800, 520), 2500, "half of it off the left side");
  assert.equal(visibleArea([[-500, -500], [-100, -500], [-100, -100], [-500, -100]], 800, 520), 0);
  assert.ok(Math.abs(visibleArea([[400, 0], [800, 260], [400, 520], [0, 260]], 800, 520) - 208_000) < 1e-6, "a diamond touching the middle of each side: half the box");
  assert.ok(Math.abs(visibleArea([[-1000, -1000], [2000, -1000], [2000, 2000], [-1000, 2000]], 800, 520) - 800 * 520) < 1e-6, "one bigger than the chart counts the chart");
  const huge = { id: "off", area: visibleArea([[790, 0], [5000, 0], [5000, 520], [790, 520]], 800, 520) };
  const middle = { id: "on", area: visibleArea([[300, 200], [500, 200], [500, 320], [300, 320]], 800, 520) };
  assert.deepEqual(choosePictures([huge, middle], new Set()).map((x) => x.id), ["on", "off"], "a field far wider than the chart but mostly off it comes after one in the middle");
});

test("of more than five pictures in view the five most on the screen are chosen; one chosen last frame keeps its place against a newcomer of about its size", () => {
  const seven = [700, 600, 500, 400, 300, 280, 100].map((area, i) => ({ id: `P${i}`, area }));
  assert.deepEqual(choosePictures(seven, new Set()).map((x) => x.id), ["P0", "P1", "P2", "P3", "P4"]);
  // P5 was chosen last frame and P4 now shows a little more: P5 stays, and the list is still the most seen first
  const kept = choosePictures(seven, new Set(["P0", "P1", "P2", "P3", "P5"]));
  assert.deepEqual(kept.map((x) => x.id), ["P0", "P1", "P2", "P3", "P5"]);
  // a newcomer that shows more than KEEP_MARGIN times as much takes the place
  const grown = seven.map((x) => (x.id === "P4" ? { ...x, area: 280 * KEEP_MARGIN + 1 } : x));
  assert.deepEqual(choosePictures(grown, new Set(["P0", "P1", "P2", "P3", "P5"])).map((x) => x.id), ["P0", "P1", "P2", "P3", "P4"]);
  // on the chart: a small move with the last frame's choice given keeps the same pictures
  for (const view of [{ ra: 169.9, dec: 13.0, zoom: 175 }, { ra: 148.9, dec: 69.3, zoom: 300 }]) {
    const first = chart(options(view)).wanted;
    for (const step of [-0.02, 0.02]) {
      const moved = chart(options({ ...view, ra: view.ra + step, previousPictures: new Set(first) })).wanted;
      assert.deepEqual(new Set(moved), new Set(first), `${first.join(",")} then ${moved.join(",")}`);
    }
  }
});

test("a picture that has arrived is drawn pinned to the sky, under the marks, and fades with the zoom; one that has not is not", () => {
  const view = { ...at("M13"), zoom: 400 };
  assert.ok(!chart(options(view)).svg.includes("<image"), "not yet arrived: no picture");
  const drawn = chart(options({ ...view, readyPictures: new Set(["M13"]), pictureBase: "./" }));
  const image = /<image data-pic="M13" href="\.\/pictures\/M13\.webp" width="(\d+)" height="(\d+)" transform="matrix\(([^)]+)\)" opacity="([\d.]+)"/.exec(drawn.svg);
  assert.ok(image !== null, "the picture of M13 is drawn");
  assert.equal(Number(image![4]), 1, "fully shown when it fills the chart");
  assert.ok(drawn.svg.indexOf("<image") < drawn.svg.indexOf('data-deep="M13"'), "under the outline");
  const [a, b, c, d, e, f] = image![3]!.split(" ").map(Number) as [number, number, number, number, number, number];
  // the picture's centre lands where the object does: the matrix maps its pixel (width/2, height/2) there
  const cx = a * (Number(image![1]) / 2) + c * (Number(image![2]) / 2) + e;
  const cy = b * (Number(image![1]) / 2) + d * (Number(image![2]) / 2) + f;
  assert.ok(Math.hypot(cx - size.width / 2, cy - size.height / 2) < 1, `centre at ${cx.toFixed(1)}, ${cy.toFixed(1)}`);
  const far = chart(options({ ...at("M13"), zoom: 40, readyPictures: new Set(["M13"]) }));
  const faded = /<image data-pic="M13"[^>]*opacity="([\d.]+)"/.exec(far.svg);
  assert.ok(faded === null || Number(faded[1]) < 0.5, "faint or absent when small");
});

test("the Pictures layer off draws no picture and asks for none; the Deep sky layer off draws no mark", () => {
  const off = chart(options({ ...at("M13"), zoom: 400, layers: new Set(["deep"] as const), readyPictures: new Set(["M13"]) }));
  assert.ok(!off.svg.includes("<image") && off.wanted.length === 0);
  const noMarks = chart(options({ ...at("M13"), zoom: 400, layers: new Set(["pictures"] as const), readyPictures: new Set(["M13"]) }));
  assert.ok(noMarks.svg.includes("<image") && !noMarks.svg.includes("data-deep"));
});

test("the layers: pictures is a layer, on by default, kept in the address like the rest", () => {
  assert.ok(DEFAULT_LAYERS.includes("pictures"));
  assert.equal(layersText(layersOf(null)), null);
  assert.equal(layersText(new Set(["milky", "lines", "names", "grid"] as const)), "milky,lines,names,grid");
  assert.ok(layersOf("deep,pictures").has("pictures"));
});

test("with the whole table given, the NGC and IC objects are drawn too, with their shapes, and the faint ones only when zoomed in", () => {
  const whole = { catalogue: deepSky(), shapeOf: deepSkyShape };
  const wide = chart(options({ ...at("M31"), zoom: 3, ...whole }));
  const count = (svg: string): number => (svg.match(/data-deep="/g) ?? []).length;
  assert.ok(count(wide.svg) > 5, "a view of the sky round Andromeda draws its neighbours");
  assert.ok(count(chart(options({ ...at("NGC 253"), zoom: 60, ...whole })).svg) > 0);
  assert.ok(mark(chart(options({ ...at("NGC 253"), zoom: 60, ...whole })).svg, "NGC 253").includes("<path"), "NGC 253 at its RC3 size");
  assert.ok(count(wide.svg) <= 400 + 110, "never more than a page of marks");
});

test("the bright catalogue stars inside the Pleiades are ringed when it is large, and the card's list is the package's", () => {
  const m45 = deepSkyObject("M45")!;
  const drawn = chart(options({ ...at("M45"), zoom: 20, magnitude: 6, picked: "M45" }));
  const ringed = [...drawn.svg.matchAll(/data-inside="(\d+)"/g)].length;
  assert.ok(ringed >= 5, `${ringed} ringed`);
  assert.ok(starsInside(m45, messierShape(m45)).length >= ringed);
});

test("deepLimit and markOpacity: fainter objects as the zoom grows, and fainter ones drawn lighter", () => {
  assert.ok(deepLimit(1) < deepLimit(10) && deepLimit(10) < deepLimit(500));
  assert.ok(markOpacity(3) > markOpacity(9) && markOpacity(9) > markOpacity(14) && markOpacity(14) >= 0.38);
  assert.equal(markOpacity(undefined), 0.55);
});

test("every picture has an object the demo can draw and pick", () => {
  for (const picture of deepSkyPictures()) assert.ok(deepSkyObject(picture.object) !== undefined);
  assert.equal(deepSkyPicture("M13")?.object, "M13");
});

test("an object that is picked is drawn, with its cluster stars ringed, even when the Deep sky layer is off", () => {
  const drawn = chart(options({ ...at("M45"), zoom: 20, magnitude: 6, picked: "M45", layers: new Set(["pictures"] as const) }));
  assert.ok(drawn.svg.includes('data-deep="M45"'));
  assert.ok(!chart(options({ ...at("M45"), zoom: 20, magnitude: 6, layers: new Set(["pictures"] as const) })).svg.includes("data-deep"));
  assert.ok(drawn.svg.includes("data-inside"));
});
