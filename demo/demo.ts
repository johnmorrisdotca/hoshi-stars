// The demo page: a sky you turn with a drag, zoom with the wheel or a pinch, tap for a star, a Messier object or a constellation, and search by name in English or Japanese.
// Every choice is kept in the address. The language is the family's: the chooser in the header fills the page's fixed words, and this script rewrites what it draws itself.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { zoomText } from "@johnmorrisdotca/kazoku-ui/view-controls";
import { wideCss } from "@johnmorrisdotca/kazoku-ui/wide-layout";
import "@johnmorrisdotca/kazoku-ui/wide-layout/define";
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import type { EmbedChangeDetail, EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import { WORDS } from "../scripts/page-words.ts";
import { starByHr, starColour, starDistance, starDistanceLightYears, stars, type Star } from "../src/index.ts";
import type { SeenSky, SeenStar } from "../src/sky-from.ts";
import { constellation, starsIn, type Constellation } from "../src/constellations.ts";
import type { Culture } from "../src/culture.ts";
import type { CultureFigure } from "../src/lines.ts";
import { deepSkyObject, messier, type DeepSkyObject } from "../src/deep-sky.ts";
import { PROJECTIONS, project, type Projection } from "../src/projection.ts";
import { centreOfConstellation, chart, constellationUnder, DEFAULT_VIEW, defaultZoom, figureById, figuresOf, figureUnder, fitScale, keyOfSeen, labelOf, LAYERS, reachOfConstellation, toScreen, ZOOM_MAX, ZOOM_MIN, type Hit, type Layer, type View } from "./chart.ts";
import { CULTURE_IDS, cultureOf, cultureText } from "./cultures.ts";
import { western } from "../src/cultures/western.ts";
import { FAMOUS, fromText, skyOf, viewpointOf } from "./from.ts";
import { attachHands } from "./hands.ts";
import { nearbyOf, type By } from "./nearby.ts";
import { DEFAULT_MAGNITUDE, layersOf, layersText, type Choice } from "./choice.ts";
import type { Box } from "./labels.ts";
import { embedCode, frameAddress, frameCode, heightFor } from "./embed-code.ts";
import { mountPicker } from "./picker.ts";

const wideStyle = document.createElement("style");
wideStyle.textContent = wideCss({ side: "340px" });
document.head.append(wideStyle);

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
let by: By = "sky";
let from: Star | undefined;
let culture: Culture = western;
let sky: SeenSky | undefined;
let nearKeys: string[] = [];
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
  by = address.get("by") === "space" ? "space" : "sky";
  from = viewpointOf(address.get("from"));
  sky = skyOf(from);
  culture = cultureOf(address.get("culture")) ?? western;
  if (picked?.startsWith("C:") && figureById(picked.slice(2), culture) === undefined) picked = null;
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

/** The figure to show brighter: the picked figure, or the figure of the culture the picked star is in (its constellation in the Western and Japanese skies). */
const pickedConstellation = (): string | undefined => {
  if (picked === null) return undefined;
  const [kind, key = ""] = [picked.slice(0, 1), picked.slice(2)];
  if (kind === "C") return key;
  const star = kind === "S" ? starByHr(Number(key)) : undefined;
  if (star === undefined) return undefined;
  return culture.id === "chinese" ? figuresOf(culture).find((f) => f.stars.includes(star))?.asterism.id : star.constellation;
};

/** The chart's corners that hold buttons (the zoom tools, the Wide toggle): no label is drawn under them. */
function clear(): Box[] {
  const at = svg.getBoundingClientRect();
  return [$("zoom-in").parentElement!, $("wide-toggle")]
    .map((element) => element.getBoundingClientRect())
    .filter((box) => box.width > 0)
    .map((box) => ({ x0: box.left - at.left - 4, y0: box.top - at.top - 4, x1: box.right - at.left + 4, y1: box.bottom - at.top + 4 }));
}

function draw(): void {
  queued = false;
  $("zoom-readout").textContent = zoomText(view.zoom / opening());
  const out = chart({ ...view, width, height, magnitude, layers, lang: lang(), keepClear: clear(), highlight: hover ?? pickedConstellation(), culture, near: nearKeys, picked: picked !== null && picked.slice(0, 1) !== "C" ? picked.slice(2) : undefined, sky });
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
function seg(id: string, items: ReadonlyArray<readonly [string, string]>, click: (value: string) => void, icon?: (value: string) => string): void {
  $(id).replaceChildren(
    ...items.map(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.value = value;
      if (icon === undefined) button.textContent = label;
      else {
        button.innerHTML = icon(value);
        const name = document.createElement("span");
        name.textContent = label;
        button.append(name);
      }
      button.addEventListener("click", () => click(value));
      return button;
    }),
  );
}

/** A projection's own picture: its grid of lines every 45 degrees, drawn by the projection itself and fitted to a small square. */
const projectionIcons = new Map<string, string>();
function projectionIcon(kind: string): string {
  const known = projectionIcons.get(kind);
  if (known !== undefined) return known;
  const lines: Array<Array<[number, number]>> = [];
  const trace = (points: Array<{ rightAscension: number; declination: number }>): void => {
    let run: Array<[number, number]> = [];
    for (const point of points) {
      const at = project(kind as Projection, point, { centre: { rightAscension: 0, declination: 0 } });
      // a point the projection cannot show (the far side), or one thrown far out (gnomonic near 90 degrees), ends the line
      if (at === undefined || Math.hypot(at.x, at.y) > 3) {
        if (run.length > 1) lines.push(run);
        run = [];
      } else run.push([at.x, at.y]);
    }
    if (run.length > 1) lines.push(run);
  };
  const steps = (from: number, to: number, by: number): number[] => Array.from({ length: Math.round((to - from) / by) + 1 }, (_, i) => from + i * by);
  for (const ra of steps(-180, 180, 45)) trace(steps(-90, 90, 5).map((dec) => ({ rightAscension: ra, declination: dec })));
  for (const dec of steps(-45, 45, 45)) trace(steps(-180, 180, 5).map((ra) => ({ rightAscension: ra, declination: dec })));
  const xs = lines.flat().map(([x]) => x);
  const ys = lines.flat().map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const size = 30;
  const k = size / Math.max(x1 - x0, y1 - y0);
  const ox = (34 - (x1 - x0) * k) / 2;
  const oy = (34 - (y1 - y0) * k) / 2;
  const d = lines.map((run) => "M" + run.map(([x, y]) => `${(ox + (x - x0) * k).toFixed(1)} ${(oy + (y1 - y) * k).toFixed(1)}`).join("L")).join("");
  const svg = `<svg viewBox="0 0 34 34" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".85"/></svg>`;
  projectionIcons.set(kind, svg);
  return svg;
}
function pressed(): void {
  $("seg-projection").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === view.projection)));
  $("seg-layers").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(layers.has(b.dataset.value as Layer))));
  $("seg-culture").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === culture.id)));
  $("culture-note").textContent = say(`cultureNote${culture.id[0]!.toUpperCase()}${culture.id.slice(1)}`);
  const slider = $<HTMLInputElement>("magnitude");
  slider.value = String(magnitude);
  $("magnitude-out").textContent = magnitude.toFixed(1);
  $("shown").textContent = `${(sky === undefined ? stars({ magnitude }).length : sky.filter((star) => star.magnitude <= magnitude).length).toLocaleString(lang())} ${say("sampleCount")}`;
  fromChoices();
}
function words(): void {
  $("wide-toggle").setAttribute("lang", lang());
  seg("seg-projection", PROJECTIONS.map((kind) => [kind, say(kind)] as const), (kind) => {
    setView({ ...view, projection: kind as Projection, ...(address.get("zoom") === null ? { zoom: defaultZoom(kind as Projection, width, height) } : {}) });
    address.set("proj", kind);
    everything();
  }, projectionIcon);
  seg("seg-culture", CULTURE_IDS.map((id) => [id, say(`culture${id[0]!.toUpperCase()}${id.slice(1)}`)] as const), (id) => {
    culture = cultureOf(id) ?? western;
    address.set("culture", cultureText(culture));
    if (picked?.startsWith("C:") && figureById(picked.slice(2), culture) === undefined) pick(null);
    hover = undefined;
    details();
    showResults(search(field.value), field.value);
    everything();
    settled();
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

// ----- the viewpoint: the sky from the Earth, or from another star -----
const nameOfStar = (star: Star): string => FAMOUS.find((one) => one.hr === star.hr)?.[lang()] ?? starName(star);
function fromChoices(): void {
  const select = $<HTMLSelectElement>("from");
  const extra = from !== undefined && !FAMOUS.some((one) => one.hr === from!.hr) ? from : picked?.startsWith("S:") ? viewpointOf(`HR${picked.slice(2)}`) : undefined;
  const items: Array<[string, string]> = [["", say("viewFromEarth")], ...FAMOUS.map((one): [string, string] => [`HR${one.hr}`, one[lang()]])];
  if (extra !== undefined && !FAMOUS.some((one) => one.hr === extra.hr)) items.push([fromText(extra), extra === from ? starName(extra) : `${starName(extra)} (${say("viewFromPicked")})`]);
  select.replaceChildren(...items.map(([value, label]) => Object.assign(document.createElement("option"), { value, textContent: label })));
  select.value = from === undefined ? "" : fromText(from);
  const note = $("from-note");
  const distance = from === undefined ? undefined : starDistance(from);
  note.hidden = distance === undefined;
  note.textContent = from === undefined || distance === undefined ? "" : `${say("viewFromNote").replace("{name}", nameOfStar(from)).replace("{distance}", (distance.lightYears < 100 ? distance.lightYears.toFixed(1) : Math.round(distance.lightYears).toLocaleString(lang())))} ${say("viewFromLines")}`;
}
$("from").addEventListener("change", () => {
  address.set("from", $<HTMLSelectElement>("from").value || null);
  from = viewpointOf(address.get("from"));
  sky = skyOf(from);
  details();
  everything();
  settled();
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

/** The figure of the sky culture under a pixel: an asterism near a line or star of it, else (in a sky with constellations) the constellation whose boundary holds the pixel. */
function figureAt(x: number, y: number): CultureFigure | undefined {
  if (sky !== undefined) return undefined;
  const near = figureUnder(view, width, height, x, y, culture);
  if (near !== undefined) return near;
  if (culture.id === "chinese") return undefined;
  const found = constellationUnder(view, width, height, x, y);
  return found === undefined ? undefined : figureById(found.abbreviation, culture);
}

function hovering(at: Touch): void {
  const found = figureAt(at.x, at.y);
  const next = found?.asterism.id;
  if (next === hover) return;
  hover = next;
  $("under").textContent = found === undefined ? "" : labelOf(found, culture, lang());
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
    const found = figureAt(x, y);
    pick(found === undefined ? null : `C:${found.asterism.id}`);
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
  const middle = centreOfConstellation(abbreviation, culture);
  if (middle === undefined) return 3;
  const reach = Math.min(80, reachOfConstellation(abbreviation, culture) * (culture.id === "chinese" ? 1.6 : 1) + 4);
  const test = { ...view, ra: middle.rightAscension, dec: middle.declination, zoom: 1 };
  const at = toScreen(test, width, height, { rightAscension: middle.rightAscension, declination: Math.min(89.9, middle.declination + reach) }) ?? toScreen(test, width, height, { rightAscension: middle.rightAscension, declination: middle.declination - reach });
  const radius = at === undefined ? fitScale(view.projection, width, height) : Math.hypot(at[0] - width / 2, at[1] - height / 2);
  return Math.max(1, Math.min(12, (0.42 * Math.min(width, height)) / Math.max(1, radius)));
}

// ----- search -----
const fold = (text: string): string =>
  [...text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()].map((ch) => (ch >= "ァ" && ch <= "ヶ" ? String.fromCodePoint(ch.codePointAt(0)! - 0x60) : ch)).join("").trim();

/** A star of the sky seen from another star, by the key a pick has (the HR number or `sun`); `undefined` for the Earth's sky. */
const seenOf = (id: string): SeenStar | undefined => sky?.find((star) => keyOfSeen(star.id) === id);

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
  const kindOf = (figure: CultureFigure): string => say(figure.asterism.kind === "constellation" ? "constellationKind" : figure.asterism.kind === "mansion" ? "mansionKind" : "asterismKind");
  const exact = culture.find(text);
  if (exact !== undefined) out.push({ label: labelOf(figureById(exact.id, culture)!, culture, lang()), kind: kindOf(figureById(exact.id, culture)!), key: `C:${exact.id}` });
  const starts: Found[] = [];
  const contains: Found[] = [];
  if (sky !== undefined && [fold("Sun"), fold("太陽")].some((name) => name.startsWith(q))) starts.push({ label: say("sun"), kind: say("starKind"), key: "S:sun" });
  for (const star of stars()) {
    if (star.name === undefined) continue;
    const found = { label: starName(star), kind: say("starKind"), key: `S:${star.hr}` };
    const names = [fold(star.name), ...(star.nameJa === undefined ? [] : [fold(star.nameJa)])];
    if (names.some((name) => name.startsWith(q))) starts.push(found);
    else if (names.some((name) => name.includes(q))) contains.push(found);
  }
  for (const figure of figuresOf(culture)) {
    const a = figure.asterism;
    if (out.some((one) => one.key === `C:${a.id}`)) continue;
    const names = [a.name, ...Object.values(a.names), a.readings.ja, a.readings.zh, ...a.aka, a.id].filter((name): name is string => name !== undefined && name !== "");
    if (names.some((name) => fold(name).includes(q))) (names.some((name) => fold(name).startsWith(q)) ? starts : contains).push({ label: labelOf(figure, culture, lang()), kind: kindOf(figure), key: `C:${a.id}` });
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
    const star = seenOf(id) ?? (sky === undefined ? starByHr(Number(id)) : undefined);
    return star && { ra: star.rightAscension, dec: star.declination, zoom: Math.max(view.zoom, 6) };
  }
  if (key.startsWith("D:")) {
    const object = deepSkyObject(id);
    return object && { ra: object.rightAscension, dec: object.declination, zoom: Math.max(view.zoom, 6) };
  }
  const middle = centreOfConstellation(id, culture);
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

// ----- the picker over the map -----
const picker = mountPicker({ strip: $("picker-strip"), search: $<HTMLInputElement>("picker-search"), go: (abbreviation) => goTo(`C:${abbreviation}`), current: pickedConstellation, say });

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
  picker.refresh();
  nearbyPanel();
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
  if (picked === "S:sun") {
    const sun = seenOf("sun");
    title.textContent = say("sun");
    if (sun === undefined) return;
    const swatch = Object.assign(document.createElement("span"), { className: "swatch" });
    swatch.style.background = "#fff4e0";
    fact(list, "starKind", say("sun"));
    fact(list, "fieldMagnitude", `${sun.magnitude.toFixed(2)} ${say("magnitudeUnit")}`);
    fact(list, "fieldDistance", `${sun.lightYears.toFixed(2)} ${say("lightYears")}`);
    fact(list, "fieldClass", "G2");
  } else if (picked.startsWith("S:")) {
    const star = starByHr(Number(id)) as Star | undefined;
    if (star === undefined) return;
    title.textContent = starName(star);
    const seen = seenOf(id);
    const light = seen?.lightYears ?? (sky === undefined ? starDistanceLightYears(star) : undefined);
    const nothing = from?.hr === star.hr ? say("viewFromHere") : say("unknown");
    const swatch = Object.assign(document.createElement("span"), { className: "swatch" });
    swatch.style.background = starColour(star);
    fact(list, "starKind", `HR ${star.hr}`);
    if (star.designation !== undefined) fact(list, "fieldDesignation", star.designation);
    fact(list, "fieldMagnitude", seen === undefined && sky !== undefined ? nothing : `${(seen?.magnitude ?? star.magnitude).toFixed(2)} ${say("magnitudeUnit")}`);
    fact(list, "fieldDistance", light === undefined ? nothing : `${sky !== undefined && light < 100 ? light.toFixed(1) : Math.round(light).toLocaleString(lang())} ${say("lightYears")}`);
    const colour = document.createElement("span");
    colour.append(swatch, ` ${starColour(star)}`);
    fact(list, "fieldColour", colour);
    if (star.spectralClass !== "") fact(list, "fieldClass", star.spectralClass);
    if (star.constellation !== undefined) {
      const c = constellation(star.constellation);
      if (c !== undefined) fact(list, "fieldIn", figureById(c.abbreviation, culture) === undefined ? nameOf(c) : linkTo(nameOf(c), `C:${c.abbreviation}`));
    }
    const parts = figuresOf(culture).filter((f) => f.asterism.kind !== "constellation" && f.stars.includes(star)).slice(0, 4);
    if (parts.length > 0) {
      const holder = document.createElement("span");
      holder.className = "chips";
      for (const part of parts) holder.append(linkTo(labelOf(part, culture, lang()), `C:${part.asterism.id}`));
      fact(list, "fieldPartOf", holder);
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
    const figure = figureById(id, culture);
    if (figure === undefined) return;
    const a = figure.asterism;
    title.textContent = labelOf(figure, culture, lang());
    if (culture.id === "chinese") title.lang = "zh-Hant";
    const c = a.kind === "constellation" ? constellation(a.id) : undefined;
    if (c !== undefined) {
      fact(list, "constellationKind", c.abbreviation);
      fact(list, "fieldLatin", `${c.name} (${c.genitive})`);
      fact(list, "fieldEnglish", c.english);
      fact(list, "fieldJapanese", `${c.japanese} (${c.reading})`);
    } else {
      fact(list, "fieldType", say(a.kind === "mansion" ? "mansionKind" : "asterismKind"));
      if (a.names.en !== undefined && a.names.en !== title.textContent) fact(list, "fieldEnglish", a.names.en);
      if (a.names.ja !== undefined && culture.id !== "chinese") fact(list, "fieldJapanese", a.readings.ja === undefined || a.readings.ja === a.names.ja ? a.names.ja : `${a.names.ja} (${a.readings.ja})`);
      if (a.about !== "") fact(list, "fieldAbout", a.about);
      if (a.group !== undefined) fact(list, "fieldQuarter", say(a.group));
      const lies = [...new Set(figure.stars.map((star) => constellation(star.constellation)).filter((one): one is Constellation => one !== undefined))];
      if (lies.length > 0) fact(list, "fieldLiesIn", lies.map(nameOf).join(", "));
    }
    if (a.names["zh-Hant"] !== undefined) fact(list, "fieldChinese", `${a.names["zh-Hant"]}${a.names["zh-Hans"] !== a.names["zh-Hant"] ? ` / ${a.names["zh-Hans"]}` : ""}${a.readings.zh === undefined ? "" : ` (${a.readings.zh})`}`);
    if (a.aka.length > 0 && culture.id === "japanese" && a.kind === "asterism") fact(list, "fieldReading", a.aka.join("、"));
    const chips = document.createElement("div");
    chips.className = "chips";
    const members = c === undefined ? figure.stars : starsIn(c.abbreviation);
    for (const star of [...members].sort((x, y) => x.magnitude - y.magnitude).slice(0, 12)) chips.append(linkTo(starName(star), `S:${star.hr}`));
    host.append(Object.assign(document.createElement("h4"), { textContent: say("starsIn") }), chips);
    const notes: string[] = [];
    if (a.missing > 0) notes.push(say("noteMissing").replace("{missing}", String(a.missing)).replace("{held}", String(figure.stars.length)));
    if (culture.id === "chinese") notes.push(say("noteChineseLines"));
    for (const note of notes) {
      const line = Object.assign(document.createElement("p"), { className: "fam-fine", textContent: note });
      line.dataset.testid = "figure-note";
      host.append(line);
    }
  }
}

// ----- what is near what is picked -----
function nearbyPanel(): void {
  const host = $("nearby");
  host.replaceChildren();
  const found = nearbyOf(picked !== null && picked.startsWith("C:") && constellation(picked.slice(2)) === undefined ? null : picked, by, sky);
  nearKeys = found === undefined ? [] : found.rows.filter((row) => !row.key.startsWith("C:") || figureById(row.key.slice(2), culture) !== undefined).map((row) => row.key);
  const title = Object.assign(document.createElement("h3"), { textContent: say("nearbyHeading") });
  host.append(title);
  if (found === undefined) {
    host.append(Object.assign(document.createElement("p"), { className: "fam-fine", textContent: say("nearbyNothing") }));
    return;
  }
  if (found.kind !== "constellation") {
    const row = document.createElement("div");
    row.className = "fam-row";
    const group = document.createElement("span");
    group.className = "fam-seg";
    group.dataset.testid = "nearby-by";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", say("nearbyBy"));
    for (const [value, label] of [["sky", "bySky"], ["space", "bySpace"]] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.value = value;
      button.textContent = say(label);
      button.disabled = value === "space" && !found.canSpace;
      button.setAttribute("aria-pressed", String(value === (by === "space" && found.canSpace ? "space" : "sky")));
      button.addEventListener("click", () => {
        by = value;
        address.set("by", value === "sky" ? null : value);
        nearbyPanel();
        schedule();
        settled();
      });
      group.append(button);
    }
    row.append(group);
    host.append(row);
  }
  const heading = Object.assign(document.createElement("h4"), { textContent: say(found.kind === "constellation" ? "nearbyConstellations" : "nearbyStars") });
  const list = document.createElement("ol");
  list.dataset.testid = "nearby-list";
  const inSpace = by === "space" && found.canSpace && found.kind === "star";
  for (const row of found.rows) {
    const item = document.createElement("li");
    const id = row.key.slice(2);
    const star = row.key.startsWith("S:") ? starByHr(Number(id)) : undefined;
    const c = row.key.startsWith("C:") ? constellation(id) : undefined;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fam-button";
    button.dataset.key = row.key;
    button.append(star !== undefined ? starName(star) : c !== undefined ? nameOf(c) : id === "sun" ? say("sun") : id);
    if (row.value !== undefined) button.append(Object.assign(document.createElement("span"), { className: "value", textContent: inSpace ? `${row.value.toFixed(1)} ${say("lightYears")}` : `${row.value.toFixed(row.value < 10 ? 2 : 1)} ${say("degreesUnit")}` }));
    button.addEventListener("click", () => goTo(row.key));
    item.append(button);
    list.append(item);
  }
  host.append(heading, list);
  if (found.kind === "star") {
    const note = document.createElement("p");
    note.className = "fam-fine";
    note.dataset.testid = "nearby-note";
    note.textContent = inSpace ? `${found.skipped.toLocaleString(lang())} ${say("nearbySkipped")}` : found.canSpace ? say("nearbySkyNote") : say("nearbyNoSpace");
    host.append(note);
  }
}

// ----- the code to copy -----
const panel = $<EmbedPanelElement>("embed-panel");
const choice = (size = width): Choice => ({ ...view, zoom: (view.zoom * fitScale(view.projection, width, height) * size) / width / fitScale(view.projection, size, heightFor(size)), ra: Math.round(view.ra * 100) / 100, dec: Math.round(view.dec * 100) / 100, magnitude, layers, lang: lang(), ...(from === undefined ? {} : { from: fromText(from) }), ...(cultureText(culture) === null ? {} : { cultureId: culture.id }), ...(pickedConstellation() === undefined ? {} : { highlight: pickedConstellation() }), ...(picked === null ? {} : { nearTo: picked, ...(by === "space" ? { nearBy: by } : {}) }) });
panel.kinds = ["module", "html", "react", "vue", "angular", "svelte", "iframe"];
panel.generate = ({ kind, size, preview }) => (kind === "iframe" ? frameCode(choice(size), say("chartLabel"), size, preview) : (embedCode(kind, choice(size), size) ?? ""));
panel.preview = ({ kind, size }) => {
  if (kind === "iframe") return undefined;
  const holder = document.createElement("div");
  holder.style.cssText = `width: ${size}px; max-width: 100%; line-height: 0`;
  const c = choice(size);
  holder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${heightFor(size)}" style="display:block;width:100%;height:auto">${chart({ ...c, width: size, height: heightFor(size), layers: new Set(c.layers.has("lines") ? (["lines"] as const) : []), highlight: undefined, picked: undefined, sky }).svg}</svg>`;
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
const goAsked = constellation(address.get("go") ?? "");
if (goAsked !== undefined) {
  address.set("go", null);
  goTo(`C:${goAsked.abbreviation}`);
}
