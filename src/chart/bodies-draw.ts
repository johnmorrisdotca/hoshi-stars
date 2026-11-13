// Draws the page's bodies on the chart: a dot sized by magnitude for a planet, a disc with its lit part for the Moon, and the names the label placer then keeps clear of the stars. Pure: positions come in
// through `place`, the SVG goes out as text. The chart (chart.ts) lays the labels out with its own placer; here they are only asked for.
import type { SkyPoint } from "../projection.ts";
import type { Box } from "./labels.ts";
import { bodyRadius, type SkyBody } from "./bodies.ts";

/** The colour of a planet's dot, a Moon's lit part, and the dark part of a disc. */
export const BODY_COLOURS = { planet: "#ffe2a0", moon: "#f4f1e6", dark: "#252d4a", label: "#ffe2a0" } as const;
/** The least radius of the Moon's disc in pixels: it is drawn larger than its true size so that its phase can be seen on a wide chart. */
export const MOON_MIN_RADIUS = 7;
/** A disc this wide (radius in pixels) or wider shows its phase. */
export const PHASE_FROM_RADIUS = 4;

/** What a tap can land on among the bodies, in chart pixels. */
export interface BodyHit {
  x: number;
  y: number;
  id: string;
  /** The radius drawn, in pixels. */
  r: number;
}

/** A name a body asks for, to be placed beside its dot. */
export interface BodyLabel {
  rank: number;
  text: string;
  x: number;
  y: number;
  gap: number;
  fill: string;
}

export interface BodiesDrawn {
  svg: string;
  hits: BodyHit[];
  obstacles: Box[];
  labels: BodyLabel[];
}

const round = (n: number): string => n.toFixed(1);
const attr = (text: string): string => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * The shape of a disc's lit part as an SVG path, in a disc of radius `r` about the origin whose lit side is to the right (+x): a half circle on the lit side and a half ellipse for the terminator.
 * Below a lit fraction of 0.5 the terminator bulges toward the lit side (a crescent), above it away from it (gibbous). Nothing is lit at 0 and the whole disc is at 1.
 *
 * @param phase - The lit fraction, 0 to 1.
 * @param r - The disc's radius.
 * @returns The path's `d`, or an empty text for a new disc.
 *
 * @example
 * ```ts
 * import { litPath } from "./bodies-draw.ts";
 *
 * console.log(litPath(0.5, 10));
 * // M0 -10A10 10 0 0 1 0 10A0 10 0 0 0 0 -10Z
 * ```
 */
export function litPath(phase: number, r: number): string {
  const k = Math.max(0, Math.min(1, phase));
  if (k <= 0.002) return "";
  const f = (n: number): string => String(Math.round(n * 100) / 100);
  if (k >= 0.998) return `M0 ${f(-r)}A${f(r)} ${f(r)} 0 1 1 0 ${f(r)}A${f(r)} ${f(r)} 0 1 1 0 ${f(-r)}Z`;
  const rx = Math.abs(1 - 2 * k) * r;
  return `M0 ${f(-r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(r)}A${f(rx)} ${f(r)} 0 0 ${k <= 0.5 ? 0 : 1} 0 ${f(-r)}Z`;
}

/** The angle, in degrees on the screen (0 to the right, clockwise), of the position angle `limb` (from north through east) at a place, by where a little north and a little east of it land. */
function limbAngle(place: (point: SkyPoint) => [number, number] | undefined, at: [number, number], body: SkyBody): number {
  if (body.brightLimb === undefined) return 0;
  const north = place({ rightAscension: body.ra, declination: body.dec + (body.dec > 89 ? -0.5 : 0.5) });
  const east = place({ rightAscension: body.ra + 0.5 / Math.max(0.05, Math.cos((body.dec * Math.PI) / 180)), declination: body.dec });
  if (north === undefined || east === undefined) return 0;
  const sign = body.dec > 89 ? -1 : 1;
  const n = [(north[0] - at[0]) * sign, (north[1] - at[1]) * sign];
  const e = [east[0] - at[0], east[1] - at[1]];
  const pa = (body.brightLimb * Math.PI) / 180;
  const x = Math.sin(pa) * e[0]! + Math.cos(pa) * n[0]!;
  const y = Math.sin(pa) * e[1]! + Math.cos(pa) * n[1]!;
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/**
 * Draws the bodies a chart's limit lets through. A body is a dot sized by its magnitude as a star's is (brighter is larger); one with an apparent `size` is a disc at its true size where that is larger, and the Moon
 * (`id` `moon`) is always a disc, at least `MOON_MIN_RADIUS` wide. A disc whose true size is 4 pixels wide or more shows its phase: a dark disc with the lit part over it. A body fainter than `faintest` (the faintest magnitude
 * the chart draws at its zoom) is left out, the Moon never. Each carries `data-body` (its id), `data-phase` and `data-shape` (`dot` or `disc`) for a page's own styling and tests; a disc's lit part is a `path[data-lit]`.
 *
 * @param o - The bodies, the language, the chart's magnitude, the faintest magnitude drawn and the zoom's growth of a dot (`growOf`), the chart's size, and where a point of the sky lands (`place`).
 * @returns The SVG text, what a tap can land on, the boxes names keep off, and the names asked for.
 *
 * @example
 * ```ts
 * import { drawBodies } from "./bodies-draw.ts";
 *
 * const moon = { id: "moon", names: { en: "Moon", ja: "月" }, ra: 84, dec: 0, magnitude: -12, phase: 0.5 };
 * const out = drawBodies({ bodies: [moon], lang: "en", magnitude: 5, faintest: 5, grow: 1, width: 320, height: 200, place: () => [160, 100] });
 * console.log(out.hits[0]?.id, out.labels[0]?.text, out.svg.includes("data-lit"));
 * // moon Moon true
 * ```
 */
export function drawBodies(o: {
  bodies: readonly SkyBody[];
  lang: "en" | "ja";
  /** The chart's magnitude setting: a dot's size is reckoned from it, as a star's is. */
  magnitude: number;
  /** The faintest body drawn: the chart's magnitude, fainter as it zooms in. */
  faintest: number;
  grow: number;
  width: number;
  height: number;
  place: (point: SkyPoint) => [number, number] | undefined;
}): BodiesDrawn {
  let svg = "";
  const hits: BodyHit[] = [];
  const obstacles: Box[] = [];
  const labels: BodyLabel[] = [];
  // the brightest first, so that a faint one never hides a bright one
  const order = o.bodies.map((body, index) => ({ body, index })).filter(({ body }) => Number.isFinite(body.ra) && Number.isFinite(body.dec) && Number.isFinite(body.magnitude));
  order.sort((a, b) => b.body.magnitude - a.body.magnitude || a.index - b.index);
  for (const { body } of order) {
    const moon = body.id === "moon";
    if (!moon && body.magnitude > o.faintest) continue;
    const at = o.place({ rightAscension: body.ra, declination: body.dec });
    if (at === undefined || at[0] < -24 || at[0] > o.width + 24 || at[1] < -24 || at[1] > o.height + 24) continue;
    let r = bodyRadius(body.magnitude, o.magnitude, o.grow);
    // the disc at its true size, where the body gives one
    let trueR = 0;
    if (body.size !== undefined && Number.isFinite(body.size) && body.size > 0) {
      const aside = o.place({ rightAscension: body.ra, declination: body.dec + (body.dec > 89.99 ? -0.01 : 0.01) });
      trueR = aside === undefined ? 0 : ((body.size / 2) * Math.hypot(aside[0] - at[0], aside[1] - at[1])) / 36;
      r = Math.max(r, trueR);
    }
    if (moon) r = Math.max(MOON_MIN_RADIUS, Math.min(r, Math.max(o.width, o.height)));
    const phase = Number.isFinite(body.phase) ? Math.max(0, Math.min(1, body.phase)) : 1;
    const name = o.lang === "ja" ? body.names.ja : body.names.en;
    const disc = moon || trueR >= PHASE_FROM_RADIUS;
    const colour = moon ? BODY_COLOURS.moon : BODY_COLOURS.planet;
    const head = `<g data-body="${attr(body.id)}" data-phase="${phase.toFixed(2)}" data-shape="${disc ? "disc" : "dot"}"><title>${text(name)}</title>`;
    if (disc) {
      const angle = limbAngle(o.place, at, body);
      const lit = litPath(phase, r);
      svg += `${head}<g transform="translate(${round(at[0])} ${round(at[1])}) rotate(${round(angle)})"><circle r="${round(r)}" fill="${BODY_COLOURS.dark}" stroke="${colour}" stroke-opacity=".45" stroke-width="1"/>${lit === "" ? "" : `<path data-lit="" d="${lit}" fill="${colour}"/>`}</g></g>`;
    } else {
      svg += `${head}<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r)}" fill="${colour}" stroke="#0b1020" stroke-width="1"/></g>`;
    }
    hits.push({ x: at[0], y: at[1], id: body.id, r });
    obstacles.push({ x0: at[0] - r - 1, y0: at[1] - r - 1, x1: at[0] + r + 1, y1: at[1] + r + 1 });
    if (name !== "") labels.push({ rank: 800 + body.magnitude * 1e-3, text: name, x: at[0], y: at[1], gap: r + 4, fill: BODY_COLOURS.label });
  }
  return { svg: svg === "" ? "" : `<g data-layer="bodies">${svg}</g>`, hits, obstacles, labels };
}
