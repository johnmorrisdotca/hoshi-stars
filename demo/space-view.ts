// The constellation in 3D as a part a page can mount: the canvas (kazoku-ui's shared renderer, one WebGL context for the page), the labels over it, and the calls that choose a constellation, a viewpoint and a pose. The page owns
// the hands (the shared view controls, or a plain controller in an embed) and tells this part where the view is with `pose`.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { pageRenderer } from "./page-renderer.ts";
import { constellationIn3D, type Constellation3D, type StarIn3D } from "../src/constellation-3d.ts";
import type { NearbyStar } from "../src/nearby.ts";
import type { Star } from "../src/stars.ts";
import { placeLabels, type LabelRequest, type Rect } from "./space-labels.ts";
import { RESTING_POSE, type Pose } from "./space-camera.ts";
import { shapeOf, sizeOf, spaceItem, type Frame, type SpaceScene, type Three } from "./space-scene.ts";
import { describe, lightYearsText, type Say } from "./space-text.ts";
import type { Lang } from "./thumbs.ts";

export interface MountOptions {
  /** The element the canvas goes in; the hands bind to it. */
  host: HTMLElement;
  /** The layer the labels go in, over the host. */
  labels: HTMLElement;
  lang(): Lang;
  /** True for the light look. */
  light(): boolean;
  say: Say;
  /** Rectangles over the view that labels stay out of (its own buttons). */
  keepClear?(): Rect[];
  /** A figure was shown (or failed to draw: `live` false). */
  onShown?(figure: Constellation3D, live: boolean): void;
  /** The view is across the lines of sight (1) or at the viewpoint (0), after each frame. */
  onAcross?(across: number): void;
}

export interface SpaceMount {
  /** Show a constellation (its IAU abbreviation), optionally from a star (a bright star, or a nearby one the page has loaded). Resolves with whether the 3D view is live. */
  show(abbreviation: string, from?: Star | NearbyStar): Promise<boolean>;
  /** The pose the hands hold now. */
  pose(pose: Pose, snap?: boolean): void;
  /** The look or the language changed: draw the labels again. */
  refresh(): void;
  readonly figure: Constellation3D | undefined;
  readonly view: View | undefined;
  readonly renderer: SharedRenderer<Three>;
  readonly live: boolean;
  dispose(): void;
}

interface Entry {
  key: string;
  element: HTMLElement;
  kind: "star" | "tick" | "place";
  leader: SVGLineElement;
  radius: number;
  priority: number;
  sizes: Array<{ w: number; h: number }>;
}

const reducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mountSpace(options: MountOptions): SpaceMount {
  const { host, labels } = options;
  const renderer = pageRenderer();
  // the renderer's numbers, for the freeze test and anyone who asks the element
  Object.defineProperty(host, "stats", { get: () => renderer.stats, configurable: true });
  let token = 0;
  let view: View | undefined;
  let figure: Constellation3D | undefined;
  let scene: SpaceScene | undefined;
  let entries: Entry[] = [];
  let lastPose: Pose = { ...RESTING_POSE };
  let live = false;
  let lastFrame: Frame | undefined;

  const element = (tag: string, className: string, text = ""): HTMLElement => {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== "") el.textContent = text;
    return el;
  };

  const SVG = "http://www.w3.org/2000/svg";
  let leaders: SVGSVGElement | undefined;

  function buildLabels(anchors: readonly string[]): void {
    labels.replaceChildren();
    entries = [];
    leaders = document.createElementNS(SVG, "svg");
    leaders.setAttribute("class", "sp-leaders");
    labels.append(leaders);
    if (figure === undefined) return;
    const lang = options.lang();
    const byId = new Map(figure.stars.map((one) => [`s:${one.id}`, one]));
    for (const key of anchors) {
      let el: HTMLElement;
      let kind: Entry["kind"] = "star";
      let radius = 6;
      let priority = 50;
      const star: StarIn3D | undefined = byId.get(key);
      if (star !== undefined) {
        const words = describe(star, lang, options.say);
        el = element("div", `sp-label q-${star.quality} s-${shapeOf(star)}`);
        el.dataset["star"] = star.id;
        el.append(element("span", "sp-n", words.name), element("span", "sp-d", words.distance));
        if (words.range !== "") el.append(element("span", "sp-r", words.range));
        radius = shapeOf(star) === "ray" ? 4 : Math.max(5, sizeOf(star.star.magnitude) * 0.42);
        priority = 100 - star.star.magnitude * 9 + (star.position === undefined ? -4 : 0);
      } else if (key.startsWith("tick:")) {
        el = element("div", "sp-label sp-tick", options.say("sp_axis", { n: lightYearsText(Number(key.slice(5)), lang) }));
        kind = "tick";
        radius = 4;
        priority = 8;
      } else {
        el = element("div", "sp-label sp-place", options.say(key === "sun" ? "sp_sun" : "sp_earth"));
        kind = "place";
        radius = 7;
        priority = 400;
      }
      el.hidden = true;
      el.dataset["key"] = key;
      labels.append(el);
      const leader = document.createElementNS(SVG, "line");
      leader.setAttribute("visibility", "hidden");
      leaders.append(leader);
      entries.push({ key, element: el, kind, leader, radius, priority, sizes: [] });
    }
    // measure each label in full and with its name alone
    labels.dataset["measuring"] = "true";
    for (const entry of entries) {
      entry.element.hidden = false;
      entry.element.classList.remove("compact");
      const full = entry.element.getBoundingClientRect();
      entry.element.classList.add("compact");
      const small = entry.element.getBoundingClientRect();
      entry.element.classList.remove("compact");
      entry.sizes = entry.kind === "star" ? [{ w: Math.ceil(full.width), h: Math.ceil(full.height) }, { w: Math.ceil(small.width), h: Math.ceil(small.height) }] : [{ w: Math.ceil(full.width), h: Math.ceil(full.height) }];
      entry.element.hidden = true;
    }
    delete labels.dataset["measuring"];
  }

  function place(frame: Frame): void {
    lastFrame = frame;
    if (frame.width < 2) return;
    const requests: LabelRequest[] = [];
    const seen = new Set<string>();
    const points = new Map<string, { x: number; y: number }>();
    for (const point of frame.points) {
      const entry = entries.find((one) => one.key === point.key);
      if (entry === undefined || !point.visible) continue;
      if (entry.kind === "tick" && frame.across < 0.35) continue;
      seen.add(entry.key);
      requests.push({ key: entry.key, x: point.x, y: point.y, radius: entry.radius, sizes: entry.sizes, priority: entry.priority, leader: entry.kind === "star" });
      points.set(entry.key, point);
    }
    const placed = placeLabels(requests, frame.width, frame.height, options.keepClear?.() ?? []);
    for (const entry of entries) {
      const at = placed.get(entry.key);
      if (at === undefined) {
        entry.element.hidden = true;
        entry.leader.setAttribute("visibility", "hidden");
        continue;
      }
      entry.element.hidden = false;
      const star = points.get(entry.key)!;
      if (at.leader) {
        // a line from the star to the nearest point of its label
        const x = Math.max(at.x, Math.min(star.x, at.x + at.w));
        const y = Math.max(at.y, Math.min(star.y, at.y + at.h));
        entry.leader.setAttribute("x1", String(Math.round(star.x)));
        entry.leader.setAttribute("y1", String(Math.round(star.y)));
        entry.leader.setAttribute("x2", String(Math.round(x)));
        entry.leader.setAttribute("y2", String(Math.round(y)));
        entry.leader.setAttribute("visibility", "visible");
      } else entry.leader.setAttribute("visibility", "hidden");
      entry.element.classList.toggle("compact", at.size === 1);
      entry.element.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
      if (entry.kind === "tick") entry.element.style.opacity = String(Math.max(0, Math.min(1, (frame.across - 0.3) / 0.3)));
    }
    options.onAcross?.(frame.across);
  }

  async function show(abbreviation: string, from?: Star | NearbyStar): Promise<boolean> {
    const mine = ++token;
    view?.dispose();
    view = undefined;
    scene = undefined;
    live = false;
    figure = constellationIn3D(abbreviation, from === undefined ? {} : { from });
    labels.replaceChildren();
    entries = [];
    const made = spaceItem({
      figure,
      light: options.light,
      onFrame: place,
      invalidate: () => view?.invalidate(),
      still: reducedMotion,
    });
    const mine2 = renderer.view(host, made, { still: null });
    view = mine2;
    const ok = await mine2.focus();
    if (mine !== token) return false;
    if (!ok || mine2.scene === undefined) {
      live = false;
      options.onShown?.(figure, false);
      return false;
    }
    scene = mine2.scene as SpaceScene;
    live = true;
    buildLabels(made.anchors);
    scene.pose(lastPose, true);
    mine2.invalidate();
    options.onShown?.(figure, true);
    return true;
  }

  return {
    show,
    pose(next, snap = false) {
      lastPose = next;
      scene?.pose(next, snap);
    },
    refresh() {
      if (scene === undefined || figure === undefined) return;
      buildLabels(scene.info.anchors);
      scene.restyle();
      view?.invalidate();
      if (lastFrame !== undefined) place(lastFrame);
    },
    get figure() {
      return figure;
    },
    get view() {
      return view;
    },
    renderer,
    get live() {
      return live;
    },
    dispose() {
      token += 1;
      view?.dispose();
      view = undefined;
      scene = undefined;
      labels.replaceChildren();
    },
  };
}
