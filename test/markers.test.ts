// The page's own markers: which a time range shows and how strongly, the order a track joins a group in, the span a slider covers, CSV in and out, and the chart: markers are drawn where their sky is,
// their names stand clear of the stars and of each other, a range hides what it should, a track joins in date order, and the same options draw the same SVG.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chartSvg, markerSpan, markersFromCsv, markersToCsv, markerTime, markerTracks, normaliseMarkers, visibleMarkers, type SkyMarker } from "../src/chart/index.ts";
import { chart, toScreen } from "../src/chart/chart.ts";
import { drawMarkers } from "../src/chart/markers-draw.ts";

const DAY = 86_400_000;
/** A fixed width a character, so the names are laid out the same on every machine. */
const measure = (text: string): number => text.length * 6;

const log: SkyMarker[] = [
  { id: "a", ra: 80, dec: 0, date: "2026-11-01", group: "Log" },
  { id: "b", ra: 84, dec: 2, date: "2026-11-05", group: "Log" },
  { id: "c", ra: 88, dec: 4, date: "2026-11-09", group: "Log" },
  { id: "d", ra: 90, dec: -3 },
];

test("a moment is read from an ISO text, milliseconds or a Date, and nothing else", () => {
  assert.equal(markerTime("2026-11-08"), Date.UTC(2026, 10, 8));
  assert.equal(markerTime(5), 5);
  assert.equal(markerTime(new Date(7)), 7);
  assert.equal(markerTime("not a date"), undefined);
  assert.equal(markerTime(""), undefined);
  assert.equal(markerTime(undefined), undefined);
  assert.equal(markerTime(new Date("nope")), undefined);
});

test("a time range shows the markers dated inside it, ends included, and every marker without a date", () => {
  const ids = (range?: Parameters<typeof visibleMarkers>[1]) => visibleMarkers(log, range).map((m) => m.id);
  assert.deepEqual(ids(), ["a", "b", "c", "d"]);
  assert.deepEqual(ids({ from: "2026-11-05", to: "2026-11-09" }), ["b", "c", "d"]);
  assert.deepEqual(ids({ from: "2026-11-02", to: "2026-11-08" }), ["b", "d"]);
  assert.deepEqual(ids({ to: "2026-11-01" }), ["a", "d"]);
  assert.deepEqual(ids({ from: "2026-11-10" }), ["d"]);
  assert.deepEqual(ids({ from: "2027-01-01", to: "2026-01-01" }), ["d"]);
});

test("a marker with no id answers to its place in the list, and one that cannot be placed is never shown", () => {
  const some: SkyMarker[] = [{ ra: 1, dec: 1 }, { ra: Number.NaN, dec: 1 }, { ra: 3, dec: Number.POSITIVE_INFINITY }, { id: "z", ra: 4, dec: 4 }];
  assert.deepEqual(visibleMarkers(some).map((m) => [m.id, m.index]), [["m0", 0], ["z", 3]]);
});

test("a fade brings a marker in from the edge of the range: faint at the edge, full a fade inside it", () => {
  const some: SkyMarker[] = [0, 0.5, 1, 2, 5, 8, 9, 10].map((day, i) => ({ id: `d${i}`, ra: 0, dec: 0, date: Date.UTC(2026, 0, 1) + day * DAY }));
  const seen = visibleMarkers(some, { from: Date.UTC(2026, 0, 1), to: Date.UTC(2026, 0, 11), fade: 2 });
  const opacity = Object.fromEntries(seen.map((m) => [m.id, m.opacity]));
  assert.equal(opacity["d0"], 0.2);
  assert.ok(opacity["d1"]! > 0.2 && opacity["d1"]! < 1);
  assert.equal(opacity["d3"], 1);
  assert.equal(opacity["d4"], 1);
  assert.equal(opacity["d7"], 0.2);
  assert.ok(Math.abs(opacity["d6"]! - (0.2 + 0.8 * 0.5)) < 1e-9);
  assert.equal(opacity["d5"], 1);
  // no fade, a clean cut: every shown marker is full
  assert.ok(visibleMarkers(some, { from: Date.UTC(2026, 0, 1), to: Date.UTC(2026, 0, 11) }).every((m) => m.opacity === 1));
  // a fade on one open end fades only the other
  const open = visibleMarkers(some, { from: Date.UTC(2026, 0, 1), fade: 2 });
  assert.equal(open.at(-1)!.opacity, 1);
  assert.equal(open[0]!.opacity, 0.2);
});

test("a track joins a group in date order, whatever order the markers were given in", () => {
  const some: SkyMarker[] = [
    { id: "late", ra: 3, dec: 3, date: "2026-11-03", group: "Comet" },
    { id: "early", ra: 1, dec: 1, date: "2026-11-01", group: "Comet" },
    { id: "mid", ra: 2, dec: 2, date: "2026-11-02", group: "Comet" },
    { id: "other", ra: 9, dec: 9, date: "2026-11-02", group: "Log" },
    { id: "undated", ra: 5, dec: 5, group: "Comet" },
  ];
  const tracks = markerTracks(visibleMarkers(some), true);
  assert.deepEqual(tracks.map((t) => [t.group, t.items.map((i) => i.id)]), [["Comet", ["early", "mid", "late"]]]);
  assert.deepEqual(markerTracks(visibleMarkers(some), ["Log"]), [], "a group of one has nothing to join");
  assert.deepEqual(markerTracks(visibleMarkers(some), ["Comet"]).map((t) => t.group), ["Comet"]);
  assert.deepEqual(markerTracks(visibleMarkers(some), false), []);
  assert.deepEqual(markerTracks(visibleMarkers(some), undefined), []);
});

test("the markers of one moment keep the order given, and a track follows the range", () => {
  const same: SkyMarker[] = [{ id: "x", ra: 1, dec: 1, date: 5 }, { id: "y", ra: 2, dec: 2, date: 5 }, { id: "z", ra: 3, dec: 3, date: 4 }];
  assert.deepEqual(markerTracks(visibleMarkers(same), true)[0]!.items.map((i) => i.id), ["z", "x", "y"]);
  assert.deepEqual(markerTracks(visibleMarkers(log, { to: "2026-11-05" }), true)[0]!.items.map((i) => i.id), ["a", "b"]);
  assert.deepEqual(markerTracks(visibleMarkers(log, { to: "2026-11-02" }), true), []);
});

test("the span of a slider runs from the first date to the last, and there is none without dates", () => {
  assert.deepEqual(markerSpan(log), { from: Date.UTC(2026, 10, 1), to: Date.UTC(2026, 10, 9) });
  assert.equal(markerSpan([{ ra: 0, dec: 0 }]), undefined);
  assert.equal(markerSpan([]), undefined);
});

test("markers read from a list are placed in range, and a row that cannot be read is dropped", () => {
  const got = normaliseMarkers([{ ra: "370", dec: 95, label: "A", size: "12", extra: 1 }, { ra: null, dec: 1 }, "no", null, { ra: 5, dec: -100, date: "", color: "" }, { ra: -10, dec: 0, id: 7 }]);
  assert.deepEqual(got, [{ ra: 10, dec: 90, label: "A", size: 12 }, { ra: 5, dec: -90 }, { ra: 350, dec: 0, id: "7" }]);
  assert.deepEqual(normaliseMarkers("not a list"), []);
});

test("CSV in and out: the same markers come back, with commas, quotes and line breaks inside a name", () => {
  const some: SkyMarker[] = [
    { id: "m42", ra: 83.82, dec: -5.39, date: "2026-11-08T21:30:00Z", label: 'M42, the "Orion" Nebula', color: "#ff8fb1", size: 12, group: "Log" },
    { ra: 10, dec: 20, label: "two\nlines" },
  ];
  const csv = markersToCsv(some);
  assert.ok(csv.startsWith("id,ra,dec,date,label,color,size,group\n"));
  assert.ok(csv.includes('"M42, the ""Orion"" Nebula"'));
  assert.deepEqual(markersFromCsv(csv), some);
  assert.deepEqual(markersFromCsv(csv.replace(/\n/g, "\r\n").replace("two\r\nlines", "two\nlines")), some);
  // columns in any order, extras ignored, a byte order mark and blank lines tolerated
  assert.deepEqual(markersFromCsv("﻿note,dec,ra\nx,1,2\n\n"), [{ ra: 2, dec: 1 }]);
  assert.deepEqual(markersFromCsv(""), []);
  assert.deepEqual(markersFromCsv("ra,dec\nnope,1\n3,4"), [{ ra: 3, dec: 4 }]);
  assert.equal(markersToCsv([{ ra: 1, dec: 2, date: new Date(Date.UTC(2026, 0, 2)) }]).split("\n")[1], ",1,2,2026-01-02T00:00:00.000Z,,,,");
});

const VIEW = { width: 640, height: 400, ra: 84, dec: 0, zoom: 4, measure } as const;

test("a marker is drawn where its sky is, as a dot with its id, and is a place a tap can land on", () => {
  const out = chart({ ...VIEW, projection: "stereographic", magnitude: 5, layers: new Set(), lang: "en", markers: [{ id: "here", ra: 84, dec: 0, label: "Here", color: "#123456", size: 14 }] });
  assert.equal(out.markerHits.length, 1);
  const hit = out.markerHits[0]!;
  const at = toScreen({ projection: "stereographic", ra: 84, dec: 0, zoom: 4 }, 640, 400, { rightAscension: 84, declination: 0 })!;
  assert.ok(Math.abs(hit.x - at[0]) < 1e-9 && Math.abs(hit.y - at[1]) < 1e-9);
  assert.equal(hit.r, 7);
  assert.ok(out.svg.includes('data-marker="here"'));
  assert.ok(out.svg.includes('fill="#123456"'));
  assert.ok(out.svg.includes(">Here</text>"));
});

test("a marker off the chart or on the far side is not drawn, and none are drawn in the sky seen from another star", () => {
  const far = chart({ ...VIEW, projection: "orthographic", magnitude: 5, layers: new Set(), lang: "en", markers: [{ id: "far", ra: 264, dec: 0 }, { id: "off", ra: 84 + 80, dec: 0 }] });
  assert.equal(far.markerHits.length, 0);
  const seen = chart({ ...VIEW, projection: "stereographic", magnitude: 5, layers: new Set(), lang: "en", sky: Object.assign([], { skipped: 0 }), markers: [{ id: "here", ra: 84, dec: 0 }] });
  assert.equal(seen.markerHits.length, 0);
});

test("the time range hides the markers outside it, in the chart and in the SVG string, and the same options draw the same SVG", () => {
  const options = { width: 640, height: 400, ra: 84, dec: 0, zoom: 3, measure, markers: log };
  const all = chartSvg(options);
  for (const id of ["a", "b", "c", "d"]) assert.ok(all.includes(`data-marker="${id}"`), id);
  const some = chartSvg({ ...options, timeRange: { from: "2026-11-04", to: "2026-11-06" } });
  assert.ok(some.includes('data-marker="b"') && some.includes('data-marker="d"'));
  assert.ok(!some.includes('data-marker="a"') && !some.includes('data-marker="c"'));
  assert.equal(chartSvg({ ...options, timeRange: { from: "2026-11-04", to: "2026-11-06" } }), some);
  assert.ok(!chartSvg({ ...options, markers: [] }).includes("data-marker"));
});

test("a track is one path through the group's markers in date order, drawn under the dots, and only for the groups asked for", () => {
  const options = { width: 640, height: 400, ra: 84, dec: 0, zoom: 3, measure, markers: [log[2]!, log[0]!, log[1]!, log[3]!], layers: [] } as const;
  assert.ok(!chartSvg(options).includes("data-track"));
  const joined = chartSvg({ ...options, tracks: true });
  const path = /data-track="Log" d="([^"]+)"/.exec(joined)![1]!;
  const points = path.match(/[ML][\d.-]+ [\d.-]+/g)!;
  assert.equal(points.length, 3);
  const at = (m: SkyMarker) => toScreen({ projection: "stereographic", ra: 84, dec: 0, zoom: 3 }, 640, 400, { rightAscension: m.ra, declination: m.dec })!.map((n) => n.toFixed(1)).join(" ");
  assert.deepEqual(points.map((p) => p.slice(1)), [at(log[0]!), at(log[1]!), at(log[2]!)]);
  assert.ok(joined.indexOf("data-track") < joined.indexOf("data-marker"));
  assert.ok(!chartSvg({ ...options, tracks: ["Comet"] }).includes("data-track"));
  assert.ok(chartSvg({ ...options, tracks: ["Log"] }).includes('data-track="Log"'));
  // the track follows the range: two markers still make a line, one does not
  assert.ok(chartSvg({ ...options, tracks: true, timeRange: { to: "2026-11-05" } }).includes("data-track"));
  assert.ok(!chartSvg({ ...options, tracks: true, timeRange: { to: "2026-11-02" } }).includes("data-track"));
});

test("a name keeps off the stars and the other names, and the stars' names keep off a marker's dot", () => {
  // Sirius sits at 101.29, -16.72; a marker named on it, and a crowd of markers about it
  const crowd: SkyMarker[] = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, ra: 101.29 + (i % 4) * 0.2, dec: -16.72 + Math.floor(i / 4) * 0.2, label: `Marker number ${i}` }));
  const out = chart({ width: 640, height: 400, ra: 101.29, dec: -16.72, zoom: 40, measure, projection: "stereographic", magnitude: 5, layers: new Set(["names"]), lang: "en", markers: crowd });
  const boxes = [...out.svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" text-anchor="(\w+)"[^>]*>([^<]*)<\/text>/g)].map((m) => {
    const w = m[4]!.length * 6;
    const x = Number(m[1]);
    const left = m[3] === "start" ? x : m[3] === "end" ? x - w : x - w / 2;
    return { text: m[4]!, x0: left, x1: left + w, y0: Number(m[2]) - 9, y1: Number(m[2]) + 3 };
  });
  assert.ok(boxes.some((b) => b.text.startsWith("Marker")), "some marker names are placed");
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      assert.ok(!(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1), `${a.text} and ${b.text} overlap`);
    }
  }
  // no name sits on a marker's dot
  for (const hit of out.markerHits) {
    for (const b of boxes) assert.ok(!(b.x0 < hit.x + hit.r && hit.x - hit.r < b.x1 && b.y0 < hit.y + hit.r && hit.y - hit.r < b.y1), `${b.text} covers a marker`);
  }
});

test("a marker's name keeps off a bright star and its own dot, and the markers' names are placed before the stars' names", () => {
  const withMarker = chart({ width: 640, height: 400, ra: 101.29, dec: -16.72, zoom: 12, measure, projection: "stereographic", magnitude: 5, layers: new Set(["names"]), lang: "en", markers: [{ id: "s", ra: 101.29, dec: -16.72, label: "Near Sirius" }] });
  const sirius = withMarker.hits.find((h) => h.kind === "star" && h.key === "2491")!;
  const text = [...withMarker.svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" text-anchor="(\w+)"[^>]*>([^<]*)<\/text>/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), anchor: m[3]!, text: m[4]! }));
  const mine = text.find((t) => t.text === "Near Sirius")!;
  assert.ok(mine, "the marker's name is drawn");
  const w = mine.text.length * 6;
  const left = mine.anchor === "start" ? mine.x : mine.anchor === "end" ? mine.x - w : mine.x - w / 2;
  const onStar = left < sirius.x + 4 && sirius.x - 4 < left + w && mine.y - 9 < sirius.y + 4 && sirius.y - 4 < mine.y + 3;
  assert.ok(!onStar, "its name is not on the star");
});

test("drawMarkers on its own: a marker without a name asks for none, and a colour with a quote cannot break the SVG", () => {
  const out = drawMarkers({ markers: [{ id: 'q"1', ra: 1, dec: 1, color: 'red" onload="x' }, { ra: 2, dec: 2, label: "A <b> & B" }], width: 100, height: 100, place: () => [50, 50], path: () => "", ground: "#000" });
  assert.equal(out.labels.length, 1);
  assert.ok(!out.dots.includes('onload="x'));
  assert.ok(out.dots.includes("&quot;"));
  assert.ok(out.dots.includes("<title>A &lt;b> &amp; B</title>"));
});
