// The faint stars on the demo's maps: the loader for UCAC4's tiles (served beside the page, in `faint-tiles/`), the patch of sky a view shows, and what to draw from the tiles that are here.
// A view asks for stars to a depth (the telescope rule, `faintDepthOf`); the tiles it needs are fetched in the background and the chart is drawn again when they arrive. Nothing here runs at rest.
import { faintSky, faintTilesFor, type FaintField } from "../src/faint.ts";
import { FAINT_DOT_CAP, faintDepthOf, FAINT_FROM, fromScreen, type FaintDraw, type Layer, type View } from "./chart.ts";

const RADIANS = Math.PI / 180;
/** A view that would need more tiles than this (a wide view with a deep limit) draws no faint stars: zoom in for them. */
const MAX_TILES = 48;
/** The most stars taken from the field before the screen's edges cut it: the field is a circle round a rectangle. */
const FIELD_CAP = FAINT_DOT_CAP * 2;

const tiles = faintSky({ baseUrl: new URL("faint-tiles/", document.baseURI).href });
const failed = new Set<string>();

/** The round patch of sky a chart of `width` by `height` pixels shows, with a margin so that a small pan finds its tiles already here; `undefined` where it is too wide to be of use. */
export function fieldOf(view: View, width: number, height: number): FaintField | undefined {
  let radius = 0;
  const sinDec = Math.sin(view.dec * RADIANS);
  const cosDec = Math.cos(view.dec * RADIANS);
  for (const [x, y] of [[0, 0], [width, 0], [0, height], [width, height], [width / 2, 0], [width / 2, height], [0, height / 2], [width, height / 2]] as const) {
    const at = fromScreen(view, width, height, x, y);
    if (at === undefined) return undefined;
    const cosine = sinDec * Math.sin(at.declination * RADIANS) + cosDec * Math.cos(at.declination * RADIANS) * Math.cos((at.rightAscension - view.ra) * RADIANS);
    radius = Math.max(radius, Math.acos(Math.max(-1, Math.min(1, cosine))) / RADIANS);
  }
  return { rightAscension: view.ra, declination: view.dec, radius: radius * 1.08 + 0.05 };
}

/**
 * The faint stars for a view, from the tiles that are here, and whether more are on the way. `onMore` is called when tiles arrive: the page draws again. `undefined` where the layer is off or the view is too wide or too shallow.
 */
export function faintFor(view: View, width: number, height: number, magnitude: number, layers: ReadonlySet<Layer>, onMore: () => void): (FaintDraw & { state: "ready" | "loading" | "failed" }) | undefined {
  if (!layers.has("faint")) return undefined;
  const limit = faintDepthOf(magnitude, view.zoom);
  if (limit <= FAINT_FROM) return undefined;
  const field = fieldOf(view, width, height);
  if (field === undefined) return undefined;
  const need = faintTilesFor(field, limit);
  if (need.length > MAX_TILES) return undefined;
  const got = tiles.stars(field, limit, FIELD_CAP);
  const key = need.map((tile) => `${tile.level}/${tile.band}-${tile.column}`).join(",");
  if (!got.loaded && !failed.has(key)) {
    tiles.load(field, limit).then(onMore, () => {
      failed.add(key);
      onMore();
    });
  }
  return { stars: got.stars, depth: got.depth, state: got.loaded ? "ready" : failed.has(key) ? "failed" : "loading" };
}
