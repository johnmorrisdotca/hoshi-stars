// The embed page of the constellation in 3D: it draws what its address says, for a site that cannot run script of its own, and takes the family's hands (a drag turns it, a pinch or Ctrl and the wheel zooms, the keys turn and
// zoom). Its buttons turn it 90 degrees, bring it back to the view from the Earth, and zoom. The address is read as text:
//   ?c=Ori                    the constellation (the IAU abbreviation; Orion when left out)     &from=HR5459   the star it is seen from (a Bright Star Catalogue number: Alpha Centauri)
//   &yaw=-90&tilt=10          how far it is turned (degrees)                                     &lang=ja       Japanese words        &theme=light  the paper look (the device's when left out)
//   &spin=off                 held still (it opens turning, one turn in 30 seconds, unless the reader prefers reduced motion)
import { createViewController } from "@johnmorrisdotca/kazoku-ui/view-controls";
import { constellation } from "../src/constellations.ts";
import { viewpointOf } from "./from.ts";
import { mountSpace } from "./space-view.ts";
import { lookNow } from "./thumbs.ts";
import { say } from "./words.ts";
import { frameCredit } from "./frame-credit.ts";

const query = new URLSearchParams(location.search);
if (query.get("lang") === "ja") document.documentElement.lang = "ja";
if (query.get("theme") === "light" || query.get("theme") === "dark") document.documentElement.dataset["theme"] = query.get("theme")!;
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const stage = $("sp-stage");
const host = $("sp-view");
const number = (name: string, low: number, high: number): number => Math.max(low, Math.min(high, Number(query.get(name)) || 0));
const abbreviation = constellation(query.get("c") ?? "")?.abbreviation ?? "Ori";
const from = viewpointOf(query.get("from"));
const lang = document.documentElement.lang === "ja" ? "ja" : "en";
frameCredit(lang === "ja");

const mount = mountSpace({
  host,
  labels: $("sp-labels"),
  lang: () => lang,
  light: () => lookNow() === "light",
  say,
  keepClear: () => {
    const box = stage.getBoundingClientRect();
    const tools = $("tools").getBoundingClientRect();
    return [{ x: tools.left - box.left - 4, y: tools.top - box.top - 4, w: tools.width + 8, h: tools.height + 8 }];
  },
  onShown(figure, live) {
    stage.dataset["state"] = live ? "live" : "fallback";
    $("sp-fallback").hidden = live;
    host.setAttribute("aria-label", say("sp_view", { name: lang === "ja" ? figure.constellation.japanese : figure.constellation.name }));
    document.documentElement.dataset["ready"] = "true";
  },
  onAcross(value) {
    stage.dataset["across"] = value.toFixed(2);
  },
});

const spin = $("spin");
const controller = createViewController({
  turnable: true,
  // one turn in 30 seconds: the family's gentle speed, and the first at which the turn is plain to see
  speed: 12,
  limits: { tiltMax: 85, zoomMin: 0.5, zoomMax: 10 },
  initial: { yaw: number("yaw", -180, 180), tilt: number("tilt", -85, 85) },
  onChange: (state) => {
    showSpin(state.turning);
    mount.pose({ yaw: state.yaw, tilt: state.tilt, roll: state.roll ?? 0, zoom: state.zoom, panX: state.panX, panY: state.panY });
  },
});
controller.bind(host);
// It opens turning (MODULES-817), unless the address says spin=off or the reader prefers reduced motion: then it is still, with Play ready.
function showSpin(turning: boolean): void {
  const label = say(turning ? "sp_pause" : "sp_play");
  spin.textContent = label;
  spin.setAttribute("aria-pressed", String(turning));
}
spin.addEventListener("click", () => (controller.state.turning ? controller.pause() : controller.play()));
showSpin(false);
if (query.get("spin") !== "off" && !matchMedia("(prefers-reduced-motion: reduce)").matches) controller.play();

const buttons: Array<[string, string, () => void]> = [
  ["turn", say("sp_turn"), () => controller.set({ yaw: ((((controller.state.yaw - 90 + 180) % 360) + 360) % 360) - 180 }, true, "turn")],
  ["front", lang === "ja" ? "地球から" : "From Earth", () => controller.front()],
  ["zoom-in", lang === "ja" ? "拡大" : "Zoom in", () => controller.zoomBy(1.6)],
  ["zoom-out", lang === "ja" ? "縮小" : "Zoom out", () => controller.zoomBy(1 / 1.6)],
];
for (const [id, label, act] of buttons) {
  const button = $(id);
  button.setAttribute("aria-label", label);
  button.title = label;
  if (id === "turn" || id === "front") button.textContent = label;
  button.addEventListener("click", act);
}
$("sp-nogl").textContent = say("sp_noGl");
mount.pose({ yaw: controller.state.yaw, tilt: controller.state.tilt, roll: 0, zoom: 1, panX: 0, panY: 0 }, true);
void mount.show(abbreviation, from?.hr);
