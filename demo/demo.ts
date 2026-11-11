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
import { blackHole, blackHoles } from "../src/black-holes.ts";
import { deepSkyObject, galaxyDistance as messierDistance, messier, type DeepSkyObject } from "../src/deep-sky.ts";
import type { GalaxyDistance } from "../src/galaxy-distance-core.ts";
import { byDistance, compact, ends, GALAXY_LIST_COUNT, parsecsText, type Order } from "./galaxies.ts";
import { PROJECTIONS, project, type Projection } from "../src/projection.ts";
import { deepSkyShape, measuredParts, type DeepSkyShape } from "../src/deep-sky-shape.ts";
import { drawnPictures } from "./picture-quality.ts";
import { starsInside } from "../src/deep-sky-members.ts";
import { createDeepFetcher, TIER_ZOOM } from "./deep.ts";
import { centreOfConstellation, chart, constellationUnder, DEFAULT_VIEW, defaultZoom, figureById, figuresOf, figureUnder, fitScale, keyOfSeen, labelOf, LAYERS, pictureZoomCap, reachOfConstellation, toScreen, ZOOM_MAX, ZOOM_MIN, type Hit, type Layer, type View } from "./chart.ts";
import { CULTURE_IDS, cultureOf, cultureText, type CultureId } from "./cultures.ts";
import { western } from "../src/cultures/western.ts";
import { FAMOUS, fromText, skyOf, viewpointOf } from "./from.ts";
import { attachHands } from "./hands.ts";
import { nearbyOf, type By } from "./nearby.ts";
import { DEFAULT_MAGNITUDE, layersOf, layersText, type Choice } from "./choice.ts";
import type { Box } from "./labels.ts";
import { embedCode, frameAddress, frameCode, heightFor } from "./embed-code.ts";
import { distanceText, foundKey, kindKey, massText, papersOf, placeText } from "./holes.ts";
import { makeCard, paintCard } from "./constellation-card.ts";
import { mountPicker } from "./picker.ts";
import { mountReadings, writeReadings } from "./readings.ts";
import { lookNow, onLook } from "./thumbs.ts";
import { faintFor } from "./faint.ts";
import { BAND_COLOURS, layersFor, loadDistances, renderLegend, UNCERTAIN_COLOUR } from "./distance-layers.ts";
import { DISTANCE_LIMITS, limitAtSlider, limitFromText, limitText, sliderOfLimit, stepLimit } from "../src/distance.ts";
import { figure, profileNotes, profileRows, profileTop, SUN_INPUT, type ProfileView } from "./profile-panel.ts";
import { starProfile } from "../src/profile.ts";
import { starComparison, starPortrait } from "../src/portrait.ts";
import { starCode, starFrameCode, starHeightFor, starQuery, type StarChoice } from "./star-code.ts";
import { lookOf } from "./sky-labels-svg.ts";
import { createOverlay, LOOK_IDS, lookIdOf, type LookId } from "./sky-overlay.ts";
import { CONSTELLATION_LINES_ATTRIBUTE, lineStrengthFromAttribute, STAR_NAMES_ATTRIBUTES, starNamesFromAttributes, type SkyProjector, type StarNamesSettings } from "../src/sky-labels.ts";

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
let galaxyOrder: Order | null = null;
let from: Star | undefined;
let culture: Culture = western;
let sky: SeenSky | undefined;
let nearKeys: string[] = [];
let hover: string | undefined;
let profileView: ProfileView = "portrait";
let embedWhat: "chart" | "star" = "chart";
/** Names on the brightest stars, faint constellation lines and their look: each off until chosen. */
let starNames: StarNamesSettings | undefined;
let lineStrength: number | undefined;
let labelLook: LookId = "display";
const overlay = createOverlay();
/** What the overlay was last set to: it is set again only when one of these changes, never on a frame that only moves the sky. */
const overlayWas = { set: false, names: undefined as StarNamesSettings | undefined, strength: undefined as number | undefined, look: "", lang: "", maxLength: undefined as number | undefined };
function configureOverlay(): void {
  const sky3 = sky === undefined;
  const names = sky3 ? starNames : undefined;
  const strength = sky3 ? lineStrength : undefined;
  const language = lang();
  const maxLength = view.projection === "equirectangular" || view.projection === "mollweide" || view.projection === "hammer" ? width / 2 : undefined;
  const was = overlayWas;
  if (was.set && was.names === names && was.strength === strength && was.look === labelLook && was.lang === language && was.maxLength === maxLength) return;
  was.set = true;
  was.names = names;
  was.strength = strength;
  was.look = labelLook;
  was.lang = language;
  was.maxLength = maxLength;
  overlay.configure({ names, strength, look: labelLook, style: lookOf(document.documentElement, new URLSearchParams(location.search)), lang: language, maxLength });
}
const projector: SkyProjector = (ra, dec, o) => {
  const at = toScreen(view, width, height, { rightAscension: ra, declination: dec });
  if (at === undefined) return false;
  o.x = at[0];
  o.y = at[1];
  return true;
};
/** The sky out to this many light-years (Infinity for all), or undefined for the sky as it was. */
let limit: number | undefined;

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
  const pview = address.get("pview");
  profileView = pview === "compare" || pview === "3d" ? pview : "portrait";
  embedWhat = address.get("ew") === "star" ? "star" : "chart";
  starNames = starNamesFromAttributes(address.get(STAR_NAMES_ATTRIBUTES.count), address.get(STAR_NAMES_ATTRIBUTES.magnitude));
  lineStrength = lineStrengthFromAttribute(address.get(CONSTELLATION_LINES_ATTRIBUTE));
  labelLook = lookIdOf(address.get("label-look"));
  overlayWas.set = false;
  limit = limitFromText(address.get("dist"));
  if (limit !== undefined) loadDistances(() => everything());
  by = address.get("by") === "space" ? "space" : "sky";
  galaxyOrder = address.get("gal") === "near" ? "near" : address.get("gal") === "far" ? "far" : null;
  from = viewpointOf(address.get("from"));
  sky = skyOf(from);
  culture = cultureOf(address.get("culture")) ?? western;
  if (picked?.startsWith("C:") && figureById(picked.slice(2), culture) === undefined) picked = null;
  if (picked?.startsWith("B:") && blackHole(picked.slice(2)) === undefined) picked = null;
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
const fetcher = createDeepFetcher("./", () => schedule());
/** The pictures the last frame chose, so they keep their places as the view moves. */
let chosenPictures: ReadonlySet<string> = new Set();
/** An object of the Messier table, or of the whole table once the NGC and IC objects are in. */
const deepObject = (id: string): DeepSkyObject | undefined => deepSkyObject(id) ?? fetcher.find(id);
const shapeOfObject = (object: DeepSkyObject): DeepSkyShape => (fetcher.shapeOf() ?? deepSkyShape)(object);
const distanceOfObject = (object: DeepSkyObject): GalaxyDistance | null => (fetcher.distanceOf() ?? messierDistance)(object);

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
  const shown = view.zoom / opening();
  // from a thousand on, whole numbers with a thousands separator: "2,837×" is the width of "177.3×"
  $("zoom-readout").textContent = shown >= 1000 ? `${Math.round(shown).toLocaleString(lang())}×` : zoomText(shown);
  const faint = sky === undefined ? faintFor(view, width, height, magnitude, layers, schedule) : undefined;
  if ((layers.has("deep") && view.zoom >= TIER_ZOOM) || (picked?.startsWith("D:") === true && deepSkyObject(picked.slice(2)) === undefined)) void fetcher.loadTier();
  configureOverlay();
  const keepClear = clear();
  overlay.update(projector, { width, height }, keepClear);
  const layered = limit === undefined || sky !== undefined ? undefined : layersFor(limit);
  const out = chart({ ...view, overlay: overlay.on ? { lines: overlay.lines, names: layered === undefined ? overlay.names : undefined } : undefined, ...(layered === undefined ? {} : { distance: { layers: layered, colours: BAND_COLOURS, uncertain: UNCERTAIN_COLOUR } }), width, height, magnitude, layers, lang: lang(), keepClear, highlight: hover ?? pickedConstellation(), culture, near: nearKeys, picked: picked !== null && picked.slice(0, 1) !== "C" && picked.slice(0, 1) !== "B" ? picked.slice(2) : undefined, pickedHole: picked?.startsWith("B:") ? picked.slice(2) : undefined, sky, faint, catalogue: fetcher.catalogue(), shapeOf: fetcher.shapeOf(), readyPictures: fetcher.ready, pictureBase: "./", previousPictures: chosenPictures });
  chosenPictures = new Set(out.wanted);
  faintNote(out.faint, faint?.state);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  // a picture already on the page keeps its element across a redraw, so it is never blank for a frame while the browser decodes it again
  const kept = new Map<string, Element>();
  svg.querySelectorAll("image[data-pic]").forEach((node) => kept.set(node.getAttribute("data-pic")!, node));
  svg.innerHTML = out.svg;
  svg.querySelectorAll("image[data-pic]").forEach((node) => {
    const old = kept.get(node.getAttribute("data-pic")!);
    if (old === undefined) return;
    old.setAttribute("transform", node.getAttribute("transform")!);
    old.setAttribute("opacity", node.getAttribute("opacity")!);
    node.replaceWith(old);
  });
  hits = out.hits;
  if (out.wanted.length > 0) {
    fetcher.want(out.wanted);
    if (out.wanted.some((id) => !id.startsWith("M"))) void fetcher.loadTier();
  }
}
/** The line under the chart about the faint stars: the depth reached here, or what is missing. */
function faintNote(drawn: { drawn: number; depth: number } | undefined, state: "ready" | "loading" | "failed" | undefined): void {
  const note = $("faint-note");
  let text = "";
  if (layers.has("faint") && sky === undefined) {
    if (state === undefined || drawn === undefined) text = say("faintHint");
    else if (state === "loading") text = say("faintLoading");
    else if (state === "failed") text = say("faintFailed");
    else text = say("faintDepth").replace("{depth}", drawn.depth.toFixed(1)).replace("{count}", drawn.drawn.toLocaleString(lang()));
  }
  if (note.textContent !== text) note.textContent = text;
}
function schedule(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(draw);
}
overlay.attach(box, schedule);
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
  const starNow = starChoiceNow();
  if (starNow === undefined) embedWhat = "chart";
  $("seg-embed-what").querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.value === embedWhat));
    if (b.dataset.value === "star") (b as HTMLButtonElement).disabled = starNow === undefined;
  });
  $("embed-what-hint").hidden = starNow !== undefined;
  overlayPressed();
  readings.refresh(say("readings"));
  writeReadings($("culture-note"), say(`cultureNote${culture.id[0]!.toUpperCase()}${culture.id.slice(1)}`), readings.on());
  const slider = $<HTMLInputElement>("magnitude");
  slider.value = String(magnitude);
  $("magnitude-out").textContent = magnitude.toFixed(1);
  distancePanel();
  $("shown").textContent = limit !== undefined && sky === undefined && layersFor(limit) !== undefined ? say("distShown").replace("{n}", layersFor(limit)!.things.length.toLocaleString(lang())).replace("{limit}", limit === Infinity ? say("distAllWords") : say("distLimitText").replace("{n}", limit.toLocaleString(lang()))) : `${(sky === undefined ? stars({ magnitude }).length : sky.filter((star) => star.magnitude <= magnitude).length).toLocaleString(lang())} ${say("sampleCount")}`;
  fromChoices();
}
/** The names and lines row: which choice is on in each group. */
function overlayPressed(): void {
  const names = starNames === undefined ? "off" : starNames.count !== undefined ? String(starNames.count) : "bright";
  $("seg-names").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === names)));
  const strength = lineStrength === undefined ? "off" : String(lineStrength);
  $("seg-lines-strength").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === strength)));
  $("seg-look").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === labelLook)));
  $("seg-look").querySelectorAll("button").forEach((b) => ((b as HTMLButtonElement).disabled = starNames === undefined && lineStrength === undefined));
}
function setNames(count: number | undefined, magnitude?: number): void {
  starNames = count === undefined && magnitude === undefined ? undefined : { ...(count === undefined ? {} : { count }), ...(magnitude === undefined ? {} : { magnitude }) };
  address.setMany({ [STAR_NAMES_ATTRIBUTES.count]: count === undefined ? null : String(count), [STAR_NAMES_ATTRIBUTES.magnitude]: magnitude === undefined ? null : String(magnitude) });
  everything();
}
/** The distance row: which limit is chosen, the slider and its readout, the legend and the note about what is left out. */
function distancePanel(): void {
  const on = limit !== undefined && sky === undefined;
  $("seg-dist").querySelectorAll("button").forEach((b) => {
    const value = b.dataset.value!;
    b.setAttribute("aria-pressed", String(value === "off" ? limit === undefined : value === "all" ? limit === Infinity : limit === Number(value)));
  });
  $("dist-more").hidden = !on;
  const legend = $("dist-legend");
  const note = $("dist-note");
  legend.hidden = !on;
  note.hidden = !on;
  if (!on) return;
  const slider = $<HTMLInputElement>("dist-slider");
  slider.value = String(Math.round(sliderOfLimit(limit!) * 1000));
  $("dist-out").textContent = limit === Infinity ? say("distAll") : say("distLimitText").replace("{n}", (limit! >= 100 ? Math.round(limit!) : Number(limit!.toPrecision(2))).toLocaleString(lang()));
  const layers = layersFor(limit!);
  renderLegend(legend, layers, lang());
  note.textContent = layers === undefined ? say("distLoading") : say("distNote").replace("{n}", layers.unknown.toLocaleString(lang()));
}
function setLimit(next: number | undefined): void {
  limit = next;
  address.set("dist", next === undefined ? null : limitText(next));
  if (next !== undefined) loadDistances(() => everything());
  everything();
}
function words(): void {
  seg("seg-names", [["off", say("olOff")], ["6", "6"], ["12", "12"], ["24", "24"], ["bright", say("olBright")]], (value) => (value === "off" ? setNames(undefined) : value === "bright" ? setNames(undefined, 1.5) : setNames(Number(value))));
  seg("seg-lines-strength", [["off", say("olOff")], ["0.16", say("olFaint")], ["0.4", say("olMedium")], ["1", say("olFull")]], (value) => {
    lineStrength = value === "off" ? undefined : Number(value);
    address.set(CONSTELLATION_LINES_ATTRIBUTE, lineStrength === undefined ? null : String(lineStrength));
    everything();
  });
  seg("seg-look", LOOK_IDS.map((id) => [id, say(`look${id[0]!.toUpperCase()}${id.slice(1)}`)] as const), (id) => {
    labelLook = id as LookId;
    address.set("label-look", labelLook === "display" ? null : labelLook);
    everything();
  });
  seg("seg-dist", [["off", say("distOff")], ...DISTANCE_LIMITS.map((n) => [String(n), n.toLocaleString(lang())] as const), ["all", say("distAll")]], (value) => setLimit(value === "off" ? undefined : value === "all" ? Infinity : Number(value)));
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
  seg("seg-embed-what", [["chart", say("embedChart")], ["star", say("embedStar")]], (what) => {
    embedWhat = what === "star" ? "star" : "chart";
    address.set("ew", embedWhat === "star" ? "star" : null);
    everything();
  });
  seg("seg-layers", LAYERS.map((layer) => [layer, say(layer)] as const), (layer) => {
    if (layers.has(layer as Layer)) layers.delete(layer as Layer);
    else layers.add(layer as Layer);
    address.set("layers", layersText(layers));
    everything();
  });
}
$("dist-nearer").addEventListener("click", () => limit !== undefined && setLimit(stepLimit(limit, -1)));
$("dist-farther").addEventListener("click", () => limit !== undefined && setLimit(stepLimit(limit, 1)));
$<HTMLInputElement>("dist-slider").addEventListener("input", () => setLimit(limitAtSlider(Number($<HTMLInputElement>("dist-slider").value) / 1000)));
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
  zoomCap: (at, x, y) => (layers.has("pictures") ? pictureZoomCap(at, width, height, x, y) : ZOOM_MAX),
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
    // a deep-sky object drawn large is tapped anywhere in its bright middle, not only at its exact centre
    const away = Math.max(0, Math.hypot(hit.x - x, hit.y - y) - ((hit.reach ?? 22) - 22));
    const d = away ** 2;
    if (d < near) {
      near = d;
      best = hit;
    }
  }
  if (best !== undefined) pick(best.kind === "star" ? `S:${best.key}` : best.kind === "hole" ? `B:${best.key}` : `D:${best.key}`);
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
  // no closer than the picture at the place can show sharp
  const cap = layers.has("pictures") ? pictureZoomCap({ ...from, ra: to.ra, dec: to.dec, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, to.zoom)) }, width, height, width / 2, height / 2) : ZOOM_MAX;
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, to.zoom, cap));
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

/** The zoom at which a deep-sky object fills about half of the chart (its picture is then fully shown), or a close one where its size is not known. */
function zoomForObject(object: DeepSkyObject): number {
  const shape = shapeOfObject(object);
  if (shape.majorArcmin === undefined) return Math.max(view.zoom, 40);
  const test = { ...view, ra: object.rightAscension, dec: object.declination, zoom: 1 };
  const a = toScreen(test, width, height, object);
  const b = toScreen(test, width, height, { rightAscension: object.rightAscension, declination: object.declination + 1 / 60 });
  const perArcmin = a === undefined || b === undefined ? fitScale(view.projection, width, height) * (Math.PI / 10800) : Math.hypot(a[0] - b[0], a[1] - b[1]);
  return Math.max(2, Math.min(ZOOM_MAX, (0.55 * Math.min(width, height)) / (shape.majorArcmin * perArcmin)));
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
  for (const hole of blackHoles()) {
    const names = [hole.name, ...hole.otherNames].map((name) => fold(name).replace(/[^a-z0-9]+/g, ""));
    const asked = q.replace(/[^a-z0-9]+/g, "");
    if (asked !== "" && names.some((name) => name.startsWith(asked) || (asked.length > 2 && name.includes(asked)))) (names.some((name) => name.startsWith(asked)) ? starts : contains).push({ label: hole.name, kind: say(kindKey(hole)), key: `B:${hole.id}` });
  }
  // an NGC or IC number or a name from the whole table, once that is fetched (asking for it starts as soon as the text looks like one)
  const wide = /^(ngc|ic)\s*\d/.test(q) || /[a-z]{4}/.test(q) ? fetcher.find(text) : undefined;
  if (wide !== undefined && !starts.some((one) => one.key === `D:${wide.id}`)) starts.push({ label: wide.name === undefined ? wide.id : `${wide.id} ${wide.name}`, kind: say("deepKind"), key: `D:${wide.id}` });
  return [...out, ...starts, ...contains].slice(0, 8);
}

function placeOf(key: string): Place | undefined {
  const id = key.slice(2);
  if (key.startsWith("S:")) {
    const star = seenOf(id) ?? (sky === undefined ? starByHr(Number(id)) : undefined);
    return star && { ra: star.rightAscension, dec: star.declination, zoom: Math.max(view.zoom, 6) };
  }
  if (key.startsWith("D:")) {
    const object = deepObject(id);
    return object && { ra: object.rightAscension, dec: object.declination, zoom: zoomForObject(object) };
  }
  if (key.startsWith("B:")) {
    const hole = blackHole(id);
    return hole && { ra: hole.rightAscension, dec: hole.declination, zoom: Math.max(view.zoom, 6) };
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
field.addEventListener("input", () => {
  showResults(search(field.value), field.value);
  if (/^(ngc|ic)\s*\d/i.test(field.value.trim()) || /[a-z]{4}/i.test(field.value)) void fetcher.loadTier().then(() => showResults(search(field.value), field.value));
});
$("find").addEventListener("submit", (event) => {
  event.preventDefault();
  const first = search(field.value)[0];
  if (first === undefined) showResults([], field.value);
  else goTo(first.key);
});

// ----- the picker over the map -----
const readings = mountReadings($("readings-row"), $<HTMLButtonElement>("readings"), address, () => lang() === "ja" && culture.id === "chinese", () => {
  picker.refresh();
  pressed();
});
const picker = mountPicker({ strip: $("picker-strip"), search: $<HTMLInputElement>("picker-search"), culture: () => culture.id as CultureId, go: (id) => goTo(`C:${id}`), current: pickedConstellation, readings: readings.on, say });

// ----- what is picked -----
const SOURCE_WORDS: Record<string, string> = { RC3: "srcRC3", NED: "srcNed", "Catalogue row": "srcRow" };
/** The sources of photographs in true colour (an observatory's own), placed by a fit to our stars. */
const NATURAL_SOURCES: ReadonlySet<string> = new Set(["NSF NOIRLab", "ESO"]);
const SURVEY_WORDS: Record<string, string> = { "SDSS g, r, i": "pictureSdss", "2MASS J, H, K": "picture2mass", "WISE 3.4, 4.6, 12 micron": "pictureWise", "ESA/Hubble": "pictureHubble", "NSF NOIRLab": "pictureNatural", ESO: "pictureNatural" };
const fill = (text: string, values: Record<string, string>): string => Object.entries(values).reduce((out, [key, value]) => out.replace(`{${key}}`, value), text);
const arcmin = (n: number): string => (n < 10 ? n.toFixed(1) : String(Math.round(n * 10) / 10));

/** What is measured about a deep-sky object and what is drawn: the card's rows, the picture's credit and the stars inside a cluster. */
function deepCard(object: DeepSkyObject, title: HTMLElement, list: HTMLElement, host: HTMLElement): void {
  title.textContent = object.name === undefined ? object.id : `${object.id} ${object.name}`;
  const shape = shapeOfObject(object);
  const parts = measuredParts(shape);
  fact(list, "deepKind", object.id);
  fact(list, "fieldType", say(object.type));
  if (object.magnitude !== undefined) fact(list, "fieldMagnitude", `${object.magnitude.toFixed(1)} ${say("magnitudeUnit")}`);
  fact(list, "fieldSize", !parts.size ? say("sizeNone") : parts.ratio ? fill(say("sizeTwo"), { major: arcmin(shape.majorArcmin!), minor: arcmin(shape.minorArcmin!) }) : fill(say("sizeOne"), { major: arcmin(shape.majorArcmin!) }));
  fact(list, "fieldAngle", parts.angle ? fill(say("angleValue"), { degrees: String(shape.positionAngle) }) : say("angleNone"));
  if (shape.source !== undefined) fact(list, "fieldMeasuredBy", say(SOURCE_WORDS[shape.source]!));
  fact(list, "fieldDrawn", say(parts.oval ? "drawnOval" : parts.size ? "drawnRound" : "drawnFixed"));
  if (object.ngc !== undefined) fact(list, "fieldNgc", object.ngc);
  const away = object.type === "galaxy" ? distanceOfObject(object) : null;
  if (object.type === "galaxy") fact(list, "fieldDistance", away === null ? say("distanceNone") : `${fill(say("distanceLy"), { n: compact(away.lightYears, lang()) })} (${parsecsText(away.parsecs)})`);
  const c = object.constellation === undefined ? undefined : constellation(object.constellation);
  if (c !== undefined) fact(list, "fieldIn", linkTo(nameOf(c), `C:${c.abbreviation}`));
  if (away !== null) {
    const line = (testid: string, text: string): void => {
      const p = Object.assign(document.createElement("p"), { className: "fam-fine", textContent: text });
      p.dataset.testid = testid;
      host.append(p);
    };
    if (away.error !== null) line("distance-error", fill(say("distanceError"), { e: compact(away.error.lightYears, lang()) }));
    if (away.count > 1 && compact(away.spread.low.lightYears, lang()) !== compact(away.spread.high.lightYears, lang())) line("distance-range", fill(say("distanceRange"), { n: String(away.count), low: compact(away.spread.low.lightYears, lang()), high: compact(away.spread.high.lightYears, lang()) }));
    if (away.disagree) line("distance-disagree", say("distanceDisagree"));
    line("distance-source", say("distanceSource"));
  }
  const pictures = drawnPictures().filter((picture) => picture.object === object.id);
  host.append(Object.assign(document.createElement("h4"), { textContent: say("fieldPicture") }));
  if (pictures.length === 0) host.append(Object.assign(document.createElement("p"), { className: "fam-fine", textContent: say("pictureNone") }));
  for (const picture of pictures) {
    const credit = Object.assign(document.createElement("p"), { className: "fam-fine" });
    credit.dataset.testid = "picture-credit";
    credit.textContent = `${fill(say("pictureFrom"), { survey: picture.source.name, colour: say(SURVEY_WORDS[picture.source.name] ?? "pictureHubble"), credit: picture.credit, licence: picture.source.licence })} ${say(NATURAL_SOURCES.has(picture.source.name) ? "pictureNoteNatural" : picture.source.name === "ESA/Hubble" ? "pictureNoteRelease" : "pictureNote")}`;
    host.append(credit);
  }
  const inside = object.type === "open cluster" || object.type === "globular cluster" ? starsInside(object, shape) : undefined;
  if (inside !== undefined && parts.size) {
    host.append(Object.assign(document.createElement("h4"), { textContent: say("fieldInside") }));
    const chips = document.createElement("div");
    chips.className = "chips";
    for (const star of inside.slice(0, 12)) chips.append(linkTo(starName(star), `S:${star.hr}`));
    const note = Object.assign(document.createElement("p"), { className: "fam-fine", textContent: say(inside.length === 0 ? "insideNone" : "insideNote") });
    note.dataset.testid = "inside-note";
    host.append(...(inside.length === 0 ? [note] : [chips, note]));
  }
}

function fact(list: HTMLElement, name: string, value: string | Node, note?: string): void {
  const dt = Object.assign(document.createElement("dt"), { textContent: say(name) });
  const dd = document.createElement("dd");
  dd.append(value);
  if (note !== undefined) dd.append(Object.assign(document.createElement("small"), { className: "fact-note", textContent: note }));
  list.append(dt, dd);
}
/** The star's picture goes under its name, and the figures worked out for it go at the top of its facts. */
function profileOf(host: HTMLElement, title: HTMLElement, list: HTMLElement, input: Parameters<typeof starProfile>[0], name: string): void {
  const profile = starProfile(input);
  const context = { say, lang };
  title.after(
    profileTop(profile, name, profileView, context, (next) => {
      profileView = next;
      address.set("pview", next === "portrait" ? null : next);
      details();
      codes();
    }, input.hr ?? 0),
  );
  // The figures worked out for the star come first: they are what the picture is made from.
  const figures = document.createElement("dl");
  for (const row of profileRows(profile, context)) fact(figures, row.key, row.value, row.note);
  list.prepend(...Array.from(figures.children));
  for (const note of profileNotes(profile, context)) host.append(Object.assign(document.createElement("p"), { className: "fam-fine profile-note", textContent: note }));
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
  galaxiesPanel();
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
    profileOf(host, title, list, SUN_INPUT, say("sun"));
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
    const away = sky === undefined ? starDistance(star) : undefined;
    const distanceError = away?.lightYearsError === undefined ? "" : ` ± ${figure(away.lightYearsError, lang())}`;
    fact(list, "fieldDistance", light === undefined ? nothing : `${sky !== undefined && light < 100 ? light.toFixed(1) : Math.round(light).toLocaleString(lang())}${distanceError} ${say("lightYears")}`);
    const colour = document.createElement("span");
    colour.append(swatch, ` ${starColour(star)}`);
    fact(list, "fieldColour", colour);
    if (star.spectralType !== "") fact(list, "fieldClass", star.spectralType);
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
    profileOf(host, title, list, star, starName(star));
  } else if (picked.startsWith("B:")) {
    const hole = blackHole(id);
    if (hole === undefined) return;
    title.textContent = hole.name;
    fact(list, "fieldType", say(kindKey(hole)));
    fact(list, "fieldStatus", say(hole.status === "confirmed" ? "holeConfirmed" : "holeCandidate"));
    fact(list, "fieldPosition", placeText(hole));
    const mass = massText(hole, lang(), say);
    if (mass !== undefined) fact(list, "fieldMass", mass);
    const far = distanceText(hole, lang(), say);
    if (far !== undefined) fact(list, "fieldDistance", far);
    if (hole.companion !== undefined || hole.companionType !== undefined) fact(list, "fieldCompanion", [hole.companion, hole.companionType].filter((part) => part !== undefined).join(", "));
    fact(list, "fieldFound", say(foundKey(hole)));
    if (hole.year !== undefined) fact(list, "fieldYear", String(hole.year));
    const c = constellation(hole.constellation);
    if (c !== undefined) fact(list, "fieldIn", linkTo(nameOf(c), `C:${c.abbreviation}`));
    if (hole.otherNames.length > 0) fact(list, "fieldNgc", hole.otherNames.slice(0, 4).join(", "));
    host.append(Object.assign(document.createElement("h4"), { textContent: say("fieldMeasured") }), Object.assign(document.createElement("p"), { className: "fam-fine", textContent: say(`how-${hole.foundBy}`) }));
    if (hole.note !== undefined) host.append(Object.assign(document.createElement("p"), { className: "fam-fine", textContent: lang() === "en" ? hole.note : hole.status === "candidate" && hole.note.startsWith("Not dynamically") ? say("holeNoteProbable") : say(`holeNote_${hole.id}`) }));
    const papers = document.createElement("ul");
    papers.className = "papers";
    papers.dataset.testid = "papers";
    for (const { source, facts } of papersOf(hole)) {
      const item = document.createElement("li");
      if (source.link === undefined) item.append(source.citation);
      else item.append(Object.assign(document.createElement("a"), { href: source.link, textContent: source.citation, target: "_blank", rel: "noopener noreferrer" }));
      item.append(Object.assign(document.createElement("span"), { className: "fam-fine", textContent: ` (${facts.map((fact) => say(`src${fact[0]!.toUpperCase()}${fact.slice(1)}`)).join(", ")})` }));
      papers.append(item);
    }
    host.append(Object.assign(document.createElement("h4"), { textContent: say("fieldSources") }), papers);
  } else if (picked.startsWith("D:")) {
    const object = deepObject(id) as DeepSkyObject | undefined;
    if (object === undefined) return;
    deepCard(object, title, list, host);
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
      if (a.partOf !== undefined) fact(list, "fieldEnclosure", culture.find(a.partOf)?.name ?? say(a.partOf));
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
  // Constellations are the strip's picture cards in a grid that fits the panel; stars and objects are rows with their distance.
  if (found.kind === "constellation") list.className = "pick-grid";
  const inSpace = by === "space" && found.canSpace && found.kind === "star";
  for (const row of found.rows) {
    const item = document.createElement("li");
    const id = row.key.slice(2);
    const c = row.key.startsWith("C:") ? constellation(id) : undefined;
    if (c !== undefined && found.kind === "constellation") {
      const card = makeCard(c.abbreviation) as HTMLButtonElement;
      card.dataset.key = row.key;
      paintCard(card, c, lang(), lookNow());
      card.addEventListener("click", () => goTo(row.key));
      item.append(card);
      list.append(item);
      continue;
    }
    const star = row.key.startsWith("S:") ? starByHr(Number(id)) : undefined;
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

// ----- the nearest and farthest galaxies -----
let sortedGalaxies: ReturnType<typeof byDistance> | undefined;
/** Ten galaxies, the nearest or the farthest. The whole table (the NGC and IC tier) is fetched when one of the two is first chosen, not before. */
function galaxiesPanel(): void {
  const host = $("galaxies");
  host.replaceChildren(Object.assign(document.createElement("h3"), { textContent: say("galaxiesHeading") }));
  const row = document.createElement("div");
  row.className = "fam-row";
  const group = document.createElement("span");
  group.className = "fam-seg";
  group.dataset.testid = "galaxies-order";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", say("galaxiesHeading"));
  for (const [value, label] of [["near", "galaxiesNearest"], ["far", "galaxiesFarthest"]] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.value = value;
    button.textContent = say(label);
    button.setAttribute("aria-pressed", String(galaxyOrder === value));
    button.addEventListener("click", () => {
      galaxyOrder = value;
      address.set("gal", value);
      galaxiesPanel();
    });
    group.append(button);
  }
  row.append(group);
  host.append(row);
  const say1 = (key: string, className = "fam-fine"): HTMLParagraphElement => host.appendChild(Object.assign(document.createElement("p"), { className, textContent: say(key) }));
  if (galaxyOrder === null) {
    say1("galaxiesPrompt");
    return;
  }
  const all = fetcher.catalogue();
  if (all === undefined) {
    say1("galaxiesLoading").dataset.testid = "galaxies-loading";
    void fetcher.loadTier().then(galaxiesPanel);
    return;
  }
  sortedGalaxies ??= byDistance(all, distanceOfObject);
  const list = document.createElement("ol");
  list.dataset.testid = "galaxies-list";
  for (const { object, distance } of ends(sortedGalaxies, galaxyOrder, GALAXY_LIST_COUNT)) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fam-button";
    button.dataset.key = `D:${object.id}`;
    button.append(object.name === undefined ? object.id : `${object.id} ${object.name}`, Object.assign(document.createElement("span"), { className: "value", textContent: fill(say("distanceLy"), { n: compact(distance.lightYears, lang()) }) }));
    button.addEventListener("click", () => goTo(`D:${object.id}`));
    item.append(button);
    list.append(item);
  }
  host.append(list);
  const note = Object.assign(document.createElement("p"), { className: "fam-fine", textContent: fill(say("galaxiesNote"), { n: sortedGalaxies.length.toLocaleString(lang()), total: all.filter((o) => o.type === "galaxy").length.toLocaleString(lang()), d: sortedGalaxies.filter((g) => g.distance.disagree).length.toLocaleString(lang()) }) });
  note.dataset.testid = "galaxies-note";
  host.append(note);
}

// ----- the code to copy -----
const panel = $<EmbedPanelElement>("embed-panel");
const choice = (size = width): Choice => ({ ...view, zoom: (view.zoom * fitScale(view.projection, width, height) * size) / width / fitScale(view.projection, size, heightFor(size)), ra: Math.round(view.ra * 100) / 100, dec: Math.round(view.dec * 100) / 100, magnitude, layers, lang: lang(), ...(starNames === undefined || sky !== undefined ? {} : { starNames }), ...(lineStrength === undefined || sky !== undefined ? {} : { lineStrength }), ...(labelLook === "display" || starNames === undefined ? {} : { labelLook }), ...(limit === undefined || sky !== undefined ? {} : { limit }), ...(from === undefined ? {} : { from: fromText(from) }), ...(cultureText(culture) === null ? {} : { cultureId: culture.id }), ...(pickedConstellation() === undefined ? {} : { highlight: pickedConstellation() }), ...(picked === null || picked.startsWith("B:") ? {} : { nearTo: picked, ...(by === "space" ? { nearBy: by } : {}) }) });
panel.kinds = ["module", "html", "react", "vue", "angular", "svelte", "iframe"];
/** The picked star as a choice for the star's code, or `undefined` where no star with a catalogue number is picked (the Sun, a constellation, nothing). */
function starChoiceNow(): StarChoice | undefined {
  if (picked === null || !picked.startsWith("S:") || picked === "S:sun") return undefined;
  const star = starByHr(Number(picked.slice(2))) as Star | undefined;
  return star === undefined ? undefined : { hr: star.hr, name: star.name ?? star.designation ?? `HR ${star.hr}`, view: profileView, lang: lang() };
}
const starMode = (): StarChoice | undefined => (embedWhat === "star" ? starChoiceNow() : undefined);
panel.generate = ({ kind, size, preview }) => {
  const one = starMode();
  if (one !== undefined) return kind === "iframe" ? starFrameCode(one, one.name, size, preview) : (starCode(kind, one, size) ?? "");
  return kind === "iframe" ? frameCode(choice(size), say("chartLabel"), size, preview) : (embedCode(kind, choice(size), size) ?? "");
};
panel.preview = ({ kind, size }) => {
  if (kind === "iframe") return undefined;
  const holder = document.createElement("div");
  holder.style.cssText = `width: ${size}px; max-width: 100%; line-height: 0`;
  const one = starMode();
  if (one !== undefined) {
    const profile = starProfile(starByHr(one.hr) as Star);
    holder.innerHTML = (one.view === "compare" ? starComparison(profile, { name: one.name, lang: one.lang, size }) : starPortrait(profile, { name: one.name, lang: one.lang, size })) ?? "";
    holder.querySelector("svg")?.setAttribute("style", `display:block;width:100%;height:auto;max-height:${starHeightFor(one.view, size)}px`);
    return holder;
  }
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
  const one = starMode();
  panel.openHref = one === undefined ? frameAddress("", choice()) : `star.html?${starQuery(one)}`;
  panel.credits = say("credit");
  panel.update();
}

// ----- keep everything in step -----
function everything(): void {
  pressed();
  codes();
  schedule();
}
onLook(nearbyPanel);
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
// `go=` opens the map on a figure and takes itself out of the address: a constellation by any of its names, else a figure of the culture in the address by its id (the gallery's tiles of the Japanese and Chinese skies)
const goText = address.get("go") ?? "";
const goAsked = constellation(goText)?.abbreviation ?? (figureById(goText, culture) === undefined ? undefined : goText);
if (goAsked !== undefined && figureById(goAsked, culture) !== undefined) {
  address.set("go", null);
  goTo(`C:${goAsked}`);
}
