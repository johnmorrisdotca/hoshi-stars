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
import { centreOfConstellation, chart, constellationUnder, DEFAULT_VIEW, dragged, fitScale, LAYERS, reachOfConstellation, toScreen, ZOOM_MAX, ZOOM_MIN, zoomedAbout, type Hit, type Layer, type View } from "./chart.ts";
import { DEFAULT_MAGNITUDE, layersOf, layersText, type Choice } from "./choice.ts";
import { embedCode, frameAddress, frameCode, heightFor } from "./embed-code.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const lang = (): "en" | "ja" => (document.documentElement.lang === "ja" ? "ja" : "en");
const say = (key: string): string => (WORDS[lang()] as Record<string, string>)[key] ?? key;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wrap360 = (degrees: number): number => ((degrees % 360) + 360) % 360;

const address = createAddressState({ defaults: { proj: DEFAULT_VIEW.projection, ra: DEFAULT_VIEW.ra.toFixed(2), dec: DEFAULT_VIEW.dec.toFixed(2), zoom: "1", mag: String(DEFAULT_MAGNITUDE) } });

// ----- the state, read from the address -----
let view: View = { ...DEFAULT_VIEW };
let magnitude = DEFAULT_MAGNITUDE;
let layers: Set<Layer> = layersOf(null);
let picked: string | null = null;
let hover: string | undefined;

function read(): void {
  const kind = address.get("proj") ?? "";
  view = {
    projection: (PROJECTIONS as readonly string[]).includes(kind) ? (kind as Projection) : DEFAULT_VIEW.projection,
    ra: wrap360(Number(address.get("ra")) || 0),
    dec: Math.max(-90, Math.min(90, Number(address.get("dec")) || 0)),
    zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(address.get("zoom")) || 1)),
  };
  magnitude = Math.max(2, Math.min(6, Number(address.get("mag")) || DEFAULT_MAGNITUDE));
  const named = address.get("layers");
  layers = layersOf(named === "none" ? "" : named);
  picked = address.get("pick");
}

function writeView(): void {
  address.setMany({ ra: view.ra.toFixed(2), dec: view.dec.toFixed(2), zoom: String(Math.round(view.zoom * 100) / 100) });
}

// ----- drawing -----
const svg = $("chart") as unknown as SVGSVGElement;
const box = $("chart-box");
let width = 800;
let height = 560;
let hits: Hit[] = [];
let queued = false;

const pickedConstellation = (): string | undefined => {
  if (picked === null) return undefined;
  const [kind, key = ""] = [picked.slice(0, 1), picked.slice(2)];
  if (kind === "C") return key;
  const star = kind === "S" ? starByHr(Number(key)) : undefined;
  return star?.constellation;
};

function draw(): void {
  queued = false;
  const out = chart({ ...view, width, height, magnitude, layers, lang: lang(), highlight: hover ?? pickedConstellation(), picked: picked !== null && picked.slice(0, 1) !== "C" ? picked.slice(2) : undefined });
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
    view = { ...view, projection: kind as Projection };
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
interface Touch {
  x: number;
  y: number;
}
const touches = new Map<number, Touch>();
let moved = 0;
let pinch = 0;
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
svg.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.pointerType === "mouse") return;
  svg.setPointerCapture(event.pointerId);
  touches.set(event.pointerId, local(event));
  moved = touches.size > 1 ? 99 : 0;
  pinch = 0;
  cancelFly();
});
svg.addEventListener("pointermove", (event) => {
  const here = local(event);
  const before = touches.get(event.pointerId);
  if (before === undefined) {
    if (event.pointerType === "mouse") hovering(here);
    return;
  }
  if (touches.size === 1) {
    moved += Math.abs(here.x - before.x) + Math.abs(here.y - before.y);
    if (moved > 6) view = dragged(view, width, height, here.x - before.x, here.y - before.y);
  } else if (touches.size === 2) {
    const others = [...touches.entries()].find(([id]) => id !== event.pointerId)![1];
    const distance = Math.hypot(here.x - others.x, here.y - others.y);
    const middleBefore = { x: (before.x + others.x) / 2, y: (before.y + others.y) / 2 };
    const middle = { x: (here.x + others.x) / 2, y: (here.y + others.y) / 2 };
    view = dragged(view, width, height, middle.x - middleBefore.x, middle.y - middleBefore.y);
    if (pinch > 0 && distance > 0) view = zoomedAbout(view, width, height, distance / pinch, middle.x, middle.y);
    pinch = distance;
  }
  touches.set(event.pointerId, here);
  schedule();
});
const release = (event: PointerEvent): void => {
  const was = touches.get(event.pointerId);
  touches.delete(event.pointerId);
  if (touches.size < 2) pinch = 0;
  if (was === undefined) return;
  if (touches.size === 0) {
    if (moved <= 6 && event.type === "pointerup") tap(was.x, was.y);
    else settled();
  }
};
svg.addEventListener("pointerup", release);
svg.addEventListener("pointercancel", release);
svg.addEventListener("pointerleave", () => {
  if (hover !== undefined) {
    hover = undefined;
    $("under").textContent = "";
    schedule();
  }
});
svg.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    cancelFly();
    const at = local(event);
    view = zoomedAbout(view, width, height, Math.exp((-event.deltaY * (event.deltaMode === 1 ? 16 : 1)) / 400), at.x, at.y);
    schedule();
    settled();
  },
  { passive: false },
);
svg.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 160 : 48;
  const move: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  if (event.key in move) {
    const [dx, dy] = move[event.key]!;
    view = dragged(view, width, height, dx, dy);
  } else if (event.key === "+" || event.key === "=") view = zoomedAbout(view, width, height, 1.4, width / 2, height / 2);
  else if (event.key === "-" || event.key === "_") view = zoomedAbout(view, width, height, 1 / 1.4, width / 2, height / 2);
  else if (event.key === "0" || event.key === "Home") view = { ...view, ra: DEFAULT_VIEW.ra, dec: DEFAULT_VIEW.dec, zoom: 1 };
  else return;
  event.preventDefault();
  schedule();
  settled();
});
$("zoom-in").addEventListener("click", () => {
  view = zoomedAbout(view, width, height, 1.6, width / 2, height / 2);
  schedule();
  settled();
});
$("zoom-out").addEventListener("click", () => {
  view = zoomedAbout(view, width, height, 1 / 1.6, width / 2, height / 2);
  schedule();
  settled();
});
$("reset").addEventListener("click", () => {
  fly({ ra: DEFAULT_VIEW.ra, dec: DEFAULT_VIEW.dec, zoom: 1 });
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
    view = place(1);
    schedule();
    settled();
    return;
  }
  const started = performance.now();
  const step = (now: number): void => {
    if (mine !== flying) return;
    const t = Math.min(1, (now - started) / 700);
    view = place(t * t * (3 - 2 * t));
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
    const name = fold(star.name);
    if (name.startsWith(q)) starts.push({ label: star.name, kind: say("starKind"), key: `S:${star.hr}` });
    else if (name.includes(q)) contains.push({ label: star.name, kind: say("starKind"), key: `S:${star.hr}` });
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
    title.textContent = star.name ?? star.designation ?? `HR ${star.hr}`;
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
    for (const star of starsIn(c.abbreviation).slice(0, 12)) chips.append(linkTo(star.name ?? star.designation ?? `HR ${star.hr}`, `S:${star.hr}`));
    host.append(Object.assign(document.createElement("h4"), { textContent: say("starsIn") }), chips);
  }
}

// ----- the code to copy -----
const panel = $<EmbedPanelElement>("embed-panel");
const choice = (): Choice => ({ ...view, ra: Math.round(view.ra * 100) / 100, dec: Math.round(view.dec * 100) / 100, magnitude, layers, lang: lang(), ...(pickedConstellation() === undefined ? {} : { highlight: pickedConstellation() }) });
panel.kinds = ["module", "html", "react", "vue", "angular", "svelte", "iframe"];
panel.generate = ({ kind, size, preview }) => (kind === "iframe" ? frameCode(choice(), say("chartLabel"), size, preview) : (embedCode(kind, choice(), size) ?? ""));
panel.preview = ({ kind, size }) => {
  if (kind === "iframe") return undefined;
  const holder = document.createElement("div");
  holder.style.cssText = `width: ${size}px; max-width: 100%; line-height: 0`;
  const c = choice();
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
