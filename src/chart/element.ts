// <hoshi-chart>: the sky chart as a web component. It draws what its attributes say as SVG, carries the family's hands (drag, two-finger pinch, wheel, keys) and reads its layers' data only when they are asked for.
// The hands are kazoku-ui's `carryControls`, read only when they are on (`controls="none"` never reads them).
import type { carryControls } from "@johnmorrisdotca/kazoku-ui/view-controls";
import { DEFAULT_VIEW, ZOOM_MAX, ZOOM_MIN, constellationUnder, defaultZoom, zoomedAbout, type Box, type Hit, type View } from "./draw.ts";
import { has, layerSet, loadChartData, needs } from "./data.ts";
import { attachHands, type Hands } from "./hands.ts";
import { DEFAULT_LAYERS, DEFAULT_MAGNITUDE, MAGNITUDE_MAX, MAGNITUDE_MIN, drawSvg, type ChartSvgOptions } from "./svg.ts";
import { PROJECTIONS, type Projection } from "../projection.ts";

/**
 * What a `hoshi-viewchange` event carries: where the chart looks now, whether the hand has settled (a release, a key, a wheel step, a button) and what moved it.
 *
 * @example
 * ```ts no-run
 * import type { ViewChangeDetail } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * document.querySelector("hoshi-chart")!.addEventListener("hoshi-viewchange", (event) => {
 *   const { view, final } = (event as CustomEvent<ViewChangeDetail>).detail;
 *   if (final) console.log(view.ra, view.dec, view.zoom);
 * });
 * ```
 */
export interface ViewChangeDetail {
  view: View;
  final: boolean;
  reason: "hands" | "resize" | "reset" | "zoom";
}

/**
 * What a `hoshi-pick` event carries: the star (`S:<HR number>`), Messier object (`D:M31`) or constellation (`C:Ori`) under a tap, or `null` for the empty sky off the map, and where the tap was in chart pixels.
 *
 * @example
 * ```ts no-run
 * import type { PickDetail } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * document.querySelector("hoshi-chart")!.addEventListener("hoshi-pick", (event) => {
 *   console.log((event as CustomEvent<PickDetail>).detail.key);
 * });
 * ```
 */
export interface PickDetail {
  key: string | null;
  x: number;
  y: number;
}

const ATTRIBUTES = ["projection", "ra", "dec", "zoom", "magnitude", "layers", "constellation", "lang", "theme", "near", "by", "controls", "hover"] as const;
const READ_AT = 22;

const finite = (text: string | null): number | undefined => {
  if (text === null || text.trim() === "") return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
};
const wrap360 = (degrees: number): number => ((degrees % 360) + 360) % 360;

const STYLE = `
:host { display: block; position: relative; overflow: hidden; aspect-ratio: 4 / 3; min-height: 120px; background: #0b1020; cursor: grab; user-select: none; -webkit-user-select: none; }
:host([theme="light"]) { background: #f8f6ef; }
:host(:active) { cursor: grabbing; }
:host(:focus-visible) { outline: 3px solid #ffd86b; outline-offset: -3px; }
:host([hidden]) { display: none; }
svg { display: block; width: 100%; height: 100%; }
`;

// A page that renders on a server loads this module without a DOM: the class then has nothing to extend, and `chartSvg` still works.
const Base = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

/**
 * The `<hoshi-chart>` custom element: a chart of the sky. Importing `@johnmorrisdotca/hoshi-stars/chart` defines it.
 *
 * Attributes: `projection` (`stereographic`, `orthographic`, `gnomonic`, `equidistant`, `equirectangular`, `mollweide` or `hammer`), `ra` and `dec` (the middle, degrees), `zoom` (0.1 to 500; left out, the opening view),
 * `magnitude` (the faintest star, 2 to 6), `layers` (a comma list of `milky-way`, `lines`, `names`, `boundaries`, `deep-sky`, `grid`, or `none`), `constellation` (one drawn brighter, `Ori`), `lang` (`en` or `ja`; left out, the page's),
 * `theme` (`dark` or `light`), `near` (a star `S:2491`, a Messier object `D:M31` or a constellation `C:Ori`: what is near it is ringed) and `by` (`sky` or `space`: how nearness of a star is measured),
 * `controls` (`none` takes the drag, the pinch, the wheel and the keys off) and `hover` (tell which constellation the mouse is over). Its size is its box: give it a width and a height, or it is three to four.
 * Children are laid over the chart, for buttons of your own. Events: `hoshi-viewchange`, `hoshi-pick`, `hoshi-hover`, `hoshi-resize` and `hoshi-draw`.
 *
 * @example
 * ```ts no-run
 * import { HoshiChart } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const chart = document.createElement("hoshi-chart") as HoshiChart;
 * chart.setAttribute("projection", "mollweide");
 * chart.setAttribute("layers", "milky-way,lines,names");
 * document.body.append(chart);
 * ```
 */
export class HoshiChart extends Base {
  static observedAttributes = ATTRIBUTES;

  #root: ShadowRoot | undefined;
  #view: View = { ...DEFAULT_VIEW };
  #size = { width: 0, height: 0 };
  #hands: Hands | undefined;
  #handsLoading = false;
  #connected = false;
  #queued = false;
  #hits: Hit[] = [];
  #ro: ResizeObserver | undefined;
  #keepClear: readonly Box[] | (() => readonly Box[]) = [];
  #hover: string | null | undefined;
  #touches = new Map<number, { x: number; y: number }>();
  #moved = 0;
  #ownLabel: boolean | undefined;
  #follows = true;
  #drawn = false;

  /** Where the chart looks now: the projection, the middle (degrees) and the zoom. Set it to move the chart without an event. */
  get view(): View {
    return { ...this.#view };
  }
  set view(next: View) {
    this.#follows = false;
    this.#view = { projection: next.projection, ra: wrap360(next.ra), dec: Math.max(-90, Math.min(90, next.dec)), zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next.zoom)) };
    this.#hands?.sync();
    this.#schedule();
  }

  /** The chart's size in pixels, as drawn. */
  get size(): { width: number; height: number } {
    return { ...this.#size };
  }

  /** What a tap can land on in the chart last drawn, in chart pixels. */
  get hits(): readonly Hit[] {
    return this.#hits;
  }

  /** The zoom the chart opens at here: Orion about 90 degrees wide on a desk, 60 on a phone. */
  get opening(): number {
    return defaultZoom(this.#view.projection, this.#size.width || 800, this.#size.height || 600);
  }

  /** Rectangles in chart pixels that no name may cover, or a function that gives them at each draw (buttons laid over the chart). */
  set keepClear(boxes: readonly Box[] | (() => readonly Box[])) {
    this.#keepClear = boxes;
    this.#schedule();
  }

  /** Zoom in (`factor` above 1) or out about the middle, the way the buttons of a page would. */
  zoomBy(factor: number): void {
    if (this.#hands !== undefined) {
      this.#hands.zoomBy(factor);
      return;
    }
    const { width, height } = this.#size;
    this.#move(zoomedAbout(this.#view, width, height, factor, width / 2, height / 2), true, "zoom");
  }

  /** Back to the view the attributes give (or Orion at the opening zoom where they give none). */
  reset(): void {
    this.#move(this.#home(), true, "reset");
    this.#hands?.sync();
  }

  /** Draw again now with what is read; the element does this itself when an attribute or the size changes. */
  redraw(): void {
    this.#draw();
  }

  attributeChangedCallback(name: string): void {
    if (!this.#connected) return;
    if (name === "projection" || name === "ra" || name === "dec" || name === "zoom") {
      this.#follows = true;
      this.#view = this.#fromAttributes();
      this.#hands?.sync();
    } else if (name === "controls") {
      if (this.getAttribute("controls") !== "none") void this.#startHands();
    } else if (name === "lang") this.#label();
    this.#schedule();
  }

  connectedCallback(): void {
    this.#connected = true;
    if (this.#root === undefined) {
      this.#root = this.attachShadow({ mode: "open" });
      this.#root.innerHTML = `<style>${STYLE}</style><svg></svg><slot></slot>`;
      this.addEventListener("pointerdown", this.#down);
      this.addEventListener("pointermove", this.#movePointer);
      this.addEventListener("pointerup", this.#up);
      this.addEventListener("pointercancel", this.#up);
      this.addEventListener("pointerleave", this.#leave);
    }
    this.#measure();
    this.#view = this.#fromAttributes();
    this.#label();
    if (this.getAttribute("controls") !== "none" && !this.hasAttribute("tabindex")) this.tabIndex = 0;
    this.#ro = new ResizeObserver(() => {
      const before = this.#size;
      this.#measure();
      if (before.width === this.#size.width && before.height === this.#size.height) return;
      if (this.#follows && finite(this.getAttribute("zoom")) === undefined) {
        const next = { ...this.#view, zoom: this.opening };
        if (this.#drawn) this.#move(next, true, "resize");
        else this.#view = next;
      }
      this.#hands?.sync();
      this.#schedule();
      this.dispatchEvent(new CustomEvent("hoshi-resize", { detail: { ...this.#size } }));
    });
    this.#ro.observe(this);
    if (this.getAttribute("controls") !== "none") void this.#startHands();
    this.#schedule();
  }

  disconnectedCallback(): void {
    this.#connected = false;
    this.#ro?.disconnect();
    this.#hands?.unbind();
    this.#hands = undefined;
  }

  #measure(): void {
    this.#size = { width: Math.max(1, Math.round(this.clientWidth)), height: Math.max(1, Math.round(this.clientHeight)) };
    if (this.clientWidth === 0 || this.clientHeight === 0) this.#size = { width: 0, height: 0 };
  }

  #lang(): "en" | "ja" {
    const asked = this.getAttribute("lang") ?? this.closest("[lang]")?.getAttribute("lang") ?? "";
    return asked.toLowerCase().startsWith("ja") ? "ja" : "en";
  }

  #label(): void {
    this.#ownLabel ??= !this.hasAttribute("aria-label");
    if (this.#ownLabel) this.setAttribute("aria-label", this.#lang() === "ja" ? "星空の図" : "A chart of the sky");
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
  }

  #fromAttributes(): View {
    const kind = this.getAttribute("projection") ?? "";
    const projection: Projection = (PROJECTIONS as readonly string[]).includes(kind) ? (kind as Projection) : DEFAULT_VIEW.projection;
    const width = this.#size.width || 800;
    const height = this.#size.height || 600;
    const zoom = finite(this.getAttribute("zoom"));
    return {
      projection,
      ra: wrap360(finite(this.getAttribute("ra")) ?? DEFAULT_VIEW.ra),
      dec: Math.max(-90, Math.min(90, finite(this.getAttribute("dec")) ?? DEFAULT_VIEW.dec)),
      zoom: zoom === undefined ? defaultZoom(projection, width, height) : Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)),
    };
  }

  #home(): View {
    const asked = this.#fromAttributes();
    return { ...asked, projection: this.#view.projection };
  }

  #move(next: View, final: boolean, reason: ViewChangeDetail["reason"]): void {
    if (reason !== "resize") this.#follows = false;
    this.#view = next;
    this.#schedule();
    this.dispatchEvent(new CustomEvent<ViewChangeDetail>("hoshi-viewchange", { detail: { view: { ...next }, final, reason } }));
  }

  async #startHands(): Promise<void> {
    if (this.#hands !== undefined || this.#handsLoading) return;
    this.#handsLoading = true;
    try {
      const kit = (await import("@johnmorrisdotca/kazoku-ui/view-controls")) as { carryControls: typeof carryControls };
      if (!this.#connected || this.getAttribute("controls") === "none" || this.#hands !== undefined) return;
      this.#hands = attachHands(kit, this, {
        view: () => this.#view,
        size: () => ({ width: this.#size.width || 800, height: this.#size.height || 600 }),
        opening: () => this.opening,
        home: () => this.#home(),
        moved: (next, final) => this.#move(next, final, "hands"),
      });
    } finally {
      this.#handsLoading = false;
    }
  }

  #options(): ChartSvgOptions {
    const layers = this.getAttribute("layers");
    const magnitude = finite(this.getAttribute("magnitude"));
    const by = this.getAttribute("by");
    const theme = this.getAttribute("theme");
    const keepClear = typeof this.#keepClear === "function" ? this.#keepClear() : this.#keepClear;
    return {
      width: this.#size.width,
      height: this.#size.height,
      ...this.#view,
      magnitude: magnitude === undefined ? DEFAULT_MAGNITUDE : Math.max(MAGNITUDE_MIN, Math.min(MAGNITUDE_MAX, magnitude)),
      layers: layers === null ? DEFAULT_LAYERS : layers === "none" ? [] : layerSet(layers.split(",").map((name) => name.trim())),
      constellation: this.getAttribute("constellation") ?? undefined,
      lang: this.#lang(),
      theme: theme === "light" ? "light" : "dark",
      near: this.getAttribute("near") ?? undefined,
      by: by === "space" ? "space" : "sky",
      keepClear,
    };
  }

  #schedule(): void {
    if (this.#queued || !this.#connected) return;
    this.#queued = true;
    requestAnimationFrame(() => {
      this.#queued = false;
      this.#draw();
    });
  }

  #draw(): void {
    if (!this.#connected || this.#root === undefined || this.#size.width === 0) return;
    const options = this.#options();
    const wanted = needs({ layers: options.layers, constellation: options.constellation, near: options.near });
    if (!wanted.every(has)) {
      loadChartData({ layers: options.layers, constellation: options.constellation, near: options.near }).then(
        () => this.#schedule(),
        (error: unknown) => this.dispatchEvent(new ErrorEvent("error", { error, message: error instanceof Error ? error.message : String(error) })),
      );
      return;
    }
    const drawn = drawSvg(options, false);
    this.#root.querySelector("svg")!.outerHTML = drawn.svg;
    this.#hits = drawn.hits;
    this.#drawn = true;
    this.setAttribute("data-state", "drawn");
    this.dispatchEvent(new CustomEvent("hoshi-draw", { detail: { hits: drawn.hits } }));
  }

  #at(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const box = this.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  #down = (event: PointerEvent): void => {
    if ((event.pointerType === "mouse" && event.button !== 0) || (event.target as Element).closest("button") !== null) return;
    this.#touches.set(event.pointerId, this.#at(event));
    this.#moved = this.#touches.size > 1 ? 99 : 0;
  };

  #movePointer = (event: PointerEvent): void => {
    const here = this.#at(event);
    const before = this.#touches.get(event.pointerId);
    if (before === undefined) {
      if (event.pointerType === "mouse" && this.hasAttribute("hover")) void this.#hovering(here);
      return;
    }
    this.#moved += Math.abs(here.x - before.x) + Math.abs(here.y - before.y);
    this.#touches.set(event.pointerId, here);
  };

  #up = (event: PointerEvent): void => {
    const was = this.#touches.get(event.pointerId);
    this.#touches.delete(event.pointerId);
    if (was !== undefined && this.#touches.size === 0 && this.#moved <= 6 && event.type === "pointerup") void this.#tap(was.x, was.y);
  };

  #leave = (): void => {
    if (this.#hover !== undefined && this.#hover !== null) {
      this.#hover = null;
      this.dispatchEvent(new CustomEvent("hoshi-hover", { detail: { abbreviation: null } }));
    }
  };

  async #hovering(at: { x: number; y: number }): Promise<void> {
    if (!has("boundaries")) await loadChartData({ constellation: "?" });
    const found = constellationUnder(this.#view, this.#size.width, this.#size.height, at.x, at.y);
    const next = found?.abbreviation ?? null;
    if (next === this.#hover) return;
    this.#hover = next;
    this.dispatchEvent(new CustomEvent("hoshi-hover", { detail: { abbreviation: next } }));
  }

  async #tap(x: number, y: number): Promise<void> {
    let best: Hit | undefined;
    let nearest = READ_AT * READ_AT;
    for (const hit of this.#hits) {
      const d = (hit.x - x) ** 2 + (hit.y - y) ** 2;
      if (d < nearest) {
        nearest = d;
        best = hit;
      }
    }
    let key: string | null = best === undefined ? null : best.kind === "star" ? `S:${best.key}` : `D:${best.key}`;
    if (best === undefined) {
      if (!has("boundaries")) await loadChartData({ constellation: "?" });
      const found = constellationUnder(this.#view, this.#size.width, this.#size.height, x, y);
      key = found === undefined ? null : `C:${found.abbreviation}`;
    }
    this.dispatchEvent(new CustomEvent<PickDetail>("hoshi-pick", { detail: { key, x, y } }));
  }
}

if (typeof customElements !== "undefined" && !customElements.get("hoshi-chart")) customElements.define("hoshi-chart", HoshiChart);
