// The sky by distance in 3D: the stars and galaxies out to a limit (10, 50, 100, 500, 1,000 light-years, any number up to 3 million, or all), at their real distances round the Earth, each in the colour of its band, with the shells marked; a thing whose distance
// is uncertain is a streak and never a dot. The limit and the view (yaw, tilt, zoom) are kept in the address. What is drawn is in layers-view.ts and layers-scene.ts; this file is the page around them.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import type { EmbedChangeDetail, EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import type { ViewChangeDetail, ViewControlsElement } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { DISTANCE_LIMITS, limitAtSlider, limitFromText, limitText, sliderOfLimit, stepLimit, type DistanceLayers } from "../src/distance.ts";
import { layersFrameAddress, layersFrameCode, layersCode, layersSvg, type LayersChoice } from "./layers-code.ts";
import type { LayersLayout } from "./layers-layout.ts";
import { mountLayers } from "./layers-view.ts";
import { layersFor, loadDistances, renderLegend } from "./distance-layers.ts";
import type { Pose } from "./space-camera.ts";
import { langNow } from "./thumbs.ts";
import { say } from "./words.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const address = createAddressState({ defaults: { dist: "100" } });
/** The turn's degrees a second: one turn in 30 seconds. */
const SPIN_SPEED = 12;
const stage = $("sp-stage");
const controls = $<ViewControlsElement>("sp-controls");
let limit = limitFromText(address.get("dist")) ?? 100;

const mount = mountLayers({
  host: $("sp-view"),
  labels: $("sp-labels"),
  lang: langNow,
  onShown(layers, layout, live) {
    stage.dataset["state"] = live ? "live" : "fallback";
    $("sp-fallback").hidden = live;
    describe(layers, layout);
  },
});

const limitWords = (n: number): string => (n === Number.POSITIVE_INFINITY ? say("distAllWords") : say("distLimitText", { n: (n >= 100 ? Math.round(n) : Number(n.toPrecision(2))).toLocaleString(langNow()) }));

function describe(layers: DistanceLayers, layout: LayersLayout): void {
  const lang = langNow();
  renderLegend($("dist-legend"), layers, lang);
  $("sp-view").setAttribute("aria-label", say("ly_view", { limit: limitWords(layers.limit) }));
  const things = layers.things.length;
  $("ly-summary").textContent = say("ly_summary", { n: things.toLocaleString(lang), uncertain: layers.uncertain.toLocaleString(lang), unknown: layers.unknown.toLocaleString(lang) });
  $("ly-scale").textContent = layout.scale === "linear" ? say("ly_scaleTrue", { edge: layout.edge.toLocaleString(lang) }) : say("ly_scaleLog");
  stage.dataset["scale"] = layout.scale;
  stage.dataset["things"] = String(things);
  stage.dataset["limit"] = limitText(layers.limit);
}

function pressed(): void {
  $("seg-dist").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset["value"] === "all" ? limit === Number.POSITIVE_INFINITY : Number(b.dataset["value"]) === limit)));
  $<HTMLInputElement>("dist-slider").value = String(Math.round(sliderOfLimit(limit) * 1000));
  $("dist-out").textContent = limit === Number.POSITIVE_INFINITY ? say("distAll") : limitWords(limit);
  $<HTMLAnchorElement>("ly-open").href = `./?dist=${limitText(limit)}&proj=hammer&ra=180&dec=0&zoom=1`;
}

function buttons(): void {
  const seg = $("seg-dist");
  seg.replaceChildren(
    ...[...DISTANCE_LIMITS, Number.POSITIVE_INFINITY].map((n) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset["value"] = n === Number.POSITIVE_INFINITY ? "all" : String(n);
      button.textContent = n === Number.POSITIVE_INFINITY ? say("distAll") : n.toLocaleString(langNow());
      button.addEventListener("click", () => setLimit(n));
      return button;
    }),
  );
  pressed();
}

function show(): void {
  loadDistances(show);
  const layers = layersFor(limit);
  if (layers === undefined) {
    renderLegend($("dist-legend"), undefined, langNow());
    return;
  }
  void mount.show(layers);
}

function setLimit(next: number): void {
  limit = next;
  address.set("dist", limit === 100 ? null : limitText(limit));
  pressed();
  show();
  codes();
}

$("dist-nearer").addEventListener("click", () => setLimit(stepLimit(limit, -1)));
$("dist-farther").addEventListener("click", () => setLimit(stepLimit(limit, 1)));
$<HTMLInputElement>("dist-slider").addEventListener("input", () => setLimit(limitAtSlider(Number($<HTMLInputElement>("dist-slider").value) / 1000)));
$("sp-front").addEventListener("click", () => controls.controller.front());

const poseOf = (s: ViewChangeDetail | ViewControlsElement["state"]): Pose => ({ yaw: s.yaw, tilt: s.tilt, roll: s.roll ?? 0, zoom: s.zoom, panX: s.panX, panY: s.panY });
controls.addEventListener("kazoku-viewchange", (event) => mount.pose(poseOf((event as CustomEvent<ViewChangeDetail>).detail)));
// It opens turning, as every view that can move does, at one turn in 30 seconds. A reader who prefers reduced motion gets it still with Auto-turn ready, and a Pause is kept in the address (spin=off).
controls.setAttribute("speed", String(SPIN_SPEED));
controls.addEventListener("kazoku-viewchange", (event) => {
  const reason = (event as CustomEvent<ViewChangeDetail>).detail.reason;
  if (reason === "pause") address.set("spin", "off");
  else if (reason === "play") address.set("spin", null);
});
if (address.get("spin") !== "off" && !matchMedia("(prefers-reduced-motion: reduce)").matches) controls.controller.play();
document.addEventListener("hoshi-language", () => {
  controls.setAttribute("lang", langNow());
  buttons();
  mount.refresh();
  const layers = layersFor(limit);
  if (layers !== undefined && mount.layout !== undefined) describe(layers, mount.layout);
  codes();
});
address.subscribe(({ source }) => {
  if (source !== "navigation") return;
  limit = limitFromText(address.get("dist")) ?? 100;
  pressed();
  show();
});

// ----- the code to copy -----
const panel = $<EmbedPanelElement>("embed-panel");
const choice = (): LayersChoice => ({ limit, yaw: Math.round(controls.state.yaw), tilt: Math.round(controls.state.tilt), lang: langNow() });
panel.kinds = ["module", "html", "react", "vue", "angular", "svelte", "iframe"];
panel.generate = ({ kind, size, preview }) => (kind === "iframe" ? layersFrameCode(choice(), say("ly_embedLabel"), size, preview) : (layersCode(kind, choice(), size) ?? ""));
panel.preview = ({ kind, size }) => {
  if (kind === "iframe") return undefined;
  const holder = document.createElement("div");
  holder.style.cssText = `width: ${size}px; max-width: 100%; line-height: 0`;
  holder.innerHTML = layersSvg(choice(), size);
  return holder;
};
panel.credits = say("credit");
panel.docsHref = "docs/index.html";
const keptKind = address.get("embed") ?? "";
panel.kind = panel.kinds.includes(keptKind) ? keptKind : "module";
panel.addEventListener("kazoku-embedchange", (event) => {
  const { kind, reason } = (event as CustomEvent<EmbedChangeDetail>).detail;
  if (reason === "init") return;
  address.set("embed", kind === "module" ? null : kind);
});
function codes(): void {
  panel.openHref = layersFrameAddress("", choice());
  panel.credits = say("credit");
  panel.update();
}

controls.setAttribute("lang", langNow());
mount.pose(poseOf(controls.state), true);
buttons();
show();
codes();
