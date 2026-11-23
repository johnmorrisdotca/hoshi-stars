// <hoshi-flight>: the flying view as an element a page drops in. The sky from where the camera is, on kazoku-ui's shared renderer; a flight to a place by its id (`goTo`), a turn to face one (`lookAt`), the speed
// dial, and names on the Sun and on the place the flight is going to. A flight turns to its place, leaves slowly, flies at the dial's speed and slows to stop beside it (`flyToward` with its ease), so a star goes from
// a point to a ball and back without a jump. The family's hands turn the camera (a drag looks around, Ctrl and the wheel or a pinch narrows the view). A reader who asks for reduced motion is put at the place at
// once: one draw, no flight. Where the camera is has one text (`status.at`, and the `at` attribute at each stop): the id of the place it rests at, else its point in parsecs. Nothing is drawn while it rests, is out
// of sight or the tab is hidden, and never more than 30 frames a second (the shared renderer's rules). three.js is loaded when the view first goes live: `import("three")`, or what the page hands `setThreeLoader`.
import { createSharedRenderer, type RendererStats, type SharedRenderer, type View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { createViewController, type ViewController } from "@johnmorrisdotca/kazoku-ui/view-controls";
import { FLIGHT_SPEEDS, LIGHT_SPEED, flightPointText, flightSpeedFor, flyToward, fromCamera, stepFlightSpeed, type FlightPoint } from "./flight.ts";
import { flightAddress, flightPlaceById, type FlightPlace } from "./flight-places.ts";
import { BALL_WITHIN, FAINTEST, flightItem, type FlightBody, type FlightFrame, type FlightMark, type FlightScene, type FlightThree } from "./flight-scene.ts";
import { nearbyStars } from "./nearby.ts";
import { portraitLook } from "./portrait.ts";
import { starProfile, type ProfileInput } from "./profile.ts";
import { skyFrom, type SeenSky } from "./sky-from.ts";
import { starLook, type StarLook } from "./star-body.ts";
import { starByHr, stars } from "./stars.ts";
import { filterOf, FILTER_BAR_STYLE, mountFilterBar, setFilterOf, type FilterBar } from "./star-filter-bar.ts";
import { STAR_FILTER_ATTRIBUTES, starFilterActive, starFilterKey, starPasses } from "./star-filter.ts";

/**
 * The tag, defined by `@johnmorrisdotca/hoshi-stars/flight/define`.
 *
 * @example
 * ```js no-run
 * import { FLIGHT_TAG } from "@johnmorrisdotca/hoshi-stars/flight/element";
 *
 * const flight = document.createElement(FLIGHT_TAG);
 * flight.setAttribute("at", "hr-7001");
 * document.body.append(flight);
 * ```
 */
export const FLIGHT_TAG = "hoshi-flight";

/**
 * Where the flight is: `status` on the element, and what `hoshi-flight` carries beside its `change`.
 *
 * @example
 * ```ts no-run
 * import type { FlightStatus } from "@johnmorrisdotca/hoshi-stars/flight/element";
 *
 * const { at, moving, position } = (document.querySelector("hoshi-flight") as unknown as { status: FlightStatus }).status;
 * console.log(at, moving, Math.hypot(position.x, position.y, position.z), "parsecs from the Sun");
 * ```
 */
export interface FlightStatus {
  /** Where the camera is, as an address carries it: the id of the place it rests at, else `pc_<x>_<y>_<z>`. */
  at: string;
  /** The place it rests at. */
  place: FlightPlace | undefined;
  /** The place it is flying to. */
  target: FlightPlace | undefined;
  /** True while it flies or turns. */
  moving: boolean;
  /** Parsecs from the Sun, on the equatorial axes. */
  position: FlightPoint;
  /** The speed it is moving at now, in multiples of the speed of light: under the dial's while it leaves and arrives, 0 at rest. */
  speed: number;
  /** The dial's speed. */
  dial: number;
  /** How far the stop beside the target still is, in parsecs. */
  remaining: number | undefined;
}

/**
 * What `hoshi-flight` says: the status, and `change`: `moving` at each step of a flight or a turn, `arrived` when it stops at a place, `home` when it stops at the Sun, and `rest` for any other change at rest
 * (a turn that ended, the dial, a point given as `at`).
 *
 * @example
 * ```ts no-run
 * import type { FlightChange } from "@johnmorrisdotca/hoshi-stars/flight/element";
 *
 * document.querySelector("hoshi-flight")!.addEventListener("hoshi-flight", (event) => {
 *   const { change, at } = (event as CustomEvent<FlightChange>).detail;
 *   if (change === "home") console.log("back at the Sun");
 *   else if (change === "arrived") history.replaceState(null, "", `?at=${at}`);
 * });
 * ```
 */
export interface FlightChange extends FlightStatus {
  change: "moving" | "arrived" | "home" | "rest";
}

/** The Sun's radius in parsecs (695,700 km, the IAU's nominal radius). */
const SUN_RADIUS = 695_700 / 3.085677581491367e13;
const ASTRONOMICAL_UNIT = 149_597_870.7 / 3.085677581491367e13;
/** The Sun as the profile reads a star: its magnitude from the Earth, its colour and its class. */
const SUN: ProfileInput = { magnitude: -26.74, colourIndex: 0.65, spectralType: "G2V", luminosityClass: "V", parallaxMas: 206_264_806.2, parallaxErrorMas: 1, parallaxSource: "GCTP" };
/** The camera stops this many radii from a star's middle: the ball fills about a third of the view's height. */
const RADII_AWAY = 6;
/** A flight to a place takes about this long at the speed chosen for it, before its slow start and stop. */
const LEG_SECONDS = 4;
/** The flight slows to its stop, leaves and turns by these time constants, in seconds. */
const ARRIVE = 0.25;
const LEAVE = 0.15;
const TURN = 0.18;
/** The view's height in degrees at Fit, and the range `fov` may ask for. */
const FIELD = 60;
const FIELD_MIN = 10;
const FIELD_MAX = 120;
/** The reason on a change of the hands that the flight made itself. */
const OWN = "flight";
const DEGREES = 180 / Math.PI;

const WORDS = {
  en: { stage: "The sky from where the flight is. Drag to look around.", noWebGL: "This browser cannot draw 3D here.", sun: "Sun" },
  ja: { stage: "飛んでいる場所から見た空。ドラッグで見回せます。", noWebGL: "このブラウザでは3Dを表示できません。", sun: "太陽" },
} as const;

const STYLE = `:host{display:block;position:relative;aspect-ratio:16/10;min-height:200px;background:#05070f;overflow:hidden;color:#e8ecff;font:.8rem/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
.stage{position:absolute;inset:0;outline:none;touch-action:pan-y;cursor:grab;-webkit-user-select:none;user-select:none}
.stage:focus-visible{outline:3px solid #ffd86b;outline-offset:-3px}.stage canvas{display:block}
.marks{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.mark{position:absolute;left:0;top:0;display:flex;align-items:center;gap:4px;margin:-9px 0 0 -9px;white-space:nowrap;text-shadow:0 0 3px #05070f,0 0 3px #05070f;will-change:transform}
.ring{width:16px;height:16px;border:1px solid #ffd86b;border-radius:50%}.name{font-weight:650;color:#ffe9a8}
.none{margin:0;padding:24px;text-align:center;color:#aab4d8;font-size:1rem}[hidden]{display:none!important}`;

const less = (a: FlightPoint, b: FlightPoint): FlightPoint => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const long = (a: FlightPoint): number => Math.hypot(a.x, a.y, a.z);
const unit = (a: FlightPoint): FlightPoint => {
  const length = long(a);
  return { x: a.x / length, y: a.y / length, z: a.z / length };
};
const dot = (a: FlightPoint, b: FlightPoint): number => a.x * b.x + a.y * b.y + a.z * b.z;
/** The direction of a right ascension and a declination, in degrees. */
const toward = (ra: number, dec: number): FlightPoint => {
  const flat = Math.cos(dec / DEGREES);
  return { x: flat * Math.cos(ra / DEGREES), y: flat * Math.sin(ra / DEGREES), z: Math.sin(dec / DEGREES) };
};
const number = (text: string | null): number | undefined => {
  const n = Number(text);
  return text !== null && text.trim() !== "" && Number.isFinite(n) ? n : undefined;
};

interface Ball {
  look: StarLook;
  seed: number;
  /** Parsecs. */
  radius: number;
}

const balls = new Map<string, Ball | undefined>();
/** The ball a place is drawn as beside it: the Sun and a bright star with a temperature and a radius. A nearby star or a galaxy has none here and stays a point. */
function ballOf(place: FlightPlace): Ball | undefined {
  if (balls.has(place.id)) return balls.get(place.id);
  const hr = /^hr-(\d+)$/.exec(place.id);
  const star = hr === null ? undefined : starByHr(Number(hr[1]));
  const profile = place.id === "sun" ? starProfile(SUN) : star === undefined ? undefined : starProfile(star);
  const look = profile === undefined ? undefined : starLook(profile, portraitLook(profile));
  const radius = profile?.radius?.value;
  const ball = look === undefined || radius === undefined ? undefined : { look, seed: star?.hr ?? 0, radius: radius * SUN_RADIUS };
  balls.set(place.id, ball);
  return ball;
}

/** How far from a place the camera stops by itself, in parsecs: a few radii from a star with a ball, an astronomical unit from a star without one, a fiftieth of the way out from a galaxy or a cluster. */
function stopBeside(place: FlightPlace): number {
  const ball = ballOf(place);
  if (ball !== undefined) return ball.radius * RADII_AWAY;
  return place.kind === "deep-sky" ? place.lightYears / 3.261563777 / 50 : ASTRONOMICAL_UNIT;
}

// One renderer for every flight on the page, made on first use; the last element to leave lets it go (after a second, in case it is only moving).
let loader: () => Promise<FlightThree> = () => import("three");
let shared: SharedRenderer<FlightThree> | undefined;
let holding = 0;
let letGo: ReturnType<typeof setTimeout> | undefined;
function takeRenderer(): SharedRenderer<FlightThree> {
  clearTimeout(letGo);
  holding += 1;
  shared ??= createSharedRenderer<FlightThree>({ load: () => loader(), stillSize: 320, antialias: true });
  return shared;
}
function giveRendererBack(): void {
  holding -= 1;
  if (holding > 0) return;
  letGo = setTimeout(() => {
    if (holding > 0) return;
    shared?.dispose();
    shared = undefined;
  }, 1000);
}

/**
 * Where three.js comes from, if the page wants to hand it over itself (before the first `<hoshi-flight>` goes live). A module that re-exports only the parts the flight draws with ships a few hundred kilobytes of
 * three.js instead of all of it. Left alone, it is `import("three")`, the package's optional peer.
 *
 * @param load - Returns the three.js module, as a promise.
 *
 * @example
 * ```ts no-run
 * import { setThreeLoader } from "@johnmorrisdotca/hoshi-stars/flight/element";
 *
 * setThreeLoader(() => import("three"));
 * ```
 */
export function setThreeLoader(load: () => Promise<FlightThree>): void {
  loader = load;
}

// On a server (a framework's render, or Node) there is no HTMLElement: the class still loads, as a stand-in nothing defines, so importing it never throws there.
const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

/**
 * The flight through the stars, as an element: `<hoshi-flight at="sun"></hoshi-flight>`. It fills its box (16 by 10 unless the page sizes it) with the sky seen from where the camera is, the stars put around it
 * again at each step, the Sun a named star from afar and a ball nearby, and a bright star a ball when the flight stops beside it. A drag looks around; a pinch, or Ctrl and the wheel, narrows and widens the view.
 *
 * Attributes: `at` (where it is: a place's id, `sun`, `hr-7001`, `gctp-3278`, `M31`, or a point in parsecs, `pc_1.5_-2_0.25`; written back in its one form at each stop, and setting it puts the camera there
 * without a flight), `lang` (`en` or `ja`, else the nearest above it), `ra` and `dec` (the direction it opens facing, in degrees on the equatorial axes; left out, it faces the place it is at, or the Sun from a point),
 * `fov` (the view's height in degrees at Fit, 10 to 120, 60 by default) and `sun-stop` (how far from the Sun's middle it stops, in astronomical units; six of the Sun's radii, about 0.028, by default).
 *
 * Star filters: `distance-min` and `distance-max` (light-years from where the camera is now) and `magnitude-limit` (the apparent magnitude seen from there) keep only the stars that fit; the sky is filtered once for a place, not at each frame.
 * `filter-bar` shows two bars for them over the view (folded on a narrow box; `filter-bar="open"` keeps them open); a bar writes the attributes and sends `hoshi-filter` (`StarFilterDetail`, with `final`). The flying sky holds only stars
 * with a distance, so none is hidden for lacking one.
 *
 * Properties: `status` (`FlightStatus`), `sunStop`, `live` (true while it draws in 3D) and `stats`; methods `goTo(id)` (fly to a place), `lookAt(id)` (turn to face one) and `stepSpeed(1 or -1)` (the dial). It sends
 * `hoshi-flight` (`FlightChange`) as it moves and when it stops: `moving`, `arrived`, `home` at the Sun, or `rest`.
 *
 * @example
 * ```html
 * <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/flight/define/+esm"></script>
 * <hoshi-flight at="hr-7001" style="height: 60vh"></hoshi-flight>
 * ```
 */
export class HoshiFlightElement extends Base {
  static observedAttributes = ["at", "lang", "ra", "dec", "fov", "sun-stop", "distance-min", "distance-max", "magnitude-limit", "filter-bar"];

  #stage: HTMLElement | undefined;
  #labels: HTMLElement | undefined;
  #markEls = new Map<string, HTMLElement>();
  #among = [...stars(), ...nearbyStars()];
  #sun = flightPlaceById("sun")!;
  #position: FlightPoint = { x: 0, y: 0, z: 0 };
  #look: FlightPoint = { x: -1, y: 0, z: 0 };
  /** The view's height at Fit and now, in degrees. */
  #fit = FIELD;
  #field = FIELD;
  #place: FlightPlace | undefined;
  #target: FlightPlace | undefined;
  #left: FlightPlace | undefined;
  #aim: FlightPoint | undefined;
  #byHand = false;
  #dial = FLIGHT_SPEEDS[0]!;
  #speed = 0;
  #remaining: number | undefined;
  /** It came to rest at a place since the last change was sent. */
  #arrived = false;
  #stamp = 0;
  #sunStop: number | undefined;
  #opened = false;
  #writing = false;
  #syncing = false;
  #live = false;
  #renderer: SharedRenderer<FlightThree> | undefined;
  #view: View | undefined;
  #hands: ViewController | undefined;
  #unbind: (() => void) | undefined;
  #seen: { at: FlightPoint; sky: SeenSky; key: string; shown: SeenSky } | undefined;
  #bar: FilterBar | undefined;

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    if (this.#stage === undefined) {
      root.innerHTML = `<style>${STYLE}${FILTER_BAR_STYLE}</style><div class="stage" part="stage" role="img" tabindex="0"></div><div class="marks" part="marks" aria-hidden="true"></div>`;
      this.#stage = root.querySelector<HTMLElement>(".stage")!;
      this.#labels = root.querySelector<HTMLElement>(".marks")!;
    }
    this.#stage.setAttribute("aria-label", WORDS[this.#lang()].stage);
    this.#syncBar();
    if (!this.#opened) {
      this.#opened = true;
      this.#readField();
      this.#open(this.getAttribute("at"));
      this.#arrived = false;
      this.#writeAt();
    }
    this.#bind();
  }

  disconnectedCallback(): void {
    this.#unbind?.();
    this.#unbind = undefined;
    this.#hands?.destroy();
    this.#hands = undefined;
    this.#view?.dispose();
    this.#view = undefined;
    this.#live = false;
    if (this.#renderer !== undefined) giveRendererBack();
    this.#renderer = undefined;
    this.#bar?.destroy();
    this.#bar = undefined;
  }

  attributeChangedCallback(name: string, before: string | null, after: string | null): void {
    if (!this.#opened || before === after) return;
    if (name === "filter-bar") this.#syncBar();
    else if (name === STAR_FILTER_ATTRIBUTES.distanceMin || name === STAR_FILTER_ATTRIBUTES.distanceMax || name === STAR_FILTER_ATTRIBUTES.magnitudeLimit) {
      this.#redraw();
      this.#bar?.sync();
    } else if (name === "at") {
      if (this.#writing || after === null) return;
      if (flightAddress(after)?.at === this.status.at) return this.#writeAt();
      this.#open(after);
      this.#changed();
    } else if (name === "lang") {
      this.#stage?.setAttribute("aria-label", WORDS[this.#lang()].stage);
      this.#bar?.sync();
      for (const el of this.#markEls.values()) el.remove();
      this.#markEls.clear();
      this.#redraw();
    } else if (name === "fov") {
      this.#readField();
      this.#sync();
      this.#redraw();
    } else if (name === "sun-stop") {
      this.#sunStop = undefined;
      if (this.#place?.id !== "sun") return;
      // Still at the Sun: the same side of it, at the new distance.
      this.#rest(this.#sun, { x: this.#position.x * 2, y: this.#position.y * 2, z: this.#position.z * 2 });
      this.#changed();
    } else if (!this.status.moving) {
      this.#faceOpening();
      this.#sync();
      this.#redraw();
    }
  }

  /** The nearest star drawn, in light-years from the camera; 0 for no limit. Setting it sets the attribute `distance-min`. */
  get distanceMin(): number {
    return filterOf(this).distanceMin ?? 0;
  }

  set distanceMin(value: number | null | undefined) {
    setFilterOf(this, { ...filterOf(this), distanceMin: value ?? undefined });
  }

  /** The farthest star drawn, in light-years from the camera; `Infinity` for no limit. Setting it sets the attribute `distance-max`. */
  get distanceMax(): number {
    return filterOf(this).distanceMax ?? Number.POSITIVE_INFINITY;
  }

  set distanceMax(value: number | null | undefined) {
    setFilterOf(this, { ...filterOf(this), distanceMax: value ?? undefined });
  }

  /** The faintest star drawn, the apparent magnitude seen from the camera; `Infinity` for no limit. Setting it sets the attribute `magnitude-limit`. */
  get magnitudeLimit(): number {
    return filterOf(this).magnitudeLimit ?? Number.POSITIVE_INFINITY;
  }

  set magnitudeLimit(value: number | null | undefined) {
    setFilterOf(this, { ...filterOf(this), magnitudeLimit: value ?? undefined });
  }

  #syncBar(): void {
    const root = this.shadowRoot;
    if (root === null) return;
    if (!this.hasAttribute(STAR_FILTER_ATTRIBUTES.bar) || this.getAttribute(STAR_FILTER_ATTRIBUTES.bar) === "false") {
      this.#bar?.destroy();
      this.#bar = undefined;
      return;
    }
    this.#bar ??= mountFilterBar(this, root, {
      lang: () => this.#lang(),
      count: () => {
        const seen = this.#seen;
        return seen === undefined ? undefined : { shown: seen.shown.length, total: seen.sky.length, noDistance: 0 };
      },
    });
    this.#bar.sync();
  }

  /** Where the flight is now. */
  get status(): FlightStatus {
    return { at: this.#place?.id ?? flightPointText(this.#position), place: this.#place, target: this.#target, moving: this.#target !== undefined || this.#aim !== undefined, position: this.#position, speed: this.#speed, dial: this.#dial, remaining: this.#remaining };
  }

  /** How far from the Sun's middle the flight stops, in astronomical units: the `sun-stop` attribute, else six of the Sun's radii. */
  get sunStop(): number {
    return this.#stopOf(this.#sun) / ASTRONOMICAL_UNIT;
  }

  set sunStop(au: number) {
    this.setAttribute("sun-stop", String(au));
  }

  /** True while the view draws in 3D: false before it goes live and where there is no WebGL. */
  get live(): boolean {
    return this.#live;
  }

  /** What a test or a status line reads: whether it is live, the stars drawn as points, the star drawn as a ball, and the renderer's own counts. */
  get stats(): { live: boolean; points: number; ball: string | undefined; renderer: RendererStats | undefined } {
    const scene = this.#view?.scene as FlightScene | undefined;
    return { live: this.#live, points: scene?.points ?? 0, ball: scene?.ball, renderer: this.#renderer?.stats };
  }

  /** Fly to a place by its id (`sun`, `hr-7001`, `gctp-3278`, `M31`); with reduced motion, be there at once. False where nothing has that id. */
  goTo(id: string): boolean {
    const to = flightPlaceById(id);
    if (to === undefined) return false;
    this.#byHand = false;
    if (to.id === this.#place?.id) return true;
    if (this.#still()) this.#rest(to, this.#position);
    else {
      this.#left = this.#place ?? this.#left;
      this.#place = undefined;
      this.#target = to;
      this.#aim = undefined;
      this.#remaining = Math.max(0, long(less(to.position, this.#position)) - this.#stopOf(to));
      this.#dial = flightSpeedFor(this.#remaining, LEG_SECONDS);
    }
    this.#changed();
    return true;
  }

  /** Turn to face a place without moving; with reduced motion, at once. False where nothing has that id. */
  lookAt(id: string): boolean {
    const to = flightPlaceById(id);
    if (to === undefined) return false;
    const gap = less(to.position, this.#position);
    if (long(gap) === 0) return true;
    this.#byHand = false;
    if (this.#still()) this.#look = unit(gap);
    else this.#aim = to.position;
    this.#changed();
    return true;
  }

  /** Step the speed dial up (1) or down (-1). */
  stepSpeed(direction: 1 | -1): void {
    this.#dial = stepFlightSpeed(this.#dial, direction);
    this.#emit();
  }

  #lang(): "en" | "ja" {
    return (this.closest("[lang]")?.getAttribute("lang") ?? "").toLowerCase().startsWith("ja") ? "ja" : "en";
  }

  #still(): boolean {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  #stopOf(place: FlightPlace): number {
    if (place.id !== "sun") return stopBeside(place);
    const au = number(this.getAttribute("sun-stop"));
    this.#sunStop ??= au !== undefined && au > 0 ? au * ASTRONOMICAL_UNIT : stopBeside(place);
    return this.#sunStop;
  }

  /** The field at Fit from `fov`, keeping the hand's zoom. */
  #readField(): void {
    const fov = number(this.getAttribute("fov"));
    const zoom = this.#fit / this.#field;
    this.#fit = fov === undefined ? FIELD : Math.max(FIELD_MIN, Math.min(FIELD_MAX, fov));
    this.#field = this.#fit / zoom;
  }

  #faceOpening(): void {
    const ra = number(this.getAttribute("ra"));
    const dec = number(this.getAttribute("dec"));
    if (ra !== undefined || dec !== undefined) this.#look = toward(ra ?? 0, Math.max(-90, Math.min(90, dec ?? 0)));
  }

  #settle(to: FlightPlace | undefined): void {
    this.#place = to;
    this.#target = undefined;
    this.#left = undefined;
    this.#aim = undefined;
    this.#speed = 0;
    this.#remaining = undefined;
    this.#arrived = to !== undefined;
  }

  /** Beside a place, on the side the camera comes from, facing it. */
  #rest(to: FlightPlace, from: FlightPoint): void {
    const way = less(to.position, from);
    this.#look = long(way) > 0 ? unit(way) : { x: -1, y: 0, z: 0 };
    const stop = this.#stopOf(to);
    this.#position = { x: to.position.x - this.#look.x * stop, y: to.position.y - this.#look.y * stop, z: to.position.z - this.#look.z * stop };
    this.#settle(to);
  }

  /** Put the camera where an address says, with no flight: the Sun when the text is left out or not understood. */
  #open(text: string | null): void {
    const opened = text === null ? undefined : flightAddress(text);
    if (opened === undefined || opened.place !== undefined) this.#rest(opened?.place ?? this.#sun, { x: 0, y: 0, z: 0 });
    else {
      this.#settle(undefined);
      this.#position = opened.position;
      if (long(this.#position) > 0) this.#look = unit(less(this.#sun.position, this.#position));
    }
    this.#faceOpening();
    this.#byHand = false;
    this.#sync();
  }

  /** The `at` attribute says where the camera stopped, not every step of the way there. */
  #writeAt(): void {
    const { at, moving } = this.status;
    if (moving || this.getAttribute("at") === at) return;
    this.#writing = true;
    this.setAttribute("at", at);
    this.#writing = false;
  }

  #emit(): void {
    const status = this.status;
    const change = status.moving ? "moving" : this.#arrived ? (status.place?.id === "sun" ? "home" : "arrived") : "rest";
    this.#arrived = false;
    this.#writeAt();
    if (change !== "moving") this.#bar?.sync();
    this.dispatchEvent(new CustomEvent<FlightChange>("hoshi-flight", { detail: { ...status, change } }));
  }

  #redraw(): void {
    this.#stamp += 1;
    this.#view?.invalidate();
  }

  #changed(): void {
    this.#sync();
    this.#redraw();
    this.#emit();
  }

  /** The hands keep the camera's direction as an angle (right ascension) and a tilt (declination), and the field as a zoom of the field at Fit. */
  #sync(): void {
    if (this.#hands === undefined) return;
    this.#syncing = true;
    const look = this.#look;
    this.#hands.set({ yaw: Math.atan2(look.y, look.x) * DEGREES, tilt: Math.asin(Math.max(-1, Math.min(1, look.z))) * DEGREES, zoom: this.#fit / this.#field, panX: 0, panY: 0 }, true, OWN);
    this.#syncing = false;
  }

  /** The name on a place's mark, in the element's language. */
  #nameOf(place: FlightPlace): string {
    const lang = this.#lang();
    if (place.id === "sun") return WORDS[lang].sun;
    const hr = /^hr-(\d+)$/.exec(place.id);
    const star = hr === null ? undefined : starByHr(Number(hr[1]));
    return (lang === "ja" ? star?.nameJa : undefined) ?? place.name ?? place.id;
  }

  #markEl(id: string): HTMLElement {
    let el = this.#markEls.get(id);
    if (el === undefined) {
      el = document.createElement("div");
      el.className = "mark";
      el.setAttribute("part", "mark");
      el.dataset.mark = id;
      el.append(Object.assign(document.createElement("span"), { className: "ring" }), Object.assign(document.createElement("span"), { className: "name", textContent: this.#nameOf(flightPlaceById(id)!) }));
      this.#labels!.append(el);
      this.#markEls.set(id, el);
    }
    return el;
  }

  /** The Sun, the place the flight goes to and the place it rests at get a name while they are far enough off to be points. */
  #marks(): FlightMark[] {
    const out: FlightMark[] = [];
    for (const marked of [this.#sun, this.#target, this.#place]) {
      if (marked === undefined || out.some((mark) => mark.id === marked.id)) continue;
      const way = less(marked.position, this.#position);
      if (long(way) > stopBeside(marked) * 50) out.push({ id: marked.id, direction: unit(way) });
    }
    return out;
  }

  /** The ball of the nearest of the places the flight has to do with. */
  #body(): FlightBody | undefined {
    let best: FlightBody | undefined;
    let nearest = BALL_WITHIN;
    for (const near of [this.#place, this.#target, this.#left]) {
      const ball = near === undefined ? undefined : ballOf(near);
      if (near === undefined || ball === undefined) continue;
      const offset = fromCamera(near.position, this.#position, ball.radius);
      const away = Math.hypot(...offset);
      if (away <= nearest) {
        nearest = away;
        best = { id: near.id, look: ball.look, seed: ball.seed, offset };
      }
    }
    return best;
  }

  #frame(): FlightFrame {
    if (this.#seen?.at !== this.#position) {
      const sky = skyFrom(this.#position, { among: this.#among, magnitude: FAINTEST });
      this.#seen = { at: this.#position, sky, key: "", shown: sky };
    }
    // the filter is applied to the sky once for a place and a filter, not at each frame
    const filter = filterOf(this);
    const key = starFilterKey(filter);
    if (this.#seen.key !== key) {
      this.#seen.key = key;
      this.#seen.shown = starFilterActive(filter) ? Object.assign(this.#seen.sky.filter((star) => starPasses(filter, star.magnitude, star.lightYears)), { skipped: this.#seen.sky.skipped }) : this.#seen.sky;
    }
    return { stamp: this.#stamp, sky: this.#seen.shown, look: this.#look, fieldOfView: this.#field, body: this.#body(), marks: this.#marks() };
  }

  /** Turn toward a direction by one step; how nearly it faces it afterwards (1 is facing). */
  #turn(way: FlightPoint, seconds: number): number {
    const share = -Math.expm1(-seconds / TURN);
    const look = this.#look;
    if (dot(look, way) < -0.98) {
      // Straight behind: there is no shorter way round, so it swings out sideways first.
      const side = Math.abs(look.z) < 0.9 ? unit({ x: -look.y, y: look.x, z: 0 }) : { x: 1, y: 0, z: 0 };
      this.#look = unit({ x: look.x + side.x * share, y: look.y + side.y * share, z: look.z + side.z * share });
    } else this.#look = unit({ x: look.x + (way.x - look.x) * share, y: look.y + (way.y - look.y) * share, z: look.z + (way.z - look.z) * share });
    return dot(this.#look, way);
  }

  #advance(seconds: number): boolean {
    const target = this.#target;
    const goal = target?.position ?? this.#aim;
    if (goal === undefined) return false;
    const gap = less(goal, this.#position);
    const way = long(gap) > 0 ? unit(gap) : this.#look;
    const facing = this.#byHand ? 1 : this.#turn(way, seconds);
    const faced = this.#byHand || facing > 0.99999;
    if (target === undefined) {
      if (faced) {
        if (!this.#byHand) this.#look = way;
        this.#aim = undefined;
      }
    } else if (facing > 0.9) {
      // It leaves a place as slowly as it will arrive at the next: no faster than its distance from the place it left in each LEAVE seconds.
      const leaving = this.#left === undefined ? this.#dial : long(less(this.#position, this.#left.position)) / (LIGHT_SPEED * LEAVE);
      const stop = this.#stopOf(target);
      const leg = flyToward({ position: this.#position, heading: way, speed: Math.min(this.#dial, leaving) }, target.position, seconds, { stopAt: stop, easeSeconds: ARRIVE });
      this.#position = leg.state.position;
      this.#speed = seconds > 0 ? leg.moved / (LIGHT_SPEED * seconds) : this.#speed;
      this.#remaining = leg.remaining - stop;
      if (leg.arrived && faced) {
        if (!this.#byHand) this.#look = way;
        this.#settle(target);
      }
    }
    this.#stamp += 1;
    this.#sync();
    this.#emit();
    return this.#target !== undefined || this.#aim !== undefined;
  }

  /** Bind the hands to the stage and take a view of the shared renderer. */
  #bind(): void {
    const stage = this.#stage!;
    const labels = this.#labels!;
    this.#hands = createViewController({
      limits: { tiltMax: 89, zoomMin: 1, zoomMax: 8 },
      onChange: (state, info) => {
        if (this.#syncing || info.reason === OWN) return;
        this.#look = toward(state.yaw, state.tilt);
        this.#field = this.#fit / state.zoom;
        // A hand on the view has the camera: a flight goes on, and no longer turns it.
        this.#byHand = true;
        if (this.#target === undefined) this.#aim = undefined;
        this.#redraw();
      },
    });
    this.#unbind = this.#hands.bind(stage);
    this.#sync();
    this.#renderer = takeRenderer();
    const view = this.#renderer.view(
      stage,
      flightItem({
        capacity: this.#among.length + 1,
        advance: (seconds) => this.#advance(seconds),
        frame: () => this.#frame(),
        onMarks: (places) => {
          const shown = new Set<string>();
          for (const at of places) {
            const el = this.#markEl(at.id);
            el.hidden = !at.shown;
            el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;
            shown.add(at.id);
          }
          for (const [id, el] of this.#markEls) if (!shown.has(id)) el.hidden = true;
        },
      }),
      { still: null },
    );
    this.#view = view;
    void view.focus().then((ok) => {
      if (this.#view !== view) return;
      this.#live = ok && view.scene !== undefined;
      if (this.#live) {
        view.invalidate();
        return;
      }
      view.dispose();
      this.#view = undefined;
      this.#markEls.clear();
      labels.replaceChildren(Object.assign(document.createElement("p"), { className: "none", textContent: WORDS[this.#lang()].noWebGL }));
      labels.removeAttribute("aria-hidden");
    });
  }
}
