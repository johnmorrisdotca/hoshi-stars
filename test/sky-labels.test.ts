// Names on the brightest stars and faint constellation lines for a sky the page draws itself: choosing the brightest in view, a body that covers stars, a name never leaves the view or lies on another,
// the strength is held to 0 up to 1, the figure under the pointer is the only one at full strength, the attributes are read as text, a look is a setting, and nothing is on until asked.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampStrength,
  CONSTELLATION_LINES_ATTRIBUTE,
  createFigureLines,
  createStarNames,
  DEFAULT_LABEL_STYLE,
  DEFAULT_LINE_STRENGTH,
  discCover,
  LABEL_SIDES,
  LABEL_STYLE_PROPERTIES,
  labelHeight,
  labelStyle,
  labelStyleFrom,
  labelStyleVars,
  labelText,
  labelWidth,
  lineStrengthFromAttribute,
  placeLabel,
  STAR_NAMES_ATTRIBUTES,
  starNamesFromAttributes,
  type ScreenPoint,
  type SkyProjector,
  type StarNameLabel,
} from "../src/sky-labels.ts";
import { stars } from "../src/stars.ts";

/** A flat sky 8 pixels to the degree, Orion's belt in the middle of 1280 by 720; stars more than 80 degrees from it in right ascension are behind the camera. */
const project: SkyProjector = (ra, dec, out) => {
  const across = ((ra - 84 + 540) % 360) - 180;
  out.x = 640 - across * 8;
  out.y = 360 - dec * 8;
  return Math.abs(across) < 80;
};
const VIEW = { width: 1280, height: 720 };

const inView = (): Array<{ name: string; hr: number; magnitude: number; x: number; y: number }> => {
  const spot: ScreenPoint = { x: 0, y: 0 };
  return stars()
    .filter((star) => star.name !== undefined)
    .filter((star) => project(star.rightAscension, star.declination, spot) && spot.x >= 0 && spot.x <= VIEW.width && spot.y >= 0 && spot.y <= VIEW.height)
    .map((star) => ({ name: star.name!, hr: star.hr, magnitude: star.magnitude, x: spot.x, y: spot.y }))
    .sort((a, b) => a.magnitude - b.magnitude);
};

test("nothing is named until a count or a magnitude is asked for", () => {
  const names = createStarNames();
  assert.equal(names.update(project, VIEW), 0);
  assert.equal(names.labels.length, 0);
  assert.equal(starNamesFromAttributes(null, null), undefined);
  assert.equal(starNamesFromAttributes(undefined, undefined), undefined);
});

test("a count names the brightest stars in view, and a star out of view does not count", () => {
  const names = createStarNames({ count: 3 });
  assert.equal(names.update(project, VIEW), 3);
  assert.deepEqual(names.labels.map((label) => label.text), ["Sirius", "Rigel", "Procyon"]);
  const every = inView();
  assert.ok(every.length > 10);
  const more = createStarNames({ count: every.length });
  more.update(project, VIEW);
  assert.ok(more.labels.every((label) => every.some((one) => one.hr === label.hr)));
  assert.ok(!more.labels.some((label) => label.text === "Arcturus" || label.text === "Canopus" || label.text === "Capella"), "Arcturus is 130 degrees away, Canopus is 52 degrees south and Capella above the top");
});

test("a magnitude limit names only stars that bright, and with a count the two limits both hold", () => {
  const names = createStarNames({ magnitude: 0.5 });
  names.update(project, VIEW);
  assert.ok(names.labels.length >= 3);
  assert.ok(names.labels.every((label) => label.magnitude <= 0.5));
  assert.deepEqual(names.labels.map((label) => label.hr), inView().filter((one) => one.magnitude <= 0.5).map((one) => one.hr).slice(0, names.labels.length));
  const both = createStarNames({ magnitude: 0.5, count: 2 });
  assert.equal(both.update(project, VIEW), 2);
  const tight = createStarNames({ magnitude: -2, count: 5 });
  assert.equal(tight.update(project, VIEW), 0);
});

test("a body that covers part of the sky hides the names behind it, and the next stars take their place", () => {
  const plain = createStarNames({ count: 3 });
  plain.update(project, VIEW);
  const sirius = plain.labels[0]!;
  const covered = createStarNames({ count: 3 });
  covered.update(project, VIEW, discCover(sirius.x, sirius.y, 20));
  assert.equal(covered.labels.length, 3);
  assert.ok(!covered.labels.some((label) => label.text === "Sirius"));
  assert.deepEqual(covered.labels.map((label) => label.text), ["Rigel", "Procyon", "Betelgeuse"]);
  const everything = createStarNames({ count: 20 });
  assert.equal(everything.update(project, VIEW, () => true), 0);
});

test("a mask covers a whole name's room, not only its star", () => {
  const plain = createStarNames({ count: 1 });
  plain.update(project, VIEW);
  const first = plain.labels[0]!;
  const middle = (first.x0 + first.x1) / 2;
  const names = createStarNames({ count: 1 });
  names.update(project, VIEW, (x, y) => Math.abs(x - middle) < 2 && Math.abs(y - (first.y0 + first.y1) / 2) < 2);
  const moved = names.labels[0]!;
  assert.ok(moved.hr !== first.hr || moved.x0 !== first.x0, "the name is set elsewhere, or the next star is named");
  assert.ok(!(moved.x0 <= middle && middle <= moved.x1 && moved.y0 <= (first.y0 + first.y1) / 2 && (first.y0 + first.y1) / 2 <= moved.y1), "and it is not over the mask");
});

test("a disc covers a point inside it and none outside it", () => {
  const earth = discCover(100, 100, 50);
  assert.equal(earth(100, 140), true);
  assert.equal(earth(100, 150), true);
  assert.equal(earth(100, 151), false);
  assert.equal(earth(0, 0), false);
});

test("every name lies wholly inside the view, none on another", () => {
  for (const view of [VIEW, { width: 320, height: 240 }, { width: 700, height: 300, margin: 20 }]) {
    const names = createStarNames({ count: 60, style: { leader: 18, size: 14 } });
    names.update(project, view);
    const margin = "margin" in view ? view.margin : 4;
    assert.ok(names.labels.length > 0);
    for (const label of names.labels) {
      assert.ok(label.x0 >= margin && label.x1 <= view.width - margin && label.y0 >= margin && label.y1 <= view.height - margin, `${label.text} is inside`);
    }
    for (let i = 0; i < names.labels.length; i += 1) {
      for (let j = i + 1; j < names.labels.length; j += 1) {
        const a = names.labels[i]!;
        const b = names.labels[j]!;
        assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, `${a.text} and ${b.text} do not touch`);
      }
    }
  }
});

test("a name goes on the side asked for, and a side that leaves the view does not fit", () => {
  const style = labelStyle({ size: 12 });
  const view = { width: 400, height: 300 };
  const out = {} as StarNameLabel;
  const width = labelWidth("Rigel", style);
  assert.equal(placeLabel(100, 100, width, style, view, out), true);
  assert.equal(out.anchor, "start");
  assert.equal(placeLabel(360, 100, width, style, view, out), false, "no room on the right of a star near the right edge");
  assert.equal(placeLabel(360, 100, width, style, view, out, false, "left"), true);
  assert.equal(out.anchor, "end");
  assert.equal(out.textX, out.x1);
  assert.equal(placeLabel(200, 100, width, style, view, out, false, "above"), true);
  assert.equal(out.anchor, "middle");
  assert.ok(out.y1 <= 100 - style.ring && Math.abs((out.x0 + out.x1) / 2 - 200) < 1e-9, "centred over the star, clear of its ring");
  assert.equal(placeLabel(200, 100, width, style, view, out, false, "below"), true);
  assert.ok(out.y0 >= 100 + style.ring);
  assert.equal(placeLabel(200, 2, width, style, view, out, false, "above"), false, "above the top edge");
  assert.equal(placeLabel(30, 100, width, style, { width: 60, height: 300 }, out), false);
  assert.equal(placeLabel(30, 100, width, style, { width: 60, height: 300 }, out, false, "left"), false, "a name 33 pixels wide has no room either side of a star in a view 60 pixels wide");
  assert.deepEqual([...LABEL_SIDES], ["right", "left", "above", "below"]);
});

/** Orion's belt, Alnitak, Alnilam and Mintaka, a degree and a half apart, at `pixels` to the degree: where no name may lie on another or cover a star. */
function belt(pixels: number) {
  const centre = { ra: 84.05, dec: -1.2 };
  const here: SkyProjector = (ra, dec, out) => {
    out.x = 400 - (ra - centre.ra) * pixels;
    out.y = 300 - (dec - centre.dec) * pixels;
    return Math.abs(ra - centre.ra) < 60;
  };
  const names = createStarNames({ count: 60 });
  names.update(here, { width: 800, height: 600 });
  const dots: Array<{ hr: number; x: number; y: number }> = [];
  const spot: ScreenPoint = { x: 0, y: 0 };
  for (const star of stars()) if (star.magnitude <= 3 && here(star.rightAscension, star.declination, spot)) dots.push({ hr: star.hr, x: spot.x, y: spot.y });
  return { names: names.labels, dots };
}

test("in Orion's belt no two names overlap and none covers a star's dot, at any zoom", () => {
  for (const pixels of [4, 8, 12, 20, 40, 80]) {
    const { names, dots } = belt(pixels);
    for (let i = 0; i < names.length; i += 1) {
      const a = names[i]!;
      for (let j = i + 1; j < names.length; j += 1) {
        const b = names[j]!;
        assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, `${a.text} and ${b.text} overlap at ${pixels} px a degree`);
      }
      for (const dot of dots) {
        if (dot.hr === a.hr) continue;
        const dx = dot.x < a.x0 ? a.x0 - dot.x : dot.x > a.x1 ? dot.x - a.x1 : 0;
        const dy = dot.y < a.y0 ? a.y0 - dot.y : dot.y > a.y1 ? dot.y - a.y1 : 0;
        assert.ok(dx * dx + dy * dy >= 9, `${a.text} covers the dot of star ${dot.hr} at ${pixels} px a degree`);
      }
    }
  }
});

test("in Orion's belt the names take other sides when the right is taken, and a name with no free place is left out", () => {
  const wide = belt(80).names.map((label) => label.text);
  assert.ok(["Alnitak", "Alnilam", "Mintaka"].every((name) => wide.includes(name)), "far enough in, all three are named");
  const sides = new Set(belt(20).names.filter((label) => ["Alnitak", "Alnilam", "Mintaka"].includes(label.text)).map((label) => label.anchor));
  assert.ok(sides.size >= 2, "at 20 px a degree the three names do not all take the right side");
  const tight = belt(8).names.map((label) => label.text);
  assert.ok(!tight.includes("Alnilam") && tight.includes("Alnitak") && tight.includes("Mintaka"), "at 8 px a degree Alnilam, boxed in by its two neighbours' dots, has no free place and is left out");
});

test("the names come in Japanese, in katakana, with the English where a star has none", () => {
  const names = createStarNames({ count: 2, lang: "ja" });
  names.update(project, VIEW);
  assert.deepEqual(names.labels.map((label) => label.text), ["シリウス", "リゲル"]);
});

test("update reuses the same objects, so a page that moves allocates nothing", () => {
  const names = createStarNames({ count: 5 });
  names.update(project, VIEW);
  const labels = names.labels;
  const first = names.labels[0]!;
  names.update(project, VIEW);
  assert.equal(names.labels, labels);
  assert.equal(names.labels[0], first);
});

test("settings change what is named, and a bad number is held to its range", () => {
  const names = createStarNames({ count: 2 });
  names.update(project, VIEW);
  assert.equal(names.labels.length, 2);
  names.set({ count: 5, style: { case: "upper" } });
  names.update(project, VIEW);
  assert.equal(names.labels.length, 5);
  assert.equal(names.labels[0]!.text, "SIRIUS");
  names.set({});
  assert.equal(names.update(project, VIEW), 0);
});

test("the two names attributes are read as text", () => {
  assert.deepEqual([STAR_NAMES_ATTRIBUTES.count, STAR_NAMES_ATTRIBUTES.magnitude], ["star-names", "star-names-magnitude"]);
  assert.deepEqual(starNamesFromAttributes("12", null), { count: 12 });
  assert.deepEqual(starNamesFromAttributes("", null), { count: 10 });
  assert.deepEqual(starNamesFromAttributes(null, "1.5"), { magnitude: 1.5 });
  assert.deepEqual(starNamesFromAttributes("8", "2"), { count: 8, magnitude: 2 });
  assert.deepEqual(starNamesFromAttributes("12.9", null), { count: 12 });
  assert.equal(starNamesFromAttributes("0", null), undefined);
  assert.equal(starNamesFromAttributes("-3", null), undefined);
  assert.equal(starNamesFromAttributes("many", " "), undefined);
  assert.equal(starNamesFromAttributes("100000", null)!.count, 335);
  assert.equal(starNamesFromAttributes(null, "99")!.magnitude, 7);
});

test("the strength is held to 0 up to 1 and a number that is not a number is the default", () => {
  assert.equal(clampStrength(3), 1);
  assert.equal(clampStrength(-1), 0);
  assert.equal(clampStrength(0.35), 0.35);
  assert.equal(clampStrength(Number.NaN), DEFAULT_LINE_STRENGTH);
  assert.equal(clampStrength("0.5"), DEFAULT_LINE_STRENGTH);
  assert.equal(clampStrength(undefined, 0.4), 0.4);
  assert.equal(DEFAULT_LINE_STRENGTH, 0.16);
  assert.equal(createFigureLines({ strength: 7 }).settings.strength, 1);
  assert.equal(createFigureLines({ strength: -7 }).settings.strength, 0);
  assert.equal(createFigureLines().settings.strength, 0.16);
});

test("the lines attribute is off when missing, zero or off, the default when bare, and a number held to 0 up to 1", () => {
  assert.equal(CONSTELLATION_LINES_ATTRIBUTE, "constellation-lines");
  assert.equal(lineStrengthFromAttribute(null), undefined);
  assert.equal(lineStrengthFromAttribute(undefined), undefined);
  assert.equal(lineStrengthFromAttribute(""), 0.16);
  assert.equal(lineStrengthFromAttribute("0.3"), 0.3);
  assert.equal(lineStrengthFromAttribute("5"), 1);
  assert.equal(lineStrengthFromAttribute("0"), undefined);
  assert.equal(lineStrengthFromAttribute("-1"), undefined);
  assert.equal(lineStrengthFromAttribute("off"), undefined);
  assert.equal(lineStrengthFromAttribute("false"), undefined);
  assert.equal(lineStrengthFromAttribute("loud"), undefined);
});

function orionLines(options: Parameters<typeof createFigureLines>[0] = { strength: 0.2 }) {
  const lines = createFigureLines(options);
  lines.update(project, VIEW);
  return lines;
}

test("the lines of every figure in view are laid out, and the strength is for all but the figure under the pointer", () => {
  const lines = orionLines();
  assert.ok(lines.count > 20);
  const drawn = lines.figures.filter((figure) => figure.end > figure.start);
  assert.ok(drawn.length >= 5 && drawn.length < 88);
  assert.ok(drawn.some((figure) => figure.abbreviation === "Ori"));
  assert.ok(lines.figures.filter((figure) => figure.abbreviation === "UMi")[0]!.end === lines.figures.filter((figure) => figure.abbreviation === "UMi")[0]!.start, "the Little Bear is out of view");
  for (const figure of lines.figures) assert.equal(lines.opacityOf(figure), 0.2);
  assert.equal(lines.picked, undefined);
  assert.equal(lines.name, undefined);
  assert.equal(lines.segments.length >= lines.count * 4, true);
});

test("the pointer on a line raises that figure alone to full strength and shows its name", () => {
  const lines = orionLines();
  const orion = lines.figures.find((figure) => figure.abbreviation === "Ori")!;
  const at = orion.start * 4;
  const x = (lines.segments[at]! + lines.segments[at + 2]!) / 2;
  const y = (lines.segments[at + 1]! + lines.segments[at + 3]!) / 2;
  assert.equal(lines.point(x, y + 3), true, "the pick changed, so draw once");
  assert.equal(lines.picked, orion);
  assert.equal(lines.opacityOf(orion), 1);
  assert.equal(lines.figures.filter((figure) => lines.opacityOf(figure) === 1).length, 1);
  assert.ok(lines.figures.filter((figure) => figure !== orion).every((figure) => lines.opacityOf(figure) === 0.2));
  assert.equal(lines.name!.text, "Orion");
  assert.ok(lines.name!.x > 0 && lines.name!.x < VIEW.width && lines.name!.y > 0 && lines.name!.y < VIEW.height);
  assert.equal(lines.point(x + 1, y + 3), false, "the same figure again changes nothing, so nothing is drawn");
  assert.equal(lines.point(), true, "the pointer left");
  assert.equal(lines.picked, undefined);
  assert.equal(lines.opacityOf(orion), 0.2);
  assert.equal(lines.point(), false);
});

test("the pointer far from every line picks nothing, and a finger's reach is a setting", () => {
  const lines = orionLines();
  assert.equal(lines.point(5, 700), false);
  assert.equal(lines.picked, undefined);
  const orion = lines.figures.find((figure) => figure.abbreviation === "Ori")!;
  const at = orion.start * 4;
  const x = (lines.segments[at]! + lines.segments[at + 2]!) / 2;
  const y = (lines.segments[at + 1]! + lines.segments[at + 3]!) / 2;
  assert.equal(lines.point(x, y), true);
  const near = orionLines({ strength: 0.2, reach: 0.5 });
  assert.equal(near.point(x, y + 8), false, "8 pixels is out of a reach of half a pixel");
  const wide = orionLines({ strength: 0.2, reach: 40 });
  assert.equal(wide.point(x, y + 8), true);
});

test("the name is in Japanese and in the look's case when asked", () => {
  const lines = orionLines({ strength: 0.3, lang: "ja" });
  const orion = lines.figures.find((figure) => figure.abbreviation === "Ori")!;
  lines.point(lines.segments[orion.start * 4]!, lines.segments[orion.start * 4 + 1]!);
  assert.equal(lines.name!.text, "オリオン座");
  const upper = orionLines({ strength: 0.3, style: { case: "upper" } });
  upper.point(upper.segments[orion.start * 4]!, upper.segments[orion.start * 4 + 1]!);
  assert.equal(upper.name!.text, "ORION");
});

test("strength 0 draws nothing and picks nothing, and a picked figure that leaves the view is let go", () => {
  const off = orionLines({ strength: 0 });
  assert.equal(off.count, 0);
  assert.equal(off.point(640, 360), false);
  const lines = orionLines();
  const orion = lines.figures.find((figure) => figure.abbreviation === "Ori")!;
  lines.point(lines.segments[orion.start * 4]!, lines.segments[orion.start * 4 + 1]!);
  assert.equal(lines.picked?.abbreviation, "Ori");
  lines.update((ra, dec, out) => project(ra + 180, dec, out), VIEW);
  assert.equal(lines.picked, undefined);
  lines.set({ strength: 0 });
  lines.update(project, VIEW);
  assert.equal(lines.count, 0);
});

test("a line longer than the page allows is left out, for a flat map's seam", () => {
  const all = orionLines({ strength: 0.2 });
  const short = orionLines({ strength: 0.2, maxLength: 60 });
  assert.ok(short.count < all.count && short.count > 0);
});

test("update and point reuse their numbers, so nothing is allocated while a page moves", () => {
  const lines = orionLines();
  const segments = lines.segments;
  const figures = lines.figures;
  const orion = lines.figures.find((figure) => figure.abbreviation === "Ori")!;
  lines.point(lines.segments[orion.start * 4]!, lines.segments[orion.start * 4 + 1]!);
  const name = lines.name;
  lines.update(project, VIEW);
  assert.equal(lines.segments, segments);
  assert.equal(lines.figures, figures);
  assert.equal(lines.name, name);
  assert.equal(lines.figures.find((figure) => figure.abbreviation === "Ori"), orion);
});

test("a look is a settings change: a complete object, CSS custom properties both ways, case, spacing and a leader line", () => {
  const style = labelStyle();
  assert.deepEqual(style, { ...DEFAULT_LABEL_STYLE });
  assert.equal(style.leader, 0);
  assert.deepEqual([style.font.split(",")[0], style.case, style.letterSpacing, style.ring, style.designation], ["Michroma", "small-caps", 0.14, 6, "below"], "the chosen look: Michroma in small capitals, wide spacing, a thin ring, the catalogue letter below");
  assert.match(style.designationFont, /monospace$/);
  const custom = labelStyle({ font: "Georgia, serif", size: 16, weight: 600, colour: "#fff", halo: "none", haloWidth: 0, case: "upper", letterSpacing: 0.2, leader: 20, leaderColour: "#8af", offset: 10 });
  assert.equal(custom.font, "Georgia, serif");
  assert.equal(custom.weight, 600);
  assert.equal(custom.halo, "none");
  assert.equal(custom.letterSpacing, 0.2);
  const clamped = labelStyle({ size: 9000, weight: 5, haloWidth: -4, letterSpacing: 9, leader: 1e6, offset: -3, case: "shout" as never, font: "  ", colour: 12 as never });
  assert.deepEqual([clamped.size, clamped.weight, clamped.haloWidth, clamped.letterSpacing, clamped.leader, clamped.offset], [48, 100, 0, 1, 80, 0]);
  assert.equal(clamped.case, "small-caps");
  assert.equal(clamped.font, DEFAULT_LABEL_STYLE.font);
  assert.equal(clamped.colour, DEFAULT_LABEL_STYLE.colour);
  const vars = labelStyleVars(custom);
  assert.deepEqual(Object.keys(vars).sort(), Object.values(LABEL_STYLE_PROPERTIES).sort());
  assert.equal(vars["--hoshi-label-size"], "16");
  assert.equal(vars["--hoshi-label-case"], "upper");
  assert.deepEqual(labelStyleFrom((name) => vars[name] ?? ""), custom);
  assert.deepEqual(labelStyleFrom(() => ""), style);
  assert.equal(labelText("Sirius", custom), "SIRIUS");
  assert.equal(labelText("シリウス", custom), "シリウス");
  assert.equal(labelText("Sirius", labelStyle({ case: "lower" })), "sirius");
  assert.ok(labelWidth("Sirius", custom) > labelWidth("Sirius", style));
  assert.equal(labelWidth("シリウス", labelStyle({ size: 12, letterSpacing: 0 })), 48);
  assert.equal(labelHeight(labelStyle({ size: 20 })), 24);
});

test("a leader line runs up and out from the star to the text, and no line when the look has none", () => {
  const out = {} as StarNameLabel;
  const style = labelStyle({ leader: 20, offset: 4 });
  assert.equal(placeLabel(100, 100, 40, style, VIEW, out), true);
  assert.equal(out.leader, true);
  assert.ok(out.leaderX1 > out.leaderX0 && out.leaderY1 < out.leaderY0);
  assert.ok(Math.abs(Math.hypot(out.leaderX1 - out.leaderX0, out.leaderY1 - out.leaderY0) - 20) < 1e-9);
  assert.ok(out.x0 >= out.leaderX1);
  const plain = labelStyle();
  assert.equal(placeLabel(100, 100, 40, plain, VIEW, out), true);
  assert.equal(out.leader, false);
  assert.equal(out.x0, 100 + plain.offset + plain.ring);
});

test("the default look names a star in small capitals with a ring round it and its catalogue letter under it", () => {
  const names = createStarNames({ count: 30 });
  names.update(project, VIEW);
  const rigel = names.labels.find((label) => label.text === "Rigel")!;
  assert.equal(rigel.designation, "β Ori");
  assert.equal(names.labels.find((label) => label.text === "Betelgeuse")!.designation, "α Ori");
  assert.equal(rigel.ring, 6);
  assert.ok(rigel.designationY > rigel.textY && rigel.designationY < rigel.y1 + 1, "the letter is under the name, inside the box");
  assert.equal(rigel.designationX, rigel.textX);
  assert.ok(rigel.x0 >= rigel.x + 6 + 4 - 1e-9 || rigel.x1 <= rigel.x - 10 + 1e-9, "the name clears the ring and its gap");
  const plain = createStarNames({ count: 30, style: { designation: "none", ring: 0 } });
  plain.update(project, VIEW);
  const bare = plain.labels.find((label) => label.text === "Rigel")!;
  assert.equal(bare.designation, "");
  assert.equal(bare.ring, 0);
  assert.ok(bare.y1 - bare.y0 < rigel.y1 - rigel.y0, "one line, not two");
  for (const label of names.labels) assert.ok(!/^\s/.test(label.designation), label.text);
});

test("a star with no Bayer letter or Flamsteed number has no catalogue letter to write", () => {
  const names = createStarNames({ count: 200 });
  names.update(project, VIEW);
  assert.ok(names.labels.some((label) => label.designation === ""));
});

test("the pointer on a star of a figure lights the whole figure, not only on a line", () => {
  const lines = orionLines();
  const orion = lines.figures.find((figure) => figure.abbreviation === "Ori")!;
  const spot = { x: lines.segments[orion.start * 4]!, y: lines.segments[orion.start * 4 + 1]! };
  assert.equal(lines.point(spot.x + 2, spot.y - 2), true);
  assert.equal(lines.picked, orion);
  assert.equal(lines.figures.filter((figure) => lines.opacityOf(figure) === 1).length, 1);
});

test("the picked figure's name is clear above the figure, and never over a star's name", () => {
  const names = createStarNames({ count: 60 });
  const lines = createFigureLines({ strength: 0.16 });
  names.update(project, VIEW);
  lines.update(project, VIEW, names.labels);
  const orion = lines.figures.find((figure) => figure.abbreviation === "Ori")!;
  lines.point(lines.segments[orion.start * 4]!, lines.segments[orion.start * 4 + 1]!);
  const name = lines.name!;
  assert.equal(lines.picked, orion);
  const half = labelWidth(name.text, lines.style) / 2;
  const box = { x0: name.x - half, x1: name.x + half, y0: name.y - labelHeight(lines.style) * 0.8, y1: name.y + labelHeight(lines.style) * 0.2 };
  assert.ok(box.y1 <= orion.top, "above the top of the figure");
  for (const label of names.labels) assert.ok(box.x1 <= label.x0 || box.x0 >= label.x1 || box.y1 <= label.y0 || box.y0 >= label.y1, `clear of ${label.text}`);
  const before = name.y;
  lines.update(project, VIEW, [{ x0: 0, y0: box.y0 - 1, x1: VIEW.width, y1: box.y1 + 1 }]);
  assert.ok(lines.name!.y < before, "a star's name in the way moves it further up");
});

test("a figure that reaches the top of the view has its name below it", () => {
  const lines = createFigureLines({ strength: 0.16 });
  lines.update((ra, dec, out) => project(ra, dec - 40, out), VIEW);
  const ursa = lines.figures.find((figure) => figure.abbreviation === "UMa")!;
  assert.ok(ursa.end > ursa.start);
  lines.point(lines.segments[ursa.start * 4]!, lines.segments[ursa.start * 4 + 1]!);
  assert.equal(lines.picked, ursa);
  assert.ok(lines.name!.y >= 0 && lines.name!.y <= VIEW.height);
});

test("the most names asked for is the number of stars that have one", () => {
  assert.equal(starNamesFromAttributes("100000", null)!.count, stars().filter((star) => star.name !== undefined).length);
  assert.equal(starNamesFromAttributes("100000", null)!.count, 335);
});

test("the dot table is built once, however low the magnitude limit is", () => {
  for (const dotMagnitude of [-5, 3]) {
    const names = createStarNames({ count: 3, dotMagnitude });
    let built = 0;
    const counting: SkyProjector = (ra, dec, out) => {
      built += 1;
      return project(ra, dec, out);
    };
    names.update(counting, VIEW);
    const first = built;
    names.update(counting, VIEW);
    assert.equal(built - first, first, "the second update asks the projector for the same stars as the first, and builds nothing more");
  }
});

test("a figure that runs off the view still has its name clear of every star's name, ring and dot (Orion at 70 px a degree)", () => {
  const close: SkyProjector = (ra, dec, out) => {
    out.x = 640 - (ra - 84) * 70;
    out.y = 360 - dec * 70;
    return Math.abs(ra - 84) < 40;
  };
  for (const count of [8, 30, 60]) {
    const names = createStarNames({ count });
    const lines = createFigureLines({ strength: 0.16 });
    names.update(close, VIEW);
    lines.update(close, VIEW, names.labels);
    const orion = lines.figures.find((figure) => figure.abbreviation === "Ori")!;
    assert.ok(orion.end > orion.start);
    assert.ok(orion.top < 4 || orion.bottom > VIEW.height - 4 || orion.left < 0 || orion.right > VIEW.width, "the figure runs off the view");
    lines.point(lines.segments[orion.start * 4]!, lines.segments[orion.start * 4 + 1]!);
    assert.equal(lines.picked, orion);
    const name = lines.name!;
    const half = labelWidth(name.text, lines.style) / 2;
    const box = { x0: name.x - half, x1: name.x + half, y0: name.y - labelHeight(lines.style) * 0.8, y1: name.y + labelHeight(lines.style) * 0.2 };
    for (const label of names.labels) {
      assert.ok(box.x1 <= label.x0 || box.x0 >= label.x1 || box.y1 <= label.y0 || box.y0 >= label.y1, `clear of the name ${label.text} with ${count} names`);
      const dx = label.x < box.x0 ? box.x0 - label.x : label.x > box.x1 ? label.x - box.x1 : 0;
      const dy = label.y < box.y0 ? box.y0 - label.y : label.y > box.y1 ? label.y - box.y1 : 0;
      assert.ok(dx * dx + dy * dy >= label.ring * label.ring, `clear of the ring round ${label.text}`);
    }
    for (let i = 0; i < lines.count * 2; i += 1) {
      const x = lines.segments[(i >> 1) * 4 + (i & 1) * 2]!;
      const y = lines.segments[(i >> 1) * 4 + (i & 1) * 2 + 1]!;
      const dx = x < box.x0 ? box.x0 - x : x > box.x1 ? x - box.x1 : 0;
      const dy = y < box.y0 ? box.y0 - y : y > box.y1 ? y - box.y1 : 0;
      assert.ok(dx * dx + dy * dy >= 9, "clear of the dot of a star of a figure");
    }
    assert.ok(box.x0 >= 0 && box.x1 <= VIEW.width && box.y0 >= 0 && box.y1 <= VIEW.height, "and inside the view");
  }
});
