// Bodies on the chart: a plain list the page passes in (no other package is involved): each is drawn where its sky is, by its magnitude, the Moon as a disc with its phase, named in the chart's language,
// and the ecliptic comes from the package's own frame maths. The same options draw the same SVG.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chartSvg, eclipticLine, eclipticToEquatorial, normaliseBodies, OBLIQUITY_J2000, type SkyBody } from "../src/chart/index.ts";
import { chart, toScreen } from "../src/chart/chart.ts";
import { litPath } from "../src/chart/bodies-draw.ts";
import { sunPosition } from "../src/tonight.ts";

/** A fixed width a character, so the names are laid out the same on every machine. */
const measure = (text: string): number => text.length * 6;
const base = { projection: "stereographic", ra: 84, dec: 10, zoom: 2, width: 640, height: 400, magnitude: 5, layers: new Set<never>(), lang: "en", measure } as const;

// a fixed list: two planets of different brightness, a faint one, a half Moon and a body behind the observer's back
const list: SkyBody[] = [
  { id: "venus", names: { en: "Venus", ja: "金星" }, ra: 80, dec: 8, magnitude: -4.4, phase: 0.5 },
  { id: "mars", names: { en: "Mars", ja: "火星" }, ra: 90, dec: 12, magnitude: 1.2, phase: 0.95 },
  { id: "neptune", names: { en: "Neptune", ja: "海王星" }, ra: 86, dec: 14, magnitude: 7.8, phase: 1 },
  { id: "moon", names: { en: "Moon", ja: "月" }, ra: 88, dec: 6, magnitude: -11, phase: 0.25, brightLimb: 90, size: 1850 },
  { id: "far", names: { en: "Far side", ja: "裏側" }, ra: 264, dec: -10, magnitude: 0, phase: 1 },
];

const group = (svg: string, id: string): string => svg.match(new RegExp(`<g data-body="${id}"[^>]*>.*?</g>(?=<g data-body|</g>)`, "s"))?.[0] ?? "";
/** The middle and radius of a body's dot or disc (a disc is drawn about its own origin, moved by `translate`). */
const circle = (fragment: string): { x: number; y: number; r: number } => {
  const dot = fragment.match(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)"/);
  if (dot !== null) return { x: Number(dot[1]), y: Number(dot[2]), r: Number(dot[3]) };
  const disc = fragment.match(/translate\(([\d.-]+) ([\d.-]+)\) rotate\([\d.-]+\)"><circle r="([\d.]+)"/);
  assert.ok(disc, `a circle in ${fragment.slice(0, 200)}`);
  return { x: Number(disc[1]), y: Number(disc[2]), r: Number(disc[3]) };
};

test("each body is drawn where its sky is, and the one on the far side is not drawn", () => {
  const out = chart({ ...base, bodies: list });
  for (const id of ["venus", "mars"]) {
    const body = list.find((b) => b.id === id)!;
    const at = toScreen(base, base.width, base.height, { rightAscension: body.ra, declination: body.dec })!;
    const spot = circle(group(out.svg, id));
    assert.ok(Math.abs(spot.x - at[0]) < 0.06 && Math.abs(spot.y - at[1]) < 0.06, `${id} at ${at}, drawn at ${spot.x},${spot.y}`);
  }
  assert.ok(!out.svg.includes('data-body="far"'));
  assert.deepEqual(out.hits.filter((h) => h.kind === "body").map((h) => h.key).sort(), ["mars", "moon", "venus"]);
});

test("a body is drawn by its magnitude: brighter is larger, and one fainter than the chart's faintest star is left out", () => {
  const out = chart({ ...base, bodies: list });
  assert.ok(circle(group(out.svg, "venus")).r > circle(group(out.svg, "mars")).r, "Venus is larger than Mars");
  assert.ok(!out.svg.includes('data-body="neptune"'), "magnitude 7.8 is fainter than the 5 the chart draws");
  // a deeper chart draws it
  assert.ok(chart({ ...base, magnitude: 6, zoom: 40, ra: 86, dec: 14, bodies: list }).svg.includes('data-body="neptune"'));
  // a limit of 8 reaches it at once
  assert.ok(chart({ ...base, magnitude: 8, bodies: list }).svg.includes('data-body="neptune"'));
});

test("the Moon is a disc with its phase drawn, and a dark one when it is new", () => {
  const out = chart({ ...base, bodies: list });
  const moon = group(out.svg, "moon");
  assert.match(moon, /data-shape="disc"/);
  assert.match(moon, /data-phase="0.25"/);
  assert.match(moon, /<path data-lit="" d="M0 -[\d.]+A/);
  assert.ok(circle(moon).r >= 7, "never smaller than 7 pixels");
  const fullMoon = chart({ ...base, bodies: [{ ...list[3]!, phase: 1 }] }).svg;
  assert.match(fullMoon, /data-phase="1.00"/);
  const newMoon = chart({ ...base, bodies: [{ ...list[3]!, phase: 0 }] }).svg;
  assert.ok(newMoon.includes('data-body="moon"') && !newMoon.includes("data-lit"), "a new Moon has no lit part");
  // a planet with no size is a dot with no phase shape
  assert.match(group(out.svg, "venus"), /data-shape="dot"/);
  assert.ok(!group(out.svg, "venus").includes("data-lit"));
});

test("the lit part is a crescent below half, a straight terminator at half and gibbous above, turned to the bright limb", () => {
  assert.equal(litPath(0, 10), "");
  assert.equal(litPath(0.5, 10), "M0 -10A10 10 0 0 1 0 10A0 10 0 0 0 0 -10Z");
  assert.equal(litPath(0.25, 10), "M0 -10A10 10 0 0 1 0 10A5 10 0 0 0 0 -10Z", "the terminator bulges toward the lit side");
  assert.equal(litPath(0.75, 10), "M0 -10A10 10 0 0 1 0 10A5 10 0 0 1 0 -10Z", "and away from it when gibbous");
  // a limb at position angle 90 (east) is turned east on the chart: east is to the left of north-up charts, whichever way this projection puts it
  const east = chart({ ...base, bodies: [{ ...list[3]!, brightLimb: 90 }] }).svg.match(/rotate\((-?[\d.]+)\)/)![1];
  const north = chart({ ...base, bodies: [{ ...list[3]!, brightLimb: 0 }] }).svg.match(/rotate\((-?[\d.]+)\)/)![1];
  assert.ok(Math.abs(Number(east) - Number(north)) > 80 && Math.abs(Number(east) - Number(north)) < 100, `north ${north}, east ${east}`);
  assert.ok(Math.abs(Math.abs(Number(north)) - 90) < 15, "north is up on the screen in this view");
});

test("a body is named in the chart's language and the name stands clear of the dots", () => {
  const en = chart({ ...base, bodies: list }).svg;
  assert.match(en, />Venus<\/text>/);
  assert.match(en, />Moon<\/text>/);
  const ja = chart({ ...base, lang: "ja", bodies: list }).svg;
  assert.match(ja, />金星<\/text>/);
  assert.match(ja, />月<\/text>/);
  assert.ok(!ja.includes(">Venus</text>"));
});

test("the same list and options draw the same SVG, and no list draws no bodies", () => {
  assert.equal(chart({ ...base, bodies: list }).svg, chart({ ...base, bodies: list }).svg);
  assert.ok(!chart({ ...base }).svg.includes("data-body"));
  assert.ok(!chart({ ...base, bodies: [] }).svg.includes("data-body"));
  const a = chartSvg({ width: 400, height: 300, ra: 88, dec: 6, zoom: 4, bodies: list, measure });
  assert.ok(a.includes('data-body="moon"') && a.includes('data-body="venus"'));
  assert.equal(a, chartSvg({ width: 400, height: 300, ra: 88, dec: 6, zoom: 4, bodies: list, measure }));
});

test("a body with a number that is not finite is not drawn, and a bad phase counts as full", () => {
  const bad: SkyBody[] = [{ id: "a", names: { en: "A", ja: "ア" }, ra: Number.NaN, dec: 0, magnitude: 1, phase: 1 }, { id: "b", names: { en: "B", ja: "ビ" }, ra: 84, dec: 10, magnitude: 1, phase: Number.NaN, size: 400 }];
  const svg = chart({ ...base, zoom: 300, bodies: bad }).svg;
  assert.ok(!svg.includes('data-body="a"'));
  assert.match(svg, /data-body="b" data-phase="1.00" data-shape="disc"/);
});

test("a list that came as text is cleaned: no id or place drops an entry, a missing name falls back, a phase is held to 0 to 1", () => {
  const list2 = normaliseBodies([
    { id: "mars", names: { en: "Mars" }, ra: 10, dec: -5, magnitude: 1.1, phase: 1.7 },
    { id: "", names: { en: "x" }, ra: 1, dec: 1, magnitude: 1, phase: 1 },
    { id: "nope", names: { en: "x" }, ra: "1", dec: 1, magnitude: 1, phase: 1 },
    { id: "moon", names: { ja: "月" }, ra: 1, dec: 1, magnitude: -12, phase: -1, size: -3, brightLimb: 10 },
    7,
  ]);
  assert.deepEqual(list2.map((b) => b.id), ["mars", "moon"]);
  assert.equal(list2[0]!.names.ja, "Mars");
  assert.equal(list2[0]!.phase, 1);
  assert.equal(list2[1]!.names.en, "月");
  assert.equal(list2[1]!.phase, 0);
  assert.equal(list2[1]!.size, undefined);
  assert.equal(list2[1]!.brightLimb, 10);
  assert.deepEqual(normaliseBodies("text"), []);
  assert.deepEqual(normaliseBodies(null), []);
});

test("the ecliptic is the equator turned by the published obliquity: the equinoxes and solstices fall where they should and it agrees with the Sun's place", () => {
  assert.ok(Math.abs(OBLIQUITY_J2000 - 23.4392794) < 1e-6);
  const march = eclipticToEquatorial(0);
  assert.ok(Math.abs(march.rightAscension) < 1e-9 || Math.abs(march.rightAscension - 360) < 1e-9);
  assert.ok(Math.abs(march.declination) < 1e-9);
  const june = eclipticToEquatorial(90);
  assert.ok(Math.abs(june.rightAscension - 90) < 1e-9 && Math.abs(june.declination - OBLIQUITY_J2000) < 1e-9);
  const december = eclipticToEquatorial(270);
  assert.ok(Math.abs(december.declination + OBLIQUITY_J2000) < 1e-9);
  // a point off the ecliptic: the north ecliptic pole is 90 degrees from it, at 18 hours and 66.56 degrees north
  const pole = eclipticToEquatorial(0, 90);
  assert.ok(Math.abs(pole.declination - (90 - OBLIQUITY_J2000)) < 1e-9);
  // the low-precision Sun of `tonight` is on this line, to its own accuracy
  const line = eclipticLine(0.25);
  for (const when of [Date.UTC(2026, 2, 20, 14), Date.UTC(2026, 5, 21, 8), Date.UTC(2026, 10, 12)]) {
    const sun = sunPosition(when);
    const off = Math.min(...line.map((p) => Math.hypot(((p.rightAscension - sun.rightAscension + 540) % 360) - 180, p.declination - sun.declination)));
    assert.ok(off < 0.4, `the Sun is ${off} degrees off the line`);
  }
  assert.equal(eclipticLine(30).length, 13);
  assert.deepEqual(eclipticLine(30)[0], eclipticLine(30).at(-1));
});

test("the ecliptic layer draws a dashed line through the solstice point, and nothing without the layer", () => {
  const options = { ...base, ra: 90, dec: 23, zoom: 3 } as const;
  const on = chart({ ...options, layers: new Set(["ecliptic"]) });
  assert.match(on.svg, /<path data-layer="ecliptic" d="M[\dML. -]+"[^>]*stroke-dasharray/);
  assert.ok(!chart({ ...options }).svg.includes('data-layer="ecliptic"'));
  assert.ok(chartSvg({ width: 320, height: 200, layers: ["ecliptic"] }).includes('data-layer="ecliptic"'));
  // the June solstice point (90, 23.44) is on the line: the path passes within a pixel of where the chart puts it
  const at = toScreen({ ...options }, options.width, options.height, eclipticToEquatorial(90))!;
  const points = [...on.svg.match(/data-layer="ecliptic" d="([^"]+)"/)![1]!.matchAll(/([\d.-]+) ([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
  assert.ok(Math.min(...points.map(([x, y]) => Math.hypot(x - at[0], y - at[1]))) < 2);
});

test("a list handed to the chart straight (not as text) with a missing name or id, a null or a repeated id is cleaned, not thrown on", () => {
  const rough = [
    { id: "x", ra: 90, dec: 10, magnitude: 1, phase: 1 },
    { names: { en: "No id", ja: "なし" }, ra: 90, dec: 10, magnitude: 1, phase: 1 },
    null,
    { id: "d", names: { en: "First", ja: "最初" }, ra: 90, dec: 10, magnitude: 1, phase: 1 },
    { id: "d", names: { en: "Second", ja: "二番目" }, ra: 90, dec: 10, magnitude: 1, phase: 1 },
  ] as unknown as SkyBody[];
  const svg = chartSvg({ width: 300, height: 200, ra: 90, dec: 10, zoom: 3, bodies: rough, measure });
  assert.deepEqual([...svg.matchAll(/data-body="([^"]*)"/g)].map((m) => m[1]), ["x", "d"]);
  assert.ok(svg.includes("First") && !svg.includes("Second"), "the first of two with one id is kept");
  assert.deepEqual(normaliseBodies([rough[3], rough[4]]).map((b) => b.names.en), ["First"]);
});
