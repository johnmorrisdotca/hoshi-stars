// The embed page: it draws what its address says, for a site that cannot run script of its own, and takes the family's hands: a drag turns it, a pinch or Ctrl and the wheel zooms,
// the keys and the + and - buttons zoom, and the plain wheel scrolls the page at the opening view. Where it looks is written back into its own address. The address is read as text:
//   ?proj=stereographic  one of the seven projections         &ra=84&dec=0&zoom=3     where it looks (degrees) and how far in (0.1 to 500; left out: Orion, 90 degrees wide, 60 under 600 px)
//   &mag=5               the faintest star                   &layers=milky,lines,names,grid  or none (also boundaries, deep)
//   &lang=ja             constellation names in Japanese     &c=Ori                  one constellation brighter, with its boundary
//   &near=S:2491         ring what is near a star (S:<HR number>), a Messier object (D:M31) or a constellation (C:Ori)   &by=space  measure the stars' nearness in space
import "../src/chart.ts";
import type { HoshiChart, ViewChangeDetail } from "../src/chart.ts";
import { choiceOf } from "./choice.ts";

const frame = document.getElementById("frame") as unknown as HoshiChart;
const tools = document.getElementById("tools")!;
const query = new URLSearchParams(location.search);
const choice = choiceOf(query, frame.size.width || 480, frame.size.height || 360);
const ja = choice.lang === "ja";
const askedZoom = query.has("zoom");

frame.setAttribute("projection", choice.projection);
frame.setAttribute("ra", String(choice.ra));
frame.setAttribute("dec", String(choice.dec));
if (askedZoom) frame.setAttribute("zoom", String(choice.zoom));
frame.setAttribute("magnitude", String(choice.magnitude));
frame.setAttribute("layers", [...choice.layers].join(",") || "none");
frame.setAttribute("lang", choice.lang);
if (choice.highlight !== undefined) frame.setAttribute("constellation", choice.highlight);
if (choice.nearTo !== undefined) frame.setAttribute("near", choice.nearTo);
if (choice.nearBy === "space") frame.setAttribute("by", "space");
frame.setAttribute("aria-label", ja ? "星空の図" : "A chart of the sky");
for (const [id, label] of [["zoom-in", ja ? "拡大" : "Zoom in"], ["zoom-out", ja ? "縮小" : "Zoom out"], ["reset", ja ? "元の位置に戻す" : "Back to the start"]] as const) {
  const button = document.getElementById(id)!;
  button.setAttribute("aria-label", label);
  button.title = label;
}

frame.keepClear = () => {
  const frameBox = frame.getBoundingClientRect();
  const at = tools.getBoundingClientRect();
  return [{ x0: at.left - frameBox.left - 4, y0: at.top - frameBox.top - 4, x1: at.right - frameBox.left + 4, y1: at.bottom - frameBox.top + 4 }];
};
frame.addEventListener("hoshi-draw", () => {
  document.documentElement.dataset.ready = "true";
});

let written: ReturnType<typeof setTimeout> | undefined;
function writeAddress(view: ViewChangeDetail["view"]): void {
  clearTimeout(written);
  written = setTimeout(() => {
    const next = new URLSearchParams(location.search);
    next.set("ra", view.ra.toFixed(2));
    next.set("dec", view.dec.toFixed(2));
    next.set("zoom", String(Math.round(view.zoom * 100) / 100));
    try {
      history.replaceState(null, "", `?${next.toString()}`);
    } catch {
      // A frame that may not rewrite its own address keeps the chart all the same.
    }
  }, 150);
}
frame.addEventListener("hoshi-viewchange", (event) => {
  const { view, final } = (event as CustomEvent<ViewChangeDetail>).detail;
  if (final) writeAddress(view);
});

document.getElementById("zoom-in")!.addEventListener("click", () => frame.zoomBy(1.6));
document.getElementById("zoom-out")!.addEventListener("click", () => frame.zoomBy(1 / 1.6));
document.getElementById("reset")!.addEventListener("click", () => {
  frame.reset();
});
