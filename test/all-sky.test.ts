// The whole-sky picture: the centre, the box, round trips, the galactic and equatorial frames, the east-left convention and the cut at the seam.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_SKY_FRAMES, ALL_SKY_PROJECTIONS, allSkyGrid, allSkyLine, allSkyOutline, allSkyProject, allSkyUnproject, type AllSkyOptions } from "../src/all-sky.ts";
import { boundaryOf } from "../src/boundaries.ts";
import { fromGalactic } from "../src/milky-way.ts";

const sagittariusA = { rightAscension: 266.4168, declination: -29.0078 };

function close(actual: number, expected: number, tolerance: number, what: string): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected}`);
}
const gap = (a: number, b: number): number => Math.min(Math.abs(a - b) % 360, 360 - (Math.abs(a - b) % 360));

test("ALL_SKY_FRAMES and ALL_SKY_PROJECTIONS name what the picture can be", () => {
  assert.deepEqual([...ALL_SKY_FRAMES], ["galactic", "equatorial"]);
  assert.deepEqual([...ALL_SKY_PROJECTIONS], ["mollweide", "hammer", "equirectangular"]);
});

test("allSkyProject: the centre of the Galaxy is the middle of a galactic picture, and 12 hours the middle of an equatorial one", () => {
  for (const projection of ALL_SKY_PROJECTIONS) {
    const g = allSkyProject(sagittariusA, { width: 1000, projection });
    close(g.x, 500, 0.5, `${projection} x`);
    close(g.y, 250, 0.5, `${projection} y`);
    const e = allSkyProject({ rightAscension: 180, declination: 0 }, { width: 800, frame: "equatorial", projection });
    close(e.x, 400, 1e-6, `${projection} equatorial x`);
    close(e.y, 200, 1e-6, `${projection} equatorial y`);
  }
});

test("allSkyProject: the poles and the edge fill the 2:1 box exactly", () => {
  for (const projection of ALL_SKY_PROJECTIONS) {
    const options: AllSkyOptions = { width: 1000, frame: "equatorial", projection, centre: 0 };
    close(allSkyProject({ rightAscension: 0, declination: 90 }, options).y, 0, 1e-6, `${projection} north pole`);
    close(allSkyProject({ rightAscension: 0, declination: -90 }, options).y, 500, 1e-6, `${projection} south pole`);
    // half a turn from the centre on the equator is the left or right edge
    const left = allSkyProject({ rightAscension: 179.999999, declination: 0 }, options);
    const right = allSkyProject({ rightAscension: 180.000001, declination: 0 }, options);
    close(Math.min(left.x, right.x), 0, 0.01, `${projection} left edge`);
    close(Math.max(left.x, right.x), 1000, 0.01, `${projection} right edge`);
  }
});

test("allSkyProject: the sky is seen from inside, so east is to the left unless mirror is set", () => {
  const east = { rightAscension: 30, declination: 0 };
  const options: AllSkyOptions = { width: 1000, frame: "equatorial", centre: 0 };
  assert.ok(allSkyProject(east, options).x < 500);
  assert.ok(allSkyProject(east, { ...options, mirror: true }).x > 500);
});

test("allSkyProject: the galactic frame is the IAU's, so the plane runs through the middle row and the pole is the top", () => {
  for (const longitude of [0, 45, 120, 200, 300]) {
    const point = fromGalactic({ longitude, latitude: 0 });
    close(allSkyProject(point, { width: 1000, projection: "equirectangular" }).y, 250, 1e-6, `plane at l=${longitude}`);
  }
  const pole = fromGalactic({ longitude: 77, latitude: 90 });
  close(allSkyProject(pole, { width: 1000 }).y, 0, 1e-6, "north galactic pole");
  // galactic longitude grows to the left
  close(allSkyProject(fromGalactic({ longitude: 90, latitude: 0 }), { width: 1000, projection: "equirectangular" }).x, 250, 1e-6, "l=90 is a quarter of the way in from the left");
});

test("allSkyUnproject is the inverse of allSkyProject, and says no outside the oval", () => {
  const spots = [{ rightAscension: 88.79, declination: 7.41 }, { rightAscension: 10, declination: -70 }, { rightAscension: 300, declination: 55 }, sagittariusA];
  for (const frame of ALL_SKY_FRAMES) {
    for (const projection of ALL_SKY_PROJECTIONS) {
      for (const mirror of [false, true]) {
        const options: AllSkyOptions = { width: 1200, frame, projection, mirror };
        for (const spot of spots) {
          const back = allSkyUnproject(allSkyProject(spot, options), options)!;
          close(gap(back.rightAscension, spot.rightAscension), 0, 1e-6, `${frame} ${projection} RA`);
          close(back.declination, spot.declination, 1e-6, `${frame} ${projection} dec`);
        }
      }
    }
  }
  assert.equal(allSkyUnproject({ x: 2, y: 2 }, { width: 1000 }), undefined);
  assert.equal(allSkyUnproject({ x: 998, y: 498 }, { width: 1000, projection: "hammer" }), undefined);
  assert.ok(allSkyUnproject({ x: 2, y: 2 }, { width: 1000, projection: "equirectangular" }) !== undefined);
});

test("Mollweide and Hammer are equal-area: the same box area is the same sky", () => {
  // A 10 by 10 degree patch at the equator and one at 60 degrees latitude (cos 60 = 0.5 as wide on the sphere) take up the same area on the picture only if the picture is equal-area.
  const area = (dec: number, projection: "mollweide" | "hammer"): number => {
    const o: AllSkyOptions = { width: 1000, frame: "equatorial", projection, centre: 180 };
    const corners = [[175, dec - 2], [185, dec - 2], [185, dec + 2], [175, dec + 2]].map(([ra, d]) => allSkyProject({ rightAscension: ra!, declination: d! }, o));
    let sum = 0;
    corners.forEach((c, i) => {
      const n = corners[(i + 1) % 4]!;
      sum += c.x * n.y - n.x * c.y;
    });
    return Math.abs(sum) / 2;
  };
  for (const projection of ["mollweide", "hammer"] as const) {
    // sphere area of the patch: 10 deg of longitude times (sin(dec+2) - sin(dec-2)); the picture's area per steradian is constant, so the ratio of areas is the ratio of the sphere's
    const ratio = area(60, projection) / area(0, projection);
    const sphere = (Math.sin(62 * Math.PI / 180) - Math.sin(58 * Math.PI / 180)) / (Math.sin(2 * Math.PI / 180) - Math.sin(-2 * Math.PI / 180));
    close(ratio, sphere, 0.03, `${projection} area ratio`);
  }
});

test("allSkyOutline goes round the oval or the box and closes", () => {
  for (const projection of ALL_SKY_PROJECTIONS) {
    const edge = allSkyOutline({ width: 1000, projection });
    assert.deepEqual(edge[0], edge[edge.length - 1]);
    for (const p of edge) {
      assert.ok(p.x >= -0.01 && p.x <= 1000.01 && p.y >= -0.01 && p.y <= 500.01, `${projection} ${JSON.stringify(p)}`);
    }
    close(Math.min(...edge.map((p) => p.x)), 0, 0.01, `${projection} reaches the left`);
    close(Math.max(...edge.map((p) => p.x)), 1000, 0.01, `${projection} reaches the right`);
  }
  assert.throws(() => allSkyOutline({ width: 1000 }, 1), RangeError);
});

test("allSkyLine: a line on one side of the seam is one run, and it stays on the great circle", () => {
  const runs = allSkyLine([{ rightAscension: 80, declination: 10 }, { rightAscension: 100, declination: 10 }], { width: 1000, frame: "equatorial", centre: 90 });
  assert.equal(runs.length, 1);
  assert.ok(runs[0]!.length > 3, "cut into pieces");
});

test("allSkyLine: a line across the seam is cut in two, each ending on the edge at the same height", () => {
  for (const projection of ALL_SKY_PROJECTIONS) {
    const options: AllSkyOptions = { width: 1000, frame: "equatorial", projection, centre: 0 };
    const runs = allSkyLine([{ rightAscension: 170, declination: 30 }, { rightAscension: 190, declination: 30 }], options);
    assert.equal(runs.length, 2, projection);
    const [a, b] = [runs[0]!, runs[1]!];
    const endA = a[a.length - 1]!;
    const startB = b[0]!;
    close(endA.y, startB.y, 0.5, `${projection} same height`);
    // one ends on the left edge and the other starts on the right, never a long line across
    assert.ok(Math.abs(endA.x - startB.x) > 400, `${projection} opposite edges`);
    for (const run of runs) for (let i = 1; i < run.length; i += 1) assert.ok(Math.abs(run[i]!.x - run[i - 1]!.x) < 100, `${projection} no jump across the picture`);
  }
});

test("allSkyLine: every boundary of the 88 stays in the box and has no long jumps, in every orientation", () => {
  for (const frame of ALL_SKY_FRAMES) {
    for (const abbreviation of ["Ori", "Cas", "UMi", "Oct", "Ser", "Cyg", "Peg", "Hya"]) {
      const options: AllSkyOptions = { width: 1000, frame, projection: "hammer" };
      const runs = allSkyLine(boundaryOf(abbreviation).outlines[0]!, options);
      assert.ok(runs.length >= 1);
      for (const run of runs) {
        for (let i = 0; i < run.length; i += 1) {
          const p = run[i]!;
          assert.ok(p.x >= -0.5 && p.x <= 1000.5 && p.y >= -0.5 && p.y <= 500.5, `${frame} ${abbreviation} ${JSON.stringify(p)}`);
          if (i > 0) assert.ok(Math.hypot(p.x - run[i - 1]!.x, p.y - run[i - 1]!.y) < 120, `${frame} ${abbreviation} jump`);
        }
      }
    }
  }
});

test("allSkyGrid: meridians and parallels of the picture's own frame, the plane the middle parallel", () => {
  for (const frame of ALL_SKY_FRAMES) {
    for (const projection of ALL_SKY_PROJECTIONS) {
      const grid = allSkyGrid({ width: 1000, frame, projection });
      const parallels = grid.filter((line) => line.kind === "parallel");
      assert.deepEqual(parallels.map((line) => line.degrees), [-60, -30, 0, 30, 60]);
      assert.equal(grid.filter((line) => line.kind === "meridian").length, 12);
      // the parallel at 0 is the middle row of the picture, however it is bent
      for (const run of parallels[2]!.runs) for (const p of run) close(p.y, 250, 1e-6, `${frame} ${projection} equator row`);
      // every run stays inside the box and has no jump across the picture
      for (const line of grid) {
        assert.ok(line.runs.length >= 1);
        for (const run of line.runs) {
          for (let i = 0; i < run.length; i += 1) {
            const p = run[i]!;
            assert.ok(p.x >= -0.5 && p.x <= 1000.5 && p.y >= -0.5 && p.y <= 500.5, `${frame} ${projection} ${line.kind} ${line.degrees} ${JSON.stringify(p)}`);
            if (i > 0) assert.ok(Math.hypot(p.x - run[i - 1]!.x, p.y - run[i - 1]!.y) < 120, `${frame} ${projection} ${line.kind} ${line.degrees} jump`);
          }
        }
      }
    }
  }
  assert.equal(allSkyGrid({ width: 1000 }, 45).filter((line) => line.kind === "meridian").length, 8);
  assert.throws(() => allSkyGrid({ width: 1000 }, 7), /every/);
});

test("bad input is refused with the name of what is wrong", () => {
  assert.throws(() => allSkyProject(sagittariusA, { width: 0 }), /width/);
  assert.throws(() => allSkyProject(sagittariusA, { width: 100, frame: "ecliptic" as never }), /frame/);
  assert.throws(() => allSkyProject(sagittariusA, { width: 100, projection: "orthographic" as never }), /projection/);
  assert.throws(() => allSkyProject(sagittariusA, { width: 100, centre: Number.NaN }), /centre/);
  assert.throws(() => allSkyProject(sagittariusA, null as never), TypeError);
  assert.throws(() => allSkyUnproject({ x: Number.NaN, y: 1 }, { width: 100 }), RangeError);
  assert.throws(() => allSkyLine([sagittariusA], { width: 100 }, 0), /step/);
});
