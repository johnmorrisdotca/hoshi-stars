// Connect-the-dots constellations: the stars of a stick figure as big dots, numbered in the order the lines are drawn, sized by brightness, to print for a child; with an answer page that has the lines.
// The figure and the numbers come from the package's own data (`/lines`); the stars are placed with a stereographic chart (`/projection`). Pure: strings in, strings out.
import { constellation, type Constellation } from "../constellations.ts";
import { figureOf } from "../lines.ts";
import { project } from "../projection.ts";
import type { Star } from "../stars.ts";
import { TYPES, footer, n, svgOpen, text as write, textWidth, type Lang } from "./common.ts";

/**
 * How hard a sheet is: `easy` joins only the brightest 5 to 10 stars of the figure, `medium` joins every star of its lines, and `hard` has the same dots with no numbers to find.
 *
 * @example
 * ```ts
 * import { DOT_LEVELS } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * console.log(DOT_LEVELS.join(", "));
 * ```
 */
export const DOT_LEVELS = ["easy", "medium", "hard"] as const;
/**
 * One level of a sheet: `easy`, `medium` or `hard`.
 *
 * @example
 * ```ts
 * import { DOT_LEVELS, type DotLevel } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const level: DotLevel = DOT_LEVELS[1];
 * console.log(level);
 * ```
 */
export type DotLevel = (typeof DOT_LEVELS)[number];

/**
 * One dot of a sheet: a star, where it is on the page and the numbers it carries (a star the lines pass again has more than one).
 *
 * @example
 * ```ts
 * import { dotsFigure, type Dot } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const first: Dot = dotsFigure("Cru", { widthMm: 180, heightMm: 150 }).dots[0];
 * console.log(first.star.name ?? first.star.designation, first.numbers);
 * ```
 */
export interface Dot {
  star: Star;
  x: number;
  y: number;
  /** The radius, in millimetres, from the star's brightness. */
  r: number;
  /** The visit numbers, in drawing order; empty on a hard sheet. */
  numbers: number[];
  /** Where the number is written (its left or middle and its baseline) and which way it is anchored. */
  label: { x: number; y: number; anchor: "start" | "middle" | "end" };
  /** A new line starts here: the child lifts the pencil. */
  ring: boolean;
}

/**
 * A figure laid out on a page of a given room.
 *
 * @example
 * ```ts
 * import { dotsFigure, type DotsFigure } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const crux: DotsFigure = dotsFigure("Cru", { level: "easy", widthMm: 180, heightMm: 150 });
 * console.log(crux.constellation.name, crux.visits, crux.lines.length);
 * ```
 */
export interface DotsFigure {
  constellation: Constellation;
  level: DotLevel;
  dots: Dot[];
  /** The lines of the answer, as pairs of indexes into `dots`, in drawing order. */
  lines: [number, number][];
  /** How many numbers there are to join: one for each visit. */
  visits: number;
  /** How many separate lines the pencil draws. */
  strokes: number;
}

/** The sky's strokes: runs of the figure's segments that continue from the star before. */
function strokesOf(segments: readonly (readonly [Star, Star])[]): Star[][] {
  const out: Star[][] = [];
  for (const [a, b] of segments) {
    const last = out.at(-1);
    if (last !== undefined && last.at(-1) === a) last.push(b);
    else out.push([a, b]);
  }
  return out;
}

/**
 * The smallest and largest radius, in millimetres, a dot of a sheet can have: the floor still prints and can be seen, the ceiling is what the brightest star gets when nothing is near it. A dot is also never larger than a third of the distance to
 * its nearest neighbour on the page (down to the floor), so close dots stay apart.
 *
 * @example
 * ```ts
 * import { DOT_LIMITS } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * console.log(DOT_LIMITS.kid.floor, DOT_LIMITS.kid.ceiling);
 * ```
 */
export const DOT_LIMITS: Readonly<Record<"kid" | "normal", { floor: number; ceiling: number }>> = {
  kid: { floor: 1, ceiling: 5 },
  normal: { floor: 0.6, ceiling: 2 },
};
/** The thickest a line of an answer page is, in millimetres: the sheet type's own line, but no more than 1 mm so that close dots stay apart. */
const ANSWER_LINE_MAX_MM = 1;

/** The radius a star's brightness asks for, between the limits; the nearest neighbour may lower it (see `fit`). */
const radiusOf = (magnitude: number, type: "kid" | "normal"): number => {
  const { floor, ceiling } = DOT_LIMITS[type];
  return Math.max(floor, Math.min(ceiling, type === "kid" ? 2 + (4.2 - magnitude) * 0.7 : 0.7 + (4.2 - magnitude) * 0.3));
};

/** The strokes of a level: all of them, or for `easy` only the brightest stars along them. */
function strokesFor(strokes: Star[][], level: DotLevel): Star[][] {
  if (level !== "easy") return strokes;
  const all = [...new Set(strokes.flat())];
  const want = Math.max(5, Math.min(10, Math.round(all.length * 0.7)));
  const keep = new Set([...all].sort((a, b) => a.magnitude - b.magnitude).slice(0, Math.min(want, all.length)));
  // one line through the brightest stars, in the order the figure first reaches them: no star twice, no pencil lifted
  const path = all.filter((star) => keep.has(star));
  return path.length >= 2 ? [path] : strokes;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const gap = (a: Box, b: Box): number => Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)), Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));

/**
 * A constellation laid out as numbered dots on a page `widthMm` by `heightMm`: the stars placed by a stereographic chart, east to the left as in the sky, made as large as fits; the dots sized by brightness and never more than a third of the distance to the nearest dot (`DOT_LIMITS`), and two stars too close for the smallest dots moved apart to the distance they need; every visit numbered along the lines in drawing order
 * (one number for each time the pencil reaches a star, a star met again carrying both numbers); each number put where it touches no dot, line or other number.
 * @param text - The constellation, as `constellation` takes it (`Ori`, `Orion`, `オリオン座`).
 * @param options - `level`, `widthMm`, `heightMm` and `type` (`kid` or `normal`).
 * @returns The dots, the lines of the answer and the counts.
 * @throws RangeError if the constellation is not one of the 88 or its figure has no line to draw.
 *
 * @example
 * ```ts
 * import { dotsFigure } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const orion = dotsFigure("Ori", { level: "medium", widthMm: 180, heightMm: 150 });
 * console.log(orion.dots.length, orion.visits, orion.dots[0].numbers);
 * ```
 */
export function dotsFigure(text: string, options: { level?: DotLevel; widthMm: number; heightMm: number; type?: "kid" | "normal" }): DotsFigure {
  const found = constellation(text);
  if (found === undefined) throw new RangeError(`"${text}" is not one of the 88 constellations`);
  const figure = figureOf(found.abbreviation);
  if (figure.segments.length === 0) throw new RangeError(`${found.name} has no figure to join`);
  const level = options.level ?? "medium";
  const type = options.type ?? "kid";
  const strokes = strokesFor(strokesOf(figure.segments), level);
  const members = [...new Set(strokes.flat())];
  // the middle of the figure, then the chart: east to the left, north up
  const sum = members.reduce((t, s) => [t[0] + Math.cos((s.declination * Math.PI) / 180) * Math.cos((s.rightAscension * Math.PI) / 180), t[1] + Math.cos((s.declination * Math.PI) / 180) * Math.sin((s.rightAscension * Math.PI) / 180), t[2] + Math.sin((s.declination * Math.PI) / 180)], [0, 0, 0]);
  const centre = { rightAscension: ((Math.atan2(sum[1]!, sum[0]!) * 180) / Math.PI + 360) % 360, declination: (Math.atan2(sum[2]!, Math.hypot(sum[0]!, sum[1]!)) * 180) / Math.PI };
  const raw = members.map((star) => project("stereographic", star, { centre, scale: 1 })!);
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const margin = type === "kid" ? 17 : 10;
  const scale = Math.min((options.widthMm - 2 * margin) / Math.max(spanX, 1e-6), (options.heightMm - 2 * margin) / Math.max(spanY, 1e-6));
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const dots: Dot[] = members.map((star, i) => ({
    star,
    x: options.widthMm / 2 + (raw[i]!.x - midX) * scale,
    y: options.heightMm / 2 - (raw[i]!.y - midY) * scale,
    r: radiusOf(star.magnitude, type),
    numbers: [],
    label: { x: 0, y: 0, anchor: "middle" },
    ring: false,
  }));
  // two stars that lie closer on the page than the smallest dots can be told apart (the head of Hydra is five stars within 4 mm on an A5 page) are moved apart to that distance: by 2 mm at the most, on a figure over 100 mm across
  const { floor } = DOT_LIMITS[type];
  separate(dots, 2 * floor + 0.6);
  // no dot is larger than a third of the distance to its nearest neighbour on this page, down to the floor that still prints
  for (const dot of dots) {
    const nearest = Math.min(...dots.filter((other) => other !== dot).map((other) => Math.hypot(other.x - dot.x, other.y - dot.y)));
    dot.r = Math.max(floor, Math.min(dot.r, nearest / 3));
  }
  const index = new Map(members.map((star, i) => [star, i]));
  const lines: [number, number][] = [];
  let visit = 0;
  strokes.forEach((one, k) => {
    one.forEach((star, j) => {
      visit += 1;
      const dot = dots[index.get(star)!]!;
      if (level !== "hard") dot.numbers.push(visit);
      if (j === 0 && k > 0) dot.ring = true;
      if (j > 0) lines.push([index.get(one[j - 1]!)!, index.get(star)!]);
    });
  });
  if (level !== "hard") placeLabels(dots, lines, options.widthMm, options.heightMm, type);
  return { constellation: found, level, dots, lines, visits: visit, strokes: strokes.length };
}

/** Moves dots that are closer than `least` millimetres apart until none is, each pair half and half along the line between them. Stops after 400 rounds, which the figures of the sky never need. */
function separate(dots: Dot[], least: number): void {
  for (let round = 0; round < 400; round += 1) {
    let moved = false;
    for (let i = 0; i < dots.length; i += 1) {
      for (let j = i + 1; j < dots.length; j += 1) {
        const a = dots[i]!;
        const b = dots[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= least) continue;
        const ux = d === 0 ? 1 : dx / d;
        const uy = d === 0 ? 0 : dy / d;
        const push = (least - d) / 2 + 0.01;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    if (!moved) return;
  }
}

/** The distance from a point to a segment. */
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const along = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + along * dx), py - (ay + along * dy));
}
/** The distance from a segment to a box: 0 where they meet, else the nearest of the segment's ends to the box and the box's corners to the segment. */
function segmentToBox(ax: number, ay: number, bx: number, by: number, box: Box): number {
  // where the segment runs inside the box (clipped against its four sides)
  let low = 0;
  let high = 1;
  for (const [p, q] of [[-(bx - ax), ax - box.x], [bx - ax, box.x + box.w - ax], [-(by - ay), ay - box.y], [by - ay, box.y + box.h - ay]] as const) {
    if (p === 0) {
      if (q < 0) { low = 2; break; }
    } else {
      const r = q / p;
      if (p < 0) low = Math.max(low, r);
      else high = Math.min(high, r);
    }
  }
  if (low <= high) return 0;
  const toBox = (x: number, y: number): number => Math.hypot(x - Math.max(box.x, Math.min(x, box.x + box.w)), y - Math.max(box.y, Math.min(y, box.y + box.h)));
  return Math.min(toBox(ax, ay), toBox(bx, by), ...[[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]].map(([x, y]) => toSegment(x!, y!, ax, ay, bx, by)));
}

/** Put each number where it touches no dot, no ring, no line of the answer and no other number, and stays inside the page: the best of 24 directions at five distances from its dot (up to 8 mm beyond it), nearest first. The numbers are placed the most crowded dot first, then each is placed again with all the others in place, until nothing moves. */
function placeLabels(dots: Dot[], lines: readonly (readonly [number, number])[], width: number, height: number, type: "kid" | "normal"): void {
  const size = TYPES[type].bodyMm;
  const lineHalf = Math.min(TYPES[type].lineMm, ANSWER_LINE_MAX_MM) / 2;
  const boxes = new Map<Dot, Box>();
  const crowd = (dot: Dot): number => Math.min(...dots.filter((other) => other !== dot).map((other) => Math.hypot(other.x - dot.x, other.y - dot.y)));
  const order = [...dots].sort((a, b) => crowd(a) - crowd(b) || a.numbers[0]! - b.numbers[0]!);
  const choose = (dot: Dot): void => {
    const w = textWidth(dot.numbers.join("·"), size);
    const h = size * 1.2;
    let best: { score: number; box: Box; x: number; y: number } | undefined;
    for (const extra of [0, 1.6, 3.4, 5.5, 8]) {
      for (let k = 0; k < 24; k += 1) {
        const angle = (k / 24) * 2 * Math.PI;
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        const reach = dot.r + (dot.ring ? 3.6 : 1.4) + extra;
        const cx = dot.x + ux * (reach + (w / 2) * Math.abs(ux));
        const cy = dot.y + uy * (reach + (h / 2) * Math.abs(uy));
        const box: Box = { x: cx - w / 2, y: cy - h / 2, w, h };
        let score = 100;
        for (const other of dots) {
          const near = Math.hypot(other.x - Math.max(box.x, Math.min(other.x, box.x + box.w)), other.y - Math.max(box.y, Math.min(other.y, box.y + box.h))) - (other.ring ? other.r + 2.2 : other.r);
          score = Math.min(score, near);
        }
        for (const [other, there] of boxes) if (other !== dot) score = Math.min(score, gap(box, there));
        for (const [a, b] of lines) score = Math.min(score, segmentToBox(dots[a]!.x, dots[a]!.y, dots[b]!.x, dots[b]!.y, box) - lineHalf);
        if (box.x < 0 || box.y < 0 || box.x + box.w > width || box.y + box.h > height) score -= 50;
        // a clear place is good enough once it has a little room; the nearest such place wins
        const value = Math.min(score, 1.2) - extra * 0.02;
        if (best === undefined || value > best.score) best = { score: value, box, x: cx, y: box.y + size * 0.95 };
      }
    }
    boxes.set(dot, best!.box);
    dot.label = { x: best!.x, y: best!.y, anchor: "middle" };
  };
  for (const dot of order) choose(dot);
  for (let pass = 0; pass < 6; pass += 1) {
    const before = order.map((dot) => `${dot.label.x},${dot.label.y}`).join(";");
    for (const dot of order) choose(dot);
    if (order.map((dot) => `${dot.label.x},${dot.label.y}`).join(";") === before) break;
  }
}

const NAME_LANG = (c: Constellation, lang: Lang): string => (lang === "ja" ? c.japanese : c.name);

/** What to write under the picture. */
function words(figure: DotsFigure, lang: Lang, answer: boolean): string {
  const name = figure.constellation;
  const last = figure.visits;
  if (answer) return lang === "ja" ? `${name.japanese}の できあがり！ うまく できたかな？` : `Here is ${name.name}. How did you do?`;
  if (figure.level === "hard") return lang === "ja" ? `${figure.dots.length}この ほしを みつけて つないで、${name.japanese}を つくろう！` : `Find the ${figure.dots.length} stars and join them to make ${name.name}!`;
  const rings = figure.strokes > 1 ? (lang === "ja" ? " まるが ついた てんからは、ペンを はなして あたらしい せんを かきはじめます。" : " A ring means: lift your pencil and start a new line.") : "";
  return lang === "ja" ? `1から ${last}まで てんを つなごう！${rings}` : `Join the dots from 1 to ${last}!${rings}`;
}

/**
 * The meaning of a constellation's name, for the line under its title: `Orion: the Hunter`, or its reading in hiragana.
 * @param c - A constellation.
 * @param lang - `en` or `ja`.
 * @returns The line.
 *
 * @example
 * ```ts
 * import { constellation } from "@johnmorrisdotca/hoshi-stars/constellations";
 * import { dotsSubtitle } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * console.log(dotsSubtitle(constellation("Ori")!, "en"), dotsSubtitle(constellation("Ori")!, "ja"));
 * ```
 */
export const dotsSubtitle = (c: Constellation, lang: Lang): string => (lang === "ja" ? `${c.reading}` : `${c.name}: the ${c.english}`);

/**
 * One page of a connect-the-dots sheet as an SVG string measured in millimetres: the dots (and the numbers, unless the level is `hard`), the words that say what to do, and on an answer page the lines too, 1 mm thick for the `kid` type (0.4 mm for `normal`).
 * @param text - The constellation.
 * @param options - `level`, `widthMm` and `heightMm` (the room the page's body has), `lang`, `answer` (draw the lines) and `type`.
 * @returns The `<svg>` markup.
 * @throws RangeError as `dotsFigure` does.
 *
 * @example
 * ```ts
 * import { dotsSvg } from "@johnmorrisdotca/hoshi-stars/sheets";
 *
 * const page = dotsSvg("Cas", { level: "easy", widthMm: 184.6, heightMm: 190, lang: "en" });
 * console.log(page.includes("Join the dots from 1 to"), page.includes("<circle"));
 * ```
 */
export function dotsSvg(text: string, options: { level?: DotLevel; widthMm: number; heightMm: number; lang?: Lang; answer?: boolean; type?: "kid" | "normal" }): string {
  const lang = options.lang ?? "en";
  const type = options.type ?? "kid";
  const t = TYPES[type];
  const probe = dotsFigure(text, { ...options, heightMm: options.heightMm });
  const say = words(probe, lang, options.answer === true);
  const block = footer(say, options.widthMm, options.heightMm, t.bodyMm);
  const roomHeight = options.heightMm - block.height - 4;
  const figure = dotsFigure(text, { level: options.level, widthMm: options.widthMm, heightMm: roomHeight, type });
  const answer = options.answer === true;
  const parts: string[] = [];
  if (answer) for (const [a, b] of figure.lines) parts.push(`<line x1="${n(figure.dots[a]!.x)}" y1="${n(figure.dots[a]!.y)}" x2="${n(figure.dots[b]!.x)}" y2="${n(figure.dots[b]!.y)}" stroke="#000" stroke-width="${n(Math.min(t.lineMm, ANSWER_LINE_MAX_MM))}" stroke-linecap="round" data-line=""/>`);
  for (const dot of figure.dots) {
    parts.push(`<circle cx="${n(dot.x)}" cy="${n(dot.y)}" r="${n(dot.r)}" fill="#000" data-dot="${dot.star.hr}"/>`);
    if (dot.ring) parts.push(`<circle cx="${n(dot.x)}" cy="${n(dot.y)}" r="${n(dot.r + 2.2)}" fill="none" stroke="#000" stroke-width="${n(Math.max(0.6, t.lineMm * 0.5))}" data-ring=""/>`);
  }
  for (const dot of figure.dots) if (dot.numbers.length > 0) parts.push(write(dot.label.x, dot.label.y, t.bodyMm, dot.numbers.join("·"), ` text-anchor="middle" data-number="${dot.numbers[0]}"`));
  const sayBlock = footer(say, options.widthMm, options.heightMm, t.bodyMm, " data-say=\"\"");
  const label = NAME_LANG(figure.constellation, lang);
  return `${svgOpen(options.widthMm, options.heightMm, label, `${figure.constellation.abbreviation}-${figure.level}${answer ? "-answer" : ""}`)}${parts.join("")}${sayBlock.markup}</svg>`;
}

