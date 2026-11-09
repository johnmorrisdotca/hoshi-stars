// The black-hole layer of the demo's chart: a symbol for each kind at its place in every projection, names only when zoomed in and never overlapping another label, a picked one drawn
// with the layer off, none from another star's sky, and the words and text the pick card is made of.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, DEFAULT_VIEW, LAYERS, toScreen, type ChartOptions } from "../demo/chart.ts";
import { layersOf, layersText } from "../demo/choice.ts";
import { distanceText, lightYearsText, massText, papersOf, placeText, plainNumber } from "../demo/holes.ts";
import { textSize } from "../demo/labels.ts";
import { WORDS } from "../scripts/page-words.ts";
import { blackHole, blackHoles } from "../src/black-holes.ts";
import { PROJECTIONS } from "../src/projection.ts";
import { skyFrom } from "../src/sky-from.ts";
import { starByHr } from "../src/index.ts";

const size = { width: 900, height: 600 };
const options = (extra: Partial<ChartOptions>): ChartOptions => ({ ...DEFAULT_VIEW, ...size, zoom: 1, magnitude: 4, layers: new Set(["holes"] as const), lang: "en", ...extra });
const symbols = (svg: string): string[] => [...svg.matchAll(/data-hole="([^"]+)" data-kind="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);
const say = (key: string): string => (WORDS.en as Record<string, string>)[key] ?? key;

test("holes is a layer, after Messier and before the grid, and is kept in an address only when it is on", () => {
  assert.deepEqual([...LAYERS], ["milky", "lines", "boundaries", "names", "deep", "holes", "grid"]);
  assert.equal(layersText(layersOf("milky,lines,names,grid")), null);
  assert.equal(layersText(layersOf("milky,lines,names,holes,grid")), "milky,lines,names,holes,grid");
  assert.equal(layersText(layersOf("holes")), "holes");
});

test("every projection draws the black holes on the sky it shows, a symbol each, and none when the layer is off", () => {
  for (const projection of PROJECTIONS) {
    const drawn = symbols(chart(options({ projection, ra: 266.4, dec: -29, zoom: 1 })).svg);
    assert.ok(drawn.length >= 20, `${projection}: ${drawn.length}`);
    assert.equal(symbols(chart(options({ projection, ra: 266.4, dec: -29, layers: new Set(["lines"] as const) })).svg).length, 0);
  }
  for (const projection of ["equirectangular", "mollweide", "hammer"] as const) {
    const all = symbols(chart(options({ projection, ra: 180, dec: 0, zoom: 1 })).svg);
    assert.ok(all.length > 280, `${projection}: ${all.length} of 301 on the whole sky`);
    for (const kind of ["stellar", "quiet", "supermassive"]) assert.ok(all.some((one) => one.endsWith(`:${kind}`)), `${projection} draws a ${kind} one`);
  }
});

test("a black hole is drawn where the projection puts its place, and a tap on it lands on it", () => {
  const sgr = blackHole("Sgr A*")!;
  const view = { ...DEFAULT_VIEW, ra: sgr.rightAscension, dec: sgr.declination, zoom: 8, projection: "stereographic" as const };
  const out = chart(options({ ...view, layers: new Set(["holes"] as const) }));
  const at = toScreen(view, size.width, size.height, sgr)!;
  const hit = out.hits.find((h) => h.kind === "hole" && h.key === "sagittarius-a")!;
  assert.ok(Math.hypot(hit.x - at[0], hit.y - at[1]) < 0.01);
  assert.ok(Math.abs(at[0] - size.width / 2) < 1 && Math.abs(at[1] - size.height / 2) < 1);
});

test("names show only when zoomed in (the famous ones sooner) and no two labels overlap, nor a label a symbol", () => {
  const out = (zoom: number, extra: Partial<ChartOptions> = {}) => chart(options({ ra: 266.4, dec: -29, zoom, layers: new Set(["holes", "names"] as const), ...extra })).svg;
  const names = (svg: string): string[] => [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
  assert.ok(!names(out(0.5, { projection: "mollweide" })).some((name) => blackHoles().some((b) => b.name === name)));
  assert.ok(names(out(8)).includes("Sagittarius A*"));
  assert.ok(blackHoles().filter((b) => b.kind !== "supermassive").some((b) => names(out(4, { ra: b.rightAscension, dec: b.declination })).includes(b.name)));
  for (const zoom of [3, 8, 20]) {
    const svg = out(zoom);
    const boxes = [...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="(\d+)"[^>]*>([^<]*)<\/text>/g)].map((m) => {
      const [x, y, anchor, fontSize, text] = [Number(m[1]), Number(m[2]), m[3]!, Number(m[4]), m[5]!];
      const { w } = textSize(text.replace(/&amp;/g, "&"), fontSize);
      const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
      return { text, x0, x1: x0 + w, y0: y - fontSize * 0.85, y1: y + fontSize * 0.3 };
    });
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, `zoom ${zoom}: "${a.text}" overlaps "${b.text}"`);
      }
    }
  }
});

test("a picked black hole is drawn and named with the layer off, in the pick colour, and none is drawn in another star's sky", () => {
  const cygnus = blackHole("Cygnus X-1")!;
  const svg = chart(options({ ra: cygnus.rightAscension, dec: cygnus.declination, zoom: 6, layers: new Set(["names"] as const), pickedHole: "cygnus-x-1" })).svg;
  assert.deepEqual(symbols(svg), ["cygnus-x-1:stellar"]);
  assert.match(svg, /fill="#ff7a59"[^>]*>Cygnus X-1<\/text>/);
  const sirius = starByHr(2491)!;
  const sky = skyFrom(sirius, { magnitude: 5 });
  assert.equal(symbols(chart(options({ ra: cygnus.rightAscension, dec: cygnus.declination, zoom: 6, sky })).svg).length, 0);
});

test("the pick card's text: mass with its range or limit, distance in light-years, the place in hours and degrees, the papers once each", () => {
  const en = (key: string) => say(key);
  const ja = (key: string) => (WORDS.ja as Record<string, string>)[key] ?? key;
  assert.equal(massText(blackHole("Cygnus X-1")!, "en", en), "21.2 (19–23.4) Suns");
  assert.equal(massText(blackHole("Sgr A*")!, "en", en), "4.3 × 10⁶ (4.29 × 10⁶–4.31 × 10⁶) Suns");
  assert.equal(massText(blackHole("M87")!, "ja", ja), "6.5 × 10⁹ (5.8 × 10⁹–7.2 × 10⁹)太陽質量");
  assert.equal(massText(blackHole("XTE J1118+480")!, "en", en), "6.9–8.2 Suns");
  assert.equal(massText(blackHole("GS 1354-64")!, "en", en), "at least 7.6 Suns");
  assert.equal(massText(blackHole("MAXI J1744-294")!, "en", en), undefined);
  assert.equal(distanceText(blackHole("Cygnus X-1")!, "en", en), "7,200 (6,700–7,800) light-years");
  assert.equal(distanceText(blackHole("GX 339-4")!, "ja", ja), "少なくとも16,000光年");
  assert.equal(distanceText(blackHole("M87")!, "en", en), "54.8 million (52.5 million–57.4 million) light-years");
  assert.equal(distanceText(blackHole("M87")!, "ja", ja), "5480万 (5250万–5740万)光年");
  assert.equal(plainNumber(21.2, "en"), "21.2");
  assert.equal(plainNumber(6.5e9, "ja"), "6.5 × 10⁹");
  assert.equal(lightYearsText(8277, "en"), "27,000");
  assert.equal(placeText(blackHole("Cygnus X-1")!), "19h 58m 22s, +35° 12′ 06″");
  assert.equal(placeText(blackHole("Gaia BH1")!), "17h 28m 41s, −0° 34′ 52″");
  const papers = papersOf(blackHole("Cygnus X-1")!);
  assert.equal(papers.length, 3);
  assert.deepEqual(papers.find((p) => p.source.key === "Miller-Jones2021")!.facts, ["mass", "distance", "companion"]);
});

test("every word the black-hole card needs is in English and in Japanese, and every note the data carries has a Japanese twin", () => {
  const all = blackHoles();
  const keys = ["holes", "holeKind", "holeStellar", "holeQuiet", "holeSupermassive", "holeConfirmed", "holeCandidate", "fieldStatus", "fieldMass", "fieldPosition", "fieldCompanion", "fieldFound", "fieldYear", "fieldSources", "fieldMeasured", "suns", "atLeast", "atMost", "srcPosition", "srcMass", "srcDistance", "srcCompanion", "srcFound", "holeNoteProbable"];
  for (const found of new Set(all.map((b) => b.foundBy))) keys.push(`found-${found}`, `how-${found}`);
  for (const lang of ["en", "ja"] as const) {
    const words = WORDS[lang] as Record<string, string>;
    for (const key of keys) assert.ok(words[key] !== undefined && words[key] !== "", `${lang}: ${key}`);
  }
  // The English card shows the note from the data; the Japanese one needs a twin for each.
  const noted = all.filter((b) => b.note !== undefined && !b.note.startsWith("Not dynamically"));
  assert.ok(noted.length >= 8);
  for (const b of noted) assert.ok(((WORDS.ja as Record<string, string>)[`holeNote_${b.id}`] ?? "") !== "", `ja: holeNote_${b.id}`);
});
