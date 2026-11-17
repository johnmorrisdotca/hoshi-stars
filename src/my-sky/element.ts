// <hoshi-my-sky>: the sky as someone standing outside sees it, at a place and a time, as an element a page drops in. A horizon with N, E, S and W, a drag to turn round and look up and down, the stars and the constellations where they stand for
// that place and moment, the Moon with its real phase, rise and set, and the planets that are up; the ground below the horizon is dark. The maths is in the other files of this folder (pure, tested); this file reads the attributes, keeps the clock,
// binds the family's hands (@johnmorrisdotca/kazoku-ui, this package's one dependency) and draws when something changes. At rest it draws nothing and asks for nothing but a tick every ten seconds while the tab is showing.
import { createFigureLines, createStarNames, lineStrengthFromAttribute, type FigureLines, type StarNames } from "../sky-labels.ts";
import { drawMoonDisc } from "./bodies-draw.ts";
import { drawScene, placeStars, type DrawnBody, type PlacedStars, type Scene } from "./draw.ts";
import { localFrame, type LocalFrame } from "./frame.ts";
import { attachSkyHands, type SkyHands, type SkyView } from "./hands.ts";
import { cleanMarks, sameMarks, type SkyMark } from "./marks.ts";
import { pickBody } from "./reach.ts";
import { skyReport, type SkyReport } from "./report.ts";
import { resolveStarId, resolveTarget, type ResolvedTarget } from "./target-stars.ts";
import { glideView, riseAndSet, targetInSky, viewOfGroup, viewOfObject, type RiseAndSet, type SkyTarget, type TargetInSky } from "./target.ts";
import { clampView, openingHeading, type SkyCamera } from "./view.ts";
import { compassPoint, mySkyWords, say, type MySkyLanguage } from "./words.ts";

/**
 * The tag, defined by `@johnmorrisdotca/hoshi-stars/my-sky/define`.
 *
 * @example
 * ```js no-run
 * import { MY_SKY_TAG } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * const sky = document.createElement(MY_SKY_TAG);
 * sky.setAttribute("latitude", "49.28");
 * sky.setAttribute("longitude", "-123.12");
 * document.body.append(sky);
 * ```
 */
export const MY_SKY_TAG = "hoshi-my-sky";

/**
 * What `hoshi-sky-view` says: which way the sky faces now, and `final` once the hand has settled.
 *
 * @example
 * ```ts no-run
 * import type { MySkyViewDetail } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * document.querySelector("hoshi-my-sky")!.addEventListener("hoshi-sky-view", (event) => {
 *   const { heading, pitch, fov, final } = (event as CustomEvent<MySkyViewDetail>).detail;
 *   if (final) console.log(`facing ${Math.round(heading)}, looking ${Math.round(pitch)} up, ${Math.round(fov)} across`);
 * });
 * ```
 */
export interface MySkyViewDetail extends SkyView {
  final: boolean;
}

/**
 * What `hoshi-sky-pick` says: a tap landed on the Sun (`kind` `sun`), the Moon (`moon`), a planet (`planet`, `id` its name in lower case), a constellation (`figure`, `id` its three-letter abbreviation) or nothing (`none`).
 *
 * @example
 * ```ts no-run
 * import type { MySkyPick } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * document.querySelector("hoshi-my-sky")!.addEventListener("hoshi-sky-pick", (event) => {
 *   const { kind, id } = (event as CustomEvent<MySkyPick>).detail;
 *   console.log(kind, id);
 * });
 * ```
 */
export interface MySkyPick {
  kind: "sun" | "moon" | "planet" | "figure" | "none";
  id: string | null;
}

/**
 * What `hoshi-sky-target` says once the view has turned to the target (`reached` true), or was turned away by the reader or the page before it got there (`reached` false): the target as it was set, its name in the language shown, where it stands and whether it is up.
 *
 * @example
 * ```ts no-run
 * import type { MySkyTargetDetail } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * document.querySelector("hoshi-my-sky")!.addEventListener("hoshi-sky-target", (event) => {
 *   const { label, up, reached } = (event as CustomEvent<MySkyTargetDetail>).detail;
 *   if (reached) console.log(up ? `${label} is up` : `${label} is below the horizon`);
 * });
 * ```
 */
export interface MySkyTargetDetail {
  /** The target as it was set: the text, or the point. */
  target: SkyTarget;
  /** What it is: `star`, `constellation`, `planet`, `moon`, `sun` or `point`. */
  kind: ResolvedTarget["kind"];
  /** Its name in the language shown. */
  label: string;
  /** Whether the view got to it. */
  reached: boolean;
  /** Where it stands now, and whether it is up. */
  altitude: number;
  azimuth: number;
  up: boolean;
}

/**
 * What `hoshi-sky-mark` says when a mark of the page's is pressed (with a tap, or Enter or Space on its button for a keyboard): the mark's own numbers.
 *
 * @example
 * ```ts no-run
 * import type { MySkyMarkDetail } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * document.querySelector("hoshi-my-sky")!.addEventListener("hoshi-sky-mark", (event) => {
 *   console.log((event as CustomEvent<MySkyMarkDetail>).detail.id);
 * });
 * ```
 */
export interface MySkyMarkDetail {
  id: string;
  label: string;
  kind: string | undefined;
  azimuth: number;
  altitude: number;
}

/**
 * The target in `sky`: where it stands over the place, whether it is up (`up`), its next `rise` and `set` and whether it is `always` or `never` up there, with what it is and its name in each language.
 *
 * @example
 * ```ts no-run
 * import type { MySkyTargetReport } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * const say = (t: MySkyTargetReport): string => `${t.label.en} is ${t.up ? "up" : "down"}`;
 * console.log(typeof say);
 * ```
 */
export interface MySkyTargetReport extends TargetInSky {
  kind: ResolvedTarget["kind"];
  label: { en: string; ja: string };
}

/**
 * What the element's `sky` property gives: the Sun, the Moon and the planets (`SkyReport`) and the target, or `null` while there is none (or it names nothing).
 *
 * @example
 * ```ts no-run
 * import type { MySkyReport } from "@johnmorrisdotca/hoshi-stars/my-sky/element";
 *
 * const up = (report: MySkyReport): boolean => report.target?.up === true;
 * console.log(typeof up);
 * ```
 */
export interface MySkyReport extends SkyReport {
  target: MySkyTargetReport | null;
}

/** The field of view the sky opens at, in degrees across the smaller side. */
const OPENING_FOV = 90;
/** The pitch it opens at: 35 degrees up, so the horizon is in view and most of the picture is sky. */
const OPENING_PITCH = 35;
/** How often a live sky redraws for the turn of the Earth: the sky moves a quarter of a degree a minute. */
const TICK_MS = 10_000;
const TICK_REDUCED_MS = 60_000;
const FONT = '"Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';

const STYLE = `:host{display:block;position:relative;aspect-ratio:4/5;min-height:320px;background:#05081a;color:#e6ecff;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;outline:none;font:13px/1.35 ${FONT}}
:host(:focus-visible){box-shadow:inset 0 0 0 3px var(--hoshi-focus,#8fb3ff)}
canvas.sky{position:absolute;inset:0;width:100%;height:100%;display:block}
.panel{position:absolute;top:8px;left:8px;max-width:min(19em,calc(100% - 16px));box-sizing:border-box;padding:8px 10px;background:rgba(8,12,28,.84);border:1px solid rgba(160,185,245,.28);border-radius:10px;touch-action:manipulation;cursor:default}
.head{display:flex;align-items:center;gap:10px}
.icon{width:36px;height:36px;flex:none;display:block}
.title{font-weight:600;font-size:14px}
.rows{margin:6px 0 0;padding:0;list-style:none;color:#cbd6f5}
.rows li{margin:2px 0}
.rows .dim{color:#9fb0dc}
.note{margin:6px 0 0;color:#ffd9a0}
.toggle{margin-left:auto;flex:none;min-width:32px;min-height:32px;padding:0;border:1px solid rgba(160,185,245,.35);border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.toggle:focus-visible{outline:2px solid var(--hoshi-focus,#8fb3ff)}
.panel[data-collapsed] .rows,.panel[data-collapsed] .note{display:none}
.panel[data-collapsed] .title{display:none}
.facing{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);max-width:calc(100% - 16px);box-sizing:border-box;padding:4px 12px;border-radius:999px;background:rgba(8,12,28,.62);color:#dfe7ff;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.message{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:#cbd6f5}
.target{position:absolute;left:50%;bottom:40px;transform:translateX(-50%);width:max-content;max-width:calc(100% - 16px);box-sizing:border-box;padding:6px 12px;border-radius:10px;background:rgba(8,12,28,.84);border:1px solid rgba(255,226,140,.45);color:#ffe9a8;text-align:center;pointer-events:none}
.target p{margin:1px 0}
.target .more{color:#cbd6f5}
.marklist{position:absolute;width:1px;height:1px;margin:0;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;list-style:none}
[hidden]{display:none!important}`;
/** How long a glide to a target takes: at least this, and up to the same again for a long way round. */
const GLIDE_MS = 450;

const number = (text: string | null, fallback: number): number => {
  const n = Number(text);
  return text !== null && text.trim() !== "" && Number.isFinite(n) ? n : fallback;
};

// On a server (a framework's render, or Node) there is no HTMLElement: the class still loads, as a stand-in nothing defines, so importing it never throws there.
const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

/**
 * The sky from a place, as an element: `<hoshi-my-sky latitude="49.28" longitude="-123.12"></hoshi-my-sky>`. It fills its box and shows what someone standing there sees looking up now: the horizon with N, E, S and W, the stars and constellations,
 * the Moon with its phase, % lit, rise and set, the planets that are up, and the Sun by day. A drag (or the arrow keys) turns you round and tips your head up and down; a pinch, Ctrl and the wheel, + and - widen or narrow the view; Home goes back.
 *
 * Attributes: `latitude` and `longitude` (degrees, north and east positive: both are needed), `time` (an ISO text or milliseconds; left out, the sky is live and moves with the clock), `lang` (`en` or `ja`, else the nearest above it, watched),
 * `heading` (the compass direction to face to start, 0 north, 90 east; left out, toward the equator: south in the north and north in the south), `pitch` (degrees above the horizon, 35 by default), `fov` (degrees across the smaller side, 20 to 130, 90 by default),
 * `timezone` (an IANA name such as `America/Vancouver` for the rise and set times; the reader's own by default), `info="none"` (hide the panel of the Moon and the planets), `constellation-lines` (a strength 0 to 1, or `off`; the default is a quiet 0.32),
 * `star-names` (how many names, or `off`; the default fits the size) and `daylight="show"` (draw the stars even when the Sun is up, as a chart).
 *
 * Properties: `latitude`, `longitude`, `time` (a `Date` or `null` for live), `heading`, `pitch`, `fov`, the read-only `sky` (the Sun, the Moon and the planets as `SkyReport`) and `setView`. It sends `hoshi-sky-view` as the view turns and `hoshi-sky-pick` when a tap lands
 * on the Sun, the Moon, a planet or a constellation. Nothing moves by itself: a live sky redraws every ten seconds (a minute for a reader who prefers reduced motion) while the page is showing, and a fixed `time` never.
 *
 * @example
 * ```html
 * <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/my-sky/define.js"></script>
 * <hoshi-my-sky latitude="49.28" longitude="-123.12" timezone="America/Vancouver" style="height: 80vh"></hoshi-my-sky>
 * ```
 */
export class HoshiMySkyElement extends Base {
  static observedAttributes = ["latitude", "longitude", "time", "lang", "heading", "pitch", "fov", "timezone", "info", "constellation-lines", "star-names", "daylight", "target"];

  #canvas: HTMLCanvasElement | undefined;
  #ctx: CanvasRenderingContext2D | null = null;
  #panel: HTMLElement | undefined;
  #facing: HTMLElement | undefined;
  #message: HTMLElement | undefined;
  #icon: HTMLCanvasElement | undefined;
  #title: HTMLElement | undefined;
  #rows: HTMLElement | undefined;
  #note: HTMLElement | undefined;
  #card: HTMLElement | undefined;
  #markList: HTMLElement | undefined;
  #toggle: HTMLButtonElement | undefined;
  #size = { width: 0, height: 0 };
  #dpr = 1;
  #view: SkyView | undefined;
  #hands: SkyHands | undefined;
  #resize: ResizeObserver | undefined;
  #langWatch: MutationObserver | undefined;
  #langNow: MySkyLanguage | undefined;
  #timer: ReturnType<typeof setInterval> | undefined;
  #frame = 0;
  #draws = 0;
  #latitude: number | undefined;
  #longitude: number | undefined;
  #fixed: number | undefined;
  #frameOf: LocalFrame | undefined;
  #report: MySkyReport | undefined;
  #placed: PlacedStars | undefined;
  #lines: FigureLines | undefined;
  #names: StarNames | undefined;
  #drawn: DrawnBody[] = [];
  #picked: string | undefined;
  #pickText = "";
  #collapsed = false;
  /** Counts the times the sky's numbers were made, and what the panel last wrote, so a turn of the view does not rewrite the panel. */
  #version = 0;
  #panelKey = "";
  #touch: { x: number; y: number; moved: number; id: number } | undefined;
  #attributesRead = false;
  /** Whether the reader (or the page) has turned the view: until then a new place may pick the way it opens. */
  #turned = false;
  /** What the page asked the sky to turn to, as it set it, and what that came to (worked out, or `"unknown"` for an id that names nothing). */
  #target: SkyTarget | null = null;
  #resolved: ResolvedTarget | "unknown" | undefined;
  /** Changes with every new target, so an id that was looked up late for a target that has since been replaced is let go. */
  #targetToken = 0;
  /** A new target is waiting for its place (and the numbers for it) to turn the view to it. */
  #toGlide = false;
  #glide: { from: SkyView; to: SkyView; began: number; duration: number; frame: number } | undefined;
  /** The next rise and set of the target and when and for what they were worked out: a rise stays true until it has passed, so a tick does not work them out again. */
  #times: Pick<RiseAndSet, "rise" | "set" | "always" | "never"> | undefined;
  #timesKey = "";
  #timesAt = 0;
  #cardKey = "";
  #marks: SkyMark[] = [];
  #markKey = "";

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    if (this.#canvas === undefined) {
      root.innerHTML = `<style>${STYLE}</style><canvas class="sky" part="sky" role="img"></canvas><div class="panel" part="panel"><div class="head"><canvas class="icon" width="72" height="72" aria-hidden="true"></canvas><span class="title"></span><button class="toggle" type="button" aria-expanded="true"></button></div><ul class="rows"></ul><p class="note" hidden></p></div><div class="target" part="target" role="status" hidden></div><ul class="marklist"></ul><div class="facing" part="facing" role="status"></div><div class="message" hidden></div>`;
      this.#canvas = root.querySelector<HTMLCanvasElement>("canvas.sky")!;
      this.#ctx = this.#canvas.getContext("2d");
      this.#panel = root.querySelector<HTMLElement>(".panel")!;
      this.#icon = root.querySelector<HTMLCanvasElement>(".icon")!;
      this.#title = root.querySelector<HTMLElement>(".title")!;
      this.#rows = root.querySelector<HTMLElement>(".rows")!;
      this.#note = root.querySelector<HTMLElement>(".note")!;
      this.#card = root.querySelector<HTMLElement>(".target")!;
      this.#markList = root.querySelector<HTMLElement>(".marklist")!;
      this.#toggle = root.querySelector<HTMLButtonElement>(".toggle")!;
      this.#facing = root.querySelector<HTMLElement>(".facing")!;
      this.#message = root.querySelector<HTMLElement>(".message")!;
      // a press on the panel is the panel's, not a turn of the sky
      for (const type of ["pointerdown", "pointerup", "wheel"]) this.#panel.addEventListener(type, (event) => event.stopPropagation());
      this.#toggle.addEventListener("click", () => {
        this.#collapsed = !this.#collapsed;
        this.#showPanel();
        this.#schedule();
      });
    }
    this.#listMarks();
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    if (!this.#attributesRead) {
      this.#attributesRead = true;
      this.#readPlace();
      this.#readTime();
    }
    // properties set before the element was defined hide the accessors: take them back
    for (const name of ["latitude", "longitude", "time", "heading", "pitch", "fov", "target", "marks"] as const) {
      if (Object.hasOwn(this, name)) {
        const value = Reflect.get(this, name);
        Reflect.deleteProperty(this, name);
        Reflect.set(this, name, value);
      }
    }
    this.#resize = new ResizeObserver(() => this.#measure());
    this.#resize.observe(this);
    // a hand on the sky turns a glide to the target off: capture, so it is before the family's hands see the same press
    for (const type of ["pointerdown", "wheel", "keydown"]) this.addEventListener(type, this.#interrupt, true);
    this.addEventListener("pointerdown", this.#down);
    this.addEventListener("pointermove", this.#move);
    this.addEventListener("pointerup", this.#up);
    this.addEventListener("pointercancel", this.#cancel);
    this.#langWatch = new MutationObserver(() => {
      if (this.#lang() !== this.#langNow) this.#changed();
    });
    this.#langWatch.observe(this.ownerDocument.documentElement, { attributes: true, attributeFilter: ["lang"], subtree: true });
    this.ownerDocument.addEventListener("visibilitychange", this.#visible);
    this.#measure();
    if (this.#hands === undefined) this.#bindHands();
    this.#recompute();
    this.#startTicking();
  }

  disconnectedCallback(): void {
    this.#resize?.disconnect();
    this.#resize = undefined;
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    for (const type of ["pointerdown", "wheel", "keydown"]) this.removeEventListener(type, this.#interrupt, true);
    this.#cancelGlide();
    this.removeEventListener("pointerdown", this.#down);
    this.removeEventListener("pointermove", this.#move);
    this.removeEventListener("pointerup", this.#up);
    this.removeEventListener("pointercancel", this.#cancel);
    this.#langWatch?.disconnect();
    this.#langWatch = undefined;
    this.ownerDocument.removeEventListener("visibilitychange", this.#visible);
    this.#stopTicking();
    this.#hands?.destroy();
    this.#hands = undefined;
  }

  attributeChangedCallback(name: string, _old?: string | null, value?: string | null): void {
    if (name === "target") {
      // a point given as a property has no attribute: taking the attribute off for it is not a request to clear it
      if (!this.#settingObject) this.#setTarget(value === null || value === undefined || value.trim() === "" ? null : value);
      return;
    }
    if (name === "latitude" || name === "longitude") {
      this.#readPlace();
      // the way the sky opens depends on the hemisphere, which a page may give after the element is up
      if (!this.#turned && this.#view !== undefined) {
        this.#view = this.#opening();
        this.#hands?.sync();
      }
    }
    if (name === "time") {
      this.#readTime();
      this.#startTicking();
    }
    if (this.#canvas === undefined) return;
    if (name === "heading" || name === "pitch" || name === "fov") {
      this.#view = this.#opening();
      this.#hands?.sync();
      this.#schedule();
      return;
    }
    if (name === "info") this.#showPanel();
    if (name === "latitude" || name === "longitude" || name === "time") this.#recompute();
    else this.#changed();
  }

  /** Degrees north of the equator. Setting it sets the attribute. `undefined` until it is given. */
  get latitude(): number | undefined {
    return this.#latitude;
  }

  set latitude(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) this.removeAttribute("latitude");
    else this.setAttribute("latitude", String(value));
  }

  /** Degrees east of Greenwich (west is negative). Setting it sets the attribute. `undefined` until it is given. */
  get longitude(): number | undefined {
    return this.#longitude;
  }

  set longitude(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) this.removeAttribute("longitude");
    else this.setAttribute("longitude", String(value));
  }

  /** The fixed moment shown, or `null` while the sky is live (following the clock). Set a `Date`, milliseconds or an ISO text for a fixed sky and `null` to go live again. */
  get time(): Date | null {
    return this.#fixed === undefined ? null : new Date(this.#fixed);
  }

  set time(value: Date | number | string | null | undefined) {
    if (value === null || value === undefined) this.removeAttribute("time");
    else this.setAttribute("time", value instanceof Date ? value.toISOString() : String(value));
  }

  /** Which way the middle of the picture faces now, degrees from north through east. Setting it turns the view. */
  get heading(): number {
    return this.#view?.heading ?? this.#opening().heading;
  }

  set heading(value: number) {
    this.setView({ heading: value });
  }

  /** How far above the horizon the middle of the picture looks now, -25 to 90 degrees. Setting it tips the view. */
  get pitch(): number {
    return this.#view?.pitch ?? this.#opening().pitch;
  }

  set pitch(value: number) {
    this.setView({ pitch: value });
  }

  /** The angle across the smaller side of the picture, 20 to 130 degrees. Setting it zooms. */
  get fov(): number {
    return this.#view?.fov ?? this.#opening().fov;
  }

  set fov(value: number) {
    this.setView({ fov: value });
  }

  /**
   * What the sky is turned to: a star's id (`betelgeuse`, `alpha-orionis`, `hr-2061`), `planet:mars`, `moon`, `sun`, `constellation:Ori`, or a point `{ azimuth, altitude, label }` (a property only). Setting it glides the view to it (it jumps for a reader who prefers
   * reduced motion), rings it with its name (a constellation is framed whole and its lines lit) and sends `hoshi-sky-target`. A target below the horizon says so, with the direction and the next rise. `null` takes it away. Setting a target again glides to it again.
   */
  get target(): SkyTarget | null {
    return this.#target;
  }

  set target(value: SkyTarget | null | undefined) {
    if (typeof value === "string") {
      this.setAttribute("target", value);
    } else if (value === null || value === undefined) {
      if (this.hasAttribute("target")) this.removeAttribute("target");
      else this.#setTarget(null);
    } else {
      this.#settingObject = true;
      this.removeAttribute("target");
      this.#settingObject = false;
      this.#setTarget(value);
    }
  }

  /** The page's own points on the sky: `[{ id, azimuth, altitude, label, kind? }]`. They are drawn and named, a press sends `hoshi-sky-mark` with the `id`, and the sky is drawn again only when they differ from the last list. */
  get marks(): readonly SkyMark[] {
    return this.#marks;
  }

  set marks(value: readonly SkyMark[] | null | undefined) {
    const next = cleanMarks(value);
    if (sameMarks(next, this.#marks)) return;
    this.#marks = next;
    this.#listMarks();
    this.#schedule();
  }

  #settingObject = false;

  /** Turn the view: any of `heading`, `pitch` and `fov`, held to their ranges. Sends `hoshi-sky-view` as final. */
  setView(change: Partial<SkyView>): void {
    this.#cancelGlide();
    const next = clampView({ ...(this.#view ?? this.#opening()), ...change });
    this.#moved(next, true);
    this.#hands?.sync();
  }

  /** What is where in this sky now (the Sun, the Moon with its shape, rise and set, the planets), or `undefined` until a place is given. */
  get sky(): MySkyReport | undefined {
    return this.#report;
  }

  /** @internal How many times the sky has drawn, where the target's ring, the marks and the planets with their names were drawn, and whether a glide is going: for the tests that nothing is drawn at rest and that a ring is on its target. */
  get _stats(): { draws: number; ring: { x: number; y: number; r: number } | null; marks: Array<{ id: string; x: number; y: number }>; planets: Array<{ id: string; x: number; y: number; name: { x0: number; y0: number; x1: number; y1: number } | undefined }>; gliding: boolean } {
    const ring = this.#drawn.find((b) => b.kind === "target");
    return { draws: this.#draws, ring: ring === undefined ? null : { x: ring.x, y: ring.y, r: ring.r }, marks: this.#drawn.filter((b) => b.kind === "mark").map((b) => ({ id: b.id, x: b.x, y: b.y })), planets: this.#drawn.filter((b) => b.kind === "planet").map((b) => ({ id: b.id, x: b.x, y: b.y, name: b.name })), gliding: this.#glide !== undefined };
  }

  #lang(): MySkyLanguage {
    const lang = (this.closest("[lang]")?.getAttribute("lang") ?? "").toLowerCase();
    return lang.startsWith("ja") ? "ja" : "en";
  }

  #readPlace(): void {
    const lat = this.getAttribute("latitude");
    const lon = this.getAttribute("longitude");
    const latitude = number(lat, NaN);
    const longitude = number(lon, NaN);
    this.#latitude = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : undefined;
    this.#longitude = Number.isFinite(longitude) ? longitude : undefined;
  }

  #readTime(): void {
    const text = this.getAttribute("time");
    if (text === null || text.trim() === "" || text.trim().toLowerCase() === "now") {
      this.#fixed = undefined;
      return;
    }
    const ms = /^\s*-?\d+(\.\d+)?\s*$/.test(text) ? Number(text) : Date.parse(text);
    this.#fixed = Number.isFinite(ms) ? ms : undefined;
  }

  /** The moment shown: the fixed one, or now. */
  #when(): number {
    return this.#fixed ?? Date.now();
  }

  #opening(): SkyView {
    const heading = this.hasAttribute("heading") ? number(this.getAttribute("heading"), 180) : openingHeading(this.#latitude ?? 0);
    return clampView({ heading, pitch: number(this.getAttribute("pitch"), OPENING_PITCH), fov: number(this.getAttribute("fov"), OPENING_FOV) });
  }

  #camera(): SkyCamera {
    const view = this.#view ?? this.#opening();
    return { ...view, width: this.#size.width, height: this.#size.height };
  }

  #measure(): void {
    const box = this.getBoundingClientRect();
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    if (width === this.#size.width && height === this.#size.height && dpr === this.#dpr) return;
    this.#size = { width, height };
    this.#dpr = dpr;
    if (width === 0 || height === 0 || this.#canvas === undefined) return;
    this.#canvas.width = Math.round(width * dpr);
    this.#canvas.height = Math.round(height * dpr);
    this.#view ??= this.#opening();
    if (this.#hands === undefined) this.#bindHands();
    else this.#hands.sync();
    this.#names?.set({ ...this.#names.settings, count: this.#nameCount() });
    this.#schedule();
  }

  #bindHands(): void {
    this.#hands?.destroy();
    this.#hands = undefined;
    if (!this.isConnected || this.#view === undefined) return;
    this.#hands = attachSkyHands(this, {
      camera: () => this.#camera(),
      opening: () => OPENING_FOV,
      moved: (view, final) => this.#moved(view, final),
      home: () => this.#opening(),
    });
  }

  #moved(view: SkyView, final: boolean): void {
    this.#view = clampView(view);
    this.#turned = true;
    this.dispatchEvent(new CustomEvent<MySkyViewDetail>("hoshi-sky-view", { detail: { ...this.#view, final } }));
    this.#schedule();
  }

  /** The place or the time changed, or the sky has moved on a tick: make the numbers again, then draw. */
  #recompute(): void {
    if (this.#latitude === undefined || this.#longitude === undefined) {
      this.#frameOf = undefined;
      this.#report = undefined;
      this.#schedule();
      return;
    }
    const observer = { latitude: this.#latitude, longitude: this.#longitude };
    const now = this.#when();
    this.#frameOf = localFrame(observer, now);
    this.#report = { ...skyReport(observer, now), target: this.#locateTarget(observer, now) };
    this.#placed = placeStars(this.#frameOf);
    this.#version += 1;
    this.#schedule();
    if (this.#toGlide && this.#report.target !== null) {
      this.#toGlide = false;
      this.#startGlide();
    }
  }

  /** Where the target is now, and (worked out again only when it has to be) when it rises and sets. */
  #locateTarget(observer: { latitude: number; longitude: number }, now: number): MySkyTargetReport | null {
    const resolved = this.#resolved;
    if (resolved === undefined || resolved === "unknown") return null;
    const key = `${this.#targetToken}|${observer.latitude}|${observer.longitude}`;
    const times = this.#times;
    // a rise or a set is true until it has passed; six hours is as long as the Moon's or a planet's pass is trusted
    const stale = times === undefined || key !== this.#timesKey || now < this.#timesAt || now - this.#timesAt > 6 * 3_600_000 || (times.rise !== null && now > times.rise) || (times.set !== null && now > times.set);
    if (stale) {
      const found = riseAndSet(resolved.locator, observer, now);
      this.#times = { rise: found.rise, set: found.set, always: found.always, never: found.never };
      this.#timesKey = key;
      this.#timesAt = now;
    }
    return { ...targetInSky(resolved.locator, observer, now, this.#times), kind: resolved.kind, label: resolved.label };
  }

  /** The target is set (or taken away): work out what it is, then let the next recompute find it in the sky and turn the view to it. */
  #setTarget(value: SkyTarget | null): void {
    this.#cancelGlide();
    const token = ++this.#targetToken;
    this.#target = value;
    this.#resolved = undefined;
    this.#times = undefined;
    this.#toGlide = false;
    if (this.#report !== undefined) this.#report = { ...this.#report, target: null };
    if (value === null) {
      this.#schedule();
      return;
    }
    const first = resolveTarget(value);
    if (first === undefined) {
      this.#resolved = "unknown";
      this.#schedule();
      return;
    }
    const found = (resolved: ResolvedTarget | undefined): void => {
      if (token !== this.#targetToken) return;
      this.#resolved = resolved ?? "unknown";
      if (resolved === undefined) {
        this.#schedule();
        return;
      }
      this.#toGlide = true;
      this.#recompute();
    };
    if (first === "later") {
      // a star's id is looked up in the names index, which is not loaded until one is needed
      resolveStarId(String(value)).then(found, () => found(undefined));
    } else found(first);
  }

  /** Turn the view to the target: a thing centred, a constellation framed whole; the view glides there, or jumps when the reader prefers reduced motion, the page is hidden or the element has no size yet (a dialog not yet open). */
  #startGlide(): void {
    const target = this.#report?.target;
    const resolved = this.#resolved;
    if (target === null || target === undefined || resolved === undefined || resolved === "unknown" || this.#frameOf === undefined) return;
    const from = this.#view ?? this.#opening();
    let to: SkyView;
    if (resolved.figure === undefined) to = viewOfObject(target.altitude, target.azimuth, from.fov);
    else {
      const frame = this.#frameOf;
      const spot = { east: 0, north: 0, up: 0 };
      to = viewOfGroup(resolved.figure.stars.map((star) => ({ ...frame.fromJ2000(star.rightAscension, star.declination, spot) })));
    }
    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    if (reduced || this.ownerDocument.visibilityState !== "visible" || this.#size.width === 0 || this.#size.height === 0) {
      this.#land(to);
      return;
    }
    const turn = Math.abs(((((to.heading - from.heading) % 360) + 540) % 360) - 180) + Math.abs(to.pitch - from.pitch);
    this.#glide = { from, to, began: -1, duration: GLIDE_MS + Math.min(GLIDE_MS, turn * 4), frame: 0 };
    this.#glideStep(performance.now());
  }

  /** One frame of a glide: the view part of the way, drawn at once (one frame asked for at a time, and none once it has arrived). */
  #glideStep = (now: number): void => {
    const glide = this.#glide;
    if (glide === undefined) return;
    if (glide.began < 0) glide.began = now;
    const fraction = (now - glide.began) / glide.duration;
    if (fraction >= 1) {
      this.#glide = undefined;
      this.#land(glide.to);
      return;
    }
    this.#view = clampView(glideView(glide.from, glide.to, fraction));
    this.#turned = true;
    this.dispatchEvent(new CustomEvent<MySkyViewDetail>("hoshi-sky-view", { detail: { ...this.#view, final: false } }));
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#draw();
    glide.frame = requestAnimationFrame(this.#glideStep);
  };

  /** The view has arrived (or jumped): set it, tell the hands and the page, draw once. */
  #land(to: SkyView): void {
    this.#moved(to, true);
    this.#hands?.sync();
    this.#reached(true);
  }

  #reached(reached: boolean): void {
    const target = this.#report?.target;
    if (this.#target === null || target === null || target === undefined) return;
    const lang = this.#lang();
    this.dispatchEvent(new CustomEvent<MySkyTargetDetail>("hoshi-sky-target", { detail: { target: this.#target, kind: target.kind, label: target.label[lang], reached, altitude: target.altitude, azimuth: target.azimuth, up: target.up } }));
  }

  /** A glide stops where it is: for a hand on the sky, a view the page set, a new target or the element leaving the page. The page is told it did not get there. */
  #cancelGlide(): void {
    const glide = this.#glide;
    if (glide === undefined) return;
    cancelAnimationFrame(glide.frame);
    this.#glide = undefined;
    this.#moved(this.#view ?? glide.to, true);
    this.#hands?.sync();
    this.#reached(false);
  }

  #interrupt = (): void => {
    this.#cancelGlide();
  };

  #changed(): void {
    this.#schedule();
  }

  #startTicking(): void {
    this.#stopTicking();
    if (!this.isConnected || this.#fixed !== undefined) return;
    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    this.#timer = setInterval(() => {
      if (this.ownerDocument.visibilityState === "visible") this.#recompute();
    }, reduced ? TICK_REDUCED_MS : TICK_MS);
  }

  #stopTicking(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  #visible = (): void => {
    if (this.ownerDocument.visibilityState === "visible" && this.#fixed === undefined) this.#recompute();
  };

  #nameCount(): number {
    const text = this.getAttribute("star-names");
    if (text !== null) {
      if (/^(off|false|none)$/i.test(text.trim())) return 0;
      const n = Math.floor(number(text, NaN));
      if (Number.isFinite(n)) return Math.max(0, Math.min(60, n));
    }
    return Math.max(5, Math.min(22, Math.round((this.#size.width * this.#size.height) / 20_000)));
  }

  /** The strength lines may have, from `constellation-lines`: its value, `undefined` for off, the default when the attribute is missing. */
  #lineStrength(): number | undefined {
    const text = this.getAttribute("constellation-lines");
    return text === null ? 0.32 : lineStrengthFromAttribute(text);
  }

  #schedule(): void {
    if (this.#frame !== 0 || !this.isConnected) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#draw();
    });
  }

  #draw(): void {
    const canvas = this.#canvas;
    const ctx = this.#ctx;
    const { width, height } = this.#size;
    if (canvas === undefined || ctx === null || width === 0 || height === 0) return;
    const lang = this.#lang();
    this.#langNow = lang;
    const words = mySkyWords(lang);
    this.#message!.hidden = this.#report !== undefined;
    this.#message!.textContent = words.needsPlace;
    this.#panel!.hidden = this.#report === undefined || this.getAttribute("info") === "none";
    ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    if (this.#report === undefined || this.#frameOf === undefined || this.#placed === undefined) {
      ctx.fillStyle = "#05081a";
      ctx.fillRect(0, 0, width, height);
      this.#facing!.hidden = true;
      this.#draws += 1;
      return;
    }
    this.#showPanel();
    const strength = this.#lineStrength();
    this.#lines ??= createFigureLines({ strength: 0.32, reach: 18 });
    this.#names ??= createStarNames({ count: this.#nameCount(), style: { font: FONT, size: 11, case: "as-written", designation: "none", leader: 0, offset: 5, ring: 5, ringColour: "rgba(190, 205, 255, 0.45)", halo: "rgba(4, 7, 18, 0.85)" } });
    const scene: Scene = {
      camera: this.#camera(),
      lang,
      frame: this.#frameOf,
      report: this.#report,
      stars: this.#placed,
      lines: strength === undefined ? null : this.#lines,
      lineStrength: strength ?? 0,
      names: this.#names,
      daylight: this.getAttribute("daylight") === "show",
      picked: this.#picked,
      marks: this.#marks,
    };
    const aimed = this.#report.target;
    if (aimed !== null) {
      const resolved = this.#resolved;
      const name = aimed.label[lang];
      scene.target = { label: name, belowLabel: say(words.targetBelowTag, { name }), altitude: aimed.altitude, azimuth: aimed.azimuth, up: aimed.up, ...(resolved !== undefined && resolved !== "unknown" && resolved.figure !== undefined ? { lines: resolved.figure.lines } : {}) };
    }
    if (!this.#panel!.hidden) {
      const box = this.#panel!.getBoundingClientRect();
      const host = this.getBoundingClientRect();
      scene.keepClear = { x0: box.left - host.left - 6, y0: box.top - host.top - 6, x1: box.right - host.left + 6, y1: box.bottom - host.top + 6 };
    }
    this.#drawn = drawScene(ctx, scene);
    const view = this.#view ?? this.#opening();
    canvas.setAttribute("aria-label", say(words.label, { lat: this.#latitude!.toFixed(2), lon: this.#longitude!.toFixed(2) }));
    this.#facing!.hidden = false;
    this.#facing!.textContent = say(view.pitch > 1 ? words.facingUp : view.pitch < -1 ? words.facingDown : words.facingLevel, { direction: words.direction[compassPoint(view.heading)], n: Math.abs(Math.round(view.pitch)) });
    this.#showPanel();
    this.#markList!.setAttribute("aria-label", words.marksLabel);
    this.#showTarget(words);
    this.#draws += 1;
  }

  /** What the target says: where it is, or that it is below the horizon, which way and when it rises. Written again only when the numbers it is made from change. */
  #showTarget(words: Readonly<ReturnType<typeof mySkyWords>>): void {
    const card = this.#card;
    if (card === undefined) return;
    const lang = this.#lang();
    const resolved = this.#resolved;
    const aimed = this.#report?.target ?? null;
    const unknown = this.#target !== null && resolved === "unknown";
    const zone = this.getAttribute("timezone") ?? undefined;
    const now = this.#when();
    const shown = aimed === null ? "" : `${Math.round(aimed.altitude)}|${Math.round(aimed.azimuth)}|${aimed.up}|${aimed.rise}|${aimed.set}`;
    const key = [lang, unknown, typeof this.#target === "string" ? this.#target : "", this.#targetToken, shown, zone].join("|");
    if (key === this.#cardKey) return;
    this.#cardKey = key;
    const lines: Array<[string, boolean]> = [];
    if (unknown) lines.push([say(words.targetUnknown, { name: typeof this.#target === "string" ? this.#target : "" }), false]);
    else if (aimed !== null) {
      const name = aimed.label[lang];
      const direction = words.direction[compassPoint(aimed.azimuth)];
      lines.push([aimed.up ? say(words.targetUp, { name, altitude: Math.round(aimed.altitude), direction }) : say(words.targetDown, { name, depth: Math.max(1, Math.round(-aimed.altitude)), direction }), false]);
      const starlike = aimed.kind === "star" || aimed.kind === "constellation";
      if (aimed.never) lines.push([say(starlike ? words.targetNeverRises : words.targetNoRise, { name }), true]);
      else if (aimed.always && starlike) lines.push([say(words.targetAlwaysUp, { name }), true]);
      else if (!aimed.up && aimed.rise !== null) lines.push([say(words.targetRises, { time: this.#clock(aimed.rise, now, lang, zone, words.tomorrow) }), true]);
      else if (aimed.up && aimed.set !== null) lines.push([say(words.targetSets, { time: this.#clock(aimed.set, now, lang, zone, words.tomorrow) }), true]);
    }
    card.hidden = lines.length === 0;
    card.replaceChildren(...lines.map(([text, more]) => {
      const p = this.ownerDocument.createElement("p");
      p.textContent = text;
      if (more) p.className = "more";
      return p;
    }));
  }

  /** The page's marks as buttons a keyboard and a screen reader can reach, one for each id and name; written again only when those change (a mark that moves does not). */
  #listMarks(): void {
    const list = this.#markList;
    if (list === undefined) return;
    const words = mySkyWords(this.#lang());
    const key = this.#marks.map((m) => `${m.id}\u0000${m.label}`).join("\u0001");
    // the same marks in new places change nothing here: a mark's place is read out when it is asked for, not every time it moves
    if (key !== this.#markKey) {
      this.#markKey = key;
      list.setAttribute("aria-label", words.marksLabel);
      list.replaceChildren(...this.#marks.map((mark) => {
        const li = this.ownerDocument.createElement("li");
        const button = this.ownerDocument.createElement("button");
        button.type = "button";
        button.dataset.mark = mark.id;
        button.textContent = mark.label;
        button.addEventListener("click", () => this.#pressMark(mark.id));
        li.append(button);
        return li;
      }));
    }
  }

  #pressMark(id: string): void {
    const mark = this.#marks.find((m) => m.id === id);
    if (mark === undefined) return;
    this.dispatchEvent(new CustomEvent<MySkyMarkDetail>("hoshi-sky-mark", { detail: { id: mark.id, label: mark.label, kind: mark.kind, azimuth: mark.azimuth, altitude: mark.altitude } }));
  }

  /** The panel's words: the Moon's phase and rise and set, the planets that are up and a note for the day or for what was tapped. */
  #showPanel(): void {
    const report = this.#report;
    if (report === undefined || this.#panel === undefined) return;
    const lang = this.#lang();
    const key = [this.#version, lang, this.#pickText, this.#collapsed, this.getAttribute("info"), this.getAttribute("daylight"), this.getAttribute("timezone")].join("|");
    if (key === this.#panelKey) return;
    this.#panelKey = key;
    const words = mySkyWords(lang);
    this.#panel.hidden = this.getAttribute("info") === "none";
    if (this.#collapsed) this.#panel.setAttribute("data-collapsed", "");
    else this.#panel.removeAttribute("data-collapsed");
    this.#toggle!.textContent = this.#collapsed ? "+" : "−";
    this.#toggle!.setAttribute("aria-expanded", String(!this.#collapsed));
    this.#toggle!.setAttribute("aria-label", this.#collapsed ? words.showPanel : words.hidePanel);
    this.#toggle!.title = this.#collapsed ? words.showPanel : words.hidePanel;
    const moon = report.moon;
    this.#title!.textContent = words.phase[moon.phase.name];
    const icon = this.#icon!.getContext("2d")!;
    icon.clearRect(0, 0, 72, 72);
    drawMoonDisc(icon, 36, 36, 30, moon.phase.phaseAngle, moon.phase.waxing ? 0 : Math.PI);
    const zone = this.getAttribute("timezone") ?? undefined;
    const now = this.#when();
    const rows: Array<[string, boolean]> = [[say(words.lit, { n: Math.round(moon.phase.illuminated * 100) }), false]];
    rows.push([moon.rise === null ? words.noRise : say(words.rises, { time: this.#clock(moon.rise, now, lang, zone, words.tomorrow) }), false]);
    rows.push([moon.set === null ? words.noSet : say(words.sets, { time: this.#clock(moon.set, now, lang, zone, words.tomorrow) }), false]);
    const up = report.planets.filter((p) => p.up).map((p) => words.planet[p.id]);
    rows.push([up.length === 0 ? words.noPlanets : say(words.planetsUp, { list: up.join(words.separator) }), true]);
    this.#rows!.replaceChildren(...rows.map(([text, dim]) => {
      const li = this.ownerDocument.createElement("li");
      li.textContent = text;
      if (dim) li.className = "dim";
      return li;
    }));
    const day = report.sun.altitude > -0.833 && this.getAttribute("daylight") !== "show";
    const note = [day ? words.daytime : "", this.#pickText].filter((t) => t !== "").join(". ");
    this.#note!.textContent = note;
    this.#note!.hidden = note === "";
  }

  /** A time of day in a time zone; an event on another day than the moment shown is said to be tomorrow. */
  #clock(ms: number, now: number, lang: MySkyLanguage, zone: string | undefined, tomorrow: string): string {
    const options = (extra: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
        return { ...extra, timeZone: zone };
      } catch {
        return extra;
      }
    };
    const time = new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-CA", options({ hour: "numeric", minute: "2-digit" })).format(ms);
    const dayOf = new Intl.DateTimeFormat("en-CA", options({ year: "numeric", month: "2-digit", day: "2-digit" }));
    return dayOf.format(ms) === dayOf.format(now) ? time : say(tomorrow, { time });
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

  /** A tap: the Moon, a planet or the Sun within a finger's reach, else the constellation under it, else nothing. */
  #tap(x: number, y: number): void {
    const best = pickBody(this.#drawn, x, y);
    let detail: MySkyPick;
    this.#pickText = "";
    if (best?.kind === "mark") {
      this.#pressMark(best.id);
      return;
    }
    if (best !== undefined && best.kind !== "target") {
      this.#picked = best.id;
      this.#lines?.point();
      detail = { kind: best.kind, id: best.id };
      this.#pickText = this.#describe(best);
    } else {
      this.#picked = undefined;
      this.#lines?.point(x, y);
      const figure = this.#lines?.picked;
      detail = figure === undefined ? { kind: "none", id: null } : { kind: "figure", id: figure.abbreviation };
    }
    this.dispatchEvent(new CustomEvent<MySkyPick>("hoshi-sky-pick", { detail }));
    this.#schedule();
  }

  /** What a tapped body says: its height and direction, and a planet's brightness. */
  #describe(body: DrawnBody): string {
    const report = this.#report;
    if (report === undefined) return "";
    const words = mySkyWords(this.#lang());
    let altitude = 0;
    let azimuth = 0;
    let name = "";
    let magnitude = "";
    if (body.kind === "sun") ({ altitude, azimuth } = report.sun);
    else if (body.kind === "moon") ({ altitude, azimuth } = report.moon);
    else {
      const planet = report.planets.find((p) => p.id === body.id);
      if (planet === undefined) return "";
      ({ altitude, azimuth } = planet);
      magnitude = say(words.pickedMagnitude, { n: planet.magnitude.toFixed(1) });
    }
    name = body.kind === "sun" ? words.sun : body.kind === "moon" ? words.moon : words.planet[body.id as keyof typeof words.planet];
    return say(words.picked, { name, altitude: Math.round(altitude), direction: words.direction[compassPoint(azimuth)], magnitude });
  }
}
