// The demo page: a sky you turn with a drag, zoom with the wheel or a pinch, tap for a star, a Messier object or a constellation, and search by name in English or Japanese.
// Every choice is kept in the address. The language is the family's: the chooser in the header fills the page's fixed words, and this script rewrites what it draws itself.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import type { EmbedChangeDetail, EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import { WORDS } from "../scripts/page-words.ts";
import { starByHr, starColour, starDistanceLightYears, stars, type Star } from "../src/index.ts";
import { constellation, constellations, starsIn, type Constellation } from "../src/constellations.ts";
import { deepSkyObject, messier, type DeepSkyObject } from "../src/deep-sky.ts";
import { PROJECTIONS, type Projection } from "../src/projection.ts";
import { centreOfConstellation, chart, constellationUnder, DEFAULT_VIEW, defaultZoom, fitScale, LAYERS, reachOfConstellation, toScreen, ZOOM_MAX, ZOOM_MIN, type Hit, type Layer, type View } from "./chart.ts";
import { attachHands } from "./hands.ts";
import { DEFAULT_MAGNITUDE, layersOf, layersText, type Choice } from "./choice.ts";
import type { Box } from "./labels.ts";
import { embedCode, frameAddress, frameCode, heightFor } from "./embed-code.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const lang = (): "en" | "ja" => (document.documentElement.lang === "ja" ? "ja" : "en");
const say = (key: string): string => (WORDS[lang()] as Record<string, string>)[key] ?? key;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wrap360 = (degrees: number): number => ((degrees % 360) + 360) % 360;

const address = createAddressState({ defaults: { proj: DEFAULT_VIEW.projection, ra: DEFAULT_VIEW.ra.toFixed(2), dec: DEFAULT_VIEW.dec.toFixed(2), mag: String(DEFAULT_MAGNITUDE) } });

// ----- the state, read from the address -----
let view: View = { ...DEFAULT_VIEW };
let magnitude = DEFAULT_MAGNITUDE;
let layers: Set<Layer> = layersOf(null);
let picked: string | null = null;
let hover: string | undefined;

function read(): void {
  const kind = address.get("proj") ?? "";
  const projection = (PROJECTIONS as readonly string[]).includes(kind) ? (kind as Projection) : DEFAULT_VIEW.projection;
  const asked = Number(address.get("zoom"));
  view = {
    projection,
    ra: wrap360(Number(address.get("ra")) || 0),
    dec: Math.max(-90, Math.min(90, Number(address.get("dec")) || 0)),
    zoom: asked > 0 ? Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, asked)) : defaultZoom(projection, width, height),
  };
  magnitude = Math.max(2, Math.min(6, Number(address.get("mag")) || DEFAULT_MAGNITUDE));
  const named = address.get("layers");
  layers = layersOf(named === "none" ? "" : named);
  picked = address.get("pick");
  hands.sync();
}

function writeView(): void {
  const zoom = Math.round(view.zoom * 100) / 100;
  address.setMany({ ra: view.ra.toFixed(2), dec: view.dec.toFixed(2), zoom: zoom === opening() ? null : String(zoom) });
}

// ----- drawing -----
const svg = $("chart") as unknown as SVGSVGElement;
const box = $("chart-box");
let width = Math.max(200, Math.round(box.clientWidth)) || 800;
let height = Math.max(200, Math.round(box.clientHeight)) || 560;
const opening = (): number => defaultZoom(view.projection, width, height);
let hits: Hit[] = [];
let queued = false;

const pickedConstellation = (): string | undefined => {
  if (picked === null) return undefined;
  const [kind, key = ""] = [picked.slice(0, 1), picked.slice(2)];
  if (kind === "C") return key;
  const star = kind === "S" ? starByHr(Number(key)) : undefined;
  return star?.constellation;
};

function clear(): Box[] {
  const tools = $("zoom-in").parentElement!.getBoundingClientRect();
  const at = svg.getBoundingClientRect();
  return [{ x0: tools.left - at.left - 4, y0: tools.top - at.top - 4, x1: tools.right - at.left + 4, y1: tools.bottom - at.top + 4 }];
}

function draw(): void {
  queued = false;
  const out = chart({ ...view, width, height, magnitude, layers, lang: lang(), keepClear: clear(), highlight: hover ?? pickedConstellation(), picked: picked !== null && picked.slice(0, 1) !== "C" ? picked.slice(2) : undefined });
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = out.svg;
  hits = out.hits;
}
function schedule(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(draw);
}
new ResizeObserver(() => {
  width = Math.max(200, Math.round(box.clientWidth));
  height = Math.max(200, Math.round(box.clientHeight));
  if (address.get("zoom") === null) view = { ...view, zoom: opening() };
  hands.sync();
  schedule();
}).observe(box);

// ----- the panel's choices -----
function seg(id: string, items: ReadonlyArray<readonly [string, string]>, click: (value: string) => void): void {
  $(id).replaceChildren(
    ...items.map(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.value = value;
      button.textContent = label;
      button.addEventListener("click", () => click(value));
      return button;
    }),
  );
}
function pressed(): void {
  $("seg-projection").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === view.projection)));
  $("seg-layers").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(layers.has(b.dataset.value as Layer))));
  const slider = $<HTMLInputElement>("magnitude");
  slider.value = String(magnitude);
  $("magnitude-out").textContent = magnitude.toFixed(1);
  $("shown").textContent = `${stars({ magnitude }).length.toLocaleString(lang())} ${say("sampleCount")}`;
}
function words(): void {
  seg("seg-projection", PROJECTIONS.map((kind) => [kind, say(kind)] as const), (kind) => {
    setView({ ...view, projection: kind as Projection, ...(address.get("zoom") === null ? { zoom: defaultZoom(kind as Projection, width, height) } : {}) });
    address.set("proj", kind);
    everything();
  });
  seg("seg-layers", LAYERS.map((layer) => [layer, say(layer)] as const), (layer) => {
    if (layers.has(layer as Layer)) layers.delete(layer as Layer);
    else layers.add(layer as Layer);
    address.set("layers", layersText(layers));
    everything();
  });
}
$("magnitude").addEventListener("input", () => {
  magnitude = Number($<HTMLInputElement>("magnitude").value);
  address.set("mag", String(magnitude));
  everything();
});

// ----- turning, zooming and tapping -----
// The drag, the two-finger pinch, the wheel, the keys and the double tap are the family's view controller (hands.ts); a tap on the sky is the page's own.
interface Touch {
  x: number;
  y: number;
}
const touches = new Map<number, Touch>();
let moved = 0;
let settle: ReturnType<typeof setTimeout> | undefined;
const local = (event: { clientX: number; clientY: number }): Touch => {
  const at = svg.getBoundingClientRect();
  return { x: event.clientX - at.left, y: event.clientY - at.top };
};
function settled(): void {
  writeView();
  clearTimeout(settle);
  settle = setTimeout(codes, 150);
}
const hands = attachHands(box, {
  view: () => view,
  size: () => ({ width, height }),
  opening,
  moved(next, final) {
    cancelFly();
    view = next;
    schedule();
    if (final) settled();
  },
});
function setView(next: View): void {
  view = next;
  hands.sync();
}
box.addEventListener("pointerdown", (event) => {
  if ((event.pointerType === "mouse" && event.button !== 0) || (event.target as Element).closest("button") !== null) return;
  touches.set(event.pointerId, local(event));
  moved = touches.size > 1 ? 99 : 0;
});
box.addEventListener("pointermove", (event) => {
  const here = local(event);
  const before = touches.get(event.pointerId);
  if (before === undefined) {
    if (event.pointerType === "mouse") hovering(here);
    return;
  }
  moved += Math.abs(here.x - before.x) + Math.abs(here.y - before.y);
  touches.set(event.pointerId, here);
});
const release = (event: PointerEvent): void => {
  const was = touches.get(event.pointerId);
  touches.delete(event.pointerId);
  if (was !== undefined && touches.size === 0 && moved <= 6 && event.type === "pointerup") tap(was.x, was.y);
};
box.addEventListener("pointerup", release);
box.addEventListener("pointercancel", release);
box.addEventListener("pointerleave", () => {
  if (hover !== undefined) {
    hover = undefined;
    $("under").textContent = "";
    schedule();
  }
});
$("zoom-in").addEventListener("click", () => hands.zoomBy(1.6));
$("zoom-out").addEventListener("click", () => hands.zoomBy(1 / 1.6));
$("reset").addEventListener("click", () => {
  fly({ ra: DEFAULT_VIEW.ra, dec: DEFAULT_VIEW.dec, zoom: opening() });
  address.set("pick", null);
  picked = null;
  details();
});

function hovering(at: Touch): void {
  const found = constellationUnder(view, width, height, at.x, at.y);
  const next = found?.abbreviation;
  if (next === hover) return;
  hover = next;
  $("under").textContent = found === undefined ? "" : lang() === "ja" ? found.japanese : found.name;
  schedule();
}

function tap(x: number, y: number): void {
  let best: Hit | undefined;
  let near = 22 * 22;
  for (const hit of hits) {
    const d = (hit.x - x) ** 2 + (hit.y - y) ** 2;
    if (d < near) {
      near = d;
      best = hit;
    }
  }
  if (best !== undefined) pick(best.kind === "star" ? `S:${best.key}` : `D:${best.key}`);
  else {
    const found = constellationUnder(view, width, height, x, y);
    pick(found === undefined ? null : `C:${found.abbreviation}`);
  }
  settled();
}

function pick(key: string | null): void {
  picked = key;
  address.set("pick", key);
  details();
  schedule();
}

// ----- flying to a place -----
interface Place {
  ra: number;
  dec: number;
  zoom: number;
}
let flying = 0;
const cancelFly = (): void => {
  flying += 1;
};
const unit = (ra: number, dec: number): [number, number, number] => {
  const a = (ra * Math.PI) / 180;
  const d = (dec * Math.PI) / 180;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
};
function fly(to: Place): void {
  const mine = ++flying;
  const from = { ...view };
  const a = unit(from.ra, from.dec);
  const b = unit(to.ra, to.dec);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(dot);
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, to.zoom));
  const place = (t: number): View => {
    const k = angle < 1e-6 ? [0, 1] : [Math.sin((1 - t) * angle) / Math.sin(angle), Math.sin(t * angle) / Math.sin(angle)];
    const x = k[0]! * a[0] + k[1]! * b[0];
    const y = k[0]! * a[1] + k[1]! * b[1];
    const z = k[0]! * a[2] + k[1]! * b[2];
    return { ...from, ra: wrap360((Math.atan2(y, x) * 180) / Math.PI), dec: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI, zoom: Math.exp(Math.log(from.zoom) * (1 - t) + Math.log(zoom) * t) };
  };
  if (reduced) {
    setView(place(1));
    schedule();
    settled();
    return;
  }
  const started = performance.now();
  const step = (now: number): void => {
    if (mine !== flying) return;
    const t = Math.min(1, (now - started) / 700);
    setView(place(t * t * (3 - 2 * t)));
    draw();
    if (t < 1) requestAnimationFrame(step);
    else settled();
  };
  requestAnimationFrame(step);
}

/** The zoom at which a constellation's figure fits the chart. */
function zoomFor(abbreviation: string): number {
  const middle = centreOfConstellation(abbreviation);
  if (middle === undefined) return 3;
  const reach = Math.min(80, reachOfConstellation(abbreviation) + 4);
  const test = { ...view, ra: middle.rightAscension, dec: middle.declination, zoom: 1 };
  const at = toScreen(test, width, height, { rightAscension: middle.rightAscension, declination: Math.min(89.9, middle.declination + reach) }) ?? toScreen(test, width, height, { rightAscension: middle.rightAscension, declination: middle.declination - reach });
  const radius = at === undefined ? fitScale(view.projection, width, height) : Math.hypot(at[0] - width / 2, at[1] - height / 2);
  return Math.max(1, Math.min(12, (0.42 * Math.min(width, height)) / Math.max(1, radius)));
}

// ----- search -----
const fold = (text: string): string =>
  [...text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()].map((ch) => (ch >= "ァ" && ch <= "ヶ" ? String.fromCodePoint(ch.codePointAt(0)! - 0x60) : ch)).join("").trim();

const starName = (star: Star): string => (lang() === "ja" ? star.nameJa : undefined) ?? star.name ?? star.designation ?? `HR ${star.hr}`;

interface Found {
  label: string;
  kind: string;
  key: string;
}
function search(text: string): Found[] {
  const q = fold(text);
  if (q === "") return [];
  const out: Found[] = [];
  const exact = constellation(text);
  if (exact !== undefined) out.push({ label: lang() === "ja" ? exact.japanese : exact.name, kind: say("constellationKind"), key: `C:${exact.abbreviation}` });
  const starts: Found[] = [];
  const contains: Found[] = [];
  for (const star of stars()) {
    if (star.name === undefined) continue;
    const found = { label: starName(star), kind: say("starKind"), key: `S:${star.hr}` };
    const names = [fold(star.name), ...(star.nameJa === undefined ? [] : [fold(star.nameJa)])];
    if (names.some((name) => name.startsWith(q))) starts.push(found);
    else if (names.some((name) => name.includes(q))) contains.push(found);
  }
  for (const c of constellations()) {
    if (out.some((one) => one.key === `C:${c.abbreviation}`)) continue;
    if ([c.name, c.genitive, c.english, c.japanese, c.reading, c.abbreviation].some((name) => fold(name).includes(q))) (fold(c.name).startsWith(q) || fold(c.japanese).startsWith(q) ? starts : contains).push({ label: lang() === "ja" ? c.japanese : c.name, kind: say("constellationKind"), key: `C:${c.abbreviation}` });
  }
  for (const object of messier()) {
    const name = object.name === undefined ? "" : fold(object.name);
    if (fold(object.id) === q || fold(object.id).startsWith(q) && q.length > 1 || (name !== "" && name.includes(q))) starts.push({ label: object.name === undefined ? object.id : `${object.id} ${object.name}`, kind: say("deepKind"), key: `D:${object.id}` });
  }
  return [...out, ...starts, ...contains].slice(0, 8);
}

function placeOf(key: string): Place | undefined {
  const id = key.slice(2);
  if (key.startsWith("S:")) {
    const star = starByHr(Number(id));
    return star && { ra: star.rightAscension, dec: star.declination, zoom: Math.max(view.zoom, 6) };
  }
  if (key.startsWith("D:")) {
    const object = deepSkyObject(id);
    return object && { ra: object.rightAscension, dec: object.declination, zoom: Math.max(view.zoom, 6) };
  }
  const middle = centreOfConstellation(id);
  return middle && { ra: middle.rightAscension, dec: middle.declination, zoom: zoomFor(id) };
}

function goTo(key: string): void {
  const place = placeOf(key);
  pick(key);
  if (place !== undefined) fly(place);
}

const results = $("results");
function showResults(list: Found[], asked: string): void {
  results.replaceChildren(
    ...(list.length === 0 && asked.trim() !== ""
      ? [Object.assign(document.createElement("p"), { className: "fam-fine", textContent: say("searchNone") })]
      : list.map((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "fam-button";
          button.dataset.key = item.key;
          button.append(item.label, Object.assign(document.createElement("span"), { className: "kind", textContent: item.kind }));
          button.addEventListener("click", () => goTo(item.key));
          return button;
        })),
  );
}
const field = $<HTMLInputElement>("search");
field.addEventListener("input", () => showResults(search(field.value), field.value));
$("find").addEventListener("submit", (event) => {
  event.preventDefault();
  const first = search(field.value)[0];
  if (first === undefined) showResults([], field.value);
  else goTo(first.key);
});

// ----- what is picked -----
function fact(list: HTMLElement, name: string, value: string | Node): void {
  const dt = Object.assign(document.createElement("dt"), { textContent: say(name) });
  const dd = document.createElement("dd");
  dd.append(value);
  list.append(dt, dd);
}
function linkTo(text: string, key: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fam-chip";
  button.textContent = text;
  button.addEventListener("click", () => goTo(key));
  return button;
}
const nameOf = (c: Constellation): string => (lang() === "ja" ? c.japanese : c.name);

function details(): void {
  const host = $("picked");
  host.replaceChildren();
  if (picked === null) {
    host.append(Object.assign(document.createElement("p"), { className: "fam-fine", textContent: say("nothingPicked") }));
    return;
  }
  const id = picked.slice(2);
  const list = document.createElement("dl");
  list.className = "facts";
  const title = document.createElement("h3");
  host.append(title, list);
  if (picked.startsWith("S:")) {
    const star = starByHr(Number(id)) as Star | undefined;
    if (star === undefined) return;
    title.textContent = starName(star);
    const light = starDistanceLightYears(star);
    const swatch = Object.assign(document.createElement("span"), { className: "swatch" });
    swatch.style.background = starColour(star);
    fact(list, "starKind", `HR ${star.hr}`);
    if (star.designation !== undefined) fact(list, "fieldDesignation", star.designation);
    fact(list, "fieldMagnitude", `${star.magnitude.toFixed(2)} ${say("magnitudeUnit")}`);
    fact(list, "fieldDistance", light === undefined ? say("unknown") : `${Math.round(light).toLocaleString(lang())} ${say("lightYears")}`);
    const colour = document.createElement("span");
    colour.append(swatch, ` ${starColour(star)}`);
    fact(list, "fieldColour", colour);
    if (star.spectralClass !== "") fact(list, "fieldClass", star.spectralClass);
    if (star.constellation !== undefined) {
      const c = constellation(star.constellation);
      if (c !== undefined) fact(list, "fieldIn", linkTo(nameOf(c), `C:${c.abbreviation}`));
    }
  } else if (picked.startsWith("D:")) {
    const object = deepSkyObject(id) as DeepSkyObject | undefined;
    if (object === undefined) return;
    title.textContent = object.name === undefined ? object.id : `${object.id} ${object.name}`;
    fact(list, "deepKind", object.id);
    fact(list, "fieldType", say(object.type));
    if (object.magnitude !== undefined) fact(list, "fieldMagnitude", `${object.magnitude.toFixed(1)} ${say("magnitudeUnit")}`);
    if (object.sizeArcmin !== undefined) fact(list, "fieldSize", `${object.sizeArcmin} ${say("arcminutes")}`);
    if (object.ngc !== undefined) fact(list, "fieldNgc", object.ngc);
    const c = object.constellation === undefined ? undefined : constellation(object.constellation);
    if (c !== undefined) fact(list, "fieldIn", linkTo(nameOf(c), `C:${c.abbreviation}`));
  } else {
    const c = constellation(id);
    if (c === undefined) return;
    title.textContent = nameOf(c);
    fact(list, "constellationKind", c.abbreviation);
    fact(list, "fieldLatin", `${c.name} (${c.genitive})`);
    fact(list, "fieldEnglish", c.english);
    fact(list, "fieldJapanese", `${c.japanese} (${c.reading})`);
    const chips = document.createElement("div");
    chips.className = "chips";
    for (const star of starsIn(c.abbreviation).slice(0, 12)) chips.append(linkTo(starName(star), `S:${star.hr}`));
    host.append(Object.assign(document.createElement("h4"), { textContent: say("starsIn") }), chips);
  }
}

// ----- the code to copy -----
const panel = $<EmbedPanelElement>("embed-panel");
const choice = (size = width): Choice => ({ ...view, zoom: (view.zoom * fitScale(view.projection, width, height) * size) / width / fitScale(view.projection, size, heightFor(size)), ra: Math.round(view.ra * 100) / 100, dec: Math.round(view.dec * 100) / 100, magnitude, layers, lang: lang(), ...(pickedConstellation() === undefined ? {} : { highlight: pickedConstellation() }) });
panel.kinds = ["module", "html", "react", "vue", "angular", "svelte", "iframe"];
panel.generate = ({ kind, size, preview }) => (kind === "iframe" ? frameCode(choice(size), say("chartLabel"), size, preview) : (embedCode(kind, choice(size), size) ?? ""));
panel.preview = ({ kind, size }) => {
  if (kind === "iframe") return undefined;
  const holder = document.createElement("div");
  holder.style.cssText = `width: ${size}px; max-width: 100%; line-height: 0`;
  const c = choice(size);
  holder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${heightFor(size)}" style="display:block;width:100%;height:auto">${chart({ ...c, width: size, height: heightFor(size), layers: new Set(c.layers.has("lines") ? (["lines"] as const) : []), highlight: undefined, picked: undefined }).svg}</svg>`;
  return holder;
};
panel.credits = say("credit");
panel.docsHref = "docs/index.html";
const keptKind = address.get("embed") ?? "";
panel.kind = panel.kinds.includes(keptKind) ? keptKind : "module";
if (Number(address.get("size")) > 0) panel.size = Number(address.get("size"));
panel.addEventListener("kazoku-embedchange", (event) => {
  const { kind, size, reason } = (event as CustomEvent<EmbedChangeDetail>).detail;
  if (reason === "init") return;
  address.set("embed", kind === "module" ? null : kind);
  address.set("size", size === 480 ? null : String(size));
});
function codes(): void {
  panel.openHref = frameAddress("", choice());
  panel.credits = say("credit");
  panel.update();
}

// ----- keep everything in step -----
function everything(): void {
  pressed();
  codes();
  schedule();
}
document.addEventListener("hoshi-language", () => {
  words();
  showResults(search(field.value), field.value);
  details();
  everything();
});
address.subscribe(({ source }) => {
  if (source !== "navigation") return;
  read();
  details();
  everything();
});

read();
words();
details();
everything();
