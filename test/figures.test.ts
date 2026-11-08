// The figures: our own line art for four samples, kept on the sky: every anchor star exists and the drawing reaches it, the drawing stays in its constellation, it projects to finite path data in all seven projections, and each stays within its size budget.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { boundaryOf, constellationAt } from "../src/boundaries.ts";
import { constellation } from "../src/constellations.ts";
import { figure, figureLines, figurePath, figures } from "../src/figures.ts";
import { PROJECTIONS, project, type SkyPoint } from "../src/projection.ts";
import { starByName } from "../src/stars.ts";

// "on": a line of the figure passes within half a degree of the star. "in": the star is enclosed, with a line of the figure on each of the four sides of it.
const ANCHORS: Record<string, { on: string[]; in: string[] }> = {
  UMa: { on: ["Alkaid", "Tania Australis"], in: ["Dubhe", "Merak", "Phecda", "Megrez", "Alioth", "Mizar", "ο UMa", "Talitha", "κ UMa", "Tania Borealis", "Alula Borealis", "Alula Australis", "ψ UMa"] },
  Cas: { on: ["Caph", "Schedar", "Navi", "Ruchbah", "Segin"], in: [] },
  M45: { on: ["η Tau", "27 Tau", "28 Tau", "17 Tau", "19 Tau", "20 Tau", "23 Tau"], in: [] },
  Ori: { on: ["Bellatrix", "Saiph", "Rigel", "ι Ori", "χ1 Ori", "χ2 Ori", "Pi 1 Ori", "Pi 2 Ori", "Pi 3 Ori", "Pi 4 Ori", "Pi 5 Ori", "Pi 6 Ori"], in: ["Betelgeuse", "λ Ori", "Alnitak", "Alnilam", "Mintaka", "μ Ori"] },
};

const DEGREES = 180 / Math.PI;
type Segment = [[number, number], [number, number]];

function around(centre: SkyPoint, art: ReturnType<typeof figure> & object, step: number): Segment[] {
  const out: Segment[] = [];
  for (const line of figureLines(art, { step })) {
    const flat = line.map((p) => project("stereographic", p, { centre, scale: DEGREES })).map((m) => (m === undefined ? undefined : ([m.x, m.y] as [number, number])));
    for (let i = 1; i < flat.length; i++) if (flat[i - 1] !== undefined && flat[i] !== undefined) out.push([flat[i - 1]!, flat[i]!]);
  }
  return out;
}

function distance(segments: Segment[]): number {
  let best = Infinity;
  for (const [[ax, ay], [bx, by]] of segments) {
    const dx = bx - ax;
    const dy = by - ay;
    const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

function enclosed(segments: Segment[]): boolean {
  const hits = [false, false, false, false];
  for (const [[ax, ay], [bx, by]] of segments) {
    if (ay <= 0 !== by <= 0) {
      const x = ax + ((0 - ay) / (by - ay)) * (bx - ax);
      if (x > 0) hits[0] = true;
      else if (x < 0) hits[1] = true;
    }
    if (ax <= 0 !== bx <= 0) {
      const y = ay + ((0 - ax) / (bx - ax)) * (by - ay);
      if (y > 0) hits[2] = true;
      else if (y < 0) hits[3] = true;
    }
  }
  return hits.every(Boolean);
}

test("the four sample figures are there, each keyed, named and frozen", () => {
  assert.deepEqual(figures().map((f) => f.id).sort(), ["Cas", "M45", "Ori", "UMa"]);
  for (const art of figures()) {
    assert.ok(Object.isFrozen(art));
    assert.ok(art.path.startsWith("M") && art.path.length > 100);
    assert.ok(constellation(art.constellation), art.id);
  }
  for (const id of ["UMa", "Cas", "Ori"]) {
    const found = constellation(id)!;
    assert.equal(figure(id)!.english, found.english);
    assert.equal(figure(id)!.japanese, found.japanese);
  }
  assert.equal(figure("M45")!.constellation, "Tau");
  assert.match(figure("m45")!.japanese, /すばる/);
  assert.equal(figure("ori")!.id, "Ori");
  assert.equal(figure("Cru"), undefined);
  assert.throws(() => figure(5 as unknown as string), TypeError);
  const copy = figures();
  copy.pop();
  assert.equal(figures().length, 4, "a fresh array each call");
});

test("every anchor star exists", () => {
  for (const list of Object.values(ANCHORS)) for (const name of [...list.on, ...list.in]) assert.ok(starByName(name), name);
});

test("each figure passes within half a degree of its key stars and encloses its inner ones", () => {
  for (const [id, list] of Object.entries(ANCHORS)) {
    const art = figure(id)!;
    for (const name of list.on) {
      const star = starByName(name)!;
      const gap = distance(around(star, art, 0.05));
      assert.ok(gap <= 0.5, `${id}: ${name} is ${gap.toFixed(2)} degrees from the line`);
    }
    for (const name of list.in) assert.ok(enclosed(around(starByName(name)!, art, 0.1)), `${id}: ${name} is not inside the figure`);
  }
});

test("each figure lies inside its constellation, with a few points just outside", () => {
  for (const art of figures()) {
    const points = figureLines(art, { step: 0.25 }).flat();
    const edge = boundaryOf(art.constellation, { step: 0.1 }).outlines.flat();
    let outside = 0;
    let worst = 0;
    for (const p of points) {
      if (constellationAt(p).abbreviation === art.constellation) continue;
      outside += 1;
      const near = Math.min(...edge.map((e) => Math.hypot((e.rightAscension - p.rightAscension) * Math.cos((p.declination * Math.PI) / 180), e.declination - p.declination)));
      worst = Math.max(worst, near);
    }
    assert.ok(outside / points.length <= 0.05, `${art.id}: ${outside} of ${points.length} points are outside`);
    assert.ok(worst <= 1, `${art.id}: a point is ${worst.toFixed(2)} degrees outside the boundary`);
  }
});

test("every figure gives finite path data in all seven projections, at the right size", () => {
  for (const art of figures()) {
    const points = figureLines(art).flat();
    const centre = { rightAscension: (Math.atan2(points.reduce((s, p) => s + Math.sin(p.rightAscension / DEGREES), 0), points.reduce((s, p) => s + Math.cos(p.rightAscension / DEGREES), 0)) * DEGREES + 360) % 360, declination: points.reduce((s, p) => s + p.declination, 0) / points.length };
    for (const kind of PROJECTIONS) {
      const d = figurePath(art, kind, { centre, scale: kind === "equirectangular" ? 1 : 100 });
      assert.match(d, /^M-?[\d.]+ -?[\d.]+(L-?[\d.]+ -?[\d.]+|M-?[\d.]+ -?[\d.]+)+$/, `${art.id} ${kind}`);
      assert.ok((d.match(/-?\d+(\.\d+)?/g) ?? []).every((n) => Number.isFinite(Number(n))));
      assert.ok((d.match(/[ML]/g) ?? []).length >= points.length / 2, `${art.id} ${kind} keeps its points`);
    }
  }
});

test("y runs down, east is to the left, and a point on the far side cuts the stroke", () => {
  const art = figure("Ori")!;
  const centre = { rightAscension: 84, declination: 3 };
  const flat = figurePath(art, "stereographic", { centre, scale: 10 });
  const first = figureLines(art)[0]![0]!;
  const at = project("stereographic", first, { centre, scale: 10 })!;
  assert.ok(flat.startsWith(`M${Number(at.x.toFixed(2))} ${Number((-at.y).toFixed(2)) + 0}`));
  assert.equal(figurePath(art, "orthographic", { centre: { rightAscension: 264, declination: -3 } }), "");
  assert.notEqual(figurePath(art, "orthographic", { centre: { rightAscension: 84, declination: 60 } }), "");
  assert.ok(figurePath(art, "gnomonic", { centre, scale: 10, digits: 0 }).length > 50);
  assert.throws(() => figurePath(art, "mercator" as never, { centre }), RangeError);
});

test("the lines are finite sky positions, finer with a smaller step, and bad steps are refused", () => {
  for (const art of figures()) {
    const coarse = figureLines(art, { step: 2 }).flat();
    const fine = figureLines(art, { step: 0.2 }).flat();
    assert.ok(fine.length >= coarse.length);
    for (const p of fine) assert.ok(p.rightAscension >= 0 && p.rightAscension < 360 && p.declination >= -90 && p.declination <= 90);
    assert.deepEqual(figureLines(art, { step: 0.2 }).flat(), fine);
  }
  assert.ok(figureLines(figure("UMa")!, { step: 0.2 }).flat().length > figureLines(figure("UMa")!, { step: 2 }).flat().length);
  for (const step of [0, -1, 91, Number.NaN]) assert.throws(() => figureLines(figure("UMa")!, { step }), RangeError);
});

test("each figure's drawing is a few kB, and the data gzips small", () => {
  for (const art of figures()) assert.ok(art.path.length <= 3600, `${art.id} is ${art.path.length} characters`);
  const data = readFileSync(new URL("../src/data/figures.ts", import.meta.url));
  assert.ok(gzipSync(data).length <= 6500, `gzipped data is ${gzipSync(data).length} bytes`);
  const code = readFileSync(new URL("../src/figures.ts", import.meta.url));
  assert.ok(gzipSync(code).length <= 3500, `gzipped code is ${gzipSync(code).length} bytes`);
});
