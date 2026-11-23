// The sky chart the demo and the embed page draw: stars, constellation lines, boundaries, names, Messier objects and a grid, as one SVG string, in any of the seven projections.
// It only calls the package: the numbers (positions, colours, outlines, figures) are the package's; the pixels are decided here.
import { blackBodyColour, starByHr, starColour, starTemperatureK, stars, type Star } from "../index.ts";
import { boundaries, constellationAt } from "../boundaries.ts";
import type { Constellation } from "../constellations.ts";
import { blackHoles, type BlackHole } from "../black-holes.ts";
import { messier, type DeepSkyObject } from "../deep-sky.ts";
import { deepSkyShape } from "../deep-sky-shape.ts";
import { DEEP_COLOURS, drawDeep } from "./deep-draw.ts";
import type { CultureFigure } from "../lines.ts";
import type { Culture } from "../culture.ts";
import { western } from "../cultures/western.ts";
import { faintMarks } from "./faint-layer.ts";
import { brightShown } from "../star-filter-bright.ts";
import { distanceNarrowed, starFilterActive, starPasses } from "../star-filter.ts";
import { dimsForUncertainty, UNCERTAIN_OPACITY } from "./uncertainty.ts";
import type { SkyPoint } from "../projection.ts";
import { placeLabels, textSize, withMeasure, type Box } from "./labels.ts";
import { figureLinesSvg, figureNameSvg, starNamesSvg } from "./sky-labels-svg.ts";
import { drawMarkers, type MarkerHit } from "./markers-draw.ts";
import { eclipticLine, normaliseBodies } from "./bodies.ts";
import { drawBodies } from "./bodies-draw.ts";
import { centreOfConstellation, centroidOf, centroidsSeen, figureById, figuresOf, figuresOfCulture, labelOf, reachOfConstellation } from "./figures.ts";
import { milkyWay } from "./milky-layer.ts";
import { crossesSeam, nearEnough, pathOf, placer } from "./place.ts";
import { LAYERS, type ChartOptions, type Hit, type Language, type Layer, type View } from "./types.ts";
import { DEFAULT_VIEW, defaultZoom, dragged, escapeXml, fitScale, fromScreen, onPicture, pictureZoomCap, round, toScreen, zoomedAbout, ZOOM_MAX, ZOOM_MIN } from "./view-math.ts";

export { FAINT_DOT_CAP, faintDepthOf, FAINT_FROM, FAINT_JUMP_ZOOM, FAINT_PAST_GAP, type FaintDraw } from "./faint-layer.ts";
export { centreOfConstellation, figureById, figuresOf, labelOf, reachOfConstellation };
export { nearEnough };
export { LAYERS, type ChartOptions, type Hit, type Language, type Layer, type View };

export { DEFAULT_VIEW, defaultZoom, dragged, fitScale, fromScreen, onPicture, pictureZoomCap, toScreen, zoomedAbout, ZOOM_MAX, ZOOM_MIN };

/** How much bigger the stars are drawn as the chart zooms in. */
/** The faintest star in the catalogue: zooming in never asks for more than there is. */
const CATALOGUE_FAINTEST = Math.max(...stars().map((star) => star.magnitude));

/**
 * The faintest magnitude drawn: the slider's limit at 1x, and fainter as you zoom in, as a telescope shows more (2.5 magnitudes
 * for each tenfold zoom), up to the faintest star there is.
 */
export const depthOf = (magnitude: number, zoom: number): number =>
  Math.round(Math.min(CATALOGUE_FAINTEST, magnitude + 2.5 * Math.log10(Math.max(1, zoom))) * 100) / 100;

export const growOf = (zoom: number): number => Math.round(Math.min(1.8, 0.8 + zoom * 0.12) * 100) / 100;


/** Constellation boundaries are dashed on every map of the demo (this one and the whole-sky page): dash and gap in pixels. */
export const BOUNDARY_DASH = [5, 4] as const;

/**
 * Where the Twenty-Eight Mansions of a culture divide the sky: the hour circle (right ascension, J2000) through each mansion's determinative star (距星), its star numbered 1, for every mansion where
 * exactly one held star has that number. A mansion whose star 1 is not in our data (氐, 牛, 觜 and 參 in Wikidata) or is given twice (斗宿) has none: no circle is guessed. Empty for a culture
 * without mansions.
 *
 * @example
 * import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";
 * import { mansionMeridians } from "@johnmorrisdotca/hoshi-stars/chart";
 * const jiao = mansionMeridians(chinese).find((m) => m.id === "jiao3-xiu4");
 * console.log(jiao?.hr, jiao?.rightAscension); // 5056 (Spica), its right ascension in degrees
 */
export function mansionMeridians(culture: Culture): Array<{ id: string; hr: number; rightAscension: number }> {
  const out: Array<{ id: string; hr: number; rightAscension: number }> = [];
  for (const asterism of culture.asterisms()) {
    if (asterism.kind !== "mansion") continue;
    const first = Object.entries(asterism.numbers ?? {}).filter(([, n]) => n === 1);
    if (first.length !== 1) continue;
    const star = starByHr(Number(first[0]![0]));
    if (star !== undefined) out.push({ id: asterism.id, hr: star.hr, rightAscension: star.rightAscension });
  }
  return out;
}
/** The declinations an hour circle is drawn through, pole to pole. */
const MERIDIAN_DECS: readonly number[] = Array.from({ length: 89 }, (_, i) => -88 + i * 2);

const COLOURS = { ecliptic: "#d9a441", ground: "#0b1020", grid: "#25304f", equator: "#3a4a78", lines: "#6f93e0", linesOn: "#ffd86b", asterism: "#c792ea", asterismName: "#c9a8ec", boundary: "#46578c", boundaryOn: "#ffd86b", name: "#8da3d8", nameOn: "#ffe49a", star: "#f4f6ff", deep: "#e0a458", pick: "#ff7a59", near: "#5fe0c4", hole: "#d68cff", holeCore: "#04060d", mansion: "#a8875a" };


/** The black hole's own symbol, `k` times its full size (smaller when the chart is zoomed out, so a crowded patch stays readable): a dark disc ringed in violet with a jet each way for a stellar-mass one, a dashed ring round a dark centre for a quiet one, a dark disc inside a tilted ring for a supermassive one. A candidate is drawn fainter. */
function holeShape(hole: BlackHole, x: number, y: number, pick: boolean, k: number): string {
  const cx = Math.round(x * 10) / 10;
  const cy = Math.round(y * 10) / 10;
  const n = (v: number): number => Math.round(v * k * 10) / 10;
  const stroke = pick ? COLOURS.pick : COLOURS.hole;
  const width = Math.max(1, (pick ? 2 : 1.4) * Math.sqrt(k));
  const fade = hole.status === "candidate" && !pick ? ' stroke-opacity=".6"' : "";
  const line = `fill="none" stroke="${stroke}" stroke-width="${width}"${fade}`;
  const core = `fill="${COLOURS.holeCore}" stroke="${stroke}" stroke-width="${width}"${fade}`;
  switch (hole.kind) {
    case "stellar": return `<path d="M${cx} ${cy - n(5.5)}v${-n(4)}M${cx} ${cy + n(5.5)}v${n(4)}" ${line}/><circle cx="${cx}" cy="${cy}" r="${n(3.6)}" ${core}/>`;
    case "quiet": return `<circle cx="${cx}" cy="${cy}" r="${n(4.8)}" ${core} stroke-dasharray="${n(2.2)} ${n(2)}"/>`;
    default: return `<ellipse cx="${cx}" cy="${cy}" rx="${n(8)}" ry="${n(3)}" transform="rotate(-22 ${cx} ${cy})" ${line}/><circle cx="${cx}" cy="${cy}" r="${n(3.2)}" ${core}/>`;
  }
}

/** How big the black holes are drawn: full size from a zoom of 2, down to 0.6 of it when the whole sky is on the chart. */
const holeScale = (zoom: number): number => (zoom >= 2 ? 1 : zoom <= 0.5 ? 0.6 : 0.6 + (0.4 * (zoom - 0.5)) / 1.5);

/** The black holes that are named at any zoom, since they are the ones people look for. */
const FAMOUS_HOLES: ReadonlySet<string> = new Set(["sagittarius-a", "m87", "m31", "cygnus-x-1", "gaia-bh1"]);

interface Place {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  box: Box;
}

interface Label {
  rank: number;
  places: Place[];
  text: string;
  size: number;
  weight: number;
  fill: string;
  opacity: number;
}

/** A label for a marker at (`x`, `y`): to its right, else its left, above or below, else at a corner, `gap` pixels clear of it. */
function besideMarker(text: string, size: number, x: number, y: number, gap: number, fill: string, opacity: number): Omit<Label, "rank"> {
  const { w, above, below } = textSize(text, size);
  const top = (base: number): number => base - above;
  const row = (base: number, left: number, anchor: Place["anchor"]): Place => ({ x: anchor === "middle" ? left + w / 2 : anchor === "end" ? left + w : left, y: base, anchor, box: { x0: left - 1, y0: top(base), x1: left + w + 1, y1: base + below } });
  const places = [row(y + 4, x + gap, "start"), row(y + 4, x - gap - w, "end"), row(y - gap - 2, x - w / 2, "middle"), row(y + gap + above, x - w / 2, "middle"), row(y - gap, x + gap * 0.6, "start"), row(y - gap, x - gap * 0.6 - w, "end"), row(y + gap + above, x + gap * 0.6, "start"), row(y + gap + above, x - gap * 0.6 - w, "end")];
  return { places, text, size, weight: 400, fill, opacity };
}

/** A name that matters (the picked one, a famous one) is offered more places when the ones beside its marker are taken: further out, `rings` times. */
function withFarther(text: string, x: number, y: number, gap: number, fill: string, rings: number): Omit<Label, "rank"> {
  const near = besideMarker(text, 11, x, y, gap, fill, 1);
  const out = Array.from({ length: rings }, (_, i) => besideMarker(text, 11, x, y, gap + 16 * (i + 1), fill, 1).places);
  return { ...near, places: [...near.places, ...out.flat()] };
}

export interface Chart {
  svg: string;
  hits: Hit[];
  /** The markers drawn, for a tap to land on; markers come before the stars in a tap. */
  markerHits: MarkerHit[];
  /** The faint stars drawn: how many, and the magnitude they are complete to here. `undefined` where none were asked for. */
  faint?: { drawn: number; depth: number };
  /** The deep-sky pictures the view needs and has not been given: the page fetches them and draws again. */
  wanted: string[];
  /** The deep-sky pictures drawn with some of them on the chart (`DeepSkyPicture.id`): the page shows their credits beside the chart (`pictureCredits`). */
  pictures: string[];
}

/** One frame of the chart: an SVG string of the size asked, and what a tap can land on. */
export function chart(o: ChartOptions): Chart {
  return withMeasure(o.measure, () => drawChart(o));
}

function drawChart(o: ChartOptions): Chart {
  const { width, height, layers, lang } = o;
  const culture = o.culture ?? western;
  const drawn = figuresOfCulture(culture).list;
  const place = placer(o, width, height);
  const view: View = o;
  const hits: Hit[] = [];
  let body = `<rect width="${width}" height="${height}" fill="${COLOURS.ground}"/>`;
  const inside = (at: [number, number], margin = 24): boolean => at[0] > -margin && at[0] < width + margin && at[1] > -margin && at[1] < height + margin;

  if (layers.has("milky")) body += milkyWay(view, place, width, height);

  if (layers.has("grid")) {
    let d = "";
    for (let ra = 0; ra < 360; ra += 30) {
      const meridian: SkyPoint[] = [];
      for (let dec = -90; dec <= 90; dec += 3) meridian.push({ rightAscension: ra, declination: dec });
      d += pathOf(view, place, meridian);
    }
    for (const dec of [-60, -30, 30, 60]) {
      const parallel: SkyPoint[] = [];
      for (let ra = 0; ra <= 360; ra += 3) parallel.push({ rightAscension: ra, declination: dec });
      d += pathOf(view, place, parallel);
    }
    const equator: SkyPoint[] = [];
    for (let ra = 0; ra <= 360; ra += 3) equator.push({ rightAscension: ra, declination: 0 });
    body += `<path d="${d}" fill="none" stroke="${COLOURS.grid}" stroke-width="1"/><path d="${pathOf(view, place, equator)}" fill="none" stroke="${COLOURS.equator}" stroke-width="1"/>`;
  }

  // the ecliptic, the Sun's yearly path: dashed, in a warm colour of its own, under the stars (it is the Earth's, so not drawn in the sky seen from another star)
  if (o.sky === undefined && layers.has("ecliptic")) body += `<path data-layer="ecliptic" d="${pathOf(view, place, eclipticLine(1))}" fill="none" stroke="${COLOURS.ecliptic}" stroke-width="1.2" stroke-opacity=".75" stroke-dasharray="6 4"/>`;

  const seen = o.sky === undefined ? undefined : new Map(o.sky.map((star) => [star.id, star]));
  const near = new Set(o.near ?? []);
  const nearConstellations = new Set([...near].filter((key) => key.startsWith("C:")).map((key) => key.slice(2)));
  const deep = drawDeep({ width, height, zoom: o.zoom, place, marks: layers.has("deep") && o.distance === undefined, pictures: layers.has("pictures") && o.distance === undefined, catalogue: o.catalogue ?? messier(), shapeOf: o.shapeOf ?? deepSkyShape, picked: o.picked, near, ready: o.readyPictures ?? new Set(), base: o.pictureBase ?? "./", previous: o.previousPictures ?? new Set() });
  body += deep.under;
  if (seen === undefined && (layers.has("boundaries") || o.highlight !== undefined || nearConstellations.size > 0)) {
    let quiet = "";
    let loud = "";
    let neighbours = "";
    for (const boundary of boundaries({ step: 2 })) {
      const on = boundary.constellation.abbreviation === o.highlight;
      const next = nearConstellations.has(boundary.constellation.abbreviation);
      if (!on && !next && !layers.has("boundaries")) continue;
      const d = boundary.outlines.map((ring) => pathOf(view, place, ring)).join("");
      if (on) loud += d;
      else if (next) neighbours += d;
      else quiet += d;
    }
    body += `<path d="${quiet}" fill="none" stroke="${COLOURS.boundary}" stroke-width="1" stroke-dasharray="${BOUNDARY_DASH.join(" ")}"/><path d="${neighbours}" fill="none" stroke="${COLOURS.near}" stroke-width="1.6" stroke-dasharray="${BOUNDARY_DASH.join(" ")}"/><path d="${loud}" fill="none" stroke="${COLOURS.boundaryOn}" stroke-width="1.6" stroke-dasharray="${BOUNDARY_DASH.join(" ")}"/>`;
  }

  // the Chinese sky's own division: the mansions' hour circles, dashed like the boundaries, in a warm colour of their own
  if (seen === undefined && layers.has("mansions")) {
    let d = "";
    for (const meridian of mansionMeridians(culture)) d += pathOf(view, place, MERIDIAN_DECS.map((dec) => ({ rightAscension: meridian.rightAscension, declination: dec })));
    if (d !== "") body += `<path d="${d}" fill="none" stroke="${COLOURS.mansion}" stroke-width="1" stroke-dasharray="${BOUNDARY_DASH.join(" ")}" data-layer="mansions"/>`;
  }

  if (o.overlay?.lines !== undefined) body += figureLinesSvg(o.overlay.lines);

  if ((layers.has("lines") && o.overlay?.lines === undefined) || o.highlight !== undefined) {
    let quiet = "";
    let other = "";
    let loud = "";
    let ringed = "";
    for (const figure of drawn) {
      const on = figure.asterism.id === o.highlight;
      if (!on && (!layers.has("lines") || o.overlay?.lines !== undefined)) continue;
      // a lit figure with no line to draw (one star, or one star held of several) rings its stars, so the pick is seen on the map as on its card
      if (on && figure.segments.length === 0) {
        for (const star of figure.stars) {
          const shown = seen === undefined ? star : seen.get(`hr-${star.hr}`);
          const at = shown === undefined ? undefined : place(shown);
          if (at !== undefined && at[0] >= -12 && at[0] <= width + 12 && at[1] >= -12 && at[1] <= height + 12) ringed += `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="9" fill="none" stroke="${COLOURS.linesOn}" stroke-width="1.6" data-figure-star="${star.hr}"/>`;
        }
      }
      const side = figure.asterism.kind === "asterism" && culture.id !== "chinese";
      for (const [star, next] of figure.segments) {
        const a = seen === undefined ? star : seen.get(`hr-${star.hr}`);
        const b = seen === undefined ? next : seen.get(`hr-${next.hr}`);
        if (a === undefined || b === undefined) continue;
        const from = place(a);
        const to = place(b);
        if (from === undefined || to === undefined || crossesSeam(view, a, b)) continue;
        if ((from[0] < 0 && to[0] < 0) || (from[0] > width && to[0] > width) || (from[1] < 0 && to[1] < 0) || (from[1] > height && to[1] > height)) continue;
        const piece = `M${round(from[0])} ${round(from[1])}L${round(to[0])} ${round(to[1])}`;
        if (on) loud += piece;
        else if (side) other += piece;
        else quiet += piece;
      }
    }
    body += `<path d="${quiet}" fill="none" stroke="${COLOURS.lines}" stroke-width="1.2" stroke-opacity=".8"/><path d="${other}" fill="none" stroke="${COLOURS.asterism}" stroke-width="1.2" stroke-opacity=".85" stroke-dasharray="4 3"/><path d="${loud}" fill="none" stroke="${COLOURS.linesOn}" stroke-width="2.2"/>`;
    body += ringed;
  }

  const obstacles: Box[] = [{ x0: -1e4, y0: -1e4, x1: 0, y1: 1e4 }, { x0: width, y0: -1e4, x1: 1e4, y1: 1e4 }, { x0: -1e4, y0: -1e4, x1: 1e4, y1: 0 }, { x0: -1e4, y0: height, x1: 1e4, y1: 1e4 }, ...(o.keepClear ?? [])];
  const around = (x: number, y: number, r: number): Box => ({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
  const marked = o.sky === undefined && o.markers !== undefined && o.markers.length > 0 ? drawMarkers({ markers: o.markers, range: o.timeRange, tracks: o.tracks, width, height, place, path: (points) => pathOf(view, place, points), ground: COLOURS.ground }) : undefined;
  if (marked !== undefined) {
    body += marked.tracks;
    obstacles.push(...marked.obstacles);
  }
  const deepLabels: Label[] = [];
  obstacles.push(...deep.obstacles);
  body += deep.over;
  for (const l of deep.labels) deepLabels.push({ rank: l.rank, ...besideMarker(l.key, 11, l.x, l.y, l.gap, l.fill, 1) });
  for (const h of deep.hits) hits.push({ x: h.x, y: h.y, kind: "deep", key: h.key, reach: h.reach });

  const holeLabels: Label[] = [];
  if (o.sky === undefined && (layers.has("holes") || o.pickedHole !== undefined)) {
    for (const hole of blackHoles()) {
      const isPicked = hole.id === o.pickedHole;
      if (!layers.has("holes") && !isPicked) continue;
      const at = place(hole);
      if (at === undefined || !inside(at)) continue;
      body += `<g data-hole="${hole.id}" data-kind="${hole.kind}">${holeShape(hole, at[0], at[1], isPicked, holeScale(o.zoom))}</g>`;
      obstacles.push(around(at[0], at[1], 8 * holeScale(o.zoom)));
      const famous = FAMOUS_HOLES.has(hole.id);
      if (isPicked || (famous ? o.zoom >= 1.5 : hole.kind === "supermassive" ? o.zoom >= 8 : o.zoom >= 3)) holeLabels.push({ rank: isPicked ? -1 : famous ? 1500 : 1600 + (hole.kind === "supermassive" ? 100 : 0) + (hole.status === "candidate" ? 50 : 0), ...(isPicked ? withFarther(hole.name, at[0], at[1], 9, COLOURS.pick, 2) : famous ? withFarther(hole.name, at[0], at[1], 9, COLOURS.hole, 1) : besideMarker(hole.name, 11, at[0], at[1], 9, COLOURS.hole, 1)) });
      hits.push({ x: at[0], y: at[1], kind: "hole", key: hole.id });
    }
  }

  const grow = growOf(o.zoom);
  // the page's bodies: drawn over the stars; their taps come first in `hits` so that a planet beside a star is the one picked
  const cleanBodies = o.sky === undefined && o.bodies !== undefined ? normaliseBodies(o.bodies) : [];
  const bodied = cleanBodies.length > 0 ? drawBodies({ bodies: cleanBodies, lang, magnitude: o.magnitude, faintest: o.magnitude + 2.5 * Math.log10(Math.max(1, o.zoom)), grow, width, height, place }) : undefined;
  if (bodied !== undefined) {
    obstacles.push(...bodied.obstacles);
    for (const h of bodied.hits) hits.push({ x: h.x, y: h.y, kind: "body", key: h.id, reach: Math.max(22, h.r + 14) });
  }
  let faintDrawn: Chart["faint"];
  const filter = o.filter === undefined || !starFilterActive(o.filter) ? undefined : o.filter;
  // the faint stars have no distance: a narrowed distance leaves them out, and a magnitude limit cuts the list where it ends
  const faintStars = o.faint === undefined || filter === undefined ? o.faint : distanceNarrowed(filter) ? undefined : filter.magnitudeLimit === undefined ? o.faint : { ...o.faint, stars: o.faint.stars.filter((star) => star.magnitude <= filter.magnitudeLimit!) };
  if (o.sky === undefined && o.distance === undefined && layers.has("faint") && faintStars !== undefined) {
    const marks = faintMarks(faintStars, place, inside, grow);
    body += marks.svg;
    faintDrawn = { drawn: marks.drawn, depth: marks.depth };
  }
  const namedLimit = Math.min(o.magnitude, 1.6 + Math.log2(o.zoom) * 1.1);
  let dots = "";
  let ring = "";
  const starLabels: Label[] = [];
  const depth = filter?.magnitudeLimit === undefined ? depthOf(o.magnitude, o.zoom) : Math.min(depthOf(o.magnitude, o.zoom), filter.magnitudeLimit);
  const plot = (key: string, point: SkyPoint, magnitude: number, colour: () => string, text: string | undefined, designation: string, dim = false): void => {
    const isNear = near.has(`S:${key}`);
    const at = place(point);
    if (at === undefined || !inside(at)) return;
    const r = Math.max(0.7, (o.magnitude - Math.max(magnitude, -2)) * 0.55 + 1.1) * grow;
    dots += `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r)}" fill="${colour()}"${dim ? ` fill-opacity="${UNCERTAIN_OPACITY}" data-uncertain="C"` : ""}/>`;
    hits.push({ x: at[0], y: at[1], kind: "star", key });
    if (r >= 2.6) obstacles.push(around(at[0], at[1], r + 1));
    if (key === o.picked) ring += `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r + 6)}" fill="none" stroke="${COLOURS.pick}" stroke-width="2"/>`;
    else if (isNear) ring += `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r + 5)}" fill="none" stroke="${COLOURS.near}" stroke-width="1.8"/>`;
    if (isNear && key !== o.picked) starLabels.push({ rank: 900, ...besideMarker(text ?? designation, 11, at[0], at[1], r + 6, COLOURS.near, 1) });
    else if (layers.has("names") && o.overlay?.names === undefined && text !== undefined && magnitude <= namedLimit) starLabels.push({ rank: key === o.picked ? -1 : 1000 + magnitude, ...besideMarker(text, 11, at[0], at[1], r + 3, COLOURS.star, 0.85) });
  };
  if (o.sky === undefined && o.distance !== undefined) {
    const { colours, uncertain } = o.distance;
    const nameLimit = 2.4 + Math.log2(o.zoom) * 1.1;
    for (const thing of o.distance.layers.things) {
      const at = place({ rightAscension: thing.rightAscension, declination: thing.declination });
      if (at === undefined || !inside(at)) continue;
      const colour = thing.uncertain ? uncertain : colours[thing.band]!;
      const magnitude = thing.magnitude ?? 9;
      const r = Math.max(1.8, (6 - Math.max(magnitude, -2)) * 0.5 + 1.3) * grow;
      const x = round(at[0]);
      const y = round(at[1]);
      const mark = `data-dist-band="${thing.uncertain ? "uncertain" : thing.band}" data-dist-kind="${thing.kind}"`;
      if (thing.uncertain) dots += `<circle ${mark} cx="${x}" cy="${y}" r="${round(r + 1)}" fill="none" stroke="${colour}" stroke-width="1" stroke-opacity=".85"/>`;
      else if (thing.kind === "deep-sky") dots += `<path ${mark} d="M${x} ${round(at[1] - r - 1.5)}L${round(at[0] + r + 1.5)} ${y}L${x} ${round(at[1] + r + 1.5)}L${round(at[0] - r - 1.5)} ${y}Z" fill="${colour}"/>`;
      else dots += `<circle ${mark} cx="${x}" cy="${y}" r="${round(r)}" fill="${colour}"/>`;
      if (thing.kind === "star") hits.push({ x: at[0], y: at[1], kind: "star", key: thing.id.slice(3) });
      else if (thing.kind === "deep-sky") hits.push({ x: at[0], y: at[1], kind: "deep", key: thing.id });
      if (r >= 2.6) obstacles.push(around(at[0], at[1], r + 1));
      const star = thing.kind === "star" ? starByHr(Number(thing.id.slice(3))) : undefined;
      const text = thing.name === undefined ? undefined : lang === "ja" && star?.nameJa !== undefined ? star.nameJa : thing.name;
      if (layers.has("names") && text !== undefined && !thing.uncertain && (thing.kind === "star" ? magnitude <= nameLimit : thing.band <= 1 || o.zoom >= 3)) starLabels.push({ rank: 1000 + thing.band * 40 + magnitude, ...besideMarker(text, 11, at[0], at[1], r + 3, colour, 0.95) });
    }
  } else if (o.sky === undefined) {
    const kept = filter === undefined ? undefined : brightShown(filter);
    const drawn = stars({ magnitude: depth }).filter((star) => kept === undefined || kept.has(star.hr));
    for (const key of near) {
      const extra = key.startsWith("S:") ? starByHr(Number(key.slice(2))) : undefined;
      if (extra !== undefined && extra.magnitude > depth && (kept === undefined || kept.has(extra.hr))) drawn.push(extra);
    }
    // a star farther from the middle than the chart's corner cannot land on it: it is passed by without being placed (the stars drawn are the same)
    const reachable = nearEnough(view, width, height);
    for (const star of drawn) if (reachable === undefined || reachable(star)) plot(String(star.hr), star, star.magnitude, () => starColour(star), lang === "ja" ? star.nameJa ?? star.name : star.name, star.designation ?? `HR ${star.hr}`, o.showUncertainty === true && dimsForUncertainty(star));
  } else {
    for (const star of o.sky) {
      if (star.magnitude > depth && !near.has(`S:${keyOfSeen(star.id)}`)) continue;
      if (filter !== undefined && !starPasses(filter, star.magnitude, star.lightYears)) continue;
      const sun = star.id === "sun";
      plot(keyOfSeen(star.id), star, star.magnitude, () => (star.colourIndex === undefined ? "#ffffff" : blackBodyColour(starTemperatureK(star.colourIndex))), sun ? (lang === "ja" ? "太陽" : "Sun") : lang === "ja" ? (star.star !== undefined && "nameJa" in star.star ? star.star.nameJa : undefined) ?? star.name : star.name, star.designation ?? `HR ${keyOfSeen(star.id)}`);
    }
  }

  const nameLabels: Label[] = [];
  const middles = o.sky === undefined ? undefined : centroidsSeen(o.sky, culture);
  if (layers.has("names") && o.zoom >= 0.25) {
    for (const figure of drawn) {
      const id = figure.asterism.id;
      const middle = middles === undefined ? centroidOf(id, culture) : middles.get(id);
      const at = middle === undefined ? undefined : place(middle);
      if (at === undefined || !inside(at, -8)) continue;
      const on = id === o.highlight;
      const isNear = nearConstellations.has(id);
      const small = figure.asterism.kind === "asterism" && culture.id !== "chinese";
      const size = on ? 15 : small ? 12 : 13;
      const text = labelOf(figure, culture, lang);
      const weight = on || isNear ? 700 : 400;
      const { w, h, above, below } = textSize(text, size, weight);
      const places = [[0, 0], [0, -h], [0, h], [-w * 0.6, 0], [w * 0.6, 0], [0, -2 * h], [0, 2 * h], [-w * 0.6, -h], [w * 0.6, -h], [-w * 0.6, h], [w * 0.6, h], [0, -3 * h], [0, 3 * h]].map(([dx, dy]) => {
        const x = at[0] + dx!;
        const y = at[1] + dy!;
        return { x, y, anchor: "middle" as const, box: { x0: x - w / 2 - 1, y0: y - above, x1: x + w / 2 + 1, y1: y + below } };
      });
      const rank = (small ? 1003.5 : 1001.8) + 1.2 * (1 - Math.min(1, reachOfConstellation(id, culture) / 50)) - (figure.asterism.kind === "mansion" ? 0.8 : 0);
      nameLabels.push({ rank: on ? -1 : isNear ? 899 : rank, places, text, size, weight, fill: on ? COLOURS.nameOn : isNear ? COLOURS.near : small ? COLOURS.asterismName : COLOURS.name, opacity: on || isNear ? 1 : 0.75 });
    }
  }
  let members = "";
  for (const star of deep.inside) {
    const at = place(star);
    if (at !== undefined && inside(at) && star.magnitude <= depth) members += `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(Math.max(0.7, (o.magnitude - Math.max(star.magnitude, -2)) * 0.55 + 1.1) * grow + 4)}" fill="none" stroke="${DEEP_COLOURS.member}" stroke-width="1" stroke-dasharray="2 2" data-inside="${star.hr}"/>`;
  }
  body += `<g>${dots}</g>${ring}${members}`;
  if (bodied !== undefined) body += bodied.svg;
  const markerLabels: Label[] = marked === undefined ? [] : marked.labels.map((l) => ({ rank: l.rank, ...withFarther(l.text, l.x, l.y, l.gap, l.fill, 2), opacity: l.opacity }));
  if (marked !== undefined) body += marked.dots;

  for (const label of o.overlay?.names?.labels ?? []) obstacles.push({ x0: label.x0 - 2, y0: label.y0 - 1, x1: label.x1 + 2, y1: label.y1 + 1 });
  const bodyLabels: Label[] = bodied === undefined ? [] : bodied.labels.map((l) => ({ rank: l.rank, ...withFarther(l.text, l.x, l.y, l.gap, l.fill, 1) }));
  const labels = [...markerLabels, ...bodyLabels, ...starLabels, ...nameLabels, ...deepLabels, ...holeLabels].sort((a, b) => a.rank - b.rank);
  const chosen = placeLabels(labels.map((l) => l.places.map((p) => p.box)), obstacles);
  let text = "";
  labels.forEach((l, i) => {
    const at = chosen[i];
    if (at === undefined) return;
    const p = l.places[at]!;
    text += `<text x="${round(p.x)}" y="${round(p.y)}" text-anchor="${p.anchor}" font-size="${l.size}" font-weight="${l.weight}" fill="${l.fill}" fill-opacity="${l.opacity}">${escapeXml(l.text)}</text>`;
  });
  body += `<g font-family="system-ui, sans-serif"${culture.id === "chinese" ? ' lang="zh-Hant"' : ""} pointer-events="none" stroke="${COLOURS.ground}" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${text}</g>`;

  if (o.overlay?.names !== undefined) body += starNamesSvg(o.overlay.names);
  if (o.overlay?.lines !== undefined) body += figureNameSvg(o.overlay.lines);

  return { svg: `<g font-family="system-ui, sans-serif">${body}</g>`, hits, markerHits: marked?.hits ?? [], wanted: deep.wanted, pictures: deep.pictures, ...(faintDrawn === undefined ? {} : { faint: faintDrawn }) };
}

/** The key a seen star has on the chart and in a pick: the HR number as text, or `sun`. */
export const keyOfSeen = (id: string): string => (id.startsWith("hr-") ? id.slice(3) : id);

/** The constellation under a pixel of the chart, or `undefined` off the sky. */
export function constellationUnder(view: View, width: number, height: number, x: number, y: number): Constellation | undefined {
  const at = fromScreen(view, width, height, x, y);
  return at === undefined ? undefined : constellationAt(at);
}

/**
 * The figure of a culture nearest a pixel of the chart, within `reach` pixels of one of its lines or stars. Only the figures a tap should find: the asterisms, and every figure of a culture that has no constellations (the Chinese sky).
 *
 * @param view - The chart's view.
 * @param width - The chart's width in pixels.
 * @param height - The chart's height in pixels.
 * @param x - The pixel.
 * @param y - The pixel.
 * @param culture - The sky culture drawn.
 * @param reach - How near a line or star must be, in pixels.
 * @returns The figure, or `undefined` where none is near.
 *
 * @example
 * ```ts
 * import { chinese } from "../src/cultures/chinese.ts";
 * import { DEFAULT_VIEW, figureUnder } from "./chart.ts";
 *
 * console.log(figureUnder(DEFAULT_VIEW, 480, 360, 240, 180, chinese)?.asterism.name);
 * ```
 */
export function figureUnder(view: View, width: number, height: number, x: number, y: number, culture: Culture, reach = 12): CultureFigure | undefined {
  const place = placer(view, width, height);
  let best: CultureFigure | undefined;
  let nearest = reach * reach;
  for (const figure of figuresOfCulture(culture).list) {
    if (figure.asterism.kind === "constellation") continue;
    const spots = figure.stars.map((star) => place(star));
    const ends = figure.segments.map(([a, b]) => [place(a), place(b)] as const);
    for (const at of spots) {
      if (at === undefined) continue;
      const d = (at[0] - x) ** 2 + (at[1] - y) ** 2;
      if (d < nearest) {
        nearest = d;
        best = figure;
      }
    }
    for (const [from, to] of ends) {
      if (from === undefined || to === undefined) continue;
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const length = dx * dx + dy * dy;
      const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - from[0]) * dx + (y - from[1]) * dy) / length));
      const d = (from[0] + t * dx - x) ** 2 + (from[1] + t * dy - y) ** 2;
      if (d < nearest) {
        nearest = d;
        best = figure;
      }
    }
  }
  return best;
}

export type { BlackHole, DeepSkyObject, Star };
