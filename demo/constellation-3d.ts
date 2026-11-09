// The constellation in 3D: pick a constellation (the picture strip and search, or "See it in 3D" on its page), see it as from the Earth, then turn it (drag, the shared view controls, or Turn 90°) to see each star at its
// distance in light-years with its error bar. The choice (c, from) and the view (yaw, tilt, zoom) are kept in the address. Everything drawn is in space-view.ts and space-scene.ts; this file is the page around them.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import type { EmbedChangeDetail, EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import type { ViewChangeDetail, ViewControlsElement } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { constellation } from "../src/constellations.ts";
import { DISTANCE_QUALITIES, type Constellation3D, type DistanceQuality, type StarIn3D } from "../src/constellation-3d.ts";
import { starDistance } from "../src/stars.ts";
import { FAMOUS, viewpointOf } from "./from.ts";
import { mountPicker } from "./picker.ts";
import { frameCode, spaceCode, spaceFrameAddress, spaceSvg } from "./space-code.ts";
import type { Pose } from "./space-camera.ts";
import { mountSpace } from "./space-view.ts";
import { describe, lightYearsText, nameOf } from "./space-text.ts";
import { langNow, lookNow, nameIn, onLook, thumbSrc } from "./thumbs.ts";
import { say } from "./words.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const address = createAddressState({ defaults: { c: "Ori", from: "" } });
const stage = $("sp-stage");
const controls = $<ViewControlsElement>("sp-controls");
let across = 0;
let abbreviation = "Ori";

const chosen = (): string => constellation(address.get("c") ?? "")?.abbreviation ?? "Ori";
const fromStar = (): ReturnType<typeof viewpointOf> => viewpointOf(address.get("from"));

const mount = mountSpace({
  host: $("sp-view"),
  labels: $("sp-labels"),
  lang: langNow,
  light: () => lookNow() === "light",
  say,
  onShown(figure, live) {
    stage.dataset["state"] = live ? "live" : "fallback";
    $("sp-fallback").hidden = live;
    if (!live) $<HTMLImageElement>("sp-picture").src = thumbSrc(figure.constellation.abbreviation, 480, lookNow());
    describeFigure(figure);
    note();
  },
  onAcross(value) {
    const side = value >= 0.5;
    if (side !== (across >= 0.5)) {
      across = value;
      note();
    }
    across = value;
    stage.dataset["across"] = value.toFixed(2);
  },
});

function placeText(figure: Constellation3D | undefined): string {
  const star = fromStar();
  void figure;
  return star === undefined ? say("sp_placeEarth") : (FAMOUS.find((one) => one.hr === star.hr)?.[langNow()] ?? star.name ?? `HR ${star.hr}`);
}

function note(): void {
  const text = across >= 0.5 ? "sp_noteSide" : "sp_noteFront";
  $("sp-note").textContent = say(text, { place: placeText(mount.figure) });
}

const qualityName = (q: DistanceQuality): string => say(`q_${q}`);

function describeFigure(figure: Constellation3D): void {
  const lang = langNow();
  const name = nameIn(figure.constellation, lang);
  $("sp-heading").textContent = say("sp_heading") + (lang === "ja" ? `: ${name}` : `: ${name}`);
  document.title = `${name} - ${say("sp_heading")} - Hoshi Stars`;
  $("sp-view").setAttribute("aria-label", say("sp_view", { name }));
  $("sp-key").replaceChildren(
    ...DISTANCE_QUALITIES.map((q) => {
      const item = document.createElement("li");
      item.className = `q-${q}`;
      item.title = say(`q_${q}_hint`);
      item.dataset["quality"] = q;
      const dot = Object.assign(document.createElement("span"), { className: `sp-dot q-${q}` });
      item.append(dot, `${qualityName(q)} ${figure.counts[q]}`);
      return item;
    }),
  );
  $("sp-summary").textContent = say("sp_summary", { n: figure.stars.length, ...figure.counts });
  $("sp-poor").hidden = figure.counts.good + figure.counts.fair >= figure.stars.length / 2;

  const rows = [...figure.stars].sort((a, b) => (a.lightYears ?? Number.POSITIVE_INFINITY) - (b.lightYears ?? Number.POSITIVE_INFINITY) || a.star.magnitude - b.star.magnitude);
  const head = document.createElement("tr");
  for (const key of ["sp_thStar", "sp_thDistance", "sp_thRange", "sp_thKnown"]) head.append(Object.assign(document.createElement("th"), { scope: "col", textContent: say(key) }));
  const body = rows.map((one) => row(one, lang));
  const table = $<HTMLTableElement>("sp-table");
  table.replaceChildren(Object.assign(document.createElement("thead"), {}), Object.assign(document.createElement("tbody"), {}));
  table.tHead!.append(head);
  table.tBodies[0]!.append(...body);
  const box = table.parentElement!;
  box.tabIndex = 0;
  box.setAttribute("role", "region");
  box.setAttribute("aria-label", say("sp_tableHeading"));
}

function row(one: StarIn3D, lang: "en" | "ja"): HTMLTableRowElement {
  const words = describe(one, lang, say);
  const tr = document.createElement("tr");
  tr.dataset["star"] = one.id;
  tr.dataset["quality"] = one.quality;
  const star = document.createElement("td");
  const link = Object.assign(document.createElement("a"), {
    href: `./?pick=S:${one.star.hr}&ra=${one.star.rightAscension.toFixed(2)}&dec=${one.star.declination.toFixed(2)}&zoom=8`,
    textContent: nameOf(one, lang),
    title: say("sp_open"),
  });
  star.append(link);
  const distance = Object.assign(document.createElement("td"), { textContent: one.lightYears === undefined ? say("sp_unknown") : say("sp_ly", { n: lightYearsText(one.lightYears, lang) }) });
  const range = Object.assign(document.createElement("td"), { textContent: one.range === undefined ? (one.lightYears === undefined ? "" : say("sp_noError")) : words.range !== "" ? words.range : words.distance });
  const known = document.createElement("td");
  const chip = Object.assign(document.createElement("span"), { className: "sp-q" });
  chip.append(Object.assign(document.createElement("span"), { className: `sp-dot q-${one.quality}` }), qualityName(one.quality));
  known.append(chip);
  tr.append(star, distance, range, known);
  return tr;
}

// ----- the viewpoint -----
function fromChoices(): void {
  const select = $<HTMLSelectElement>("sp-from");
  const lang = langNow();
  const items: Array<[string, string]> = [["", say("viewFromEarth")], ...FAMOUS.map((one): [string, string] => [`HR${one.hr}`, one[lang]])];
  select.replaceChildren(...items.map(([value, label]) => Object.assign(document.createElement("option"), { value, textContent: label })));
  const star = fromStar();
  select.value = star === undefined ? "" : `HR${star.hr}`;
  const text = $("sp-from-note");
  const distance = star === undefined ? undefined : starDistance(star);
  text.hidden = distance === undefined;
  text.textContent = star === undefined || distance === undefined ? "" : say("sp_fromNote", { name: placeText(undefined), distance: lightYearsText(distance.lightYears, lang) });
}

// ----- choosing -----
const picker = mountPicker({
  strip: $("picker-strip"),
  search: $<HTMLInputElement>("picker-search"),
  go: (to) => {
    address.set("c", to === "Ori" ? null : to);
    load();
  },
  current: () => abbreviation,
  say: (key) => say(key),
});

function load(): void {
  abbreviation = chosen();
  const from = fromStar();
  void mount.show(abbreviation, from?.hr);
  fromChoices();
  picker.refresh();
  everythingElse();
}

function everythingElse(): void {
  stage.dataset["look"] = lookNow();
  if (mount.figure !== undefined) describeFigure(mount.figure);
  note();
  codes();
}

$("sp-turn").addEventListener("click", () => {
  const controller = controls.controller;
  const yaw = ((((controller.state.yaw - 90 + 180) % 360) + 360) % 360) - 180;
  controller.set({ yaw }, true, "turn");
});
$("sp-front").addEventListener("click", () => controls.controller.front());
$("sp-from").addEventListener("change", () => {
  address.set("from", $<HTMLSelectElement>("sp-from").value || null);
  load();
});
const poseOf = (s: ViewChangeDetail | ViewControlsElement["state"]): Pose => ({ yaw: s.yaw, tilt: s.tilt, roll: s.roll ?? 0, zoom: s.zoom, panX: s.panX, panY: s.panY });
controls.addEventListener("kazoku-viewchange", (event) => mount.pose(poseOf((event as CustomEvent<ViewChangeDetail>).detail)));
document.addEventListener("hoshi-language", () => {
  controls.setAttribute("lang", langNow());
  fromChoices();
  mount.refresh();
  everythingElse();
  picker.refresh();
});
onLook(() => {
  stage.dataset["look"] = lookNow();
  mount.refresh();
  picker.refresh();
});
address.subscribe(({ source }) => {
  if (source === "navigation") load();
});

// ----- the code to copy -----
const panel = $<EmbedPanelElement>("embed-panel");
const choice = (): { c: string; from: number | undefined; yaw: number; tilt: number; lang: "en" | "ja" } => ({ c: abbreviation, from: fromStar()?.hr, yaw: Math.round(controls.state.yaw), tilt: Math.round(controls.state.tilt), lang: langNow() });
panel.kinds = ["module", "html", "react", "vue", "angular", "svelte", "iframe"];
panel.generate = ({ kind, size, preview }) => (kind === "iframe" ? frameCode(choice(), say("sp_embedLabel"), size, preview) : (spaceCode(kind, choice(), size) ?? ""));
panel.preview = ({ kind, size }) => {
  if (kind === "iframe") return undefined;
  const holder = document.createElement("div");
  holder.style.cssText = `width: ${size}px; max-width: 100%; line-height: 0`;
  holder.innerHTML = spaceSvg(choice(), size);
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
  panel.openHref = spaceFrameAddress("", choice());
  panel.credits = say("credit");
  panel.update();
}

controls.setAttribute("lang", langNow());
stage.dataset["look"] = lookNow();
// a page opened with a turn in its address (yaw, tilt, zoom) starts there
mount.pose(poseOf(controls.state), true);
load();
