// The whole-sky page: all 88 constellations on one wide 2:1 map, galactic or equatorial, with the Milky Way across the middle. Tap or click a constellation to open it on the sky map; hover or Tab to
// highlight one; zoom and pan with kazoku-ui's view controls; pick one from the strip or the search; print the map as a page or a poster. Every choice is kept in the address.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { buildSheet, fitToPage, printCss, printSheet, tilePoster, type PageName } from "@johnmorrisdotca/kazoku-ui/print";
import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import type { ViewControlsElement } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { ALL_SKY_FRAMES, ALL_SKY_PROJECTIONS, allSkyUnproject, type AllSkyFrame, type AllSkyProjection } from "../src/all-sky.ts";
import { constellationAt } from "../src/boundaries.ts";
import { constellation } from "../src/constellations.ts";
import type { Culture } from "../src/culture.ts";
import { western } from "../src/cultures/western.ts";
import { CULTURE_IDS, cultureOf } from "./cultures.ts";
import { mountPicker } from "./picker.ts";
import { langNow, nameIn, type Lang } from "./thumbs.ts";
import { geometryOf, LAYERS, layoutLabels, labelsSvg, mapSvg, paperSvg, UNIT_H, UNIT_W, type Geometry, type Layer } from "./whole-sky-draw.ts";
import { milkyPicture } from "./whole-sky-milky.ts";
import { say } from "./words.ts";

declare const __HOSHI_VERSION__: string;
const ADDRESS = "https://johnmorrisdotca.github.io/hoshi-stars/whole-sky.html";
const PAPERS: readonly PageName[] = ["a4", "letter", "a3", "tabloid"];
const FORMS = ["page", "poster"] as const;
type Form = (typeof FORMS)[number];
const DEFAULT_LAYERS: readonly Layer[] = ["milky", "boundaries", "lines", "names"];
const POSTER_MM = { widthMm: 600, heightMm: 300 };
const FONT = 11;

const $ = <T extends Element = HTMLElement>(id: string): T => document.getElementById(id) as unknown as T;
const address = createAddressState({ defaults: {} });
const pickOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

// ----- the state, read from the address -----
let frame: AllSkyFrame = "galactic";
let projection: AllSkyProjection = "mollweide";
let culture: Culture = western;
let layers = new Set<Layer>(DEFAULT_LAYERS);
let selected: string | null = null;
let paper: PageName = "a3";
let form: Form = "page";
let hover: string | null = null;
let view = { zoom: 1, panX: 0, panY: 0 };

function read(): void {
  frame = pickOf(address.get("frame"), ALL_SKY_FRAMES, "galactic");
  projection = pickOf(address.get("map"), ALL_SKY_PROJECTIONS, "mollweide");
  culture = cultureOf(address.get("culture")) ?? western;
  const named = address.get("layers");
  layers = new Set(named === null ? DEFAULT_LAYERS : named === "none" ? [] : (named.split(",").filter((one) => (LAYERS as readonly string[]).includes(one)) as Layer[]));
  const asked = address.get("c");
  selected = asked !== null && constellation(asked) !== undefined ? constellation(asked)!.abbreviation : null;
  paper = pickOf(address.get("paper"), PAPERS, "a3");
  form = pickOf(address.get("form"), FORMS, "page");
}

// ----- the map on the screen -----
const box = $<HTMLElement>("ws-box");
const sky = $<SVGSVGElement>("ws-sky");
const labelLayer = $<SVGSVGElement>("ws-labels");
const bar = $<ViewControlsElement>("ws-bar");
let width = Math.max(200, Math.round(box.clientWidth));
let geometry: Geometry = geometryOf(frame, projection);
let built = "";
let world: SVGGElement | undefined;
let queued = false;

const mapHref = (abbreviation: string): string => {
  if (culture.id === "chinese") {
    const region = geometry.regions.find((r) => r.abbreviation === abbreviation)!;
    const at = allSkyUnproject({ x: region.x, y: region.y }, geometry.options)!;
    return `./?${new URLSearchParams({ culture: "chinese", ra: at.rightAscension.toFixed(2), dec: at.declination.toFixed(2), zoom: "3" }).toString()}`;
  }
  return `./?go=${abbreviation}${culture.id === "western" ? "" : `&culture=${culture.id}`}`;
};
const nameOf = (abbreviation: string): string => {
  const c = constellation(abbreviation)!;
  return `${nameIn(c, langNow())} (${c.abbreviation})`;
};

/** The ground, the Milky Way, the grid, boundaries, lines and stars: made again only when the orientation, map, culture, layers or language change. */
function build(): void {
  const key = `${frame}|${projection}|${culture.id}|${[...layers].sort().join(",")}|${langNow()}`;
  if (key === built && world !== undefined) return;
  geometry = geometryOf(frame, projection);
  const milky = layers.has("milky") ? milkyPicture(frame, projection, "night", 720) : undefined;
  sky.innerHTML = `<g id="ws-world">${mapSvg({ geometry, culture, layers, look: "night", milky, px: 1, screen: true, nameOf, hrefOf: mapHref })}</g>`;
  world = sky.querySelector<SVGGElement>("#ws-world")!;
  built = key;
  hover = null;
  paintOn();
}

function size(): void {
  width = Math.max(200, Math.round(box.clientWidth));
  sky.setAttribute("viewBox", `0 0 ${width} ${width / 2}`);
  labelLayer.setAttribute("viewBox", `0 0 ${width} ${width / 2}`);
}

function draw(): void {
  queued = false;
  build();
  const height = width / 2;
  const k = (width / UNIT_W) * view.zoom;
  world!.setAttribute("transform", `translate(${(width / 2 + view.panX).toFixed(2)} ${(height / 2 + view.panY).toFixed(2)}) scale(${k.toFixed(5)}) translate(${-UNIT_W / 2} ${-UNIT_H / 2})`);
  box.dataset.zoom = view.zoom < 1.6 ? "low" : "high";
  box.dataset.zoomed = String(view.zoom > 1.02);
  const labels = layers.has("names") ? layoutLabels({ geometry, culture, lang: langNow(), width, zoom: view.zoom, panX: view.panX, panY: view.panY, fontSize: langNow() === "ja" ? FONT + 1 : FONT }) : [];
  labelLayer.innerHTML = labelsSvg(labels, "night");
  paintOn();
}

function schedule(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(draw);
}

/** Marks the highlighted constellation (hovered, or the one chosen from the strip) on the map and in its name. */
function paintOn(): void {
  const on = hover ?? selected;
  sky.querySelectorAll(".on").forEach((el) => el.classList.remove("on"));
  labelLayer.querySelectorAll(".on").forEach((el) => el.classList.remove("on"));
  if (on !== null) {
    sky.querySelector(`a.c[data-abbr="${on}"]`)?.classList.add("on");
    sky.querySelector(`path.fg[data-fig="${on}"]`)?.classList.add("on");
    labelLayer.querySelector(`text[data-id="${on}"]`)?.classList.add("on");
  }
  $("ws-under").textContent = hover === null ? "" : nameOf(hover);
}

function setHover(abbreviation: string | null): void {
  if (hover === abbreviation) return;
  hover = abbreviation;
  box.dataset.over = String(abbreviation !== null);
  paintOn();
}

/** The constellation under a point of the box, in pixels. */
function under(x: number, y: number): string | null {
  const k = (width / UNIT_W) * view.zoom;
  const u = (x - width / 2 - view.panX) / k + UNIT_W / 2;
  const v = (y - width / 4 - view.panY) / k + UNIT_H / 2;
  const at = allSkyUnproject({ x: u, y: v }, geometry.options);
  return at === undefined ? null : constellationAt(at).abbreviation;
}

// ----- the hands: pointer to hover, tap to open; the zoom bar does the rest -----
const relative = (event: PointerEvent): { x: number; y: number } => {
  const r = box.getBoundingClientRect();
  return { x: ((event.clientX - r.left) / r.width) * width, y: ((event.clientY - r.top) / r.height) * (width / 2) };
};
let moveQueued = false;
box.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" || moveQueued) return;
  moveQueued = true;
  const at = relative(event);
  requestAnimationFrame(() => {
    moveQueued = false;
    setHover(under(at.x, at.y));
  });
});
box.addEventListener("pointerleave", () => setHover(null));
let down: { x: number; y: number; multi: boolean } | undefined;
const touching = new Set<number>();
let openTimer = 0;
let lastTap = -Infinity;
const DOUBLE_MS = 320;
box.addEventListener("pointerdown", (event) => {
  window.clearTimeout(openTimer);
  touching.add(event.pointerId);
  const at = relative(event);
  down = down === undefined ? { ...at, multi: touching.size > 1 } : { ...down, multi: true };
});
box.addEventListener("pointerup", (event) => {
  touching.delete(event.pointerId);
  const start = down;
  if (touching.size === 0) down = undefined;
  if (start === undefined || start.multi || event.button > 0) return;
  const at = relative(event);
  if (Math.hypot(at.x - start.x, at.y - start.y) > 8) return;
  const found = under(at.x, at.y);
  if (found === null) return;
  // Zoomed in, a double tap is the family's "fit": the first tap waits a moment to see whether a second one follows, and the second is not a tap of its own.
  if (event.timeStamp - lastTap < DOUBLE_MS) {
    lastTap = -Infinity;
    return;
  }
  lastTap = event.timeStamp;
  if (view.zoom <= 1.02) location.href = mapHref(found);
  else openTimer = window.setTimeout(() => (location.href = mapHref(found)), DOUBLE_MS);
});
box.addEventListener("pointercancel", (event) => {
  touching.delete(event.pointerId);
  if (touching.size === 0) down = undefined;
});
bar.addEventListener("kazoku-viewchange", (event) => {
  const d = (event as CustomEvent<{ zoom: number; panX: number; panY: number }>).detail;
  view = { zoom: d.zoom, panX: d.panX, panY: d.panY };
  schedule();
});
// A constellation reached with Tab is shown even when the zoom has moved it out of sight.
box.addEventListener("focusin", (event) => {
  const link = (event.target as Element).closest?.("a.c");
  if (link === null || link === undefined) return;
  const abbreviation = (link as SVGAElement).dataset.abbr!;
  setHover(abbreviation);
  const region = geometry.regions.find((r) => r.abbreviation === abbreviation)!;
  const k = (width / UNIT_W) * view.zoom;
  const x = width / 2 + view.panX + (region.x - UNIT_W / 2) * k;
  const y = width / 4 + view.panY + (region.y - UNIT_H / 2) * k;
  if (x < 0 || x > width || y < 0 || y > width / 2) showRegion(abbreviation, view.zoom);
});
box.addEventListener("focusout", (event) => {
  if ((event.target as Element).closest?.("a.c") !== null) setHover(null);
});

/** Zoom and pan so that the middle of a constellation is in the middle of the map. */
function showRegion(abbreviation: string, zoom: number): void {
  const region = geometry.regions.find((r) => r.abbreviation === abbreviation)!;
  const k = (width / UNIT_W) * zoom;
  bar.set({ zoom, panX: -(region.x - UNIT_W / 2) * k, panY: -(region.y - UNIT_H / 2) * k });
}

// ----- the rows of buttons -----
type Row = { id: string; items: ReadonlyArray<{ value: string; text: () => string; pressed: () => boolean }>; choose: (value: string) => void };
const rows: Row[] = [];
function row(id: string, items: Row["items"], choose: Row["choose"]): void {
  rows.push({ id, items, choose });
  $(id).replaceChildren(
    ...items.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.value = item.value;
      button.addEventListener("click", () => choose(item.value));
      return button;
    }),
  );
}
function paintRows(): void {
  for (const r of rows) {
    r.items.forEach((item, i) => {
      const button = $(r.id).children[i] as HTMLButtonElement;
      button.textContent = item.text();
      button.setAttribute("aria-pressed", String(item.pressed()));
    });
  }
  $("ws-note").textContent = say(frame === "galactic" ? "ws_noteGalactic" : "ws_noteEquatorial") + " " + say(`cultureNote${culture.id[0]!.toUpperCase()}${culture.id.slice(1)}`);
  $<HTMLButtonElement>("ws-go").textContent = say("ws_print");
  const plan = tilePoster({ ...POSTER_MM, page: paper, orientation: "landscape" });
  $("ws-info").textContent = say("ws_info", { paper: say(`kd_${paper}`), pages: form === "poster" ? say("ws_pageCount", { n: plan.pages }) : say("ws_oneSheet") });
}

function write(changes: Record<string, string | null>): void {
  address.setMany(changes);
  read();
  everything();
}

row("ws-frame", ALL_SKY_FRAMES.map((f) => ({ value: f, text: () => say(`ws_${f}`), pressed: () => frame === f })), (value) => write({ frame: value === "galactic" ? null : value }));
row("ws-map", ALL_SKY_PROJECTIONS.map((p) => ({ value: p, text: () => say(p), pressed: () => projection === p })), (value) => write({ map: value === "mollweide" ? null : value }));
row("ws-culture", CULTURE_IDS.map((id) => ({ value: id, text: () => say(`culture${id[0]!.toUpperCase()}${id.slice(1)}`), pressed: () => culture.id === id })), (value) => write({ culture: value === "western" ? null : value }));
row(
  "ws-layers",
  LAYERS.map((l) => ({ value: l, text: () => say(l === "lines" ? "lines" : l), pressed: () => layers.has(l) })),
  (value) => {
    const next = new Set(layers);
    if (next.has(value as Layer)) next.delete(value as Layer);
    else next.add(value as Layer);
    const text = LAYERS.filter((l) => next.has(l)).join(",");
    write({ layers: text === DEFAULT_LAYERS.join(",") ? null : text === "" ? "none" : text });
  },
);
row("ws-paper", PAPERS.map((p) => ({ value: p, text: () => say(`kd_${p}`), pressed: () => paper === p })), (value) => write({ paper: value === "a3" ? null : value }));
row("ws-form", FORMS.map((f) => ({ value: f, text: () => say(f === "page" ? "ws_onePage" : "ws_posterForm"), pressed: () => form === f })), (value) => write({ form: value === "page" ? null : value }));

// ----- the chooser: a constellation picked from the strip or the search is shown on this map -----
const picker = mountPicker({
  strip: $("picker-strip"),
  search: $<HTMLInputElement>("picker-search"),
  go: (abbreviation) => choose(abbreviation),
  current: () => selected ?? undefined,
  say,
});

function choose(abbreviation: string | null): void {
  selected = abbreviation;
  address.set("c", abbreviation);
  card();
  picker.refresh();
  if (abbreviation !== null) showRegion(abbreviation, Math.max(2, Math.min(8, 90 / Math.max(10, geometry.regions.find((r) => r.abbreviation === abbreviation)!.reach))));
  paintOn();
}

function card(): void {
  const host = $("ws-card");
  host.hidden = selected === null;
  if (selected === null) {
    host.replaceChildren();
    return;
  }
  const c = constellation(selected)!;
  const lang: Lang = langNow();
  const heading = Object.assign(document.createElement("h2"), { textContent: nameIn(c, lang), id: "ws-card-name" });
  const sub = Object.assign(document.createElement("p"), { className: "fam-fine", textContent: `${lang === "ja" ? c.name : c.japanese} · ${c.abbreviation}` });
  const links = document.createElement("p");
  links.className = "fam-row";
  const open = Object.assign(document.createElement("a"), { className: "fam-button", href: mapHref(c.abbreviation), textContent: say("ws_open") });
  open.dataset.primary = "true";
  open.dataset.testid = "ws-open";
  const page = Object.assign(document.createElement("a"), { className: "fam-button", href: `constellation.html?c=${c.abbreviation}`, textContent: say("ws_page") });
  const clear = Object.assign(document.createElement("button"), { type: "button", className: "fam-button", textContent: say("reset") });
  clear.addEventListener("click", () => {
    choose(null);
    bar.fit();
  });
  links.append(open, page, clear);
  host.replaceChildren(heading, sub, links);
}

// ----- print: the map as a page of the paper, or a poster in tiles -----
function printMap(): void {
  const lang: Lang = langNow();
  const fit = fitToPage({ page: paper, widthMm: 2, heightMm: 1, orientation: "auto" });
  const layout = { page: paper, orientation: fit.orientation, type: "normal" as const, language: lang };
  const milky = layers.has("milky") ? milkyPicture(frame, projection, "paper", 1200) : undefined;
  const base = {
    ...layout,
    brand: "Space Program X",
    packageName: "Hoshi Stars 星",
    title: say("ws_sheetTitle"),
    credits: say("ws_credits"),
    version: __HOSHI_VERSION__,
    date: new Date(),
    address: `${ADDRESS}${location.search}`,
    info: { more: [{ label: say("ws_frame"), value: say(`ws_${frame}`) }, { label: say("culture"), value: say(`culture${culture.id[0]!.toUpperCase()}${culture.id.slice(1)}`) }] },
    tileFooter: "ends" as const,
    pageNumber: "many" as const,
  };
  const svgOf = (widthMm: number, heightMm: number): Element => {
    const holder = document.createElement("div");
    holder.innerHTML = paperSvg({ geometry, culture, lang, layers, milky, px: 1200, widthMm, heightMm });
    return holder.firstElementChild!;
  };
  let sheet: HTMLElement;
  if (form === "poster") {
    sheet = buildSheet({ ...base, poster: { content: svgOf(POSTER_MM.widthMm, POSTER_MM.heightMm), ...POSTER_MM, overlapMm: 10 } });
  } else {
    // Lay the sheet out of sight to find how much room the page's body has, then draw the map to fill it.
    const holder = document.createElement("div");
    holder.style.cssText = "position:absolute;inset:0";
    const probe = buildSheet({ ...base, pages: [holder] });
    const style = document.createElement("style");
    style.textContent = printCss(layout);
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden";
    host.append(probe);
    document.head.append(style);
    document.body.append(host);
    const mm = 25.4 / 96;
    const body = probe.querySelector(".kazoku-body")!.getBoundingClientRect();
    host.remove();
    style.remove();
    const boxW = Math.floor(body.width * mm * 10) / 10;
    const boxH = Math.floor(body.height * mm * 10) / 10;
    const widthMm = Math.floor(Math.min(boxW, boxH * 2) * 10) / 10;
    const holderTwo = document.createElement("div");
    holderTwo.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center";
    holderTwo.append(svgOf(widthMm, widthMm / 2));
    sheet = buildSheet({ ...base, pages: [holderTwo] });
  }
  const style = document.getElementById("ws-print-style") ?? Object.assign(document.createElement("style"), { id: "ws-print-style" });
  style.textContent = printCss(layout);
  document.head.append(style);
  printSheet(sheet);
}

// ----- all of it -----
function words(): void {
  card();
  paintRows();
  built = "";
  picker.refresh();
  bar.setAttribute("lang", langNow());
}

function everything(): void {
  paintRows();
  schedule();
}

$("ws-go").addEventListener("click", printMap);
address.subscribe(({ source }) => {
  if (source !== "navigation") return;
  read();
  card();
  everything();
});
document.addEventListener("hoshi-language", () => {
  words();
  schedule();
});
new ResizeObserver(() => {
  size();
  schedule();
}).observe(box);

read();
size();
words();
everything();
if (selected !== null) requestAnimationFrame(() => choose(selected));
