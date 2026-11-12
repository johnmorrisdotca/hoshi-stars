// <hoshi-chart>: the sky chart as an element a page drops in. The same drawing as `chartSvg` and the demo, with the family's hands (drag, pinch, the wheel, the keys, a double tap), a tap that
// picks a star, a deep-sky object, a black hole or a figure, and the culture loaded only when asked for. It draws only when something changes, so at rest it asks for nothing.
// The hands are the family's view controller, @johnmorrisdotca/kazoku-ui, this package's one dependency; only this entry and /chart/define load it.
import type { Culture } from "../culture.ts";
import type { Projection } from "../projection.ts";
import { western } from "../cultures/western.ts";
import { chart, constellationUnder, defaultZoom, figureById, figureUnder, type Hit, type View } from "./chart.ts";
import { attachHands, type Hands } from "./hands.ts";
import { CHART_BACKGROUND, CHART_LAYERS, chartInput, DEFAULT_CHART_LAYERS, DEFAULT_CHART_MAGNITUDE, type ChartLayer } from "./svg.ts";

/**
 * The tag, defined by `@johnmorrisdotca/hoshi-stars/chart/define`.
 *
 * @example
 * ```js no-run
 * import { CHART_TAG } from "@johnmorrisdotca/hoshi-stars/chart/element";
 *
 * const chart = document.createElement(CHART_TAG);
 * chart.setAttribute("constellation", "Cyg");
 * document.body.append(chart);
 * ```
 */
export const CHART_TAG = "hoshi-chart";

export type { View };
/** The zoom range when the page names none: 0.1 to 500, in the chart's own unit (1 is the projection's fit of the whole sky). `zoom-max` raises it as far as 8000, the deep-sky pictures' own range. */
const CHART_ZOOM_MIN = 0.1;
const CHART_ZOOM_MAX = 500;
const CHART_ZOOM_LIMIT = 8000;

const PROJECTIONS: readonly Projection[] = ["stereographic", "orthographic", "gnomonic", "equidistant", "equirectangular", "mollweide", "hammer"];
const CULTURES: Record<string, () => Promise<Culture>> = {
  western: async () => western,
  japanese: async () => (await import("../cultures/japanese.ts")).japanese,
  chinese: async () => (await import("../cultures/chinese.ts")).chinese,
};

/**
 * What `hoshi-pick` says: a star (`id` its HR number), a deep-sky object (`M42`), a black hole (`cygnus-x-1`), a figure (`id` the figure's, with `abbreviation` for a constellation), or nothing (`kind` `none`).
 *
 * @example
 * ```ts no-run
 * import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";
 *
 * document.querySelector("hoshi-chart")!.addEventListener("hoshi-pick", (event) => {
 *   const { kind, id, abbreviation } = (event as CustomEvent<ChartPick>).detail;
 *   console.log(kind, id, abbreviation ?? "");
 * });
 * ```
 */
export interface ChartPick {
  kind: "star" | "deep" | "hole" | "figure" | "none";
  id: string | null;
  abbreviation?: string | undefined;
}

/**
 * What `hoshi-view` says: where the chart looks now, and `final` once the hand has settled.
 *
 * @example
 * ```ts no-run
 * import type { ChartViewDetail } from "@johnmorrisdotca/hoshi-stars/chart/element";
 *
 * document.querySelector("hoshi-chart")!.addEventListener("hoshi-view", (event) => {
 *   const { ra, dec, zoom, final } = (event as CustomEvent<ChartViewDetail>).detail;
 *   if (final) history.replaceState(null, "", `?ra=${ra.toFixed(2)}&dec=${dec.toFixed(2)}&zoom=${zoom.toFixed(2)}`);
 * });
 * ```
 */
export interface ChartViewDetail {
  projection: Projection;
  ra: number;
  dec: number;
  zoom: number;
  final: boolean;
}

const STYLE = `:host{display:block;position:relative;aspect-ratio:16/10;min-height:160px;background:${CHART_BACKGROUND};border-radius:8px;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;outline:none}
:host(:focus-visible){box-shadow:0 0 0 3px var(--hoshi-focus,#8fb3ff)}:host([theme="light"]:focus-visible){box-shadow:0 0 0 3px var(--hoshi-focus,#1d4ed8)}
svg{position:absolute;inset:0;width:100%;height:100%;display:block}`;

const number = (text: string | null, fallback: number): number => {
  const n = Number(text);
  return text !== null && text.trim() !== "" && Number.isFinite(n) ? n : fallback;
};

// On a server (a framework's render, or Node) there is no HTMLElement: the class still loads, as a stand-in nothing defines, so importing the chart never throws there.
const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

/**
 * The sky chart as an element: `<hoshi-chart constellation="Ori"></hoshi-chart>`. It fills its box (16 by 10 unless the page sizes it) and draws the bright stars with the layers asked for.
 *
 * Attributes: `projection`, `ra`, `dec`, `zoom`, `zoom-min` and `zoom-max`, `magnitude`, `layers` (`milky lines names grid` by default; also `boundaries`, `deep`, `holes`), `constellation`, `culture`
 * (`western`, `japanese` or `chinese`), `picked`, `lang` (its own, else the nearest above it, watched), `theme` (`light` or `dark`, for the focus ring: the sky is night in both) and `controls="none"`
 * (no hands, a still picture). A drag moves the sky, two fingers or Ctrl and the wheel zoom, the arrows look round, + and - zoom. It sends `hoshi-view` as the view changes and `hoshi-pick` when a tap
 * lands on something (or on nothing); `picked` and `constellation` set after a tap win again.
 *
 * The zoom is the chart's own, not the family's "1 is Fit": 1 fits the projection's whole sky (or hemisphere) in the smaller side, and more is closer. Left out, `zoom` is the projection's opening
 * zoom for the element's size (about 90 degrees of sky across, 60 under 600 pixels wide: 3.86 for a 640 by 400 stereographic chart), which is where Home and 0 go. `zoom-min` and `zoom-max` bound it
 * in the same unit, 0.1 and 500 by default, `zoom-max` up to 8000.
 *
 * @example
 * ```html
 * <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/chart/define.js"></script>
 * <hoshi-chart constellation="Ori" layers="milky lines names boundaries"></hoshi-chart>
 * ```
 */
export class HoshiChartElement extends Base {
  static observedAttributes = ["projection", "ra", "dec", "zoom", "zoom-min", "zoom-max", "magnitude", "layers", "constellation", "culture", "picked", "lang", "controls"];

  #svg: SVGSVGElement | undefined;
  #hands: Hands | undefined;
  #view: View | undefined;
  #culture: Culture = western;
  #cultureAsked = "western";
  #hits: Hit[] = [];
  #size = { width: 0, height: 0 };
  #frame = 0;
  #draws = 0;
  #resize: ResizeObserver | undefined;
  #touch: { x: number; y: number; moved: number; id: number } | undefined;
  #picked: string | undefined;
  #highlight: string | undefined;
  #langWatch: MutationObserver | undefined;
  #langNow: "en" | "ja" | undefined;

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    if (this.#svg === undefined) {
      root.innerHTML = `<style>${STYLE}</style><svg xmlns="http://www.w3.org/2000/svg" part="chart" role="img"></svg>`;
      this.#svg = root.querySelector("svg")!;
    }
    if (!this.hasAttribute("tabindex") && this.getAttribute("controls") !== "none") this.tabIndex = 0;
    this.#resize = new ResizeObserver(() => this.#measure());
    this.#resize.observe(this);
    this.addEventListener("pointerdown", this.#down);
    this.addEventListener("pointermove", this.#move);
    this.addEventListener("pointerup", this.#up);
    this.addEventListener("pointercancel", this.#cancel);
    // a lang set or changed above the element (the page's <html lang>, a section's) is watched: the names follow it
    this.#langWatch = new MutationObserver(() => {
      if (this.#lang() !== this.#langNow) this.#schedule();
    });
    this.#langWatch.observe(this.ownerDocument.documentElement, { attributes: true, attributeFilter: ["lang"], subtree: true });
    void this.#loadCulture();
    this.#measure();
    // back on a page after being moved: the hands were let go on leaving, and the drawing may be behind
    if (this.#hands === undefined) this.#bindHands();
    this.#schedule();
  }

  disconnectedCallback(): void {
    this.#resize?.disconnect();
    this.#resize = undefined;
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.removeEventListener("pointerdown", this.#down);
    this.removeEventListener("pointermove", this.#move);
    this.removeEventListener("pointerup", this.#up);
    this.removeEventListener("pointercancel", this.#cancel);
    this.#langWatch?.disconnect();
    this.#langWatch = undefined;
    this.#hands?.destroy();
    this.#hands = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (this.#svg === undefined) return;
    if (name === "culture") {
      void this.#loadCulture();
      return;
    }
    if (name === "controls") return this.#bindHands();
    // the page's own choice wins again over what a tap picked
    if (name === "picked") this.#picked = undefined;
    if (name === "constellation") this.#highlight = undefined;
    if (name === "projection" || name === "ra" || name === "dec" || name === "zoom" || name === "zoom-min" || name === "zoom-max") {
      this.#view = this.#viewFromAttributes(name === "projection" && !this.hasAttribute("zoom"));
      this.#hands?.sync();
    }
    this.#schedule();
  }

  /** Where the chart looks now. */
  get view(): View | undefined {
    return this.#view === undefined ? undefined : { ...this.#view };
  }

  /** Move the chart: any of `ra`, `dec`, `zoom` and `projection` (the zoom kept inside `zoom-min` and `zoom-max`). Sends `hoshi-view` as final. */
  setView(change: Partial<View>): void {
    if (this.#view === undefined) return;
    this.#moved({ ...this.#view, ...change }, true);
    this.#hands?.sync();
  }

  /** @internal How many times the chart has drawn, for the tests that nothing is drawn at rest. */
  get _stats(): { draws: number } {
    return { draws: this.#draws };
  }

  #limits(): { min: number; max: number } {
    const min = Math.max(0.01, number(this.getAttribute("zoom-min"), CHART_ZOOM_MIN));
    const max = Math.min(CHART_ZOOM_LIMIT, Math.max(min, number(this.getAttribute("zoom-max"), CHART_ZOOM_MAX)));
    return { min, max };
  }

  #viewFromAttributes(openingZoom = false): View | undefined {
    const { width, height } = this.#size;
    if (width === 0 || height === 0) return undefined;
    const asked = this.getAttribute("projection") as Projection | null;
    const projection = asked !== null && PROJECTIONS.includes(asked) ? asked : "stereographic";
    const { min, max } = this.#limits();
    const zoom = openingZoom || !this.hasAttribute("zoom") ? defaultZoom(projection, width, height) : number(this.getAttribute("zoom"), defaultZoom(projection, width, height));
    return { projection, ra: ((number(this.getAttribute("ra"), 84) % 360) + 360) % 360, dec: Math.max(-90, Math.min(90, number(this.getAttribute("dec"), 0))), zoom: Math.max(min, Math.min(max, zoom)) };
  }

  #measure(): void {
    const box = this.getBoundingClientRect();
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (width === this.#size.width && height === this.#size.height) return;
    this.#size = { width, height };
    if (width === 0 || height === 0) return;
    this.#view ??= this.#viewFromAttributes();
    // the hands are bound once; a new size only tells them the new fit
    if (this.#hands === undefined) this.#bindHands();
    else this.#hands.sync();
    this.#schedule();
  }

  #bindHands(): void {
    this.#hands?.destroy();
    this.#hands = undefined;
    if (!this.isConnected || this.getAttribute("controls") === "none" || this.#view === undefined) return;
    this.#hands = attachHands(this, {
      view: () => this.#view!,
      size: () => this.#size,
      opening: () => defaultZoom(this.#view!.projection, this.#size.width, this.#size.height),
      moved: (view, final) => this.#moved(view, final),
      zoomCap: () => this.#limits().max,
      // Home and 0 go back to where the page opened the chart, not to the demo's Orion
      home: () => this.#viewFromAttributes() ?? this.#view!,
    });
  }

  #moved(view: View, final: boolean): void {
    const { min, max } = this.#limits();
    this.#view = { ...view, zoom: Math.max(min, Math.min(max, view.zoom)) };
    this.dispatchEvent(new CustomEvent<ChartViewDetail>("hoshi-view", { detail: { ...this.#view, final } }));
    this.#schedule();
  }

  async #loadCulture(): Promise<void> {
    const asked = (this.getAttribute("culture") ?? "western").trim().toLowerCase();
    const id = asked in CULTURES ? asked : "western";
    this.#cultureAsked = id;
    const culture = await CULTURES[id]!();
    if (this.#cultureAsked !== id) return;
    this.#culture = culture;
    this.#schedule();
  }

  #lang(): "en" | "ja" {
    const lang = (this.closest("[lang]")?.getAttribute("lang") ?? "").toLowerCase();
    return lang.startsWith("ja") ? "ja" : "en";
  }

  #layers(): ChartLayer[] {
    const text = this.getAttribute("layers");
    if (text === null) return [...DEFAULT_CHART_LAYERS];
    return text.split(/[\s,]+/).filter((word): word is ChartLayer => (CHART_LAYERS as readonly string[]).includes(word));
  }

  #schedule(): void {
    if (this.#frame !== 0 || !this.isConnected) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#draw();
    });
  }

  #draw(): void {
    const svg = this.#svg;
    const view = this.#view;
    const { width, height } = this.#size;
    if (svg === undefined || view === undefined || width === 0 || height === 0) return;
    const lang = this.#lang();
    this.#langNow = lang;
    const input = chartInput({ ...view, width, height, magnitude: number(this.getAttribute("magnitude"), DEFAULT_CHART_MAGNITUDE), layers: this.#layers(), lang, culture: this.#culture, constellation: this.#highlight ?? this.getAttribute("constellation") ?? undefined, picked: this.#picked ?? this.getAttribute("picked") ?? undefined });
    const out = chart(input);
    this.#hits = out.hits;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("aria-label", this.getAttribute("aria-label") ?? (lang === "ja" ? "星図" : "Star chart"));
    svg.innerHTML = out.svg;
    this.#draws += 1;
  }

  #local(event: PointerEvent): { x: number; y: number } {
    const box = this.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  #down = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    this.#touch = this.#touch === undefined ? { ...this.#local(event), moved: 0, id: event.pointerId } : { ...this.#touch, moved: 99 };
  };

  #move = (event: PointerEvent): void => {
    if (this.#touch === undefined || event.pointerId !== this.#touch.id) return;
    const here = this.#local(event);
    this.#touch.moved += Math.abs(here.x - this.#touch.x) + Math.abs(here.y - this.#touch.y);
    this.#touch.x = here.x;
    this.#touch.y = here.y;
  };

  #cancel = (): void => {
    this.#touch = undefined;
  };

  #up = (event: PointerEvent): void => {
    const touch = this.#touch;
    this.#touch = undefined;
    if (touch === undefined || event.pointerId !== touch.id || touch.moved > 6) return;
    this.#tap(touch.x, touch.y);
  };

  /** A tap: the nearest star, deep-sky object or black hole drawn within 22 pixels (anywhere in a large object's bright middle), else the figure under it, else nothing. */
  #tap(x: number, y: number): void {
    let best: Hit | undefined;
    let near = 22 * 22;
    for (const hit of this.#hits) {
      const away = Math.max(0, Math.hypot(hit.x - x, hit.y - y) - ((hit.reach ?? 22) - 22));
      if (away ** 2 < near) {
        near = away ** 2;
        best = hit;
      }
    }
    let detail: ChartPick;
    if (best !== undefined) {
      detail = { kind: best.kind, id: best.key };
      this.#picked = best.kind === "hole" ? undefined : best.key;
      this.#highlight = undefined;
    } else {
      const figure = this.#figureAt(x, y);
      detail = figure === undefined ? { kind: "none", id: null } : { kind: "figure", id: figure.id, ...(figure.abbreviation === undefined ? {} : { abbreviation: figure.abbreviation }) };
      this.#picked = undefined;
      this.#highlight = figure?.id;
    }
    this.dispatchEvent(new CustomEvent<ChartPick>("hoshi-pick", { detail }));
    this.#schedule();
  }

  #figureAt(x: number, y: number): { id: string; abbreviation?: string } | undefined {
    const view = this.#view;
    if (view === undefined) return undefined;
    const { width, height } = this.#size;
    const near = figureUnder(view, width, height, x, y, this.#culture);
    if (near !== undefined) return { id: near.asterism.id, ...(this.#culture.id === "chinese" ? {} : constellationOf(near.asterism.id)) };
    if (this.#culture.id === "chinese") return undefined;
    const found = constellationUnder(view, width, height, x, y);
    if (found === undefined) return undefined;
    const figure = figureById(found.abbreviation, this.#culture);
    return figure === undefined ? undefined : { id: figure.asterism.id, abbreviation: found.abbreviation };
  }
}

/** A Western or Japanese figure's id is its constellation's abbreviation when it is one of the 88 (`Ori`), and an asterism's own id otherwise. */
function constellationOf(id: string): { abbreviation?: string } {
  return /^[A-Z][a-z]{2}$/.test(id) ? { abbreviation: id } : {};
}
