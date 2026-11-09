// The printable sheets: the dots are numbered in drawing order and sized by brightness, the latitude rules are right for known places, the wheel's window is the horizon of its latitude, the sky map shows only what is up, and
// every page's text fits the room it is drawn for, on every paper.
import assert from "node:assert/strict";
import { test } from "node:test";
import { horizontal, localSiderealTime } from "../src/sky.ts";
import { starByName } from "../src/stars.ts";
import { PAGE_NAMES, TYPE_PRESETS, printableSize } from "@johnmorrisdotca/kazoku-ui/print";
import { constellations } from "../src/constellations.ts";
import { figureOf } from "../src/lines.ts";
import { TYPES, textWidth, wrap } from "../src/sheets/common.ts";
import { DOT_LEVELS, dotsFigure, dotsSvg } from "../src/sheets/dots.ts";
import { regionGuideSvg } from "../src/sheets/guide.ts";
import { skyMapSvg } from "../src/sheets/map.ts";
import { latitudeBand, monthName, skyForLatitude, sunRightAscension, whyFamous } from "../src/sheets/region.ts";
import { starWheelDisc, starWheelPlate, starWheelPoster } from "../src/sheets/wheel.ts";

const MM = 25.4 / 72;
const dottable = constellations().filter((c) => figureOf(c.abbreviation).segments.length > 0).map((c) => c.abbreviation);
const numbers = (svg: string, attribute: string): number[] => [...svg.matchAll(new RegExp(`${attribute}="(-?[\\d.]+)"`, "g"))].map((m) => Number(m[1]));
const texts = (svg: string): { x: number; y: number; size: number; anchor: string; body: string }[] =>
  [...svg.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)" font-size="([\d.]+)"([^>]*)>([^<]*)<\/text>/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), size: Number(m[3]), anchor: /text-anchor="(\w+)"/.exec(m[4]!)?.[1] ?? "start", body: m[5]! }));

test("the type sizes are kazoku-ui's kid and normal presets", () => {
  for (const name of ["kid", "normal"] as const) {
    const preset = TYPE_PRESETS[name];
    assert.deepEqual(
      { title: TYPES[name].titleMm, name: TYPES[name].nameMm, body: TYPES[name].bodyMm, small: TYPES[name].smallMm, line: TYPES[name].lineMm },
      { title: preset.titlePt * MM, name: preset.namePt * MM, body: preset.bodyPt * MM, small: preset.smallPt * MM, line: preset.lineMm },
    );
  }
});

test("every constellation with a figure makes a sheet at every level; the dots are numbered in drawing order and every number is used once", () => {
  assert.ok(dottable.length >= 80, `${dottable.length} figures`);
  for (const abbreviation of dottable) {
    for (const level of DOT_LEVELS) {
      const figure = dotsFigure(abbreviation, { level, widthMm: 184.6, heightMm: 170 });
      assert.ok(figure.dots.length >= 2, `${abbreviation} ${level}`);
      if (level === "hard") {
        assert.ok(figure.dots.every((d) => d.numbers.length === 0), `${abbreviation}: a hard sheet has no numbers`);
        continue;
      }
      const all = figure.dots.flatMap((d) => d.numbers).sort((a, b) => a - b);
      assert.deepEqual(all, Array.from({ length: figure.visits }, (_, i) => i + 1), `${abbreviation} ${level}: the numbers run 1 to ${figure.visits} once each`);
      // every line of the answer joins a number to the next one
      for (const [a, b] of figure.lines) {
        const joins = figure.dots[a]!.numbers.some((x) => figure.dots[b]!.numbers.includes(x + 1));
        assert.ok(joins, `${abbreviation} ${level}: a line does not join a number to the next`);
      }
      // a pencil lift is where the numbers go on without a line
      const lifts = figure.dots.filter((d) => d.ring).length;
      assert.ok(lifts <= figure.strokes - 1 && (figure.strokes === 1 || lifts >= 1), `${abbreviation} ${level}: a ring where each new line starts`);
      if (level === "easy") {
        assert.ok(figure.dots.length >= 2 && figure.dots.length <= 10, `${abbreviation}: easy has ${figure.dots.length} dots`);
        assert.ok(figure.dots.every((d) => d.numbers.length === 1) && figure.strokes === 1, `${abbreviation}: easy is one line through each star once`);
      }
    }
  }
});

test("the easy sheet of a famous figure joins its brightest stars, and medium joins all of them", () => {
  for (const abbreviation of ["Ori", "UMa", "Cas", "Cru"]) {
    const easy = dotsFigure(abbreviation, { level: "easy", widthMm: 180, heightMm: 150 });
    const medium = dotsFigure(abbreviation, { level: "medium", widthMm: 180, heightMm: 150 });
    const members = [...new Set(figureOf(abbreviation).segments.flat())];
    assert.equal(medium.dots.length, members.length, abbreviation);
    const faintestKept = Math.max(...easy.dots.map((d) => d.star.magnitude));
    const brightestLeft = Math.min(...members.filter((s) => !easy.dots.some((d) => d.star === s)).map((s) => s.magnitude), 99);
    assert.ok(faintestKept <= brightestLeft + 1e-9, `${abbreviation}: easy keeps the brightest`);
  }
});

test("the dots are inside the page, sized by brightness, and their numbers are inside the page and clear of the other dots", () => {
  for (const abbreviation of dottable) {
    const figure = dotsFigure(abbreviation, { level: "medium", widthMm: 184.6, heightMm: 170 });
    for (const dot of figure.dots) {
      assert.ok(dot.x - dot.r >= 0 && dot.x + dot.r <= 184.6 && dot.y - dot.r >= 0 && dot.y + dot.r <= 170, `${abbreviation}: a dot is off the page`);
      const w = textWidth(dot.numbers.join("·"), TYPES.kid.bodyMm);
      assert.ok(dot.label.x - w / 2 >= -0.5 && dot.label.x + w / 2 <= 185.1 && dot.label.y <= 171 && dot.label.y >= 0, `${abbreviation}: a number is off the page`);
    }
    const byBrightness = [...figure.dots].sort((a, b) => a.star.magnitude - b.star.magnitude);
    for (let i = 1; i < byBrightness.length; i += 1) assert.ok(byBrightness[i]!.r <= byBrightness[i - 1]!.r + 1e-9, `${abbreviation}: a fainter star is bigger`);
    assert.ok(figure.dots.every((d) => d.r >= 3 && d.r <= 7), "dots 3 to 7 mm");
  }
});

test("an answer page has the lines 3 mm thick and a puzzle page has none", () => {
  const puzzle = dotsSvg("Cas", { level: "medium", widthMm: 184.6, heightMm: 170, lang: "en" });
  const answer = dotsSvg("Cas", { level: "medium", widthMm: 184.6, heightMm: 170, lang: "en", answer: true });
  assert.ok(!puzzle.includes("data-line"));
  assert.ok(numbers(answer, "stroke-width").includes(3));
  assert.ok(answer.includes("Here is Cassiopeia"));
  assert.ok(dotsSvg("Cas", { level: "hard", widthMm: 184.6, heightMm: 170, lang: "ja" }).includes("ほしを みつけて"));
});

test("known places: Ursa Minor is never seen from Sydney, the Southern Cross never from Toronto, Orion from both, the Big Dipper is always up in Toronto", () => {
  const at = (lat: number, abbreviation: string) => skyForLatitude(lat).find((e) => e.constellation.abbreviation === abbreviation)!;
  assert.equal(at(-33.9, "UMi").standing, "never");
  assert.equal(at(43.7, "Cru").standing, "never");
  assert.notEqual(at(43.7, "Ori").standing, "never");
  assert.notEqual(at(-33.9, "Ori").standing, "never");
  assert.equal(at(43.7, "UMa").standing, "always");
  assert.equal(at(-33.9, "Cru").standing, "always");
  assert.equal(at(43.7, "UMi").standing, "always");
  assert.equal(skyForLatitude(0).filter((e) => e.standing === "always").length, 0, "nothing is always up on the equator");
  assert.equal(skyForLatitude(0).filter((e) => e.standing === "never").length, 0, "nothing is never up on the equator");
  assert.equal(skyForLatitude(60, 7).some((e) => e.constellation.abbreviation === "Cru"), false);
});

test("the evening sky of the months: Orion is high in the northern winter, Scorpius in the summer, the Big Dipper in the spring", () => {
  const best = (lat: number, abbreviation: string) => skyForLatitude(lat).find((e) => e.constellation.abbreviation === abbreviation)!.bestMonth;
  assert.ok([12, 1, 2].includes(best(40, "Ori")), `Orion ${best(40, "Ori")}`);
  assert.ok([6, 7, 8].includes(best(40, "Sco")), `Scorpius ${best(40, "Sco")}`);
  assert.ok([3, 4, 5].includes(best(40, "UMa")), `Ursa Major ${best(40, "UMa")}`);
  assert.ok(skyForLatitude(40, 1).some((e) => e.constellation.abbreviation === "Ori"));
  assert.ok(!skyForLatitude(40, 7).some((e) => e.constellation.abbreviation === "Ori"));
  assert.throws(() => skyForLatitude(91), RangeError);
  assert.throws(() => skyForLatitude(40, 13), RangeError);
  // the Sun's right ascension: 0 near the March equinox, 90 at the June solstice, 180 at September's, 270 at December's
  for (const [month, day, ra] of [[3, 20, 0], [6, 21, 90], [9, 22, 180], [12, 21, 270]] as const) assert.ok(Math.abs(((sunRightAscension(month, day) - ra + 540) % 360) - 180) < 2, `${month}/${day}`);
});

test("names: months, latitude bands and the notes on a few famous constellations", () => {
  assert.equal(monthName(11, "en"), "November");
  assert.equal(monthName(11, "ja"), "11がつ");
  assert.equal(latitudeBand(43.7, "en"), "40° to 50° N");
  assert.equal(latitudeBand(-33.9, "en"), "30° to 40° S");
  assert.equal(latitudeBand(-33.9, "ja"), "みなみ 30〜40ど");
  assert.ok(whyFamous("Cru", "en")!.includes("flags"));
  assert.equal(whyFamous("Aqr"), undefined);
});

const circles = (svg: string, tag: string): { cx: number; cy: number; r: number }[] => [...svg.matchAll(new RegExp(`<circle cx="(-?[\\d.]+)" cy="(-?[\\d.]+)" r="([\\d.]+)"[^>]*${tag}`, "g"))].map((m) => ({ cx: Number(m[1]), cy: Number(m[2]), r: Number(m[3]) }));

test("the wheel's window is the horizon of its latitude: a circle of radius 1/sin(lat) whose centre is cot(lat) from the pole, touching the ring at the south and the pole's far side", () => {
  for (const latitude of [20, 35, 45, 52, 65, 70, -35, -45]) {
    const plate = starWheelPlate(latitude, { widthMm: 184.6, heightMm: 195, lang: "en" });
    const window = circles(plate, 'data-cut="window"')[0]!;
    const edge = circles(plate, 'data-cut="plate"')[0]!;
    const pole = circles(plate, 'data-pin=""')[0]!;
    const phi = (Math.abs(latitude) * Math.PI) / 180;
    assert.ok(Math.abs(pole.cx - edge.cx) < 0.02 && Math.abs(pole.cy - edge.cy) < 0.02, "the pin is at the middle");
    const offset = pole.cy - window.cy;
    assert.ok(Math.abs(offset / window.r - Math.cos(phi)) < 0.005, `${latitude}: centre offset / radius = cos(lat)`);
    const ring = edge.r - (latitude === 0 ? 0 : 12);
    // the far end of the window reaches the inner ring: cot(lat/2) in the units where the radius is 1/sin(lat)
    assert.ok(Math.abs(offset + window.r - ring) < 0.05, `${latitude}: the window reaches the ring (${(offset + window.r).toFixed(2)} vs ${ring.toFixed(2)})`);
    assert.ok(window.r > offset - 0.01 && window.r - offset > 0, "the pole is inside the window");
  }
});

test("the plate: 12 at the top, the later hours to the left in the north and the right in the south; N at the bottom in the north, S at the bottom in the south", () => {
  for (const [latitude, left] of [[45, 14], [-45, 10]] as const) {
    const plate = starWheelPlate(latitude, { widthMm: 184.6, heightMm: 195, lang: "en" });
    const labels = [...plate.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"[^>]*data-hour="(\d+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), hour: Number(m[3]) }));
    const twelve = labels.find((l) => l.hour === 12)!;
    const other = labels.find((l) => l.hour === left)!;
    assert.ok(labels.find((l) => l.hour === 0)!.y > twelve.y + 100, "midnight is at the bottom");
    assert.ok(Math.abs(twelve.x - 92.3) < 0.5, "noon is at the top middle");
    assert.ok(other.x < twelve.x, `${latitude}: hour ${left} is on the left (the later hours are on the ${latitude > 0 ? "left" : "right"})`);
    const bottom = [...plate.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"[^>]*data-direction="(\w+)"/g)].map((m) => ({ y: Number(m[2]), direction: m[3] }));
    const lowest = bottom.sort((a, b) => b.y - a.y)[0]!;
    assert.equal(lowest.direction, latitude > 0 ? "north" : "south");
  }
});

test("the disc: the ring of dates, the stars and the figures, a disc that fits the page, and the same disc for any latitude moved to 20 to 70", () => {
  const disc = starWheelDisc(45, { widthMm: 184.6, heightMm: 195, lang: "en" });
  for (let month = 1; month <= 12; month += 1) assert.ok(disc.includes(`data-month="${month}"`), `month ${month}`);
  const edge = circles(disc, 'data-cut="disc"')[0]!;
  assert.ok(edge.cx - edge.r >= 0 && edge.cx + edge.r <= 184.6 && edge.cy - edge.r >= 0 && edge.cy + edge.r <= 195, "the disc is on the page");
  assert.ok(edge.r * 2 >= 150, "and large");
  assert.ok((disc.match(/<circle /g) ?? []).length > 150, "stars");
  assert.equal(starWheelDisc(5, { widthMm: 184.6, heightMm: 195 }), starWheelDisc(20, { widthMm: 184.6, heightMm: 195 }));
  assert.throws(() => starWheelDisc(120, { widthMm: 1, heightMm: 1 }), RangeError);
  assert.ok(starWheelDisc(45, { widthMm: 184.6, heightMm: 195, type: "normal" }).length > disc.length, "the normal type draws more stars");
});

test("the poster has the disc and the plate side by side at the size asked", () => {
  const poster = starWheelPoster(50, { diameterMm: 400 });
  assert.equal(poster.widthMm, 810);
  assert.equal(poster.heightMm, 406);
  assert.ok(poster.svg.includes('data-cut="disc"') && poster.svg.includes('data-cut="plate"'));
});

test("the sky map shows only what is above the horizon: Ursa Minor from Toronto but not from Sydney, the Southern Cross the other way", () => {
  const names = (svg: string): string[] => [...svg.matchAll(/data-name="(\w+)"/g)].map((m) => m[1]!);
  const options = { widthMm: 184.6, heightMm: 195, lang: "en" as const, type: "normal" as const };
  assert.ok(names(skyMapSvg(43.7, 7, options)).includes("UMi") || skyMapSvg(43.7, 7, options).includes("data-horizon"), "the map draws");
  assert.ok(!names(skyMapSvg(-33.9, 7, options)).includes("UMi"));
  assert.ok(!names(skyMapSvg(43.7, 7, options)).includes("Cru"));
  const sydney = skyMapSvg(-33.9, 7, { ...options, type: "kid" });
  assert.ok(sydney.includes("Face north"), "the southern note");
  assert.ok(skyMapSvg(43.7, 11, { ...options, type: "kid" }).includes("Face south"));
  assert.ok(skyMapSvg(43.7, 11, options).includes("November"));
  const map = skyMapSvg(43.7, 1, options);
  const horizon = circles(map, 'data-horizon=""')[0]!;
  const stars = [...map.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="[\d.]+" fill="#000"\/>/g)].map((m) => Math.hypot(Number(m[1]) - horizon.cx, Number(m[2]) - horizon.cy));
  assert.ok(stars.length > 100 && stars.every((d) => d <= horizon.r + 0.01), "every star is inside the horizon");
  assert.throws(() => skyMapSvg(43.7, 0, options), RangeError);
});

test("the guide lists what is always up, what is best this month and what is never seen, with a figure for each", () => {
  const sydney = regionGuideSvg(-33.9, 7, { widthMm: 184.6, heightMm: 150, lang: "en" });
  assert.ok(sydney.includes('data-thumb="Cru"') && !sydney.includes('data-thumb="UMi"'), "Crux in the guide, Ursa Minor not");
  assert.ok(sydney.includes("Always up here") && sydney.includes("Best in July evenings") && sydney.includes("Never seen from here"));
  assert.ok(sydney.includes("Ursa Minor"), "the never list names Ursa Minor");
  const equator = regionGuideSvg(0, 3, { widthMm: 184.6, heightMm: 150, lang: "ja" });
  assert.ok(equator.includes("ここでは どの ほしざも のぼって しずみます"));
});

test("a sentence wraps and never runs past the width", () => {
  for (const line of wrap("The sky at about 9 in the evening in January. North is at the top.", 80, 6.35)) assert.ok(textWidth(line, 6.35) <= 80, line);
  for (const line of wrap("はじめは きたを むいて みます。ふちに ひづけが あります。", 60, 6.35)) assert.ok(textWidth(line, 6.35) <= 60, line);
});

test("every page's text fits its room on every paper, in both languages and both types, with type no smaller than the preset", () => {
  for (const page of PAGE_NAMES) {
    const size = printableSize(page, "portrait");
    const room = { widthMm: size.widthMm, heightMm: size.heightMm - 89 };
    for (const lang of ["en", "ja"] as const) {
      for (const type of ["kid", "normal"] as const) {
        const pages = [
          dotsSvg("Ori", { level: "medium", ...room, lang, type }),
          dotsSvg("Cru", { level: "hard", ...room, lang, type, answer: true }),
          regionGuideSvg(35, 4, { ...room, lang, type }),
          starWheelDisc(40, { ...room, lang, type }),
          starWheelPlate(-40, { ...room, lang, type }),
          skyMapSvg(50, 12, { ...room, lang, type }),
        ];
        for (const svg of pages) {
          assert.ok(svg.includes(`viewBox="0 0 ${Math.round(room.widthMm * 100) / 100} ${Math.round(room.heightMm * 100) / 100}"`), `${page}: the viewBox is the room`);
          assert.ok(!/NaN|undefined|Infinity/.test(svg));
          for (const line of texts(svg)) {
            const width = textWidth(line.body, line.size);
            const left = line.anchor === "middle" ? line.x - width / 2 : line.anchor === "end" ? line.x - width : line.x;
            assert.ok(left >= -0.01 && left + width <= room.widthMm + 0.01, `${page} ${lang} ${type}: "${line.body}" runs out of the room (${left.toFixed(1)} + ${width.toFixed(1)} of ${room.widthMm})`);
            assert.ok(line.y <= room.heightMm + 0.5 && line.y >= 0, `${page} ${lang} ${type}: "${line.body}" is outside the room (y ${line.y})`);
          }
        }
      }
    }
  }
});

/** Turn the printed wheel as a hand would: the disc's date tick onto the plate's hour tick, then read where each star lands on the plate. */
function turned(latitude: number, month: number, day: number, hour: number, names: string[]): { name: string; hourAngle: number; declination: number }[] {
  const room = { widthMm: 184.6, heightMm: 195 };
  const disc = starWheelDisc(latitude, { ...room, lang: "en" });
  const plate = starWheelPlate(latitude, { ...room, lang: "en" });
  const pin = circles(disc, 'data-pin=""')[0]!;
  const north = latitude >= 0;
  const angle = (x: number, y: number): number => (Math.atan2(x - pin.cx, -(y - pin.cy)) * 180) / Math.PI;
  const date = new RegExp(`<line x1="[\\d.-]+" y1="[\\d.-]+" x2="([\\d.-]+)" y2="([\\d.-]+)"[^>]*data-date="${month}-${day}"`).exec(disc)!;
  const tick = new RegExp(`<line x1="[\\d.-]+" y1="[\\d.-]+" x2="([\\d.-]+)" y2="([\\d.-]+)"[^>]*data-hour-tick="${hour}"`).exec(plate)!;
  const turn = angle(Number(tick[1]), Number(tick[2])) - angle(Number(date[1]), Number(date[2]));
  const k = circles(disc, 'data-equator=""')[0]!.r;
  return names.map((name) => {
    const star = starByName(name)!;
    const found = new RegExp(`<circle cx="([\\d.-]+)" cy="([\\d.-]+)" r="[\\d.]+" fill="#000" data-hr="${star.hr}"`).exec(disc)!;
    const x = Number(found[1]);
    const y = Number(found[2]);
    const onPlate = angle(x, y) + turn;
    const r = Math.hypot(x - pin.cx, y - pin.cy);
    const p = (2 * Math.atan(r / k) * 180) / Math.PI;
    const wrap = (v: number): number => ((((v + 180) % 360) + 360) % 360) - 180;
    return { name, hourAngle: wrap(north ? -onPlate : onPlate), declination: north ? 90 - p : p - 90 };
  });
}

test("the turned wheel matches the real sky: for Toronto and for Sydney on a January evening the stars' hour angles and declinations read off the plate are the sky's, within the mean Sun's error", () => {
  const names = ["Sirius", "Betelgeuse", "Vega", "Arcturus", "Capella", "Rigel", "Altair"];
  for (const [latitude, longitude, label] of [[43.7, -79.4, "Toronto"], [-33.9, 151.2, "Sydney"]] as const) {
    // 21:00 by the mean Sun on 10 January (the date tick the wheel has), as UTC for that longitude
    const when = Date.UTC(2026, 0, 10, 21) - (longitude / 15) * 3_600_000;
    const lst = localSiderealTime(when, longitude);
    for (const read of turned(latitude, 1, 10, 21, names)) {
      const star = starByName(read.name)!;
      const real = ((((lst - star.rightAscension + 180) % 360) + 360) % 360) - 180;
      assert.ok(Math.abs(read.declination - star.declination) < 1, `${label} ${read.name}: declination ${read.declination.toFixed(1)} vs ${star.declination.toFixed(1)}`);
      assert.ok(Math.abs(read.hourAngle - real) < 5, `${label} ${read.name}: hour angle ${read.hourAngle.toFixed(1)} on the wheel, ${real.toFixed(1)} in the sky`);
      // so it is on the right side of the meridian, and as high as the sky has it, within a few degrees
      const sky = horizontal({ rightAscension: star.rightAscension, declination: star.declination }, { latitude, longitude }, when);
      const h = (read.hourAngle * Math.PI) / 180;
      const phi = (latitude * Math.PI) / 180;
      const d = (read.declination * Math.PI) / 180;
      const altitude = (Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h)) * 180) / Math.PI;
      assert.ok(Math.abs(altitude - sky.altitude) < 5, `${label} ${read.name}: altitude ${altitude.toFixed(1)} vs ${sky.altitude.toFixed(1)}`);
      assert.equal(read.hourAngle < 0, Math.sin((sky.azimuth * Math.PI) / 180) > 0, `${label} ${read.name}: east or west of the meridian`);
    }
  }
});
