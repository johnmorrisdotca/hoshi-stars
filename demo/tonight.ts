// The Tonight page: pick a place (kuni's countries and regions, hata's flag, or your location when you ask) and the stars above its horizon now, as `visibleStars` says: the Sun low enough, the star brighter than the sky's limit once
// the air has dimmed it. A round chart with the zenith at the centre, north up and east on the left (the sky seen looking up), and a list of the brightest. The place and the moment are in the address; your own location never is.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { countries, countryName } from "@johnmorrisdotca/kuni";
import { facts } from "@johnmorrisdotca/kuni/facts";
import { WORDS } from "../scripts/page-words.ts";
import { starColour } from "../src/stars.ts";
import { visibleStars, type SkyLimit, type TonightSky, type Twilight, type VisibleStar } from "../src/tonight.ts";
import { regionFlag, regionPoints, REGION_COUNTRIES } from "./places.ts";

type Lang = "en" | "ja";
const LIMITS = ["city", "suburb", "rural", "dark"] as const;
type Limit = (typeof LIMITS)[number];
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const lang = (): Lang => (document.documentElement.lang === "ja" ? "ja" : "en");
const say = (key: string, values: Record<string, string | number> = {}): string => ((WORDS[lang()] as Record<string, string>)[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const address = createAddressState({ defaults: {} });

interface Point {
  lat: number;
  lon: number;
}
interface State {
  country: string;
  region: string;
  /** The reader's own location, when asked for: in memory only, never in the address. */
  here: Point | null;
  /** A fixed moment in milliseconds, or null for now. */
  t: number | null;
  limit: Limit;
}
const parsedTime = Date.parse(address.get("t") ?? "");
const limitParam = address.get("limit");
const state: State = {
  country: address.get("country") ?? "",
  region: address.get("region") ?? "",
  here: null,
  t: Number.isFinite(parsedTime) ? parsedTime : null,
  limit: (LIMITS as readonly string[]).includes(limitParam ?? "") ? (limitParam as Limit) : "rural",
};
let regions: { code: string; name: { en: string; ja: string }; lat: number; lon: number }[] = [];

// ----- the place -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const countrySelect = $<HTMLSelectElement>("#country");
const regionSelect = $<HTMLSelectElement>("#region");

function fillCountries(): void {
  const list = countries().map((c) => ({ code: c.alpha2, name: countryName(c.alpha2, lang()) ?? c.alpha2 })).sort((a, b) => a.name.localeCompare(b.name, lang()));
  countrySelect.replaceChildren(new Option("-", ""), ...list.map((c) => new Option(c.name, c.code)));
  countrySelect.value = state.country;
}
async function loadRegions(): Promise<void> {
  regions = REGION_COUNTRIES.has(state.country) ? await regionPoints(state.country) : [];
  $("#field-region").hidden = regions.length === 0;
  regionSelect.replaceChildren(new Option(say("tn_anyRegion"), ""), ...regions.map((r) => new Option(r.name[lang()], r.code)));
  regionSelect.value = regions.some((r) => r.code === state.region) ? state.region : "";
}
/** Where the sky is seen from: the reader's location, else the chosen region's point, else the country's. */
function place(): Point | null {
  if (state.here !== null) return state.here;
  const region = regions.find((r) => r.code === state.region);
  if (region !== undefined) return { lat: region.lat, lon: region.lon };
  const point = state.country === "" ? undefined : facts(state.country as never)?.point;
  return point === undefined || point === null ? null : { lat: point.lat, lon: point.lon };
}
function placeName(): string {
  if (state.here !== null) return say("tn_place");
  const region = regions.find((r) => r.code === state.region);
  if (region !== undefined) return region.name[lang()];
  return state.country === "" ? say("tn_place") : (countryName(state.country as never, lang()) ?? state.country);
}

// ----- the chart -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const SIZE = 400;
const MIDDLE = SIZE / 2;
const RADIUS = 176;
const BACKGROUND: Record<Twilight, string> = { day: "#7aa6d8", civil: "#3f5f92", nautical: "#223a66", astronomical: "#142241", night: "#0a1226" };
const SVG = "http://www.w3.org/2000/svg";

function el(name: string, attributes: Record<string, string | number>, text?: string): SVGElement {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
/** The place on the chart of an altitude and azimuth: the zenith at the centre, the horizon at the edge, north up, east on the left (the sky seen looking up). */
function at(altitude: number, azimuth: number): { x: number; y: number } {
  const r = (RADIUS * (90 - altitude)) / 90;
  const a = (azimuth * Math.PI) / 180;
  return { x: MIDDLE - r * Math.sin(a), y: MIDDLE - r * Math.cos(a) };
}
const radiusOf = (magnitude: number): number => Math.max(1.2, Math.min(6.5, 4.6 - 1.1 * magnitude));
const nameOf = (one: VisibleStar): string => (lang() === "ja" ? (one.star.nameJa ?? one.star.name) : one.star.name) ?? one.star.designation ?? `HR ${one.star.hr}`;
const compass = (azimuth: number): string => say("tn_compass").split(",")[Math.round(azimuth / 45) % 8]!;

function drawChart(sky: TonightSky, where: string): SVGElement {
  const svg = el("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, role: "img", "aria-label": say("tn_chartLabel", { place: where }) });
  svg.append(el("rect", { width: SIZE, height: SIZE, fill: "#05080f" }));
  svg.append(el("circle", { cx: MIDDLE, cy: MIDDLE, r: RADIUS, fill: BACKGROUND[sky.twilight], stroke: "#9fb4d8", "stroke-width": 1.5 }));
  for (const altitude of [30, 60]) svg.append(el("circle", { cx: MIDDLE, cy: MIDDLE, r: (RADIUS * (90 - altitude)) / 90, fill: "none", stroke: "#9fb4d8", "stroke-opacity": 0.25, "stroke-dasharray": "3 4" }));
  const names = say("tn_compass").split(",");
  [0, 2, 4, 6].forEach((index) => {
    const spot = at(-6, index * 45);
    svg.append(el("text", { x: spot.x, y: spot.y + 4, "text-anchor": "middle", fill: "#c9d6ee", "font-size": 13, "font-weight": 600 }, names[index]!));
  });
  const stars = el("g", { "data-testid": "tn-stars" });
  for (const one of sky.stars) {
    const spot = at(one.altitude, one.azimuth);
    stars.append(el("circle", { cx: spot.x.toFixed(1), cy: spot.y.toFixed(1), r: radiusOf(one.apparentMagnitude).toFixed(1), fill: starColour(one.star), "fill-opacity": one.ease === "easy" ? 1 : 0.6, "data-hr": one.star.hr }));
  }
  svg.append(stars);
  for (const one of sky.stars.slice(0, 14)) {
    const spot = at(one.altitude, one.azimuth);
    svg.append(el("text", { x: (spot.x + radiusOf(one.apparentMagnitude) + 3).toFixed(1), y: (spot.y + 3).toFixed(1), fill: "#e6edf9", "font-size": 10, "paint-order": "stroke", stroke: "#05080f", "stroke-width": 2.5, "stroke-linejoin": "round" }, nameOf(one)));
  }
  return svg;
}

// ----- the page ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const pad = (n: number): string => String(n).padStart(2, "0");
const localInput = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const LIMIT_WORDS: Record<Limit, string> = { city: "tn_city", suburb: "tn_suburb", rural: "tn_rural", dark: "tn_dark_site" };
let flagToken = 0;

async function render(): Promise<void> {
  const ms = state.t ?? Date.now();
  const spot = place();
  $<HTMLInputElement>("#moment").value = localInput(ms);
  $("#limits").replaceChildren(...LIMITS.map((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = say(LIMIT_WORDS[value]);
    button.dataset["value"] = value;
    button.setAttribute("aria-pressed", String(value === state.limit));
    button.addEventListener("click", () => choose({ limit: value }));
    return button;
  }));
  const token = (flagToken += 1);
  const flag = $<HTMLImageElement>("#flag");
  const url = state.country === "" || state.here !== null ? null : await regionFlag(state.country, state.region);
  if (token !== flagToken) return;
  flag.hidden = url === null;
  if (url !== null) {
    flag.src = url;
    flag.alt = placeName();
  }
  if (spot === null) {
    $("#tn-summary").textContent = say("tn_pick");
    $("#tn-chart").replaceChildren();
    $("#tn-rows").replaceChildren();
    return;
  }
  const limit: SkyLimit = state.limit;
  const sky = visibleStars({ observer: { latitude: spot.lat, longitude: spot.lon }, when: ms, sky: { limit } });
  const where = placeName();
  const twilight = say(`tn_${sky.twilight}`);
  $("#tn-summary").textContent = sky.stars.length === 0 ? say("tn_none", { twilight, place: where }) : say("tn_summary", { twilight, place: where, n: sky.stars.length, name: nameOf(sky.stars[0]!) });
  $("#tn-summary").dataset["twilight"] = sky.twilight;
  $("#tn-chart").replaceChildren(drawChart(sky, where));
  $("#tn-rows").replaceChildren(...sky.stars.slice(0, 12).map((one) => {
    const row = document.createElement("tr");
    row.dataset["hr"] = String(one.star.hr);
    for (const [text, className] of [[nameOf(one), ""], [`${Math.round(one.altitude)}°`, "tn-num"], [compass(one.azimuth), ""], [one.ease === "easy" ? say("tn_easy") : say("tn_adapt"), ""]] as const) {
      const cell = document.createElement("td");
      cell.textContent = text;
      if (className !== "") cell.className = className;
      row.append(cell);
    }
    return row;
  }));
}

function choose(change: Partial<State>): void {
  Object.assign(state, change);
  address.set("country", state.country);
  address.set("region", state.region);
  address.set("t", state.t === null ? "" : new Date(state.t).toISOString().slice(0, 16) + "Z");
  address.set("limit", state.limit === "rural" ? "" : state.limit);
  void (change.country !== undefined ? loadRegions() : Promise.resolve()).then(render);
}

countrySelect.addEventListener("change", () => choose({ country: countrySelect.value, region: "", here: null }));
regionSelect.addEventListener("change", () => choose({ region: regionSelect.value, here: null }));
$("#now").addEventListener("click", () => choose({ t: null }));
$<HTMLInputElement>("#moment").addEventListener("change", (event) => {
  const value = Date.parse((event.target as HTMLInputElement).value);
  if (Number.isFinite(value)) choose({ t: value });
});
$("#here").addEventListener("click", () => {
  $("#where-note").textContent = say("tn_hereNote");
  navigator.geolocation?.getCurrentPosition(
    (p) => choose({ here: { lat: p.coords.latitude, lon: p.coords.longitude }, country: "", region: "" }),
    () => {
      $("#where-note").textContent = say("tn_hereFail");
    },
    { maximumAge: 60_000, timeout: 10_000 },
  );
});
document.addEventListener("hoshi-language", () => {
  fillCountries();
  void loadRegions().then(render);
});
// With "now" showing, keep it current: the sky turns a degree in four minutes, so a minute's wait is as fine as anyone can see.
window.setInterval(() => {
  if (state.t === null && !document.hidden) void render();
}, 60_000);
fillCountries();
void loadRegions().then(render);
