// Where the chart's names go: a label takes the first place that is free, a label with none is left out, and the chart the demo draws at its opening view has no two names on each other or on a bright star.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, DEFAULT_VIEW, defaultZoom, toScreen, type View } from "../src/chart/chart.ts";
import { overlaps, placeLabels, textSize, type Box } from "../src/chart/labels.ts";
import { PROJECTIONS } from "../src/projection.ts";

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 });

test("a label takes its first free place and the next label goes round it", () => {
  const first = [box(0, 0, 40, 12)];
  const second = [box(20, 4, 60, 16), box(0, 14, 40, 26)];
  assert.deepEqual(placeLabels([first, second], []), [0, 1]);
});

test("the first label in the list wins, and a label with no free place is left out", () => {
  const spot = [box(0, 0, 40, 12)];
  assert.deepEqual(placeLabels([spot, spot], []), [0, undefined]);
  assert.deepEqual(placeLabels([[box(0, 0, 40, 12)], [box(41, 0, 80, 12)]], []), [0, 0]);
});

test("a label keeps off an obstacle, in a crowd as in a corner", () => {
  assert.deepEqual(placeLabels([[box(10, 10, 50, 22), box(60, 10, 100, 22)]], [box(30, 12, 34, 16)]), [1]);
  const many: Array<Box[]> = [];
  for (let i = 0; i < 300; i += 1) many.push([box(i * 7, (i % 3) * 13, i * 7 + 30, (i % 3) * 13 + 12)]);
  const placed = placeLabels(many, []);
  const kept = many.flatMap((places, i) => (placed[i] === undefined ? [] : [places[0]!]));
  assert.ok(kept.length > 20 && kept.length < 300);
  for (let i = 0; i < kept.length; i += 1) for (let j = i + 1; j < kept.length; j += 1) assert.ok(!overlaps(kept[i]!, kept[j]!));
});

test("Japanese letters take the whole size and Latin ones a little over half", () => {
  assert.equal(textSize("シリウス", 10).w, 40);
  assert.ok(textSize("Sirius", 10).w < 40);
  assert.ok(textSize("Sirius", 10).h >= 10);
});

test("the opening view is 90 degrees across the middle of a desk's chart and 60 across a phone's", () => {
  for (const [width, height, across] of [[744, 610, 90], [360, 400, 60]] as const) {
    const view: View = { ...DEFAULT_VIEW, zoom: defaultZoom("stereographic", width, height) };
    const east = toScreen(view, width, height, { rightAscension: DEFAULT_VIEW.ra + across / 2, declination: 0 })!;
    const west = toScreen(view, width, height, { rightAscension: DEFAULT_VIEW.ra - across / 2, declination: 0 })!;
    assert.ok(Math.abs(Math.abs(east[0] - west[0]) - width) < 2, `${width}: ${east[0]} to ${west[0]}`);
  }
  for (const kind of PROJECTIONS) assert.ok(defaultZoom(kind, 744, 610) > 0.6, kind);
});

interface Drawn {
  text: string;
  box: Box;
}
function labelsOf(svg: string): Drawn[] {
  return [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" text-anchor="(\w+)" font-size="(\d+)"[^>]*>([^<]*)<\/text>/g)].map((m) => {
    const x = Number(m[1]);
    const y = Number(m[2]);
    const size = Number(m[4]);
    const { w } = textSize(m[5]!, size);
    const left = m[3] === "start" ? x : m[3] === "end" ? x - w : x - w / 2;
    return { text: m[5]!, box: box(left, y - size * 0.85, left + w, y + size * 0.3) };
  });
}

for (const [name, width, height] of [["desk", 744, 610], ["phone", 360, 400]] as const) {
  for (const lang of ["en", "ja"] as const) {
    for (const extra of [[], ["deep"]] as const) {
      test(`at the opening view of a ${name}, in ${lang}${extra.length > 0 ? " with the Messier objects" : ""}, no two names touch and none sits on a bright star`, () => {
        const layers = new Set(["lines", "names", "grid", ...extra] as const);
        const { svg } = chart({ ...DEFAULT_VIEW, zoom: defaultZoom("stereographic", width, height), width, height, magnitude: 5, layers, lang });
        const drawn = labelsOf(svg);
        assert.ok(drawn.length > 15, `${drawn.length} names`);
        for (const one of drawn) assert.ok(one.box.x0 >= 0 && one.box.y0 >= 0 && one.box.x1 <= width && one.box.y1 <= height, `${one.text} is cut by the edge`);
        for (let i = 0; i < drawn.length; i += 1) for (let j = i + 1; j < drawn.length; j += 1) assert.ok(!overlaps(drawn[i]!.box, drawn[j]!.box), `${drawn[i]!.text} and ${drawn[j]!.text}`);
        const bright = [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)" fill="#/g)].filter((m) => Number(m[3]) > 2.7).map((m) => box(Number(m[1]) - Number(m[3]), Number(m[2]) - Number(m[3]), Number(m[1]) + Number(m[3]), Number(m[2]) + Number(m[3])));
        assert.ok(bright.length > 10);
        for (const one of drawn) for (const star of bright) assert.ok(!overlaps(one.box, star), `${one.text} is on a star`);
        assert.ok(drawn.some((one) => one.text === (lang === "ja" ? "シリウス" : "Sirius")), "Sirius is named");
        if (extra.length === 0) assert.ok(drawn.some((one) => one.text === (lang === "ja" ? "オリオン座" : "Orion")), "Orion is named");
      });
    }
  }
}

test("a name keeps off a rectangle it is told to keep clear, such as the buttons over the chart", () => {
  const options = { ...DEFAULT_VIEW, zoom: defaultZoom("stereographic", 360, 400), width: 360, height: 400, magnitude: 5, layers: new Set(["names"] as const), lang: "en" } as const;
  const tools = box(0, 330, 360, 400);
  const before = labelsOf(chart(options).svg);
  assert.ok(before.some((one) => overlaps(one.box, tools)));
  for (const one of labelsOf(chart({ ...options, keepClear: [tools] }).svg)) assert.ok(!overlaps(one.box, tools), one.text);
});

test("a name left out when the sky is crowded comes back when the chart zooms in on it", () => {
  const options = { ...DEFAULT_VIEW, width: 360, height: 400, magnitude: 5, layers: new Set(["names"] as const), lang: "en" } as const;
  const zoom = defaultZoom("stereographic", 360, 400);
  const names = (z: number): string[] => labelsOf(chart({ ...options, zoom: z }).svg).map((one) => one.text);
  assert.ok(!names(zoom).includes("Alnilam"), "Alnilam sits among two brighter dots and is left out");
  assert.ok(names(zoom * 2.5).includes("Alnilam"), "and is named when the chart is closer");
});
