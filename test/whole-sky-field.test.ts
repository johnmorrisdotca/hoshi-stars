// The patch of sky the whole-sky page asks the faint tiles for: it holds every star the visible part of the map shows, in every projection and orientation, at the poles and across the seam, and it is small when the map is zoomed in.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ALL_SKY_FRAMES, ALL_SKY_PROJECTIONS, allSkyProject, allSkyUnproject, type AllSkyOptions } from "../src/all-sky.ts";
import { faintTilesFor } from "../src/faint-core.ts";
import { faintDepthOf, FAINT_FROM, FAINT_JUMP_ZOOM } from "../src/chart/faint-layer.ts";
import { chartZoomOf, skyFieldOf, visibleBox, WHOLE_SKY_MAGNITUDE, WHOLE_SKY_ZOOM_MAX } from "../demo/whole-sky-field.ts";

const RADIANS = Math.PI / 180;
const WIDTH = 1000;

/** The same sequence every run: 5,000 points spread evenly over the sphere. */
function sphere(count: number): Array<{ rightAscension: number; declination: number }> {
  let seed = 12345;
  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => ({ rightAscension: next() * 360, declination: Math.asin(2 * next() - 1) / RADIANS }));
}
const SKY = sphere(5000);
let seed = 987654321;
const random = (): number => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const separation = (a: { rightAscension: number; declination: number }, b: { rightAscension: number; declination: number }): number => {
  const cosine = Math.sin(a.declination * RADIANS) * Math.sin(b.declination * RADIANS) + Math.cos(a.declination * RADIANS) * Math.cos(b.declination * RADIANS) * Math.cos((a.rightAscension - b.rightAscension) * RADIANS);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / RADIANS;
};

/** Pan so that the point (`u`, `v`) of the unit box is in the middle of a map `WIDTH` pixels wide at `zoom`. */
const aimAt = (u: number, v: number, zoom: number): { panX: number; panY: number } => {
  const k = (WIDTH / 1000) * zoom;
  return { panX: -(u - 500) * k, panY: -(v - 250) * k };
};

const AIMS: ReadonlyArray<[string, number, number]> = [
  ["the middle", 500, 250],
  ["the top, at the pole", 500, 6],
  ["the bottom, at the other pole", 500, 494],
  ["the left edge, at the seam", 4, 250],
  ["the right edge, at the seam", 996, 250],
  ["a corner of the oval", 250, 60],
  ["a lower corner of the oval", 760, 440],
];

for (const frame of ALL_SKY_FRAMES) {
  for (const projection of ALL_SKY_PROJECTIONS) {
    test(`${frame}, ${projection}: the patch holds every star on the screen, at the poles and the seam too`, () => {
      const options: AllSkyOptions = { width: 1000, frame, projection };
      for (const [name, u, v] of AIMS) {
        for (const zoom of [4, 8, 24]) {
          const { panX, panY } = aimAt(u, v, zoom);
          const seen = visibleBox(WIDTH, zoom, panX, panY);
          const field = skyFieldOf(options, seen);
          assert.ok(field !== undefined, `a field for ${name} at ${zoom}x`);
          let on = 0;
          for (const star of SKY) {
            const at = allSkyProject(star, options);
            if (at.x < seen.u0 || at.x > seen.u1 || at.y < seen.v0 || at.y > seen.v1) continue;
            on++;
            const away = separation(star, field);
            assert.ok(away <= field.radius, `${frame} ${projection}, ${name}, ${zoom}x: a star ${away.toFixed(2)} degrees from the middle is on the screen but the patch reaches ${field.radius.toFixed(2)}`);
          }
          // and the points of the screen, picked at random (not on the grid the patch was found from), land inside it too
          for (let i = 0; i < 400; i++) {
            const at = allSkyUnproject({ x: seen.u0 + random() * (seen.u1 - seen.u0), y: seen.v0 + random() * (seen.v1 - seen.v0) }, options);
            if (at === undefined) continue;
            on++;
            assert.ok(separation(at, field) <= field.radius, `${frame} ${projection}, ${name}, ${zoom}x: a random point of the screen is outside the patch`);
          }
          assert.ok(on > 0, `${name} at ${zoom}x shows some sky`);
          // the patch is a patch, not the whole sky: at 24x it is small
          if (zoom === 24) assert.ok(field.radius < 25, `${frame} ${projection}, ${name}: ${field.radius.toFixed(1)} degrees at 24x`);
        }
      }
    });
  }
}

test("zoomed in on the top of the map the patch is the pole, and the tiles it names are the polar bands' and no others far from it", () => {
  const options: AllSkyOptions = { width: 1000, frame: "equatorial", projection: "mollweide" };
  const { panX, panY } = aimAt(500, 6, 24);
  const field = skyFieldOf(options, visibleBox(WIDTH, 24, panX, panY))!;
  assert.ok(field.declination > 80, `the middle of the patch is at declination ${field.declination.toFixed(1)}`);
  const tiles = faintTilesFor(field, 9.9);
  assert.ok(tiles.length > 0 && tiles.length <= 48, `${tiles.length} tiles`);
  assert.ok(tiles.every((tile) => tile.level === 0 && tile.band >= 14), "only the northern bands of level 0");
});

test("zoomed out nothing is asked for in a hurry: the patch is more than half the sky", () => {
  const options: AllSkyOptions = { width: 1000, frame: "galactic", projection: "hammer" };
  const field = skyFieldOf(options, visibleBox(WIDTH, 1, 0, 0))!;
  assert.ok(field.radius > 90);
});

test("a view off the oval has no patch", () => {
  const options: AllSkyOptions = { width: 1000, frame: "galactic", projection: "mollweide" };
  assert.equal(skyFieldOf(options, { u0: 10, u1: 10, v0: 0, v1: 100 }), undefined);
  assert.equal(skyFieldOf(options, { u0: 0, u1: 3, v0: 0, v1: 3 }), undefined);
});

test("the depth rule is the sky chart's, read from the zoom that gives the same pixels to the degree", () => {
  // the map at its fit is 8 / 2 pi of the chart's fit
  assert.ok(Math.abs(chartZoomOf(1) - 1.2732) < 1e-3);
  assert.equal(faintDepthOf(WHOLE_SKY_MAGNITUDE, chartZoomOf(1)), 6.26);
  // the layer starts past 7 from about 2x, the depth jumps past the thin band at the chart's zoom 8 (the map's 6.3x), and the map's closest zoom is about magnitude 10
  assert.ok(faintDepthOf(WHOLE_SKY_MAGNITUDE, chartZoomOf(1.9)) <= FAINT_FROM);
  assert.ok(faintDepthOf(WHOLE_SKY_MAGNITUDE, chartZoomOf(2.1)) > FAINT_FROM);
  assert.ok(faintDepthOf(WHOLE_SKY_MAGNITUDE, chartZoomOf(FAINT_JUMP_ZOOM / chartZoomOf(1) - 0.01)) < 8.5);
  assert.equal(faintDepthOf(WHOLE_SKY_MAGNITUDE, chartZoomOf(FAINT_JUMP_ZOOM / chartZoomOf(1))), 8.5);
  const deepest = faintDepthOf(WHOLE_SKY_MAGNITUDE, chartZoomOf(WHOLE_SKY_ZOOM_MAX));
  assert.ok(deepest > 9.9 && deepest < 10, `${deepest}`);
});

test("the zoom bar on the page is the zoom the depth rule was worked out for", () => {
  assert.match(readFileSync("demo/whole-sky.html", "utf8"), new RegExp(`zoom-max="${WHOLE_SKY_ZOOM_MAX}"`));
});
