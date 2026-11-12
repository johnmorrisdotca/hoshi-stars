// Draws the page's own markers on the chart: a track joining a group in date order under the stars' names, a dot for each marker, and the names the label placer then keeps clear of the stars and of each other.
// Pure: positions come in through `place`, the SVG goes out as text. The chart (chart.ts) lays the labels out with its own placer; here they are only asked for.
import type { SkyPoint } from "../projection.ts";
import type { Box } from "./labels.ts";
import { markerTracks, visibleMarkers, type MarkerRange, type SkyMarker } from "./markers.ts";

/** The colour of a marker that names none. */
export const MARKER_COLOUR = "#ff8fb1";
/** The width of a marker's dot in pixels when it names none. */
export const MARKER_SIZE = 9;

/** What a click can land on among the markers, in chart pixels. */
export interface MarkerHit {
  x: number;
  y: number;
  /** The id the marker answers to. */
  id: string;
  /** Its place in the list given. */
  index: number;
  /** The dot's radius in pixels. */
  r: number;
}

/** A name a marker asks for, to be placed beside its dot. */
export interface MarkerLabel {
  rank: number;
  text: string;
  x: number;
  y: number;
  /** How far from the middle of the dot the name stands clear. */
  gap: number;
  fill: string;
  opacity: number;
}

export interface MarkersDrawn {
  /** The joined groups, to draw under the stars. */
  tracks: string;
  /** The dots, to draw over them. */
  dots: string;
  hits: MarkerHit[];
  /** The dots as boxes the names of the stars and the deep-sky objects keep off. */
  obstacles: Box[];
  labels: MarkerLabel[];
}

const attr = (text: string): string => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const round = (n: number): string => n.toFixed(1);

/**
 * Draws the markers a time range lets through. Dots are drawn only on the chart (a margin of 24 pixels past its edge), a track runs on past the edge; a dot has a thin night-coloured rim so it reads over a star, and
 * carries `data-marker` (its id), `data-group` and `data-opacity` for a page's own styling and tests.
 *
 * @param o - The markers, the time range, the groups to join, the chart's size, where a point of the sky lands (`place`), and a path through sky points drawn as the chart draws its own lines (`path`: broken at the far side and at a seam).
 * @returns The track and the dots as SVG text, what a click can land on, the boxes names keep off, and the names asked for.
 *
 * @example
 * ```ts
 * import { drawMarkers } from "./markers-draw.ts";
 *
 * const out = drawMarkers({ markers: [{ ra: 84, dec: 0, label: "Here" }], width: 320, height: 200, place: () => [160, 100], path: () => "", ground: "#0b1020" });
 * console.log(out.hits.length, out.labels[0]?.text);
 * // 1 Here
 * ```
 */
export function drawMarkers(o: {
  markers: readonly SkyMarker[];
  range?: MarkerRange | undefined;
  tracks?: boolean | readonly string[] | undefined;
  width: number;
  height: number;
  place: (point: SkyPoint) => [number, number] | undefined;
  path: (points: readonly SkyPoint[]) => string;
  ground: string;
}): MarkersDrawn {
  const visible = visibleMarkers(o.markers, o.range);
  let tracks = "";
  for (const track of markerTracks(visible, o.tracks)) {
    const d = o.path(track.items.map((item) => ({ rightAscension: item.marker.ra, declination: item.marker.dec })));
    if (d === "") continue;
    const colour = track.items.find((item) => item.marker.color !== undefined)?.marker.color ?? MARKER_COLOUR;
    const opacity = 0.75 * Math.min(...track.items.map((item) => item.opacity));
    tracks += `<path data-track="${attr(track.group)}" d="${d}" fill="none" stroke="${attr(colour)}" stroke-width="1.5" stroke-opacity="${round(opacity)}" stroke-linejoin="round"/>`;
  }
  let dots = "";
  const hits: MarkerHit[] = [];
  const obstacles: Box[] = [];
  const labels: MarkerLabel[] = [];
  visible.forEach((item, order) => {
    const at = o.place({ rightAscension: item.marker.ra, declination: item.marker.dec });
    if (at === undefined || at[0] < -24 || at[0] > o.width + 24 || at[1] < -24 || at[1] > o.height + 24) return;
    const size = item.marker.size !== undefined && Number.isFinite(item.marker.size) && item.marker.size > 0 ? item.marker.size : MARKER_SIZE;
    const r = size / 2;
    const colour = item.marker.color ?? MARKER_COLOUR;
    const label = item.marker.label;
    const title = label === undefined || label === "" ? "" : `<title>${text(label)}</title>`;
    dots += `<g data-marker="${attr(item.id)}"${item.marker.group === undefined ? "" : ` data-group="${attr(item.marker.group)}"`} data-opacity="${round(item.opacity)}">${title}<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${round(r)}" fill="${attr(colour)}" fill-opacity="${round(item.opacity)}" stroke="${o.ground}" stroke-width="1.5"/></g>`;
    hits.push({ x: at[0], y: at[1], id: item.id, index: item.index, r });
    obstacles.push({ x0: at[0] - r - 1, y0: at[1] - r - 1, x1: at[0] + r + 1, y1: at[1] + r + 1 });
    if (label !== undefined && label !== "") labels.push({ rank: 50 + order * 1e-4, text: label, x: at[0], y: at[1], gap: r + 4, fill: colour, opacity: Math.max(0.5, item.opacity) });
  });
  return { tracks, dots, hits, obstacles, labels };
}
