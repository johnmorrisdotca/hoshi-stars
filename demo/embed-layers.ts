// The embed page of the sky by distance in 3D: it draws what its address says, for a site that cannot run script of its own, and takes the family's hands (a drag turns it, a pinch or Ctrl and the wheel zoom). Its buttons step the limit out and in and zoom. The address is read as text:
//   ?dist=100                 the limit in light-years (10, 50, 100, 500, 1000, any number up to 3 million, or all; 100 when left out)     &lang=ja   Japanese words
//   &yaw=-90&tilt=10          how far it is turned (degrees)                                                                                    &spin=off  held still (it opens turning, one turn in 30 seconds, unless the reader prefers reduced motion)
import { createViewController } from "@johnmorrisdotca/kazoku-ui/view-controls";
import { stepLimit } from "../src/distance.ts";
import { frameCredit } from "./frame-credit.ts";
import { layersChoiceOf } from "./layers-code.ts";
import { mountLayers } from "./layers-view.ts";
import { layersFor, loadDistances, renderLegend } from "./distance-layers.ts";
import { say } from "./words.ts";

const query = new URLSearchParams(location.search);
if (query.get("lang") === "ja") document.documentElement.lang = "ja";
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const stage = $("sp-stage");
const choice = layersChoiceOf(query);
const lang = document.documentElement.lang === "ja" ? "ja" : "en";
let limit = choice.limit;
frameCredit(lang === "ja");

const mount = mountLayers({
  host: $("sp-view"),
  labels: $("sp-labels"),
  lang: () => lang,
  onShown(layers, layout, live) {
    stage.dataset["state"] = live ? "live" : "fallback";
    $("sp-fallback").hidden = live;
    stage.dataset["scale"] = layout.scale;
    stage.dataset["things"] = String(layers.things.length);
    renderLegend($("dist-legend"), layers, lang);
    $("sp-view").setAttribute("aria-label", say("ly_view", { limit: layers.limit === Number.POSITIVE_INFINITY ? say("distAllWords") : say("distLimitText", { n: layers.limit.toLocaleString(lang) }) }));
    document.documentElement.dataset["ready"] = "true";
  },
});

const controller = createViewController({
  turnable: true,
  speed: 12,
  limits: { tiltMax: 85, zoomMin: 0.5, zoomMax: 10 },
  initial: { yaw: choice.yaw, tilt: choice.tilt },
  onChange: (state) => {
    showSpin(state.turning);
    mount.pose({ yaw: state.yaw, tilt: state.tilt, roll: state.roll ?? 0, zoom: state.zoom, panX: state.panX, panY: state.panY });
  },
});
controller.bind($("sp-view"));
const spin = $("spin");
function showSpin(turning: boolean): void {
  spin.textContent = say(turning ? "sp_pause" : "sp_play");
  spin.setAttribute("aria-pressed", String(turning));
}
spin.addEventListener("click", () => (controller.state.turning ? controller.pause() : controller.play()));
showSpin(false);
if (query.get("spin") !== "off" && !matchMedia("(prefers-reduced-motion: reduce)").matches) controller.play();

function show(): void {
  loadDistances(show);
  const layers = layersFor(limit);
  if (layers === undefined) {
    renderLegend($("dist-legend"), undefined, lang);
    return;
  }
  void mount.show(layers);
}
for (const [id, label, act] of [
  ["nearer", say("distNearer"), () => { limit = stepLimit(limit, -1); show(); }],
  ["farther", say("distFarther"), () => { limit = stepLimit(limit, 1); show(); }],
  ["zoom-in", lang === "ja" ? "拡大" : "Zoom in", () => controller.zoomBy(1.6)],
  ["zoom-out", lang === "ja" ? "縮小" : "Zoom out", () => controller.zoomBy(1 / 1.6)],
] as Array<[string, string, () => void]>) {
  const button = $(id);
  button.setAttribute("aria-label", label);
  button.title = label;
  if (id === "nearer" || id === "farther") button.textContent = label;
  button.addEventListener("click", act);
}
$("sp-nogl").textContent = say("ly_noGl");
mount.pose({ yaw: controller.state.yaw, tilt: controller.state.tilt, roll: 0, zoom: 1, panX: 0, panY: 0 }, true);
show();
