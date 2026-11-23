// The built-in filter bars of the sky elements: a distance range (nearest and farthest, light-years) and a brightness limit (faintest magnitude), as real range inputs with labels and spoken values, English and Japanese.
// The bar reads and writes the host's attributes (`distance-min`, `distance-max`, `magnitude-limit`), so the attributes are the one state; it sends `hoshi-filter` as they move (`final` once the hand lets go).
import { distanceOfStep, distanceStep, DISTANCE_STOPS, magnitudeOfStep, magnitudeStep, MAGNITUDE_STOPS, normaliseStarFilter, STAR_FILTER_ATTRIBUTES, starFilterFromText, starFilterToText, type StarFilter } from "./star-filter.ts";

/**
 * What `hoshi-filter` says: the filter now, and `final` once the hand has let go of a bar (or the filter was set another way).
 *
 * @example
 * ```ts no-run
 * import type { StarFilterDetail } from "@johnmorrisdotca/hoshi-stars/star-filter/bar";
 *
 * document.querySelector("hoshi-chart")!.addEventListener("hoshi-filter", (event) => {
 *   const { distanceMax, magnitudeLimit, final } = (event as CustomEvent<StarFilterDetail>).detail;
 *   if (final) history.replaceState(null, "", `?dmax=${distanceMax ?? ""}&mag=${magnitudeLimit ?? ""}`);
 * });
 * ```
 */
export interface StarFilterDetail extends StarFilter {
  final: boolean;
}

/**
 * How many stars the filter keeps of how many the element has, for the line under the bars.
 *
 * @example
 * ```ts
 * import type { StarFilterCount } from "@johnmorrisdotca/hoshi-stars/star-filter/bar";
 *
 * const count: StarFilterCount = { shown: 300, total: 5080, noDistance: 2755 };
 * console.log(count.shown);
 * ```
 */
export interface StarFilterCount {
  shown: number;
  total: number;
  /** How many have no known distance (hidden while the distance is narrowed). */
  noDistance: number;
}

const WORDS = {
  en: {
    group: "Filter the stars",
    toggle: "Filters",
    distance: "Distance (light-years)",
    nearest: "Nearest",
    farthest: "Farthest",
    brightness: "Brightness: hide stars fainter than",
    any: "any",
    ly: "ly",
    mag: "mag",
    count: "{n} of {total} stars match.",
    unknown: "{n} have no known distance and are hidden while the distance is set.",
    reset: "Show all stars",
  },
  ja: {
    group: "星をしぼりこむ",
    toggle: "しぼりこみ",
    distance: "距離（光年）",
    nearest: "近い側",
    farthest: "遠い側",
    brightness: "明るさ：これより暗い星は出さない",
    any: "すべて",
    ly: "光年",
    mag: "等",
    count: "{total}個の星のうち{n}個が条件に合っています。",
    unknown: "{n}個は距離がわからないので、距離をしぼっている間は出しません。",
    reset: "すべての星を出す",
  },
} as const;

/**
 * The style of the bar, as one style sheet text for the element's shadow root.
 *
 * @example
 * ```ts
 * import { FILTER_BAR_STYLE } from "@johnmorrisdotca/hoshi-stars/star-filter/bar";
 *
 * console.log(FILTER_BAR_STYLE.includes(".filters"));
 * // true
 * ```
 */
export const FILTER_BAR_STYLE = `.filters{position:absolute;left:8px;right:8px;bottom:8px;box-sizing:border-box;max-width:34em;margin:0 auto;padding:6px 10px 8px;background:rgba(8,12,28,.88);border:1px solid rgba(160,185,245,.3);border-radius:10px;color:#e6ecff;font:13px/1.35 var(--hoshi-sky-font,"Hiragino Sans","Noto Sans JP",system-ui,sans-serif);touch-action:manipulation;cursor:default;-webkit-user-select:none;user-select:none;z-index:2}
.filters .bar-head{display:flex;align-items:center;gap:8px}
.filters .bar-title{font-weight:600}
.filters .bar-toggle{margin-left:auto;min-width:44px;min-height:32px;padding:0 10px;border:1px solid rgba(160,185,245,.4);border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.filters button:focus-visible,.filters input:focus-visible{outline:2px solid var(--hoshi-focus,#ffd86b);outline-offset:2px}
.filters .bar-body{display:grid;grid-template-columns:repeat(auto-fit,minmax(11em,1fr));gap:4px 14px;margin-top:4px}
.filters .bar-group{border:0;margin:0;padding:0;min-width:0}
.filters legend{padding:0;font-weight:600;color:#cbd6f5}
.filters .bar-row{display:grid;grid-template-columns:1fr;align-items:center;min-height:32px}
.filters label{color:#cbd6f5}
.filters output{font-variant-numeric:tabular-nums;color:#ffe9a8}
.filters input[type=range]{width:100%;min-width:0;margin:0;height:28px;accent-color:#8fb0ff}
.filters .bar-line{display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;margin:4px 0 0;color:#aeb9dc;font-size:12px}
.filters .bar-line button{min-height:32px;padding:0 10px;border:1px solid rgba(160,185,245,.4);border-radius:8px;background:transparent;color:#e6ecff;font:inherit;cursor:pointer}
.filters[data-collapsed] .bar-body,.filters[data-collapsed] .bar-line{display:none}
.filters .bar-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.filters [hidden]{display:none!important}`;

const number = (n: number, lang: "en" | "ja"): string => n.toLocaleString(lang === "ja" ? "ja-JP" : "en-US");

/**
 * The words for the nearest and farthest outputs and the brightness output, for a language.
 *
 * @param filter - The filter.
 * @param lang - `en` or `ja`.
 * @returns The three texts the bars read aloud.
 *
 * @example
 * ```ts
 * import { starFilterWords } from "@johnmorrisdotca/hoshi-stars/star-filter/bar";
 *
 * console.log(starFilterWords({ distanceMax: 100, magnitudeLimit: 4.5 }, "en"));
 * // { nearest: 'any', farthest: '100 ly', brightness: '4.5 mag' }
 * ```
 */
export function starFilterWords(filter: StarFilter, lang: "en" | "ja"): { nearest: string; farthest: string; brightness: string } {
  const words = WORDS[lang];
  const space = lang === "ja" ? "" : " ";
  return {
    nearest: filter.distanceMin === undefined ? words.any : `${number(filter.distanceMin, lang)}${space}${words.ly}`,
    farthest: filter.distanceMax === undefined ? words.any : `${number(filter.distanceMax, lang)}${space}${words.ly}`,
    brightness: filter.magnitudeLimit === undefined ? words.any : `${filter.magnitudeLimit}${space}${words.mag}`,
  };
}

/**
 * The two sentences under the bars: how many stars match, and (only while the distance is narrowed and some stars have none) how many are hidden for having no known distance.
 *
 * @param filter - The filter.
 * @param count - What the filter keeps, or `undefined` where that is not known (both texts are then empty).
 * @param lang - `en` or `ja`.
 * @returns The texts; an empty text where there is nothing to say.
 *
 * @example
 * ```ts
 * import { starFilterSummary } from "@johnmorrisdotca/hoshi-stars/star-filter/bar";
 *
 * console.log(starFilterSummary({ distanceMax: 100 }, { shown: 300, total: 5080, noDistance: 2755 }, "en").count);
 * // 300 of 5,080 stars match.
 * ```
 */
export function starFilterSummary(filter: StarFilter, count: StarFilterCount | undefined, lang: "en" | "ja"): { count: string; unknown: string } {
  const words = WORDS[lang];
  if (count === undefined) return { count: "", unknown: "" };
  const narrowed = filter.distanceMin !== undefined || filter.distanceMax !== undefined;
  return { count: words.count.replace("{n}", number(count.shown, lang)).replace("{total}", number(count.total, lang)), unknown: narrowed && count.noDistance > 0 ? words.unknown.replace("{n}", number(count.noDistance, lang)) : "" };
}

/**
 * What a mounted bar offers its element: `sync` reads the attributes, the language and the count again, `destroy` takes the bar away.
 *
 * @example
 * ```ts no-run
 * import type { FilterBar } from "@johnmorrisdotca/hoshi-stars/star-filter/bar";
 *
 * const refresh = (bar: FilterBar): void => bar.sync();
 * ```
 */
export interface FilterBar {
  /** Read the attributes again and write the language and the count: the element calls this when they may have changed. */
  sync(): void;
  /** Take the bar away. */
  destroy(): void;
}

/**
 * What the element gives the bar: its language, and how many stars the filter keeps.
 *
 * @example
 * ```ts no-run
 * import type { FilterBarOptions } from "@johnmorrisdotca/hoshi-stars/star-filter/bar";
 *
 * const options: FilterBarOptions = { lang: () => "en", count: () => undefined };
 * ```
 */
export interface FilterBarOptions {
  lang: () => "en" | "ja";
  /** How many stars the filter keeps, or `undefined` while the element does not know. */
  count: () => StarFilterCount | undefined;
}

/**
 * The filter the host's attributes hold.
 *
 * @param host - An element with the filter's attributes.
 * @returns The filter, made well.
 *
 * @example
 * ```ts no-run
 * import { filterOf } from "@johnmorrisdotca/hoshi-stars/star-filter/bar";
 *
 * console.log(filterOf(document.querySelector("hoshi-chart")!));
 * ```
 */
export function filterOf(host: Element): StarFilter {
  return starFilterFromText(host.getAttribute(STAR_FILTER_ATTRIBUTES.distanceMin), host.getAttribute(STAR_FILTER_ATTRIBUTES.distanceMax), host.getAttribute(STAR_FILTER_ATTRIBUTES.magnitudeLimit));
}

/**
 * Put a filter in the host's attributes: a limit that is not set takes its attribute off. Setting an attribute is what moves the element, so this is the one way the bars, the properties and a page's own code all change it.
 *
 * @param host - An element with the filter's attributes.
 * @param filter - The filter to keep; limits left out are taken off.
 *
 * @example
 * ```ts no-run
 * import { setFilterOf } from "@johnmorrisdotca/hoshi-stars/star-filter/bar";
 *
 * setFilterOf(document.querySelector("hoshi-chart")!, { distanceMax: 100 });
 * ```
 */
export function setFilterOf(host: Element, filter: StarFilter): void {
  const text = starFilterToText(filter);
  for (const [key, value] of [[STAR_FILTER_ATTRIBUTES.distanceMin, text.distanceMin], [STAR_FILTER_ATTRIBUTES.distanceMax, text.distanceMax], [STAR_FILTER_ATTRIBUTES.magnitudeLimit, text.magnitudeLimit]] as const) {
    if (value === null) host.removeAttribute(key);
    else if (host.getAttribute(key) !== value) host.setAttribute(key, value);
  }
}

/** Events a press on the bar must not pass to the sky under it: they would turn or zoom the sky. */
const KEPT = ["pointerdown", "pointermove", "pointerup", "pointercancel", "wheel", "keydown", "dblclick", "touchstart", "touchmove", "mousedown", "click"];

let counter = 0;

/**
 * Put the bars in `parent` (the element's shadow root) over the sky. Real range inputs: arrow keys, Home and End move them, each has a label and says its value aloud; the line under them says how many stars match. The bar writes the host's attributes and sends `hoshi-filter`.
 *
 * @param host - The sky element.
 * @param parent - Where the bar goes.
 * @param options - The language, and how many stars the filter keeps.
 * @returns The bar to sync and to take away.
 *
 * @example
 * ```ts no-run
 * import { mountFilterBar } from "@johnmorrisdotca/hoshi-stars/star-filter/bar";
 *
 * const host = document.querySelector("hoshi-chart") as HTMLElement;
 * const bar = mountFilterBar(host, host.shadowRoot!, { lang: () => "en", count: () => undefined });
 * bar.destroy();
 * ```
 */
export function mountFilterBar(host: HTMLElement, parent: ShadowRoot | HTMLElement, options: FilterBarOptions): FilterBar {
  const id = `f${(counter += 1)}`;
  const root = host.ownerDocument.createElement("div");
  root.className = "filters";
  root.setAttribute("part", "filters");
  root.setAttribute("role", "group");
  const last = DISTANCE_STOPS.length - 1;
  root.innerHTML = `<div class="bar-head"><span class="bar-title" part="filters-title"></span><button type="button" class="bar-toggle" part="filters-toggle" aria-expanded="true" aria-controls="${id}-body"></button></div>
<div class="bar-body" id="${id}-body">
<fieldset class="bar-group" part="filters-group"><legend class="d-legend" part="filters-legend"></legend>
<div class="bar-row"><label for="${id}-min" class="d-min" part="filters-label"></label><input id="${id}-min" type="range" min="0" max="${last - 1}" step="1" data-bar="min" part="filters-range"><output for="${id}-min" class="bar-sr" data-out="min"></output></div>
<div class="bar-row"><label for="${id}-max" class="d-max" part="filters-label"></label><input id="${id}-max" type="range" min="1" max="${last}" step="1" data-bar="max" part="filters-range"><output for="${id}-max" class="bar-sr" data-out="max"></output></div>
</fieldset>
<fieldset class="bar-group" part="filters-group"><legend class="b-legend" part="filters-legend"></legend>
<div class="bar-row wide"><input id="${id}-mag" type="range" min="0" max="${MAGNITUDE_STOPS.length}" step="1" data-bar="mag" part="filters-range" aria-labelledby="${id}-mag-label"><span id="${id}-mag-label" class="bar-sr b-label"></span><output for="${id}-mag" class="bar-sr" data-out="mag"></output></div>
</fieldset></div>
<p class="bar-line"><span class="bar-count" part="filters-count" role="status" aria-live="polite"></span><span class="bar-unknown" part="filters-count"></span><button type="button" class="bar-reset" part="filters-reset"></button></p>`;
  for (const type of KEPT) root.addEventListener(type, (event) => event.stopPropagation());
  parent.append(root);
  const $ = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const min = $<HTMLInputElement>('[data-bar="min"]');
  const max = $<HTMLInputElement>('[data-bar="max"]');
  const mag = $<HTMLInputElement>('[data-bar="mag"]');
  const toggle = $<HTMLButtonElement>(".bar-toggle");
  // on a narrow box the bars start folded away so the sky shows; `filter-bar="open"` keeps them open
  let collapsed = host.getAttribute(STAR_FILTER_ATTRIBUTES.bar) !== "open" && host.getBoundingClientRect().width > 0 && host.getBoundingClientRect().width < 520;

  const write = (filter: StarFilter, final: boolean): void => {
    setFilterOf(host, filter);
    host.dispatchEvent(new CustomEvent<StarFilterDetail>("hoshi-filter", { detail: { ...filterOf(host), final } }));
  };
  const fromBars = (): StarFilter => normaliseStarFilter({ distanceMin: distanceOfStep(Number(min.value), "min"), distanceMax: distanceOfStep(Number(max.value), "max"), magnitudeLimit: magnitudeOfStep(Number(mag.value)) });
  const moved = (final: boolean) => (): void => {
    // the nearest end never passes the farthest end: the bar being moved pushes the other
    write(fromBars(), final);
  };
  min.addEventListener("input", () => {
    if (Number(min.value) >= Number(max.value)) max.value = String(Math.min(last, Number(min.value) + 1));
    moved(false)();
  });
  max.addEventListener("input", () => {
    if (Number(max.value) <= Number(min.value)) min.value = String(Math.max(0, Number(max.value) - 1));
    moved(false)();
  });
  mag.addEventListener("input", moved(false));
  for (const bar of [min, max, mag]) bar.addEventListener("change", moved(true));
  $<HTMLButtonElement>(".bar-reset").addEventListener("click", () => write({}, true));
  toggle.addEventListener("click", () => {
    collapsed = !collapsed;
    sync();
  });

  function sync(): void {
    const lang = options.lang();
    const words = WORDS[lang];
    const filter = filterOf(host);
    const spoken = starFilterWords(filter, lang);
    root.setAttribute("aria-label", words.group);
    root.toggleAttribute("data-collapsed", collapsed);
    $(".bar-title").textContent = words.group;
    toggle.textContent = words.toggle;
    toggle.setAttribute("aria-expanded", String(!collapsed));
    $(".d-legend").textContent = words.distance;
    $(".d-min").textContent = `${words.nearest}: ${spoken.nearest}`;
    $(".d-max").textContent = `${words.farthest}: ${spoken.farthest}`;
    $(".b-legend").textContent = `${words.brightness}: ${spoken.brightness}`;
    $(".b-label").textContent = `${words.brightness}`;
    min.value = String(distanceStep(filter.distanceMin, "min"));
    max.value = String(distanceStep(filter.distanceMax, "max"));
    mag.value = String(magnitudeStep(filter.magnitudeLimit));
    min.setAttribute("aria-valuetext", spoken.nearest);
    max.setAttribute("aria-valuetext", spoken.farthest);
    mag.setAttribute("aria-valuetext", spoken.brightness);
    $('[data-out="min"]').textContent = spoken.nearest;
    $('[data-out="max"]').textContent = spoken.farthest;
    $('[data-out="mag"]').textContent = spoken.brightness;
    const said = starFilterSummary(filter, options.count(), lang);
    $(".bar-count").textContent = said.count;
    $(".bar-unknown").textContent = said.unknown;
    $(".bar-reset").textContent = words.reset;
    $(".bar-reset").toggleAttribute("hidden", filter.distanceMin === undefined && filter.distanceMax === undefined && filter.magnitudeLimit === undefined);
  }
  sync();
  return { sync, destroy: () => root.remove() };
}
