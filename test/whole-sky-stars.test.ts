// The whole-sky page's bright stars: they grow with the zoom by the sky chart's rule (at the same pixels to the degree), at the whole sky they are as they were, a brighter star is never smaller than a fainter one, the
// faint layer is never as big as the Bright Star Catalogue's faintest, and a name is never put on a bright star's dot.
import assert from "node:assert/strict";
import { test } from "node:test";
import { allSkyProject } from "../src/all-sky.ts";
import { stars } from "../src/index.ts";
import { growOf } from "../demo/chart.ts";
import { CLEAR_FROM, geometryOf, layoutLabels, UNIT_H, UNIT_W } from "../demo/whole-sky-draw.ts";
import { textSize } from "../demo/labels.ts";
import { western } from "../src/cultures/western.ts";
import { chartZoomOf, WHOLE_SKY_ZOOM_MAX } from "../demo/whole-sky-field.ts";
import { binOf, binWidth, readZoom, ringWidth, STAR_BASE, STAR_BINS, STAR_REF_WIDTH, starWidth } from "../demo/whole-sky-stars.ts";

const ZOOMS = [1, 1.02, 1.5, 2, 3, 4, 6.5, 10, 16, 24];
const FAINT_LAYER_WIDEST = 2 * 0.95 * 0.6;

test("at the whole sky the stars are the page's three sizes, as they were", () => {
  for (const look of ["night", "paper"] as const) {
    STAR_BINS.forEach((bin, i) => assert.equal(binWidth(i, 1, look), STAR_BASE[look][bin.cls], `${look} bin ${i}`));
  }
  for (let i = 0; i < STAR_BINS.length; i++) assert.equal(ringWidth(i, 1), 0, "no ring at the whole sky");
});

test("every star is in a bin, and every bin holds stars", () => {
  const counts = STAR_BINS.map(() => 0);
  for (const star of stars()) counts[binOf(star.magnitude)]! += 1;
  assert.equal(counts.reduce((a, b) => a + b, 0), 5080);
  counts.forEach((n, i) => assert.ok(n > 0, `bin ${i} is empty`));
  const geometry = geometryOf("equatorial", "mollweide");
  assert.equal(geometry.stars.length, STAR_BINS.length);
  assert.equal(geometry.stars.reduce((sum, d) => sum + (d.match(/M/g) ?? []).length, 0), 5080);
});

test("a brighter star is never drawn smaller than a fainter one, and none shrinks as the map zooms in", () => {
  for (const zoom of ZOOMS) {
    for (let i = 1; i < STAR_BINS.length; i++) assert.ok(binWidth(i - 1, zoom, "night") >= binWidth(i, zoom, "night"), `bin ${i - 1} against ${i} at ${zoom}x`);
  }
  for (let i = 0; i < STAR_BINS.length; i++) {
    for (let k = 1; k < ZOOMS.length; k++) assert.ok(binWidth(i, ZOOMS[k]!, "night") >= binWidth(i, ZOOMS[k - 1]!, "night"), `bin ${i} at ${ZOOMS[k]}x`);
  }
});

test("a magnitude-2 star is plainly the largest mark at 4x, 10x and 24x: the sky chart's size at the same pixels to the degree", () => {
  const two = binOf(2);
  for (const zoom of [4, 10, WHOLE_SKY_ZOOM_MAX]) {
    const width = binWidth(two, zoom, "night");
    // the chart's own radius for magnitude 2 with the faintest star at 6: (6 - 2) x 0.55 + 1.1, grown by the zoom
    const chart = 2 * ((6 - 2) * 0.55 + 1.1) * growOf(chartZoomOf(zoom));
    assert.equal(width, Math.round(chart * 100) / 100, `${zoom}x`);
    assert.ok(width >= 8, `${zoom}x: ${width} px across`);
    assert.ok(width > 4 * 1.2, "well over the figure lines' width");
    assert.ok(width > binWidth(binOf(4.25), zoom, "night"), "larger than a star of magnitude 4");
  }
});

test("the faint layer is never as big as the Bright Star Catalogue's faintest stars", () => {
  for (const zoom of ZOOMS) assert.ok(binWidth(STAR_BINS.length - 1, zoom, "night") > FAINT_LAYER_WIDEST, `${zoom}x`);
  for (const zoom of ZOOMS) assert.ok(starWidth(6, zoom, STAR_BASE.night.faint) > FAINT_LAYER_WIDEST, `${zoom}x`);
});

test("a ring of the sky's colour round the bright stars grows in with the zoom", () => {
  assert.equal(ringWidth(0, 24), 2.4);
  assert.equal(ringWidth(STAR_BINS.length - 1, 24), 0);
  assert.ok(ringWidth(2, 2) > 0 && ringWidth(2, 2) < ringWidth(2, 24));
});

/** The names of a view, in pixels, and the dots of the stars a name must keep off. */
function viewOf(frame: "equatorial" | "galactic", projection: "mollweide" | "hammer" | "equirectangular", width: number, zoom: number, at: { rightAscension: number; declination: number }) {
  const geometry = geometryOf(frame, projection);
  const p = allSkyProject(at, geometry.options);
  const k = (width / UNIT_W) * zoom;
  const panX = -(p.x - UNIT_W / 2) * k;
  const panY = -(p.y - UNIT_H / 2) * k;
  const labels = layoutLabels({ geometry, culture: western, lang: "en", width, zoom, panX, panY, fontSize: 11 });
  const dots = geometry.starPoints.map((s) => ({ x: width / 2 + panX + (s.x - UNIT_W / 2) * k, y: width / 4 + panY + (s.y - UNIT_H / 2) * k, d: binWidth(s.bin, zoom, "night", width) }));
  return { labels, dots, width };
}

test("a name never covers a bright star's dot, on a desk's map or a phone's, at any zoom, in any projection", () => {
  const places = [
    { rightAscension: 84, declination: 0 },
    { rightAscension: 310, declination: 42 },
    { rightAscension: 0, declination: 89 },
    { rightAscension: 100, declination: -60 },
  ];
  for (const frame of ["equatorial", "galactic"] as const) {
    for (const projection of ["mollweide", "hammer", "equirectangular"] as const) {
      for (const width of [390, 1280]) {
        for (const zoom of [1, 4, 10, 24]) {
          for (const at of places) {
            const { labels, dots } = viewOf(frame, projection, width, zoom, at);
            for (const label of labels) {
              const { w, h } = textSize(label.text, label.size);
              for (const dot of dots) {
                if (dot.d < CLEAR_FROM) continue;
                const near = Math.abs(dot.x - label.x) < w / 2 + dot.d / 2 && Math.abs(dot.y - label.y) < h / 2 + dot.d / 2;
                assert.equal(near, false, `${label.text} covers a star ${dot.d} px across (${frame} ${projection} ${width} wide, ${zoom}x, at ${at.rightAscension}, ${at.declination})`);
              }
            }
          }
        }
      }
    }
  }
});

test("Orion's Belt is named beside the belt at 24x, not on Alnilam, and still has its name", () => {
  for (const width of [390, 1280]) {
    const { labels, dots } = viewOf("equatorial", "mollweide", width, 24, { rightAscension: 84.05, declination: -1.2 });
    const belt = labels.find((l) => l.id === "orions-belt");
    assert.ok(belt, `named at ${width} wide`);
    const middle = dots.reduce((best, d) => (Math.hypot(d.x - width / 2, d.y - width / 4) < Math.hypot(best.x - width / 2, best.y - width / 4) ? d : best));
    assert.ok(middle.d >= 8, `the star in the middle is a big dot (${middle.d})`);
    assert.ok(Math.hypot(belt.x - middle.x, belt.y - middle.y) > middle.d / 2 + 5, "the name is off the star");
  }
});

test("a dot is as wide on a phone's map as on a desk's at the same pixels to the degree, and never wider at the same zoom", () => {
  // the pixels to the degree of a map are its width over 360 times its zoom: a map of 390 px at 4x has 0.35 of those of one of 1100 at 4x
  for (const desk of [940, 1100, 1440]) {
    for (const phone of [320, 390, 430]) {
      for (const zoom of [1, 2, 4, 10, 24]) {
        for (let bin = 0; bin < STAR_BINS.length; bin++) {
          assert.ok(binWidth(bin, zoom, "night", phone) <= binWidth(bin, zoom, "night", desk), `bin ${bin} at ${zoom}x: a phone of ${phone} against a desk of ${desk}`);
          // the same pixels to the degree: the phone's zoom is the desk's times the ratio of the widths
          const same = (zoom * desk) / phone;
          if (same <= WHOLE_SKY_ZOOM_MAX) assert.equal(binWidth(bin, same, "night", phone), binWidth(bin, zoom, "night", desk), `bin ${bin}: ${phone} wide at ${same}x against ${desk} wide at ${zoom}x`);
        }
      }
    }
  }
  // what it was on a phone before: the same at 4x as a desk's, which is a snowfall; now it is the desk's at 1.4x
  assert.ok(binWidth(binOf(2), 4, "night", 390) < 5);
  assert.equal(readZoom(4, 390), (4 * 390) / STAR_REF_WIDTH);
});
