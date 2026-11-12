// A picture of each constellation, drawn from this package's own stars, lines and boundaries: the constellation framed in a square with its neighbours faint around it, in a light and a dark look.
// The thumbnails tier (`@johnmorrisdotca/hoshi-stars/thumbnails`): the drawing code only, no picture files and nothing in the main entry. Pure: strings in, strings out; no DOM, no clock, no state beyond a cache of outlines.
// `thumbnailSvg` draws any figure from outlines, line segments and an ownership test, so another set of figures (the Japanese and Chinese ones) can use the same drawing; `constellationThumbnail` is the IAU case.
import { boundaries } from "./boundaries.ts";
import { constellation, type Constellation } from "./constellations.ts";
import { figureOf } from "./lines.ts";
import { project, unproject, type SkyPoint } from "./projection.ts";
import { starColour, stars, type Star } from "./stars.ts";

/**
 * The two looks of a picture: `dark` is a night sky, `light` is ink on paper.
 *
 * @example
 * ```ts
 * import { type ThumbnailTheme } from "@johnmorrisdotca/hoshi-stars/thumbnails";
 *
 * const themes: ThumbnailTheme[] = ["light", "dark"];
 * console.log(themes);
 * ```
 */
export type ThumbnailTheme = "light" | "dark";

/**
 * What to draw: the region to frame, the lines of the figure, and which stars belong to it. The IAU constellations come from `constellationThumbnail`; this is the shape another set of figures fills in.
 *
 * @example
 * ```ts
 * import { thumbnailSvg, type ThumbnailInput } from "@johnmorrisdotca/hoshi-stars/thumbnails";
 *
 * const input: ThumbnailInput = {
 *   title: "A triangle",
 *   outlines: [[{ rightAscension: 80, declination: 0 }, { rightAscension: 90, declination: 0 }, { rightAscension: 85, declination: 8 }, { rightAscension: 80, declination: 0 }]],
 *   segments: [],
 *   owns: () => true,
 * };
 * console.log(thumbnailSvg(input).length > 100);
 * ```
 */
export interface ThumbnailInput {
  /** The name for the picture's `<title>` and `aria-label`. */
  title: string;
  /** The closed outlines of the region to frame (degrees, J2000), each with its first point repeated as the last. Their extent decides the frame; they are drawn with a faint wash inside. Leave empty, and give `frame`, for a figure that has no boundary (a Chinese asterism). */
  outlines: ReadonlyArray<ReadonlyArray<SkyPoint>>;
  /** Positions to frame when the figure has no outline: the picture is framed round them (with the same room, and a least width of 4 degrees) and no boundary or wash is drawn. Ignored where `outlines` has points. */
  frame?: ReadonlyArray<SkyPoint>;
  /** The outlines of the neighbouring regions, drawn faint round the frame; leave out for none. */
  neighbourOutlines?: ReadonlyArray<ReadonlyArray<SkyPoint>>;
  /** The lines of the figure, each between two positions on the sky (the stars it joins). */
  segments: ReadonlyArray<readonly [SkyPoint, SkyPoint]>;
  /** True for a star that belongs to the figure: it is drawn in full and carries its `data-hr`. Every other star in the frame is drawn faint. */
  owns: (star: Star) => boolean;
  /** The least width of the picture in degrees where it has outlines (default 13, so a small constellation still shows its neighbours). */
  leastSpan?: number;
  /** True to widen the picture, a little at a time and no further than a constellation's 13 degrees, until a neighbouring boundary crosses it, so the faint boundary lines show in every picture (default false). */
  seeNeighbours?: boolean;
  /** Bright Star Catalogue (HR) numbers of stars to draw with a ring round them in the accent colour: a single named star inside its constellation's figure. */
  ringed?: ReadonlyArray<number>;
}

/**
 * How to draw a picture.
 *
 * @example
 * ```ts
 * import { constellationThumbnail, type ThumbnailOptions } from "@johnmorrisdotca/hoshi-stars/thumbnails";
 *
 * const options: ThumbnailOptions = { theme: "light", size: 160, neighbours: false };
 * console.log(constellationThumbnail("Ori", options).includes('width="160"'));
 * ```
 */
export interface ThumbnailOptions {
  /** `dark` (the default) or `light`. */
  theme?: ThumbnailTheme;
  /** The width and height in pixels. Left out, the picture has only a viewBox and takes the size of its box. */
  size?: number;
  /** False to leave out the neighbours' boundaries and stars (default true). */
  neighbours?: boolean;
}

/**
 * The side of the drawing in its own units; every picture is square.
 *
 * @example
 * ```ts
 * import { THUMBNAIL_UNITS } from "@johnmorrisdotca/hoshi-stars/thumbnails";
 *
 * console.log(THUMBNAIL_UNITS); // 400
 * ```
 */
export const THUMBNAIL_UNITS = 400;

const RAD = Math.PI / 180;
// The frame is never narrower than this, so a small constellation still shows its neighbours; and has this much room (a fraction of the larger side) round the boundary.
const MIN_SPAN_DEGREES = 13;
// A figure with no boundary (a few stars) is framed closer: the Pleiades are two degrees across.
const MIN_FIGURE_SPAN_DEGREES = 4;
// The widest a figure's picture is widened to, to show a neighbouring boundary line (see `FIGURE_LEAST_SPAN_DEGREES`).
const WIDEST_FIGURE_SPAN_DEGREES = 24;
const ROOM = 0.12;
// A line is only followed while it is within this many units of the frame: the 2-degree pieces of a boundary are never longer than that, so none that crosses the frame is lost.
const PEN_ROOM = 140;
const SCALE = 100;
const FRAME_ITERATIONS = 3;

const LOOKS = {
  dark: { ground: "#0b1020", neighbourLine: "#2b3a66", edge: "#7d9fe8", wash: "#6f93e0", washOpacity: 0.1, figure: "#9bb6f2", neighbourStars: 0.5, ink: "", ring: "#e0674a" },
  light: { ground: "#f7f5ef", neighbourLine: "#cdd1de", edge: "#3b5bb5", wash: "#3b5bb5", washOpacity: 0.07, figure: "#3b5bb5", neighbourStars: 0.42, ink: "#161d36", ring: "#b5452c" },
} as const;

const fixed = (value: number): string => (Math.round(value * 10) / 10).toString();
const escapeXml = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A star's colour mixed three-quarters toward the ink, so a pale star still shows on paper but keeps a tint. */
function onPaper(colour: string, ink: string): string {
  const mix = (a: number, b: number): string =>
    Math.round(a * 0.25 + b * 0.75)
      .toString(16)
      .padStart(2, "0");
  const take = (hex: string, at: number): number => parseInt(hex.slice(at, at + 2), 16);
  return `#${mix(take(colour, 1), take(ink, 1))}${mix(take(colour, 3), take(ink, 3))}${mix(take(colour, 5), take(ink, 5))}`;
}

/** The radius of a star's disc, in drawing units: bright stars are large, the faintest still show at 160 pixels. */
const radiusOf = (magnitude: number): number => 1 + 0.6 * Math.max(0, 6.6 - magnitude) ** 1.2;

function unit(point: SkyPoint): [number, number, number] {
  const ra = point.rightAscension * RAD;
  const dec = point.declination * RAD;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** The direction in the middle of some points: the mean of their unit vectors. */
function middleOf(points: readonly SkyPoint[]): SkyPoint {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const point of points) {
    const [a, b, c] = unit(point);
    x += a;
    y += b;
    z += c;
  }
  if (Math.hypot(x, y, z) < 1e-9) return { rightAscension: points[0]?.rightAscension ?? 0, declination: points[0]?.declination ?? 0 };
  return { rightAscension: (Math.atan2(y, x) / RAD + 360) % 360, declination: Math.atan2(z, Math.hypot(x, y)) / RAD };
}

interface Frame {
  centre: SkyPoint;
  /** Drawing units across the frame in the projection's own units. */
  side: number;
}

/** The centre and size of the square that holds the outlines: start at their mean direction, then re-centre on the middle of what lands on the chart, a few times. */
function frameOf(outlines: ReadonlyArray<ReadonlyArray<SkyPoint>>, leastDegrees: number): Frame {
  const all = outlines.flat();
  let centre = middleOf(all);
  let side = 0;
  for (let pass = 0; pass < FRAME_ITERATIONS; pass++) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const point of all) {
      const at = project("stereographic", point, { centre, scale: SCALE });
      if (at === undefined) continue;
      x0 = Math.min(x0, at.x);
      x1 = Math.max(x1, at.x);
      y0 = Math.min(y0, at.y);
      y1 = Math.max(y1, at.y);
    }
    side = Math.max(x1 - x0, y1 - y0);
    if (pass < FRAME_ITERATIONS - 1) {
      const middle = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
      centre = unproject("stereographic", middle, { centre, scale: SCALE }) ?? centre;
    }
  }
  const least = SCALE * 2 * Math.tan((leastDegrees * RAD) / 2);
  return { centre, side: Math.max(side * (1 + 2 * ROOM), least) };
}

/** The frame widened by a sixth at a time, to no more than the widest a figure's picture is allowed (24 degrees), until a line of `rings` runs through it: some point or middle of a 2-degree piece of a boundary is inside the square. */
function widenToSeeLines(start: Frame, rings: ReadonlyArray<ReadonlyArray<SkyPoint>>): Frame {
  const widest = SCALE * 2 * Math.tan((WIDEST_FIGURE_SPAN_DEGREES * RAD) / 2);
  const crossed = (side: number): boolean => {
    const k = THUMBNAIL_UNITS / side;
    const within = (x: number, y: number): boolean => x >= 0 && x <= THUMBNAIL_UNITS && y >= 0 && y <= THUMBNAIL_UNITS;
    for (const ring of rings) {
      let last: [number, number] | undefined;
      for (const point of ring) {
        const at = project("stereographic", point, { centre: start.centre, scale: SCALE });
        const here: [number, number] | undefined = at === undefined ? undefined : [THUMBNAIL_UNITS / 2 + at.x * k, THUMBNAIL_UNITS / 2 - at.y * k];
        if (here !== undefined && (within(here[0], here[1]) || (last !== undefined && within((here[0] + last[0]) / 2, (here[1] + last[1]) / 2)))) return true;
        last = here;
      }
    }
    return false;
  };
  let side = start.side;
  while (side < widest && !crossed(side)) side = Math.min(widest, side * 1.17);
  return { centre: start.centre, side };
}

/**
 * One picture, drawn from outlines, lines and stars you supply: the outlines are framed in a square with room round them, the stars that belong to the figure are drawn in full and every other star
 * in the frame faint, with the faint boundaries of the neighbours behind them. North is up and east is to the left, as the sky looks, and the stereographic projection keeps shapes. Each star of
 * the figure is a `<circle>` with its `data-hr`, so a program can check it is inside the picture. There is no text in the drawing apart from its `<title>`.
 *
 * @param input - What to draw.
 * @param options - The look, the size and whether the neighbours are drawn.
 * @returns A standalone SVG document as a string, a square of `THUMBNAIL_UNITS` units.
 * @throws RangeError if the outlines and `frame` are both empty, or `size` is not above 0.
 *
 * @example
 * ```ts
 * import { boundaryOf } from "@johnmorrisdotca/hoshi-stars/boundaries";
 * import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
 * import { thumbnailSvg } from "@johnmorrisdotca/hoshi-stars/thumbnails";
 *
 * const figure = figureOf("Lyr");
 * const svg = thumbnailSvg({ title: "Lyra", outlines: boundaryOf("Lyr").outlines, segments: figure.segments, owns: (star) => star.constellation === "Lyr" }, { theme: "light" });
 * console.log(svg.startsWith("<svg"));
 * ```
 */
export function thumbnailSvg(input: ThumbnailInput, options: ThumbnailOptions = {}): string {
  const look = LOOKS[options.theme === "light" ? "light" : "dark"];
  const size = options.size;
  if (size !== undefined && !(size > 0)) throw new RangeError(`size must be above 0 pixels, got ${String(size)}`);
  const bounded = input.outlines.some((outline) => outline.length > 0);
  if (!bounded && (input.frame === undefined || input.frame.length === 0)) throw new RangeError("outlines must hold at least one point (or give `frame` some)");
  let frame = bounded ? frameOf(input.outlines, input.leastSpan ?? MIN_SPAN_DEGREES) : frameOf([input.frame!], MIN_FIGURE_SPAN_DEGREES);
  if (input.seeNeighbours === true && options.neighbours !== false && input.neighbourOutlines !== undefined) frame = widenToSeeLines(frame, input.neighbourOutlines);
  const k = THUMBNAIL_UNITS / frame.side;
  // A wide frame holds thousands of stars: the faint neighbours are left out as it widens, so a picture stays light to send and clear to read. The figure's own stars are always drawn.
  const spanDegrees = (2 * Math.atan(frame.side / SCALE / 2)) / RAD;
  const faintest = Math.max(4.6, Math.min(6, 6 - (spanDegrees - 25) / 25));
  const near = THUMBNAIL_UNITS * 4;
  const place = (point: SkyPoint): [number, number] | undefined => {
    const at = project("stereographic", point, { centre: frame.centre, scale: SCALE });
    if (at === undefined) return undefined;
    const x = THUMBNAIL_UNITS / 2 + at.x * k;
    const y = THUMBNAIL_UNITS / 2 - at.y * k;
    return Math.abs(x) > near || Math.abs(y) > near ? undefined : [x, y];
  };
  const inside = (x: number, y: number, room: number): boolean => x >= -room && x <= THUMBNAIL_UNITS + room && y >= -room && y <= THUMBNAIL_UNITS + room;

  /** Outlines as one path, left alone where a point is off the chart or far outside the frame. */
  const pathOf = (rings: ReadonlyArray<ReadonlyArray<SkyPoint>>, closed: boolean): string => {
    let d = "";
    for (const ring of rings) {
      let pen = false;
      let last: [number, number] | undefined;
      for (const point of ring) {
        const at = place(point);
        if (at === undefined || (last !== undefined && !inside(at[0], at[1], PEN_ROOM) && !inside(last[0], last[1], PEN_ROOM))) {
          pen = false;
          last = at;
          continue;
        }
        d += `${pen ? "L" : "M"}${fixed(at[0])} ${fixed(at[1])}`;
        pen = true;
        last = at;
      }
      if (closed && pen) d += "Z";
    }
    return d;
  };

  const parts: string[] = [];
  const sizeText = size === undefined ? "" : ` width="${fixed(size)}" height="${fixed(size)}"`;
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${THUMBNAIL_UNITS} ${THUMBNAIL_UNITS}"${sizeText} role="img" aria-label="${escapeXml(input.title)}"><title>${escapeXml(input.title)}</title>`,
    `<rect width="${THUMBNAIL_UNITS}" height="${THUMBNAIL_UNITS}" fill="${look.ground}"/>`,
  );
  if (options.neighbours !== false && input.neighbourOutlines !== undefined) {
    parts.push(`<path d="${pathOf(input.neighbourOutlines, false)}" fill="none" stroke="${look.neighbourLine}" stroke-width="1" stroke-linejoin="round"/>`);
  }
  if (bounded) parts.push(`<path d="${pathOf(input.outlines, true)}" fill="${look.wash}" fill-opacity="${look.washOpacity}" stroke="${look.edge}" stroke-width="1.6" stroke-linejoin="round" stroke-dasharray="5 3"/>`);

  const lines: string[] = [];
  for (const [a, b] of input.segments) {
    const from = place(a);
    const to = place(b);
    if (from !== undefined && to !== undefined) lines.push(`M${fixed(from[0])} ${fixed(from[1])}L${fixed(to[0])} ${fixed(to[1])}`);
  }
  if (lines.length > 0) parts.push(`<path d="${lines.join("")}" fill="none" stroke="${look.figure}" stroke-width="2.2" stroke-linecap="round"/>`);

  const faint: string[] = [];
  const full: string[] = [];
  const rings: string[] = [];
  const ringed = new Set(input.ringed ?? []);
  const everyStar = stars();
  for (let index = everyStar.length - 1; index >= 0; index--) {
    const star = everyStar[index]!;
    const at = place(star);
    if (at === undefined) continue;
    const mine = input.owns(star);
    if (!mine && (options.neighbours === false || star.magnitude > faintest || !inside(at[0], at[1], 3))) continue;
    if (mine && !inside(at[0], at[1], 0)) continue;
    const colour = look.ink === "" ? starColour(star) : onPaper(starColour(star), look.ink);
    const disc = `<circle cx="${fixed(at[0])}" cy="${fixed(at[1])}" r="${fixed(radiusOf(star.magnitude))}" fill="${colour}"${mine ? ` data-hr="${star.hr}"` : ""}/>`;
    (mine ? full : faint).push(disc);
    if (mine && ringed.has(star.hr)) rings.push(`<circle cx="${fixed(at[0])}" cy="${fixed(at[1])}" r="${fixed(radiusOf(star.magnitude) + 6)}"/>`);
  }
  // Brightest last, so a big star is never hidden under a small one: the catalogue is brightest first, and it was walked from the faint end.
  if (faint.length > 0) parts.push(`<g opacity="${look.neighbourStars}">${faint.join("")}</g>`);
  parts.push(`<g>${full.join("")}</g>`);
  if (rings.length > 0) parts.push(`<g fill="none" stroke="${look.ring}" stroke-width="2.6" data-ring="">${rings.join("")}</g>`);
  parts.push("</svg>");
  return parts.join("");
}

let neighbours: Map<string, Array<Array<SkyPoint>>> | undefined;
function outlinesOf(): Map<string, Array<Array<SkyPoint>>> {
  if (neighbours === undefined) neighbours = new Map(boundaries({ step: 2 }).map((b) => [b.constellation.abbreviation, b.outlines]));
  return neighbours;
}

/** The input for one IAU constellation's picture; the neighbours' outlines are added by the caller. */
function constellationInput(found: Constellation): ThumbnailInput {
  return {
    title: `${found.name} (${found.abbreviation}), the constellation, with its neighbours`,
    outlines: outlinesOf().get(found.abbreviation)!,
    segments: figureOf(found.abbreviation).segments,
    owns: (star) => star.constellation === found.abbreviation,
  };
}

/** The boundaries of every constellation except `leaveOut`, as the faint lines round a picture. */
const neighbourRings = (leaveOut?: string): Array<Array<SkyPoint>> => [...outlinesOf()].filter(([abbreviation]) => abbreviation !== leaveOut).flatMap(([, rings]) => rings);

/**
 * The picture of one IAU constellation: its boundary (dashed, with a faint wash), its stick figure, its bright stars, and the neighbouring constellations' boundaries and stars faint round it. Every
 * constellation fills a square the same way, so the 88 make a tidy grid. `thumbnailSvg` is the same drawing for any other figure.
 *
 * @param text - The constellation, as the IAU abbreviation (`Ori`) or any other name `constellation` accepts.
 * @param options - The look, the size and whether the neighbours are drawn.
 * @returns A standalone SVG document as a string.
 * @throws TypeError if `text` is not a string. RangeError if it is not one of the 88 constellations, or `size` is not above 0.
 *
 * @example
 * ```ts
 * import { constellationThumbnail } from "@johnmorrisdotca/hoshi-stars/thumbnails";
 *
 * const dark = constellationThumbnail("Orion");
 * const light = constellationThumbnail("Ori", { theme: "light", size: 160 });
 * console.log(dark.length, light.includes('role="img"'));
 * ```
 */
export function constellationThumbnail(text: string, options: ThumbnailOptions = {}): string {
  const found: Constellation | undefined = constellation(text);
  if (found === undefined) throw new RangeError(`"${text}" is not one of the 88 constellations (use the IAU abbreviation such as "Ori")`);
  const input = constellationInput(found);
  if (options.neighbours !== false) input.neighbourOutlines = neighbourRings(found.abbreviation);
  return thumbnailSvg(input, options);
}

type Plane = [number, number];

/** The convex hull of some points on a plane (Andrew's monotone chain), counter-clockwise, without the first point repeated. */
function hullOf(points: readonly Plane[]): Plane[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: Plane, a: Plane, b: Plane): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list: readonly Plane[]): Plane[] => {
    const out: Plane[] = [];
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, point) <= 0) out.pop();
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...chain(sorted), ...chain([...sorted].reverse())];
}

// A padded outline is the stars' hull grown by this many degrees at least, or this fraction of the figure's width, whichever is more; its corners are rounded in this many steps.
const PAD_LEAST_DEGREES = 0.8;
const PAD_FRACTION = 0.08;
const PAD_STEPS = 20;
// A figure's picture is never narrower than this (a constellation's is 13), so the Pleiades are not a dot. It is widened from there, only until a neighbouring boundary line crosses it and never past the second number, so every picture has its faint lines: a figure deep inside a big constellation (Virgo, Bootes) needs the room.
const FIGURE_LEAST_SPAN_DEGREES = 5;
/** The width in degrees of the picture of a figure of one star: a constellation's least, so it shows the sky round it. */
const LONE_STAR_SPAN_DEGREES = 13;

/**
 * A soft outline round some stars: their convex hull grown by a margin with rounded corners, as a closed ring of positions. It is what a figure with no official boundary is drawn with, in the same
 * dashed line and wash as the boundary of a constellation. Only the 88 constellations have official boundaries; this outline is a drawing aid, not a border.
 *
 * @param points - The positions of the stars (degrees, J2000). At least one.
 * @param padDegrees - How far the outline stands off the stars. Left out, 0.8 degree or 8 per cent of the figure's width, whichever is more.
 * @returns One closed ring (the first position repeated as the last), ready for `ThumbnailInput.outlines`.
 * @throws RangeError if `points` is empty, or `padDegrees` is not above 0.
 *
 * @example
 * ```ts
 * import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
 * import { paddedOutline } from "@johnmorrisdotca/hoshi-stars/thumbnails";
 * import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";
 *
 * const ring = paddedOutline(figureOf("北斗", chinese).stars);
 * console.log(ring.length > 8, ring[0]!.rightAscension === ring[ring.length - 1]!.rightAscension);
 * ```
 */
export function paddedOutline(points: readonly SkyPoint[], padDegrees?: number): SkyPoint[] {
  if (points.length === 0) throw new RangeError("points must hold at least one position");
  if (padDegrees !== undefined && !(padDegrees > 0)) throw new RangeError(`padDegrees must be above 0, got ${String(padDegrees)}`);
  const centre = middleOf(points);
  const flat: Plane[] = [];
  for (const point of points) {
    const at = project("stereographic", point, { centre, scale: SCALE });
    if (at !== undefined) flat.push([at.x, at.y]);
  }
  const width = (list: readonly Plane[], axis: 0 | 1): number => Math.max(...list.map((p) => p[axis])) - Math.min(...list.map((p) => p[axis]));
  const across = flat.length === 0 ? 0 : Math.max(width(flat, 0), width(flat, 1));
  const toUnits = (degrees: number): number => SCALE * 2 * Math.tan((degrees * RAD) / 2);
  const pad = padDegrees === undefined ? Math.max(toUnits(PAD_LEAST_DEGREES), across * PAD_FRACTION) : toUnits(padDegrees);
  const grown: Plane[] = [];
  for (const [x, y] of hullOf(flat)) {
    for (let step = 0; step < PAD_STEPS; step++) {
      const angle = (2 * Math.PI * step) / PAD_STEPS;
      grown.push([x + pad * Math.cos(angle), y + pad * Math.sin(angle)]);
    }
  }
  const ring = hullOf(grown).map(([x, y]) => unproject("stereographic", { x, y }, { centre, scale: SCALE }) ?? centre);
  return [...ring, ring[0]!];
}

/**
 * What to draw for a figure of a sky culture: its name for the picture's `<title>`, the stars it joins and the lines between them.
 *
 * @example
 * ```ts
 * import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
 * import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";
 * import { type FigureThumbnailInput } from "@johnmorrisdotca/hoshi-stars/thumbnails";
 *
 * const subaru = figureOf("昴", japanese);
 * const input: FigureThumbnailInput = { title: "昴", stars: subaru.stars, segments: subaru.segments };
 * console.log(input.stars.length);
 * ```
 */
export interface FigureThumbnailInput {
  /** The name for the picture's `<title>` and `aria-label`. */
  title: string;
  /** The stars of the figure, drawn inside a soft outline round them; one star is also ringed. */
  stars: ReadonlyArray<Star>;
  /** The lines of the figure, each a pair of its stars. */
  segments: ReadonlyArray<readonly [Star, Star]>;
}

/**
 * The picture of a figure of a sky culture (a Chinese asterism, a traditional Japanese figure), drawn the way a constellation's is, so every sky makes one set: the same square, the same room round the
 * figure, the neighbouring constellations' boundaries and stars faint behind it, the same line and star sizes. A figure of two stars or more stands in a soft dashed outline with a faint wash (it has
 * no official boundary: only the 88 constellations do, and the outline is a drawing aid), its stars in full. A figure of one star (Rigel as 源氏星, Sirius as 天狼, or an asterism of which the catalogue
 * holds one star) stands in the same dashed outline round that star, ringed in the accent colour, with the neighbouring boundaries and stars faint behind it: no other figure's lines, so the
 * picture shows only what the figure has.
 *
 * @param input - The title, the stars and the lines.
 * @param options - The look, the size and whether the neighbours are drawn.
 * @returns A standalone SVG document as a string, a square of `THUMBNAIL_UNITS` units.
 * @throws RangeError if there are no stars, or `size` is not above 0.
 *
 * @example
 * ```ts
 * import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
 * import { figureThumbnail } from "@johnmorrisdotca/hoshi-stars/thumbnails";
 * import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";
 *
 * const dipper = figureOf("北斗", chinese);
 * const svg = figureThumbnail({ title: "北斗", stars: dipper.stars, segments: dipper.segments }, { theme: "dark" });
 * const sirius = figureOf("天狼", chinese);
 * console.log(svg.includes("stroke-dasharray"), figureThumbnail({ title: "天狼", stars: sirius.stars, segments: [] }).includes("data-ring"));
 * ```
 */
export function figureThumbnail(input: FigureThumbnailInput, options: ThumbnailOptions = {}): string {
  if (input.stars.length === 0) throw new RangeError("stars must hold at least one star");
  if (input.stars.length === 1) {
    // the same card as any figure, a soft dashed outline round its stars, here round the one star, as wide as a constellation's least picture so the sky round it says where it is
    const star = input.stars[0]!;
    const drawing: ThumbnailInput = { title: input.title, outlines: [paddedOutline([star])], segments: [], owns: (one) => one.hr === star.hr, leastSpan: LONE_STAR_SPAN_DEGREES, seeNeighbours: true, ringed: [star.hr] };
    if (options.neighbours !== false) drawing.neighbourOutlines = neighbourRings();
    return thumbnailSvg(drawing, options);
  }
  const mine = new Set(input.stars.map((star) => star.hr));
  const drawing: ThumbnailInput = { title: input.title, outlines: [paddedOutline(input.stars)], segments: input.segments, owns: (star) => mine.has(star.hr), leastSpan: FIGURE_LEAST_SPAN_DEGREES, seeNeighbours: true };
  if (options.neighbours !== false) drawing.neighbourOutlines = neighbourRings();
  return thumbnailSvg(drawing, options);
}
