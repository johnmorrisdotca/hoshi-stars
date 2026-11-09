// What the whole-sky page draws, as strings: the geometry of the 88 constellations, their figures and the field stars in the unit box of a 2:1 map (1000 by 500), for one orientation and projection;
// the SVG of the map for the screen and for paper; and where the names go at a zoom. The numbers are the package's (`all-sky`, `boundaries`, `lines`, `milky-way`); the pixels are decided here.
import { allSkyGrid, allSkyLine, allSkyOutline, allSkyProject, type AllSkyFrame, type AllSkyOptions, type AllSkyPoint, type AllSkyProjection } from "../src/all-sky.ts";
import { boundaryOf } from "../src/boundaries.ts";
import { constellations } from "../src/constellations.ts";
import type { Culture } from "../src/culture.ts";
import { stars } from "../src/index.ts";
import { figures } from "../src/lines.ts";
import type { SkyPoint } from "../src/projection.ts";
import { BOUNDARY_DASH, labelOf } from "./chart.ts";
import { placeLabels, textSize, type Box } from "./labels.ts";

export const UNIT_W = 1000;
export const UNIT_H = 500;
export type Look = "night" | "paper";
export type Language = "en" | "ja";
export const LAYERS = ["milky", "grid", "boundaries", "lines", "names"] as const;
export type Layer = (typeof LAYERS)[number];

export const PALETTE = {
  night: { ground: "#0b1020", rim: "#46578c", grid: "#25304f", plane: "#3a4a78", boundary: "#46578c", line: "#7f9be6", asterism: "#c792ea", star: "#f4f6ff", name: "#b5c4ee", asterismName: "#d3b6f0", halo: "#0b1020" },
  paper: { ground: "#ffffff", rim: "#1b2240", grid: "#c8cfe0", plane: "#8f9ac0", boundary: "#7d88ad", line: "#2b4a9e", asterism: "#7b4fb0", star: "#1b2240", name: "#1b2240", asterismName: "#5b3a8a", halo: "#ffffff" },
} as const;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const round = (n: number): string => (Math.round(n * 10) / 10).toString();
const escapeXml = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** A run of picture points as path data. */
const pathOf = (runs: readonly (readonly AllSkyPoint[])[]): string => runs.map((run) => run.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`).join("")).join("");

/** The mean direction of some sky points, and the greatest angle from it to one of them (degrees). */
function middleOf(points: readonly SkyPoint[]): { middle: SkyPoint; reach: number } {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const ra = p.rightAscension * RAD;
    const dec = p.declination * RAD;
    x += Math.cos(dec) * Math.cos(ra);
    y += Math.cos(dec) * Math.sin(ra);
    z += Math.sin(dec);
  }
  const length = Math.hypot(x, y, z) || 1;
  const [ux, uy, uz] = [x / length, y / length, z / length];
  let reach = 0;
  for (const p of points) {
    const ra = p.rightAscension * RAD;
    const dec = p.declination * RAD;
    const dot = ux * Math.cos(dec) * Math.cos(ra) + uy * Math.cos(dec) * Math.sin(ra) + uz * Math.sin(dec);
    reach = Math.max(reach, Math.acos(Math.max(-1, Math.min(1, dot))) * DEG);
  }
  return { middle: { rightAscension: (Math.atan2(uy, ux) * DEG + 360) % 360, declination: Math.atan2(uz, Math.hypot(ux, uy)) * DEG }, reach };
}

export interface Region {
  abbreviation: string;
  /** The boundary as path data in the unit box. */
  d: string;
  /** How far the boundary reaches from the middle of the figure, in degrees. */
  reach: number;
  /** The middle of the figure in the unit box. */
  x: number;
  y: number;
}

export interface Figure {
  id: string;
  kind: "constellation" | "asterism" | "mansion";
  /** The lines as path data in the unit box. */
  d: string;
  reach: number;
  x: number;
  y: number;
  /** The IAU abbreviation when the figure is a constellation. */
  abbreviation: string | undefined;
}

export interface Geometry {
  options: AllSkyOptions;
  outline: string;
  grid: string;
  plane: string;
  regions: Region[];
  /** Field stars as `M x y h0` path data: the brightest, the middle and the faint ones. */
  stars: { bright: string; middle: string; faint: string };
  figuresOf(culture: Culture): Figure[];
}

const cache = new Map<string, Geometry>();

export function geometryOf(frame: AllSkyFrame, projection: AllSkyProjection): Geometry {
  const key = `${frame}|${projection}`;
  const found = cache.get(key);
  if (found !== undefined) return found;
  const options: AllSkyOptions = { width: UNIT_W, frame, projection };
  const grid = allSkyGrid(options, 30);
  const regions = constellations().map((c): Region => {
    const outlines = boundaryOf(c.abbreviation).outlines;
    const all = outlines.flat();
    const { reach } = middleOf(all);
    const figure = figures().find((f) => f.constellation.abbreviation === c.abbreviation)!;
    const { middle } = middleOf(figure.stars.length > 0 ? figure.stars : all);
    const at = allSkyProject(middle, options);
    return { abbreviation: c.abbreviation, d: pathOf(outlines.flatMap((outline) => allSkyLine(outline, options))), reach, x: at.x, y: at.y };
  });
  const classes: { bright: string[]; middle: string[]; faint: string[] } = { bright: [], middle: [], faint: [] };
  for (const star of stars()) {
    const at = allSkyProject(star, options);
    classes[star.magnitude <= 2.5 ? "bright" : star.magnitude <= 4.5 ? "middle" : "faint"].push(`M${round(at.x)} ${round(at.y)}h0`);
  }
  const figureCache = new WeakMap<Culture, Figure[]>();
  const geometry: Geometry = {
    options,
    outline: `${pathOf([allSkyOutline(options, 90)])}Z`,
    grid: pathOf(grid.filter((line) => !(line.kind === "parallel" && line.degrees === 0)).flatMap((line) => line.runs)),
    plane: pathOf(grid.filter((line) => line.kind === "parallel" && line.degrees === 0).flatMap((line) => line.runs)),
    regions,
    stars: { bright: classes.bright.join(""), middle: classes.middle.join(""), faint: classes.faint.join("") },
    figuresOf(culture) {
      let list = figureCache.get(culture);
      if (list === undefined) {
        list = figures(culture)
          .map((f): Figure => {
            const runs = f.segments.flatMap(([a, b]) => allSkyLine([a, b], options));
            const { middle, reach } = middleOf(f.stars);
            const at = allSkyProject(middle, options);
            return { id: f.asterism.id, kind: f.asterism.kind, d: pathOf(runs), reach, x: at.x, y: at.y, abbreviation: f.asterism.kind === "constellation" ? f.asterism.id : undefined };
          });
        figureCache.set(culture, list);
      }
      return list;
    },
  };
  cache.set(key, geometry);
  return geometry;
}

export interface MapSvgOptions {
  geometry: Geometry;
  culture: Culture;
  layers: ReadonlySet<Layer>;
  look: Look;
  /** The Milky Way's picture (a data address), if the layer is on. */
  milky: string | undefined;
  /** Geometry units for one output pixel: 1 on the screen (where `vector-effect` keeps the widths in pixels), less than 1 on paper. */
  px: number;
  /** True on the screen, where the strokes keep their width as the map zooms. */
  screen: boolean;
  /** The words for a link's accessible name, by IAU abbreviation (screen only). */
  nameOf?: (abbreviation: string) => string;
  /** Where a constellation is opened (screen only). */
  hrefOf?: (abbreviation: string) => string;
}

/** The map as the inside of an SVG whose viewBox is the unit box: ground, the Milky Way, the grid, boundaries, figures and stars. */
export function mapSvg(o: MapSvgOptions): string {
  const c = PALETTE[o.look];
  const { geometry: g, px, layers } = o;
  const ve = o.screen ? ' vector-effect="non-scaling-stroke"' : "";
  const w = (n: number): string => String(Math.max(0.01, Math.round(n * px * 100) / 100));
  let svg = `<defs><clipPath id="ws-clip-${o.look}"><path d="${g.outline}"/></clipPath></defs>`;
  svg += `<path d="${g.outline}" fill="${c.ground}"/>`;
  svg += `<g clip-path="url(#ws-clip-${o.look})">`;
  if (layers.has("milky") && o.milky !== undefined) svg += `<image data-layer="milky" href="${o.milky}" x="0" y="0" width="${UNIT_W}" height="${UNIT_H}" preserveAspectRatio="none"/>`;
  if (layers.has("grid")) svg += `<g data-layer="grid" fill="none" stroke-linecap="round"><path d="${g.grid}" stroke="${c.grid}" stroke-width="${w(0.8)}"${ve}/><path d="${g.plane}" stroke="${c.plane}" stroke-width="${w(1)}" stroke-dasharray="${w(5)} ${w(4)}"${ve}/></g>`;
  if (layers.has("boundaries")) {
    svg += `<g data-layer="boundaries" fill="none" stroke-linejoin="round">`;
    for (const r of g.regions) {
      const link = o.hrefOf !== undefined;
      const body = `<path class="bd" d="${r.d}" stroke="${c.boundary}" stroke-width="${w(o.look === "paper" ? 0.6 : 0.9)}" stroke-opacity="${o.look === "paper" ? 0.9 : 0.75}" stroke-dasharray="${w(BOUNDARY_DASH[0])} ${w(BOUNDARY_DASH[1])}"${ve}/>`;
      svg += link ? `<a class="c" data-abbr="${r.abbreviation}" href="${escapeXml(o.hrefOf!(r.abbreviation))}" tabindex="0" aria-label="${escapeXml(o.nameOf!(r.abbreviation))}">${body}</a>` : `<g>${body}</g>`;
    }
    svg += "</g>";
  } else if (o.hrefOf !== undefined) {
    svg += `<g data-layer="links" fill="none">`;
    for (const r of g.regions) svg += `<a class="c" data-abbr="${r.abbreviation}" href="${escapeXml(o.hrefOf(r.abbreviation))}" tabindex="0" aria-label="${escapeXml(o.nameOf!(r.abbreviation))}"><path class="bd" d="${r.d}" stroke="none"${ve}/></a>`;
    svg += "</g>";
  }
  if (layers.has("lines")) {
    svg += `<g data-layer="lines" fill="none" stroke-linecap="round" stroke-linejoin="round">`;
    for (const f of g.figuresOf(o.culture)) {
      const extra = f.kind === "asterism" && o.culture.id !== "chinese";
      const dashed = extra ? ` stroke-dasharray="${w(4)} ${w(3)}"` : "";
      svg += `<path class="fg" data-fig="${escapeXml(f.id)}" d="${f.d}" stroke="${extra ? c.asterism : c.line}" stroke-width="${w(o.look === "paper" ? 1 : 1.2)}"${dashed}${ve}/>`;
    }
    svg += "</g>";
  }
  const dot = (d: string, size: number, cls: string): string => `<path class="${cls}" d="${d}" stroke="${c.star}" stroke-width="${w(size)}" stroke-linecap="round" fill="none"${ve}/>`;
  svg += `<g data-layer="stars">${dot(g.stars.faint, o.look === "paper" ? 1.1 : 1.2, "faint")}${dot(g.stars.middle, o.look === "paper" ? 1.9 : 2.2, "mid")}${dot(g.stars.bright, o.look === "paper" ? 3.2 : 3.6, "bright")}</g>`;
  svg += "</g>";
  svg += `<path d="${g.outline}" fill="none" stroke="${c.rim}" stroke-width="${w(1.5)}"${ve}/>`;
  return svg;
}

export interface Label {
  /** The figure's id (a constellation's abbreviation in the Western and Japanese skies). */
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  /** True when the abbreviation stands in for the name. */
  short: boolean;
  /** An asterism's name is drawn in its own colour. */
  asterism: boolean;
}

export interface LayoutOptions {
  geometry: Geometry;
  culture: Culture;
  lang: Language;
  /** The map's size on the screen (or the sheet), in pixels at Fit. */
  width: number;
  zoom: number;
  panX: number;
  panY: number;
  fontSize: number;
}

/** Where the names go at this zoom: the largest regions first, each in the fullest form that fits its region and touches no name already placed, else its abbreviation, else left out. */
export function layoutLabels(o: LayoutOptions): Label[] {
  const { geometry: g, width } = o;
  const height = width / 2;
  const s = (width / UNIT_W) * o.zoom;
  const toX = (x: number): number => width / 2 + o.panX + (x - UNIT_W / 2) * s;
  const toY = (y: number): number => height / 2 + o.panY + (y - UNIT_H / 2) * s;
  const degree = (width / 360) * o.zoom;
  const regionReach = new Map(g.regions.map((r) => [r.abbreviation, r.reach]));
  interface Candidate {
    id: string;
    texts: string[];
    x: number;
    y: number;
    room: number;
    priority: number;
    abbreviation: string | undefined;
    asterism: boolean;
  }
  const list: Candidate[] = [];
  const asterisms = g.figuresOf(o.culture);
  const byId = new Map(asterisms.map((f) => [f.id, f]));
  const sky = o.culture;
  const figs = figures(sky);
  for (const fig of figs) {
    const f = byId.get(fig.asterism.id);
    if (f === undefined) continue;
    const name = labelOf(fig, sky, o.lang);
    const reach = f.abbreviation !== undefined ? (regionReach.get(f.abbreviation) ?? f.reach) : Math.max(f.reach, 1.5);
    const x = toX(f.x);
    const y = toY(f.y);
    if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
    // The dashed asterisms are for a closer look: at the whole sky they would crowd the constellations' names.
    if (f.kind === "asterism" && o.culture.id !== "chinese" && o.zoom < 2) continue;
    const texts = f.abbreviation !== undefined ? [name, f.abbreviation] : [name];
    list.push({ id: f.id, texts, x, y, room: 2 * reach * degree, priority: (f.kind === "mansion" ? 1000 : f.kind === "asterism" && o.culture.id !== "chinese" ? -1000 : 0) + reach, abbreviation: f.abbreviation, asterism: f.kind === "asterism" && o.culture.id !== "chinese" });
  }
  list.sort((a, b) => b.priority - a.priority);
  const boxes: Box[][] = [];
  const meta: Array<{ candidate: Candidate; text: string; short: boolean; offsets: Array<[number, number]> }> = [];
  const pad = 2;
  for (const candidate of list) {
    const variants: Array<{ text: string; short: boolean }> = [];
    for (let i = 0; i < candidate.texts.length; i += 1) {
      const size = textSize(candidate.texts[i]!, o.fontSize);
      // A name may spill a little over its region; an abbreviation needs a font that can be read.
      if (size.w <= candidate.room * 1.15 + 4) variants.push({ text: candidate.texts[i]!, short: i > 0 });
    }
    for (const variant of variants) {
      const size = textSize(variant.text, variant.short ? Math.max(8, o.fontSize - 2) : o.fontSize);
      const spots: Array<[number, number]> = [[0, 0], [0, size.h], [0, -size.h], [size.w * 0.75, 0], [-size.w * 0.75, 0], [size.w * 0.6, size.h], [-size.w * 0.6, size.h], [size.w * 0.6, -size.h], [-size.w * 0.6, -size.h]];
      const place = spots.map(([dx, dy]) => ({ x0: candidate.x + dx - size.w / 2 - pad, x1: candidate.x + dx + size.w / 2 + pad, y0: candidate.y + dy - size.h / 2 - pad / 2, y1: candidate.y + dy + size.h / 2 + pad / 2 }));
      const inside = place.filter((b) => b.x0 >= 2 && b.x1 <= width - 2 && b.y0 >= 2 && b.y1 <= height - 2);
      if (inside.length > 0) {
        boxes.push(inside);
        meta.push({ candidate, text: variant.text, short: variant.short, offsets: inside.map((b): [number, number] => [(b.x0 + b.x1) / 2 - candidate.x, (b.y0 + b.y1) / 2 - candidate.y]) });
        break;
      }
    }
  }
  // Each candidate offers the places of its fullest form that fits the picture; `placeLabels` takes the first free one.
  const chosen = placeLabels(boxes, []);
  const out: Label[] = [];
  chosen.forEach((at, i) => {
    if (at === undefined) return;
    const m = meta[i]!;
    out.push({ id: m.candidate.id, text: m.text, x: m.candidate.x + m.offsets[at]![0], y: m.candidate.y + m.offsets[at]![1], size: m.short ? Math.max(8, o.fontSize - 2) : o.fontSize, short: m.short, asterism: m.candidate.asterism });
  });
  return out;
}

/** The names as SVG text in the map's pixels, each with a halo of the ground colour so it reads over lines. */
export function labelsSvg(labels: readonly Label[], look: Look): string {
  const c = PALETTE[look];
  return labels
    .map((l) => `<text data-id="${escapeXml(l.id)}" x="${round(l.x)}" y="${round(l.y)}" font-size="${l.size}" text-anchor="middle" dominant-baseline="central" fill="${l.asterism ? c.asterismName : c.name}" stroke="${c.halo}" stroke-width="${look === "paper" ? 3 : 3}" stroke-opacity="${look === "paper" ? 0.85 : 0.8}" paint-order="stroke" stroke-linejoin="round"${l.short ? ' opacity="0.8"' : ""}>${escapeXml(l.text)}</text>`)
    .join("");
}

/** A whole map for paper, self-contained: `px` wide, with the names in place, white ground and dark ink. */
export function paperSvg(o: { geometry: Geometry; culture: Culture; lang: Language; layers: ReadonlySet<Layer>; milky: string | undefined; px: number; widthMm: number; heightMm: number }): string {
  const scale = o.px / UNIT_W;
  const labels = o.layers.has("names") ? layoutLabels({ geometry: o.geometry, culture: o.culture, lang: o.lang, width: o.px, zoom: 1, panX: 0, panY: 0, fontSize: 13 }) : [];
  const body = mapSvg({ geometry: o.geometry, culture: o.culture, layers: o.layers, look: "paper", milky: o.milky, px: UNIT_W / o.px, screen: false });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.px} ${o.px / 2}" width="${o.widthMm}mm" height="${o.heightMm}mm" style="display:block"><g transform="scale(${scale})">${body}</g>${labelsSvg(labels, "paper")}</svg>`;
}
