// One star in 3D as a part a page can mount: the turning star on the page's shared renderer, a Pause button, the line that says what is drawn from numbers and what is generic, and the Sun at the same scale. Where 3D is not
// available the flat portrait from `/portrait` stands in, and says so. Reduced motion opens it still, with Play ready.
import type { View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { portraitLook, starPortrait } from "../src/portrait.ts";
import type { StarProfile } from "../src/profile.ts";
import { pageRenderer } from "./page-renderer.ts";
import { starItem, starLook } from "./star-scene.ts";

export interface Star3DContext {
  say: (key: string) => string;
  lang: () => "en" | "ja";
  /** A figure as the page writes it (three significant figures, its digit grouping). */
  figure: (value: number) => string;
}

export interface Star3DMount {
  readonly live: boolean;
  readonly view: View | undefined;
  dispose(): void;
}

/** How far the camera sees past the equator: the disc is this much narrower than the view. */
const MARGIN = 1.12;

const reducedMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const fill = (text: string, values: Record<string, string>): string => text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

/** Put the star in `art`. `undefined` where the profile has no temperature to draw; the page then says so. */
export function mountStar3D(art: HTMLElement, profile: StarProfile, hr: number, name: string, context: Star3DContext): Star3DMount | undefined {
  const lookName = portraitLook(profile);
  const look = starLook(profile, lookName);
  if (look === undefined) return undefined;
  const { say } = context;
  let paused = reducedMotion();
  let live = false;
  let disposed = false;
  let view: View | undefined;

  const stage = document.createElement("div");
  stage.className = "star3d-stage";
  stage.dataset.testid = "star-3d";
  stage.setAttribute("role", "img");
  stage.setAttribute("aria-label", fill(say("star3dLabel"), { name }));
  const pause = document.createElement("button");
  pause.type = "button";
  pause.className = "fam-button star3d-pause";
  pause.dataset.testid = "star-3d-pause";
  const showPause = (): void => {
    pause.textContent = say(paused ? "star3dPlay" : "star3dPause");
    pause.setAttribute("aria-pressed", String(paused));
  };
  showPause();
  pause.addEventListener("click", () => {
    paused = !paused;
    showPause();
    stage.dataset.paused = String(paused);
    view?.invalidate();
  });
  stage.dataset.paused = String(paused);
  const caption = document.createElement("p");
  caption.className = "fam-fine star3d-caption";
  caption.dataset.testid = "star-3d-caption";
  caption.textContent = say(profile.shape !== undefined ? "star3dMeasured" : look.cells === undefined ? "star3dSmooth" : "star3dCells");
  const scale = scaleLine(profile, context);
  art.replaceChildren(stage, pause, caption, ...(scale === undefined ? [] : [scale]));

  const renderer = pageRenderer();
  Object.defineProperty(stage, "stats", { get: () => renderer.stats, configurable: true });
  const made = starItem({ key: `star:${hr}`, look, seed: hr, still: () => paused || reducedMotion() });
  view = renderer.view(stage, made, { still: null });
  void view.focus().then((ok) => {
    if (disposed) return;
    live = ok && view?.scene !== undefined;
    stage.dataset.live = String(live);
    if (live) {
      view?.invalidate();
      return;
    }
    // No 3D here: the flat portrait in its place.
    view?.dispose();
    view = undefined;
    const still = document.createElement("div");
    still.className = "star3d-still";
    still.dataset.testid = "star-3d-still";
    still.innerHTML = starPortrait(profile, { lang: context.lang(), name }) ?? "";
    still.append(Object.assign(document.createElement("p"), { className: "fam-fine", textContent: say("star3dStill") }));
    art.replaceChildren(still);
  });

  return {
    get live() {
      return live;
    },
    get view() {
      return view;
    },
    dispose() {
      disposed = true;
      view?.dispose();
      view = undefined;
    },
  };
}

/** The Sun at the same scale as the drawn star, as a dot beside a line as wide as the star, and the radius in words with its range. The dot is left out where the Sun would not fit under the star. */
function scaleLine(profile: StarProfile, context: Star3DContext): HTMLElement | undefined {
  const radius = profile.radius;
  if (radius === undefined) return undefined;
  const { say, figure } = context;
  const line = document.createElement("div");
  line.className = "star3d-scale";
  line.dataset.testid = "star-3d-scale";
  const range = Number.isFinite(radius.range[1]) ? `${figure(radius.range[0])} ${say("rangeTo")} ${figure(radius.range[1])}` : `${figure(radius.range[0])} ${say("rangeOrMore")}`;
  // The disc is the view's width over MARGIN; the view is drawn as wide as the bar, so the bar's share is the same.
  const bar = 100 / MARGIN;
  const sun = bar / radius.value;
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("viewBox", "0 0 100 14");
  svg.setAttribute("aria-hidden", "true");
  const left = (100 - bar) / 2;
  const rule = document.createElementNS(svgNs, "line");
  for (const [k, v] of [["x1", left], ["x2", left + bar], ["y1", 7], ["y2", 7]] as const) rule.setAttribute(k, String(v));
  rule.setAttribute("class", "star3d-rule");
  svg.append(rule);
  const fits = sun <= 12;
  if (fits) {
    const dot = document.createElementNS(svgNs, "circle");
    dot.setAttribute("cx", String(left + Math.max(sun / 2, 0.4)));
    dot.setAttribute("cy", "7");
    dot.setAttribute("r", String(Math.max(sun / 2, 0.4)));
    dot.setAttribute("class", "star3d-sun");
    dot.dataset.testid = "star-3d-sun";
    svg.append(dot);
  }
  const words = document.createElement("p");
  words.className = "fam-fine";
  words.textContent = fill(say(fits ? "star3dScale" : "star3dTimes"), { n: figure(radius.value), range });
  line.append(svg, words);
  return line;
}
