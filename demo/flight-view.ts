// The flying view as a part a page can mount: the sky from where the camera is on the page's shared renderer, a flight to a place by its id (`goTo`), a turn to face one (`lookAt`), the speed dial, and
// names on the Sun and on the place the flight is going to. A flight turns to its place, leaves slowly, flies at the dial's speed and slows to stop beside it (`flyToward` with its ease), so a star goes from
// a point to a ball and back without a jump. The family's view controls turn the camera by hand (a drag looks around, Ctrl and the wheel or a pinch narrows the view). A reader who asks for reduced motion
// is put at the place at once: one draw, no flight. Where the camera is has one text (`status.at`): the id of the place it rests at, else its point in parsecs.
import type { View } from "@johnmorrisdotca/kazoku-ui/renderer";
import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import type { ViewChangeDetail, ViewControlsElement } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { FLIGHT_SPEEDS, LIGHT_SPEED, flightPointText, flightSpeedFor, flyToward, fromCamera, stepFlightSpeed, type FlightPoint } from "../src/flight.ts";
import { flightAddress, flightPlaceById, type FlightPlace } from "../src/flight-places.ts";
import { nearbyStars } from "../src/nearby.ts";
import { portraitLook } from "../src/portrait.ts";
import { starProfile, type ProfileInput } from "../src/profile.ts";
import { skyFrom, type SeenSky } from "../src/sky-from.ts";
import { starByHr, stars } from "../src/stars.ts";
import { BALL_WITHIN, FAINTEST, flightItem, type FlightBody, type FlightFrame, type FlightMark } from "./flight-scene.ts";
import { pageRenderer } from "./page-renderer.ts";
import { starLook, type StarLook } from "./star-scene.ts";

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
/** The view's height in degrees at Fit. */
const FIELD = 60;
/** The reason on a change of the view controls that the flight made itself. */
const OWN = "flight";

export interface FlightStatus {
  /** Where the camera is, as an address carries it: the id of the place it rests at, else `pc_<x>_<y>_<z>`. */
  at: string;
  /** The place it rests at. */
  place: FlightPlace | undefined;
  /** The place it is flying to. */
  target: FlightPlace | undefined;
  moving: boolean;
  position: FlightPoint;
  /** The speed it is moving at now, in multiples of the speed of light: under the dial's while it leaves and arrives, 0 at rest. */
  speed: number;
  /** The dial's speed. */
  dial: number;
  /** How far the stop beside the target still is, in parsecs. */
  remaining: number | undefined;
}

export interface FlightOptions {
  /** Where it opens: a place's id or a point (`flightAddress` reads it). The Sun when left out or not understood. */
  at?: string | undefined;
  lang: "en" | "ja";
  /** A name for a place's mark. */
  nameOf(place: FlightPlace): string;
  /** What the view is, for a reader who cannot see it. */
  stageLabel: string;
  /** What to say where there is no 3D. */
  noWebGL: string;
  /** True for a reader who asks for reduced motion: a flight is then a single step. Read at each flight. */
  still(): boolean;
  onChange(status: FlightStatus): void;
}

export interface FlightMount {
  readonly live: boolean;
  readonly view: View | undefined;
  readonly status: FlightStatus;
  /** Fly to a place by its id (`sun`, `hr-7001`, `gctp-3278`, `M31`). False where nothing has that id. */
  goTo(id: string): boolean;
  /** Turn to face a place without moving. False where nothing has that id. */
  lookAt(id: string): boolean;
  /** Step the speed dial up or down. */
  stepSpeed(direction: 1 | -1): void;
  dispose(): void;
}

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

/** How far from a place the camera stops, in parsecs: a few radii from a star with a ball, an astronomical unit from a star without one, a fiftieth of the way out from a galaxy or a cluster. */
export function stopOf(place: FlightPlace): number {
  const ball = ballOf(place);
  if (ball !== undefined) return ball.radius * RADII_AWAY;
  return place.kind === "deep-sky" ? place.lightYears / 3.261563777 / 50 : ASTRONOMICAL_UNIT;
}

const less = (a: FlightPoint, b: FlightPoint): FlightPoint => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const long = (a: FlightPoint): number => Math.hypot(a.x, a.y, a.z);
const unit = (a: FlightPoint): FlightPoint => {
  const length = long(a);
  return { x: a.x / length, y: a.y / length, z: a.z / length };
};
const dot = (a: FlightPoint, b: FlightPoint): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** Put the flying view in `art`: the stage with the marks over it, and the view controls under it. The stage carries `flight` (what this returns) and `stats` (the renderer's counts). */
export function mountFlight(art: HTMLElement, options: FlightOptions): FlightMount {
  const stage = document.createElement("div");
  stage.className = "fl-stage";
  stage.dataset.testid = "fl-stage";
  stage.setAttribute("role", "img");
  stage.tabIndex = 0;
  stage.setAttribute("aria-label", options.stageLabel);
  const among = [...stars(), ...nearbyStars()];
  const sun = flightPlaceById("sun")!;
  let position: FlightPoint = { x: 0, y: 0, z: 0 };
  let look: FlightPoint = { x: -1, y: 0, z: 0 };
  let field = FIELD;
  let place: FlightPlace | undefined;
  let target: FlightPlace | undefined;
  let left: FlightPlace | undefined;
  let aim: FlightPoint | undefined;
  let byHand = false;
  let dial = FLIGHT_SPEEDS[0]!;
  let speed = 0;
  let remaining: number | undefined;
  let stamp = 0;
  let live = false;
  let disposed = false;
  let view: View | undefined;
  let syncing = false;
  let seen: { at: FlightPoint; sky: SeenSky } | undefined;

  const settle = (to: FlightPlace): void => {
    place = to;
    target = undefined;
    left = undefined;
    aim = undefined;
    speed = 0;
    remaining = undefined;
  };

  /** Beside a place, on the side the camera comes from, facing it. */
  const rest = (to: FlightPlace, from: FlightPoint): void => {
    const way = less(to.position, from);
    look = long(way) > 0 ? unit(way) : { x: -1, y: 0, z: 0 };
    const stop = stopOf(to);
    position = { x: to.position.x - look.x * stop, y: to.position.y - look.y * stop, z: to.position.z - look.z * stop };
    settle(to);
  };

  const opened = options.at === undefined ? undefined : flightAddress(options.at);
  if (opened === undefined || opened.place !== undefined) rest(opened?.place ?? sun, { x: 0, y: 0, z: 0 });
  else {
    position = opened.position;
    if (long(position) > 0) look = unit(less(sun.position, position));
  }

  const status = (): FlightStatus => ({ at: place?.id ?? flightPointText(position), place, target, moving: target !== undefined || aim !== undefined, position, speed, dial, remaining });

  const labels = document.createElement("div");
  labels.className = "fl-marks";
  labels.setAttribute("aria-hidden", "true");
  const markEls = new Map<string, HTMLElement>();
  const markEl = (id: string): HTMLElement => {
    let el = markEls.get(id);
    if (el === undefined) {
      el = document.createElement("div");
      el.className = "fl-mark";
      el.dataset.testid = `fl-mark-${id}`;
      el.append(Object.assign(document.createElement("span"), { className: "fl-ring" }), Object.assign(document.createElement("span"), { className: "fl-name", textContent: options.nameOf(flightPlaceById(id)!) }));
      labels.append(el);
      markEls.set(id, el);
    }
    return el;
  };

  /** The Sun, the place the flight goes to and the place it rests at get a name while they are far enough off to be points. */
  const marks = (): FlightMark[] => {
    const out: FlightMark[] = [];
    for (const marked of [sun, target, place]) {
      if (marked === undefined || out.some((mark) => mark.id === marked.id)) continue;
      const way = less(marked.position, position);
      if (long(way) > stopOf(marked) * 50) out.push({ id: marked.id, direction: unit(way) });
    }
    return out;
  };

  /** The ball of the nearest of the places the flight has to do with. */
  const body = (): FlightBody | undefined => {
    let best: FlightBody | undefined;
    let nearest = BALL_WITHIN;
    for (const near of [place, target, left]) {
      const ball = near === undefined ? undefined : ballOf(near);
      if (near === undefined || ball === undefined) continue;
      const offset = fromCamera(near.position, position, ball.radius);
      const away = Math.hypot(...offset);
      if (away <= nearest) {
        nearest = away;
        best = { id: near.id, look: ball.look, seed: ball.seed, offset };
      }
    }
    return best;
  };

  const frame = (): FlightFrame => {
    if (seen?.at !== position) seen = { at: position, sky: skyFrom(position, { among, magnitude: FAINTEST }) };
    return { stamp, sky: seen.sky, look, fieldOfView: field, body: body(), marks: marks() };
  };

  const controls = document.createElement("kazoku-view-controls") as ViewControlsElement;
  controls.dataset.testid = "fl-controls";
  controls.setAttribute("controls", "basic");
  controls.setAttribute("layout", "compact");
  controls.setAttribute("lang", options.lang);
  controls.setAttribute("tilt-max", "89");
  controls.setAttribute("zoom-min", "1");
  controls.setAttribute("zoom-max", "8");
  const degrees = 180 / Math.PI;
  /** The view controls keep the camera's direction as an angle (right ascension) and a tilt (declination). */
  const sync = (): void => {
    syncing = true;
    controls.controller.set({ yaw: Math.atan2(look.y, look.x) * degrees, tilt: Math.asin(Math.max(-1, Math.min(1, look.z))) * degrees, panX: 0, panY: 0 }, true, OWN);
    syncing = false;
  };
  controls.addEventListener("kazoku-viewchange", (event) => {
    const d = (event as CustomEvent<ViewChangeDetail>).detail;
    if (syncing || d.reason === OWN) return;
    const flat = Math.cos(d.tilt / degrees);
    look = { x: flat * Math.cos(d.yaw / degrees), y: flat * Math.sin(d.yaw / degrees), z: Math.sin(d.tilt / degrees) };
    field = FIELD / d.zoom;
    // A hand on the view has the camera: a flight goes on, and no longer turns it.
    byHand = true;
    if (target === undefined) aim = undefined;
    stamp += 1;
    view?.invalidate();
  });

  const changed = (): void => {
    stamp += 1;
    sync();
    options.onChange(status());
  };

  /** Turn toward a direction by one step; how nearly it faces it afterwards (1 is facing). */
  const turn = (way: FlightPoint, seconds: number): number => {
    const share = -Math.expm1(-seconds / TURN);
    const facing = dot(look, way);
    if (facing < -0.98) {
      // Straight behind: there is no shorter way round, so it swings out sideways first.
      const side = Math.abs(look.z) < 0.9 ? unit({ x: -look.y, y: look.x, z: 0 }) : { x: 1, y: 0, z: 0 };
      look = unit({ x: look.x + side.x * share, y: look.y + side.y * share, z: look.z + side.z * share });
    } else look = unit({ x: look.x + (way.x - look.x) * share, y: look.y + (way.y - look.y) * share, z: look.z + (way.z - look.z) * share });
    return dot(look, way);
  };

  const advance = (seconds: number): boolean => {
    const toward = target?.position ?? aim;
    if (toward === undefined) return false;
    const gap = less(toward, position);
    const way = long(gap) > 0 ? unit(gap) : look;
    const facing = byHand ? 1 : turn(way, seconds);
    const faced = byHand || facing > 0.99999;
    if (target === undefined) {
      if (faced) {
        look = byHand ? look : way;
        aim = undefined;
      }
    } else if (facing > 0.9) {
      // It leaves a place as slowly as it will arrive at the next: no faster than its distance from the place it left in each LEAVE seconds.
      const leaving = left === undefined ? dial : long(less(position, left.position)) / (LIGHT_SPEED * LEAVE);
      const leg = flyToward({ position, heading: way, speed: Math.min(dial, leaving) }, target.position, seconds, { stopAt: stopOf(target), easeSeconds: ARRIVE });
      position = leg.state.position;
      speed = seconds > 0 ? leg.moved / (LIGHT_SPEED * seconds) : speed;
      remaining = leg.remaining - stopOf(target);
      if (leg.arrived && faced) {
        if (!byHand) look = way;
        settle(target);
      }
    }
    changed();
    return target !== undefined || aim !== undefined;
  };

  const renderer = pageRenderer();
  Object.defineProperty(stage, "stats", { get: () => renderer.stats, configurable: true });
  const frameEl = document.createElement("div");
  frameEl.className = "fl-frame";
  frameEl.append(stage, labels);
  art.replaceChildren(frameEl, controls);
  controls.view = stage;
  sync();
  const item = flightItem({
    capacity: among.length + 1,
    advance,
    frame,
    onMarks(places) {
      const shown = new Set<string>();
      for (const at of places) {
        const el = markEl(at.id);
        el.hidden = !at.shown;
        el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;
        shown.add(at.id);
      }
      for (const [id, el] of markEls) if (!shown.has(id)) el.hidden = true;
    },
  });
  view = renderer.view(stage, item, { still: null });
  void view.focus().then((ok) => {
    if (disposed) return;
    live = ok && view?.scene !== undefined;
    stage.dataset.live = String(live);
    if (live) {
      view?.invalidate();
      return;
    }
    view?.dispose();
    view = undefined;
    labels.replaceChildren(Object.assign(document.createElement("p"), { className: "fl-none", textContent: options.noWebGL }));
    labels.removeAttribute("aria-hidden");
  });
  options.onChange(status());

  const mount: FlightMount = {
    get live() {
      return live;
    },
    get view() {
      return view;
    },
    get status() {
      return status();
    },
    goTo(id) {
      const to = flightPlaceById(id);
      if (to === undefined) return false;
      byHand = false;
      if (to.id === place?.id) return true;
      if (options.still()) rest(to, position);
      else {
        left = place ?? left;
        place = undefined;
        target = to;
        aim = undefined;
        remaining = Math.max(0, long(less(to.position, position)) - stopOf(to));
        dial = flightSpeedFor(remaining, LEG_SECONDS);
      }
      changed();
      view?.invalidate();
      return true;
    },
    lookAt(id) {
      const to = flightPlaceById(id);
      if (to === undefined) return false;
      const gap = less(to.position, position);
      if (long(gap) === 0) return true;
      byHand = false;
      if (options.still()) look = unit(gap);
      else aim = to.position;
      changed();
      view?.invalidate();
      return true;
    },
    stepSpeed(direction) {
      dial = stepFlightSpeed(dial, direction);
      options.onChange(status());
    },
    dispose() {
      disposed = true;
      view?.dispose();
      view = undefined;
      art.replaceChildren();
    },
  };
  Object.defineProperty(stage, "flight", { get: () => mount, configurable: true });
  return mount;
}
