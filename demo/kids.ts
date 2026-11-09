// The sheets page: connect-the-dots constellations, the constellations for where you live, a star wheel for your latitude and a sky map for a month. Pick a sheet, say where you live (kuni's countries and regions, hata's flags,
// or a latitude, or your location when you ask), pick the paper, see the sheet as it will print and press Print / save PDF. The sheet's header, footer and QR code are kazoku-ui's print part; the pictures are this package's (`/sheets`).
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { buildSheet, printCss, printSheet, wordsFor, type Layout, type PageName, type SheetInfo } from "@johnmorrisdotca/kazoku-ui/print";
import { countries, countryName } from "@johnmorrisdotca/kuni";
import { facts } from "@johnmorrisdotca/kuni/facts";
import { WORDS } from "../scripts/page-words.ts";
import { constellations } from "../src/constellations.ts";
import { figureOf } from "../src/lines.ts";
import { DOT_LEVELS, dotsSvg, latitudeBand, monthName, regionGuideSvg, skyForLatitude, skyMapSvg, starWheelDisc, starWheelPlate, starWheelPoster, WHEEL_LATITUDES, type DotLevel } from "../src/sheets/index.ts";
import { regionFlag, regionPoints, REGION_COUNTRIES } from "./places.ts";

type Lang = "en" | "ja";
const KINDS = ["dots", "guide", "wheel", "map"] as const;
type Kind = (typeof KINDS)[number];
const PAPERS: readonly PageName[] = ["a4", "letter", "a3", "tabloid"];
const FAMOUS = ["UMa", "UMi", "Cas", "Ori", "Cru", "Leo", "Sco", "Cyg", "Lyr", "Aql", "Gem", "Tau"];
declare const __HOSHI_VERSION__: string;
const ADDRESS = "https://johnmorrisdotca.github.io/hoshi-stars/kids.html";

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const lang = (): Lang => (document.documentElement.lang === "ja" ? "ja" : "en");
const say = (key: string, values: Record<string, string | number> = {}): string => ((WORDS[lang()] as Record<string, string>)[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));

const address = createAddressState({ defaults: {} });
const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const dottable = constellations().filter((c) => figureOf(c.abbreviation).segments.length > 0).map((c) => c.abbreviation);

interface State {
  kind: Kind;
  level: DotLevel;
  which: string;
  country: string;
  region: string;
  lat: number | null;
  month: number;
  paper: PageName;
  type: "kid" | "normal";
  form: "pages" | "poster";
}
const initialLat = Number(address.get("lat"));
const state: State = {
  kind: pick(address.get("kind"), KINDS, "dots"),
  level: pick(address.get("level"), DOT_LEVELS, "easy"),
  which: pick(address.get("c"), ["pack", ...dottable], "Ori"),
  country: address.get("country") ?? "",
  region: address.get("region") ?? "",
  lat: address.get("lat") !== null && Number.isFinite(initialLat) ? Math.max(-70, Math.min(70, initialLat)) : null,
  month: Number(address.get("month")) >= 1 && Number(address.get("month")) <= 12 ? Math.round(Number(address.get("month"))) : new Date().getMonth() + 1,
  paper: pick(address.get("paper"), PAPERS, "a4"),
  type: pick(address.get("type"), ["kid", "normal"], "kid"),
  form: pick(address.get("form"), ["pages", "poster"], "pages"),
};

// ----- the rows of buttons -------------------------------------------------------------------------------------------------------------------------------------------------------------------
function buttons(container: string, items: readonly { value: string; text: () => string }[], current: () => string, choose: (value: string) => void): void {
  const box = $(container);
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset["value"] = item.value;
    button.addEventListener("click", () => choose(item.value));
    box.append(button);
  }
  rows.push(() => {
    items.forEach((item, i) => {
      const button = box.children[i] as HTMLButtonElement;
      button.textContent = item.text();
      button.setAttribute("aria-pressed", String(item.value === current()));
    });
  });
}
const rows: (() => void)[] = [];

const nameOf = (abbreviation: string): string => {
  const c = constellations().find((one) => one.abbreviation === abbreviation)!;
  return lang() === "ja" ? c.japanese : c.name;
};

buttons("#kinds", KINDS.map((k) => ({ value: k, text: () => say(`kd_${k}`) })), () => state.kind, (v) => choose({ kind: v as Kind }));
buttons("#levels", DOT_LEVELS.map((k) => ({ value: k, text: () => say(`kd_${k}`) })), () => state.level, (v) => choose({ level: v as DotLevel }));
buttons("#whiches", [{ value: "pack", text: () => say("kd_pack") }, ...FAMOUS.map((a) => ({ value: a, text: () => nameOf(a) }))], () => state.which, (v) => choose({ which: v }));
buttons("#months", Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), text: () => monthName(i + 1, lang()) })), () => String(state.month), (v) => choose({ month: Number(v) }));
buttons("#forms", [{ value: "pages", text: () => say("kd_pages") }, { value: "poster", text: () => say("kd_poster") }], () => state.form, (v) => choose({ form: v as State["form"] }));
buttons("#papers", PAPERS.map((p) => ({ value: p, text: () => say(`kd_${p}`) })), () => state.paper, (v) => choose({ paper: v as PageName }));
buttons("#types", (["kid", "normal"] as const).map((k) => ({ value: k, text: () => say(`kd_${k}`) })), () => state.type, (v) => choose({ type: v as State["type"] }));

// ----- the place ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const countrySelect = $<HTMLSelectElement>("#country");
const regionSelect = $<HTMLSelectElement>("#region");
const moreSelect = $<HTMLSelectElement>("#more");
let regions: { code: string; name: { en: string; ja: string }; lat: number }[] = [];

function fillCountries(): void {
  const list = countries().map((c) => ({ code: c.alpha2, name: countryName(c.alpha2, lang()) ?? c.alpha2 })).sort((a, b) => a.name.localeCompare(b.name, lang()));
  countrySelect.replaceChildren(new Option("-", ""), ...list.map((c) => new Option(c.name, c.code)));
  countrySelect.value = state.country;
}
function fillMore(): void {
  const names = dottable.map((a) => ({ code: a, name: nameOf(a) })).sort((a, b) => a.name.localeCompare(b.name, lang()));
  moreSelect.replaceChildren(new Option("-", ""), ...names.map((c) => new Option(c.name, c.code)));
  moreSelect.value = FAMOUS.includes(state.which) || state.which === "pack" ? "" : state.which;
}
async function loadRegions(): Promise<void> {
  regions = REGION_COUNTRIES.has(state.country) ? await regionPoints(state.country) : [];
  $("#field-region").hidden = regions.length === 0;
  regionSelect.replaceChildren(new Option(say("kd_anyRegion"), ""), ...regions.map((r) => new Option(r.name[lang()], r.code)));
  regionSelect.value = regions.some((r) => r.code === state.region) ? state.region : "";
}

/** The latitude the sheets are made for: the slider's, else the chosen region's or country's. */
function latitude(): number | null {
  if (state.lat !== null) return state.lat;
  const region = regions.find((r) => r.code === state.region);
  if (region !== undefined) return region.lat;
  const point = state.country === "" ? undefined : facts(state.country as never)?.point;
  return point?.lat ?? null;
}
const placeName = (): string => {
  const region = regions.find((r) => r.code === state.region);
  if (region !== undefined) return region.name[lang()];
  return state.country === "" ? "" : (countryName(state.country as never, lang()) ?? state.country);
};

// ----- the sheet ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
type Maker = (widthMm: number, heightMm: number) => string;
let sheet: HTMLElement | undefined;
let flagUrl: string | null = null;

function layoutOf(): Partial<Layout> {
  return { page: state.paper, orientation: "portrait", type: state.type, language: lang() };
}

function plan(): { title: string; makers: Maker[]; info?: SheetInfo; poster?: { svg: string; widthMm: number; heightMm: number } } | undefined {
  const type = state.type;
  const l = lang();
  const phi = latitude();
  const band = phi === null ? undefined : latitudeBand(phi, l);
  const place = placeName();
  const info: SheetInfo | undefined = phi === null ? undefined : { region: place === "" ? undefined : place, flagSrc: flagUrl ?? undefined, flagAlt: place === "" ? undefined : say("kd_flagFor", { place }), latitudeBand: band, season: state.kind === "dots" && state.which !== "pack" ? undefined : monthName(state.month, l), language: l === "ja" ? "にほんご" : "English" };
  if (state.kind === "dots") {
    if (state.which === "pack") {
      if (phi === null) return undefined;
      const list = skyForLatitude(phi, state.month).filter((e) => dottable.includes(e.constellation.abbreviation)).slice(0, 6).map((e) => e.constellation.abbreviation);
      const makers = [false, true].flatMap((answer) => list.map((a): Maker => (w, h) => dotsSvg(a, { level: state.level, widthMm: w, heightMm: h, lang: l, answer, type })));
      return { title: say("kd_packOf", { place: place === "" ? band! : place }), makers, info };
    }
    const a = state.which;
    return { title: nameOf(a), makers: [false, true].map((answer): Maker => (w, h) => dotsSvg(a, { level: state.level, widthMm: w, heightMm: h, lang: l, answer, type })), info: { ...info, language: info?.language } };
  }
  if (phi === null) return undefined;
  if (state.kind === "guide") return { title: say("kd_guideOf", { place: place === "" ? band! : place }), makers: [(w, h) => regionGuideSvg(phi, state.month, { widthMm: w, heightMm: h, lang: l, type })], info };
  if (state.kind === "map") return { title: say("kd_mapOf", { month: monthName(state.month, l), band: band! }), makers: [(w, h) => skyMapSvg(phi, state.month, { widthMm: w, heightMm: h, lang: l, type })], info };
  const wheelBand = latitudeBand(Math.min(WHEEL_LATITUDES.max, Math.max(WHEEL_LATITUDES.min, Math.abs(phi))) * (phi < 0 ? -1 : 1), l);
  if (state.form === "poster") return { title: say("kd_wheelOf", { band: wheelBand }), makers: [], info, poster: starWheelPoster(phi, { diameterMm: 400, lang: l, type }) };
  return { title: say("kd_wheelOf", { band: wheelBand }), makers: [(w, h) => starWheelDisc(phi, { widthMm: w, heightMm: h, lang: l, type }), (w, h) => starWheelPlate(phi, { widthMm: w, heightMm: h, lang: l, type })], info };
}

/** The sheet with each page's picture drawn for the room that page's body really has: the sheet is laid out out of sight, with the print rules, and measured. */
function build(): HTMLElement | undefined {
  const made = plan();
  if (made === undefined) return undefined;
  const layout = layoutOf();
  const base = { ...layout, brand: "Space Program X", packageName: "Hoshi Stars 星", title: made.title, credits: lang() === "ja" ? "ほしの データ: イェールほしカタログ。ほしざの せんは じぶんたちで かきました。" : "Stars: Yale Bright Star Catalogue. The constellation figures are our own drawings.", version: __HOSHI_VERSION__, date: new Date(), address: `${ADDRESS}?kind=${state.kind}` };
  if (made.poster !== undefined) {
    const holder = document.createElement("div");
    holder.innerHTML = made.poster.svg;
    return buildSheet({ ...base, info: made.info, poster: { content: holder.firstElementChild!, widthMm: made.poster.widthMm, heightMm: made.poster.heightMm } });
  }
  const holders = made.makers.map(() => {
    const div = document.createElement("div");
    div.style.cssText = "position:absolute;inset:0";
    return div;
  });
  const built = buildSheet({ ...base, info: made.info, pages: holders });
  const style = document.createElement("style");
  style.textContent = printCss(layout);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden";
  host.append(built);
  document.head.append(style);
  document.body.append(host);
  const mm = 25.4 / 96;
  const bodies = Array.from(built.querySelectorAll(".kazoku-body")).map((el) => el.getBoundingClientRect());
  host.remove();
  style.remove();
  made.makers.forEach((make, i) => {
    const box = bodies[i];
    holders[i]!.innerHTML = make(Math.floor((box?.width ?? 184.6 / mm) * mm * 10) / 10, Math.floor((box?.height ?? 150 / mm) * mm * 10) / 10);
  });
  return built;
}

function fit(): void {
  const inner = $("#paper-inner");
  inner.style.transform = "none";
  inner.style.width = "";
  inner.style.marginLeft = "0";
  const first = inner.querySelector<HTMLElement>(".kazoku-page");
  if (first === null) {
    $("#paper").style.height = "0";
    return;
  }
  const natural = first.getBoundingClientRect().width;
  const scale = Math.min(1, $("#paper").clientWidth / natural);
  inner.style.width = `${natural}px`;
  inner.style.transform = `scale(${scale})`;
  inner.style.marginLeft = `${Math.max(0, ($("#paper").clientWidth - natural * scale) / 2)}px`;
  $("#paper").style.height = `${inner.scrollHeight * scale}px`;
}

let renderToken = 0;
async function render(): Promise<void> {
  const token = (renderToken += 1);
  for (const refresh of rows) refresh();
  fillMore();
  const wheel = state.kind === "wheel";
  $("#row-level").hidden = state.kind !== "dots";
  $("#row-which").hidden = state.kind !== "dots";
  $("#row-month").hidden = state.kind === "dots" && state.which !== "pack" ? true : state.kind === "wheel";
  $("#row-form").hidden = !wheel;
  $("#row-where").hidden = state.kind === "dots" && state.which !== "pack";
  const phi = latitude();
  const slider = $<HTMLInputElement>("#lat");
  slider.value = String(phi ?? 0);
  $("#lat-out").textContent = phi === null ? say("kd_unknown") : `${Math.abs(phi).toFixed(1)}° ${phi >= 0 ? "N" : "S"} (${latitudeBand(phi, lang())})`;
  $("#print").textContent = wordsFor(lang()).button;
  $<HTMLAnchorElement>("#pdfs").setAttribute("href", lang() === "ja" ? "pdf/ja.html" : "pdf/");
  const flag = $<HTMLImageElement>("#flag");
  flagUrl = state.country === "" ? null : await regionFlag(state.country, state.region);
  if (token !== renderToken) return;
  flag.hidden = flagUrl === null;
  if (flagUrl !== null) {
    flag.src = flagUrl;
    flag.alt = say("kd_flagFor", { place: placeName() });
  }
  let style = document.getElementById("kids-style");
  if (style === null) {
    style = document.createElement("style");
    style.id = "kids-style";
    document.head.append(style);
  }
  style.textContent = printCss(layoutOf());
  sheet = build();
  $("#paper-inner").replaceChildren(...(sheet === undefined ? [] : [sheet]));
  const pages = sheet?.querySelectorAll(".kazoku-page").length ?? 0;
  $("#info").textContent = sheet === undefined ? say("kd_unknown") : say("kd_info", { paper: say(`kd_${state.paper}`), pages: pages === 1 ? say("kd_one") : say("kd_pageCount", { n: pages }) });
  ($("#print") as HTMLButtonElement).disabled = sheet === undefined;
  fit();
}

function choose(change: Partial<State>): void {
  Object.assign(state, change);
  if (change.which !== undefined && change.which !== "pack" && !FAMOUS.includes(change.which)) moreSelect.value = change.which;
  const keys: Record<string, string> = { kind: state.kind, level: state.level, c: state.which, country: state.country, region: state.region, month: String(state.month), paper: state.paper, type: state.type, form: state.form };
  for (const [key, value] of Object.entries(keys)) address.set(key, value);
  address.set("lat", state.lat === null ? "" : String(state.lat));
  void (change.country !== undefined ? loadRegions() : Promise.resolve()).then(render);
}

countrySelect.addEventListener("change", () => choose({ country: countrySelect.value, region: "", lat: null }));
regionSelect.addEventListener("change", () => choose({ region: regionSelect.value, lat: null }));
moreSelect.addEventListener("change", () => moreSelect.value !== "" && choose({ which: moreSelect.value }));
$<HTMLInputElement>("#lat").addEventListener("input", (event) => choose({ lat: Number((event.target as HTMLInputElement).value) }));
$("#here").addEventListener("click", () => {
  $("#where-note").textContent = say("kd_hereNote");
  navigator.geolocation?.getCurrentPosition((p) => choose({ lat: Math.round(Math.max(-70, Math.min(70, p.coords.latitude)) * 10) / 10, country: "", region: "" }), () => undefined, { maximumAge: 60_000, timeout: 10_000 });
});
$("#print").addEventListener("click", () => {
  if (sheet !== undefined) printSheet(sheet);
});
document.addEventListener("hoshi-language", () => {
  fillCountries();
  void loadRegions().then(render);
});
window.addEventListener("resize", fit);
fillCountries();
void loadRegions().then(render);
