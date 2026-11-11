// The embed page: it draws what its address says, for a site that cannot run script of its own, and takes the family's hands: a drag turns it, a pinch or Ctrl and the wheel zooms,
// the keys and the + and - buttons zoom, and the plain wheel scrolls the page at the opening view. Where it looks is written back into its own address. The address is read as text:
//   ?proj=stereographic  one of the seven projections         &ra=84&dec=0&zoom=3     where it looks (degrees) and how far in (0.1 to 8000; left out: Orion, 90 degrees wide, 60 under 600 px)
//   &mag=5               the faintest star                   &layers=milky,lines,names,pictures,faint,grid  or none (also boundaries, deep: every deep-sky object at its true size)
//   &lang=ja             constellation names in Japanese     &c=Ori                  one constellation brighter, with its boundary
//   &culture=chinese     the sky culture drawn: western (the 88 constellations and asterisms, the default), japanese or chinese
//   &from=HR5459        the sky seen from a star (Bright Star Catalogue number: Alpha Centauri; it needs a distance)
//   &star-names=12      names on the 12 brightest stars in view (&star-names-magnitude=1.5 names those brighter than 1.5)   &constellation-lines=0.2  faint constellation lines, the one under the pointer at full strength
//   &label-size=14&label-case=upper  the look of those names: label-font, -size, -weight, -colour, -halo, -halo-width, -case, -letter-spacing, -leader, -leader-colour, -offset (or the page's --hoshi-label-* custom properties)
//   &dist=100            the sky out to 100 light-years only (10, 50, 100, 500, 1000, any number, or all), each distance band in its own colour, with a legend
//   &near=S:2491         ring what is near a star (S:<HR number>), a Messier object (D:M31) or a constellation (C:Ori)   &by=space  measure the stars' nearness in space
import { chart, defaultZoom, pictureZoomCap, toScreen, ZOOM_MAX, type View } from "./chart.ts";
import { choiceOf } from "./choice.ts";
import { cultureOf } from "./cultures.ts";
import { attachHands } from "./hands.ts";
import { viewpointOf, skyOf } from "./from.ts";
import { nearbyOf } from "./nearby.ts";
import { faintFor } from "./faint.ts";
import { createDeepFetcher, TIER_ZOOM } from "./deep.ts";
import { frameCredit } from "./frame-credit.ts";
import { lookOf } from "./sky-labels-svg.ts";
import { createOverlay, lookIdOf } from "./sky-overlay.ts";
import type { SkyProjector } from "../src/sky-labels.ts";
import { BAND_COLOURS, layersFor, loadDistances, renderLegend, UNCERTAIN_COLOUR } from "./distance-layers.ts";

const frame = document.getElementById("frame")!;
const sky = document.getElementById("sky")!;
const tools = document.getElementById("tools")!;
const sizeOf = (): { width: number; height: number } => ({ width: Math.max(1, Math.round(frame.clientWidth)), height: Math.max(1, Math.round(frame.clientHeight)) });
let { width, height } = sizeOf();
const choice = choiceOf(new URLSearchParams(location.search), width, height);
const ja = choice.lang === "ja";
frameCredit(ja);
const seen = skyOf(viewpointOf(choice.from));
const near = nearbyOf(choice.nearTo, choice.nearBy ?? "sky", seen);
const nearKeys = near === undefined ? [] : near.rows.map((row) => row.key);
const target = choice.nearTo !== undefined && !choice.nearTo.startsWith("C:") ? choice.nearTo.slice(2) : undefined;
const highlight = choice.highlight ?? (choice.nearTo?.startsWith("C:") ? choice.nearTo.slice(2) : undefined);
let view: View = { projection: choice.projection, ra: choice.ra, dec: choice.dec, zoom: choice.zoom };
const opening = (): number => defaultZoom(view.projection, width, height);
const start = { ...view };
const askedZoom = new URLSearchParams(location.search).has("zoom");
const home = (): View => ({ ...start, zoom: askedZoom ? start.zoom : opening() });

frame.setAttribute("aria-label", ja ? "星空の図" : "A chart of the sky");
for (const [id, label] of [["zoom-in", ja ? "拡大" : "Zoom in"], ["zoom-out", ja ? "縮小" : "Zoom out"], ["reset", ja ? "元の位置に戻す" : "Back to the start"]] as const) {
  const button = document.getElementById(id)!;
  button.setAttribute("aria-label", label);
  button.title = label;
}

const WIDE: readonly string[] = ["equirectangular", "mollweide", "hammer"];
const query = new URLSearchParams(location.search);
const overlay = createOverlay();
const projector: SkyProjector = (ra, dec, out) => {
  const at = toScreen(view, width, height, { rightAscension: ra, declination: dec });
  if (at === undefined) return false;
  out.x = at[0];
  out.y = at[1];
  return true;
};
const configureOverlay = (): void => overlay.configure({ names: choice.starNames, strength: choice.lineStrength, look: lookIdOf(query.get("label-look")), style: lookOf(document.documentElement, query), lang: choice.lang, maxLength: WIDE.includes(choice.projection) ? width / 2 : undefined });
configureOverlay();
const legend = document.createElement("ul");
legend.className = "dist-legend";
legend.dataset["testid"] = "dist-legend";
legend.hidden = choice.limit === undefined;
frame.append(legend);
if (choice.limit !== undefined) loadDistances(() => schedule());

const fetcher = createDeepFetcher("./", () => schedule());
/** The pictures the last frame chose, so they keep their places as the view moves. */
let chosenPictures: ReadonlySet<string> = new Set();

function draw(): void {
  const frameBox = frame.getBoundingClientRect();
  const at = tools.getBoundingClientRect();
  const keepClear = [{ x0: at.left - frameBox.left - 4, y0: at.top - frameBox.top - 4, x1: at.right - frameBox.left + 4, y1: at.bottom - frameBox.top + 4 }];
  const credit = document.querySelector("[data-testid='frame-credit']")?.getBoundingClientRect();
  if (credit !== undefined) keepClear.push({ x0: credit.left - frameBox.left - 4, y0: credit.top - frameBox.top - 4, x1: credit.right - frameBox.left + 4, y1: credit.bottom - frameBox.top + 4 });
  const faint = seen === undefined ? faintFor(view, width, height, choice.magnitude, choice.layers, schedule) : undefined;
  if (choice.layers.has("deep") && view.zoom >= TIER_ZOOM) void fetcher.loadTier();
  const room = { width, height };
  if (seen === undefined) overlay.update(projector, room, keepClear);
  const layers = choice.limit === undefined || seen !== undefined ? undefined : layersFor(choice.limit);
  if (choice.limit !== undefined) renderLegend(legend, layers, ja ? "ja" : "en");
  const drawn = chart({ ...choice, ...view, overlay: seen === undefined ? { lines: overlay.lines, names: layers === undefined ? overlay.names : undefined } : undefined, distance: layers === undefined ? undefined : { layers, colours: BAND_COLOURS, uncertain: UNCERTAIN_COLOUR }, culture: cultureOf(choice.cultureId), width, height, keepClear, highlight, near: nearKeys, picked: target, sky: seen, faint, catalogue: fetcher.catalogue(), shapeOf: fetcher.shapeOf(), readyPictures: fetcher.ready, pictureBase: "./", previousPictures: chosenPictures });
  chosenPictures = new Set(drawn.wanted);
  // a picture already on the page keeps its element across a redraw, so it is never blank for a frame
  const kept = new Map<string, Element>();
  sky.querySelectorAll("image[data-pic]").forEach((node) => kept.set(node.getAttribute("data-pic")!, node));
  sky.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ja ? "星空の図" : "A chart of the sky"}">${drawn.svg}</svg>`;
  sky.querySelectorAll("image[data-pic]").forEach((node) => {
    const old = kept.get(node.getAttribute("data-pic")!);
    if (old === undefined) return;
    old.setAttribute("transform", node.getAttribute("transform")!);
    old.setAttribute("opacity", node.getAttribute("opacity")!);
    node.replaceWith(old);
  });
  fetcher.want(drawn.wanted);
  document.documentElement.dataset.ready = "true";
}

let queued = false;
function schedule(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    draw();
  });
}

let written: ReturnType<typeof setTimeout> | undefined;
function writeAddress(): void {
  clearTimeout(written);
  written = setTimeout(() => {
    const query = new URLSearchParams(location.search);
    query.set("ra", view.ra.toFixed(2));
    query.set("dec", view.dec.toFixed(2));
    query.set("zoom", String(Math.round(view.zoom * 100) / 100));
    try {
      history.replaceState(null, "", `?${query.toString()}`);
    } catch {
      // A frame that may not rewrite its own address keeps the chart all the same.
    }
  }, 150);
}

const hands = attachHands(frame, {
  view: () => view,
  size: () => ({ width, height }),
  opening,
  home,
  zoomCap: (at, x, y) => (choice.layers.has("pictures") ? pictureZoomCap(at, width, height, x, y) : ZOOM_MAX),
  moved(next, final) {
    view = next;
    schedule();
    if (final) writeAddress();
  },
});

document.getElementById("zoom-in")!.addEventListener("click", () => hands.zoomBy(1.6));
document.getElementById("zoom-out")!.addEventListener("click", () => hands.zoomBy(1 / 1.6));
document.getElementById("reset")!.addEventListener("click", () => {
  view = home();
  hands.sync();
  schedule();
  writeAddress();
});

overlay.attach(frame, schedule);

addEventListener("resize", () => {
  ({ width, height } = sizeOf());
  configureOverlay();
  if (!new URLSearchParams(location.search).has("zoom")) view = { ...view, zoom: opening() };
  hands.sync();
  draw();
});

hands.sync();
draw();
