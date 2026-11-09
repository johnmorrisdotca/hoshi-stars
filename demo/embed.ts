// The embed page: it draws what its address says, for a site that cannot run script of its own, and takes the family's hands: a drag turns it, a pinch or Ctrl and the wheel zooms,
// the keys and the + and - buttons zoom, and the plain wheel scrolls the page at the opening view. Where it looks is written back into its own address. The address is read as text:
//   ?proj=stereographic  one of the seven projections         &ra=84&dec=0&zoom=3     where it looks (degrees) and how far in (0.1 to 500; left out: Orion, 90 degrees wide, 60 under 600 px)
//   &mag=5               the faintest star                   &layers=milky,lines,names,grid  or none (also boundaries, deep)
//   &lang=ja             constellation names in Japanese     &c=Ori                  one constellation brighter, with its boundary
//   &culture=chinese     the sky culture drawn: western (the 88 constellations and asterisms, the default), japanese or chinese
//   &from=HR5459        the sky seen from a star (Bright Star Catalogue number: Alpha Centauri; it needs a distance)
//   &near=S:2491         ring what is near a star (S:<HR number>), a Messier object (D:M31) or a constellation (C:Ori)   &by=space  measure the stars' nearness in space
import { chart, defaultZoom, type View } from "./chart.ts";
import { choiceOf } from "./choice.ts";
import { cultureOf } from "./cultures.ts";
import { attachHands } from "./hands.ts";
import { viewpointOf, skyOf } from "./from.ts";
import { nearbyOf } from "./nearby.ts";
import { faintFor } from "./faint.ts";

const frame = document.getElementById("frame")!;
const sky = document.getElementById("sky")!;
const tools = document.getElementById("tools")!;
const sizeOf = (): { width: number; height: number } => ({ width: Math.max(1, Math.round(frame.clientWidth)), height: Math.max(1, Math.round(frame.clientHeight)) });
let { width, height } = sizeOf();
const choice = choiceOf(new URLSearchParams(location.search), width, height);
const ja = choice.lang === "ja";
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

function draw(): void {
  const frameBox = frame.getBoundingClientRect();
  const at = tools.getBoundingClientRect();
  const keepClear = [{ x0: at.left - frameBox.left - 4, y0: at.top - frameBox.top - 4, x1: at.right - frameBox.left + 4, y1: at.bottom - frameBox.top + 4 }];
  const faint = seen === undefined ? faintFor(view, width, height, choice.magnitude, choice.layers, schedule) : undefined;
  sky.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ja ? "星空の図" : "A chart of the sky"}">${chart({ ...choice, ...view, culture: cultureOf(choice.cultureId), width, height, keepClear, highlight, near: nearKeys, picked: target, sky: seen, faint }).svg}</svg>`;
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

addEventListener("resize", () => {
  ({ width, height } = sizeOf());
  if (!new URLSearchParams(location.search).has("zoom")) view = { ...view, zoom: opening() };
  hands.sync();
  draw();
});

hands.sync();
draw();
