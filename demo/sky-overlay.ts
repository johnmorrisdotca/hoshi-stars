// The names on the brightest stars and the faint constellation lines of the package's `sky-labels` tier, for a chart of the demo (the page and the embed page share this): the settings the address and the controls give, the looks to choose from, the
// pointer rules, and the words a screen reader hears. The chart draws what it lays out (`sky-labels-svg.ts`).
import { loadBodyLabelFont } from "@johnmorrisdotca/kazoku-ui/body-label";
import { createFigureLines, createStarNames, type FigureLines, type FigureLinesSettings, type LabelStyle, type NameLanguage, type SkyProjector, type StarNames, type StarNamesSettings } from "../src/sky-labels.ts";
import type { Box } from "./labels.ts";

/** The looks the demo offers: the default (`display`, Michroma in small capitals with a ring and the catalogue letter), a plain one and one in capitals. Each is a settings change, not code. */
export const LOOKS = {
  display: {},
  plain: { font: "system-ui, sans-serif", size: 12, case: "as-written", letterSpacing: 0, ring: 0, designation: "none" },
  capitals: { font: "system-ui, sans-serif", size: 11, case: "upper", letterSpacing: 0.1, ring: 0, designation: "none" },
} as const satisfies Record<string, Partial<LabelStyle>>;

export type LookId = keyof typeof LOOKS;
export const LOOK_IDS = Object.keys(LOOKS) as LookId[];
/** The look an address names (`label-look=plain`), or the default. */
export const lookIdOf = (text: string | null): LookId => (LOOK_IDS as string[]).includes(text ?? "") ? (text as LookId) : "display";

/** What the overlay is set to. `names` and `strength` are `undefined` for off. */
export interface OverlayState {
  names: StarNamesSettings | undefined;
  strength: number | undefined;
  look: LookId;
  /** Parts of the look the address named, over the chosen look. */
  style?: Partial<LabelStyle>;
  lang: NameLanguage;
  /** The longest line to draw, for a flat map whose figures cross its seam. */
  maxLength?: number | undefined;
}

export interface Overlay {
  readonly names: StarNames | undefined;
  readonly lines: FigureLines | undefined;
  /** Whether either is on. */
  readonly on: boolean;
  configure(state: OverlayState): void;
  /** Lay the names and lines out for the chart as it is now. */
  update(project: SkyProjector, room: { width: number; height: number }, keepClear: readonly Box[]): void;
  /** Put the pointer rules on a frame: `redraw` is called when what is picked changed, and once is enough. */
  attach(frame: HTMLElement, redraw: () => void): void;
}

const coarse = (): boolean => matchMedia("(pointer: coarse)").matches;
const MOVED = 10;

/** An overlay: the names and lines the settings ask for, and the rules for the pointer. Its live region tells a screen reader the picked figure's name. */
export function createOverlay(): Overlay {
  let names: StarNames | undefined;
  let lines: FigureLines | undefined;
  let fontAsked = false;
  let announce: HTMLElement | undefined;

  const say = (): void => {
    if (announce !== undefined) announce.textContent = lines?.name?.text ?? "";
  };

  return {
    get names() {
      return names;
    },
    get lines() {
      return lines;
    },
    get on() {
      return names !== undefined || lines !== undefined;
    },
    configure(state) {
      const style = { ...LOOKS[state.look], ...state.style } as Partial<LabelStyle>;
      if (state.names === undefined) names = undefined;
      else if (names === undefined) names = createStarNames({ dotMagnitude: 3.5, dotRadius: 4, ...state.names, lang: state.lang, style });
      else names.set({ dotMagnitude: 3.5, dotRadius: 4, ...state.names, lang: state.lang, style });
      const settings: FigureLinesSettings = { strength: state.strength, lang: state.lang, style, reach: coarse() ? 28 : 14, ...(state.maxLength === undefined ? {} : { maxLength: state.maxLength }) };
      if (state.strength === undefined) lines = undefined;
      else if (lines === undefined) lines = createFigureLines(settings);
      else lines.set(settings);
      say();
      if (!fontAsked && (names !== undefined || lines !== undefined)) {
        fontAsked = true;
        // Michroma, from the page's own site, only now that a name is drawn
        void loadBodyLabelFont(new URL("fonts/Michroma-Regular.ttf", location.href)).then(() => document.dispatchEvent(new CustomEvent("hoshi-font"))).catch(() => undefined);
      }
    },
    update(project, room, keepClear) {
      names?.update(project, room, (x, y) => keepClear.some((box) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1));
      lines?.update(project, room, names?.labels);
      say();
    },
    attach(frame, redraw) {
      announce = document.createElement("div");
      announce.setAttribute("role", "status");
      announce.setAttribute("aria-live", "polite");
      announce.dataset["testid"] = "figure-announce";
      announce.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
      frame.append(announce);
      document.addEventListener("hoshi-font", redraw);
      const pick = (event: PointerEvent): void => {
        if (lines === undefined) return;
        const box = frame.getBoundingClientRect();
        if (lines.point(event.clientX - box.left, event.clientY - box.top)) {
          say();
          redraw();
        }
      };
      const release = (): void => {
        if (lines?.point()) {
          say();
          redraw();
        }
      };
      // where each finger came down, and whether it has moved on since: a finger that moves is a pan, and picks nothing
      const touches = new Map<number, { x: number; y: number; moved: boolean }>();
      // a mouse, and a pen hovering over the chart, pick the figure they rest on and let go when they leave
      frame.addEventListener("pointermove", (event) => {
        if (event.pointerType === "touch") {
          const start = touches.get(event.pointerId);
          if (start !== undefined && Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVED) start.moved = true;
        } else if (event.buttons === 0) pick(event);
      });
      frame.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "touch" || event.pointerType === "pen") touches.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false });
      });
      // a tap (a finger or a pen that came down and went up in place) picks what it touches, and the pick stays until the next tap
      frame.addEventListener("pointerup", (event) => {
        const start = touches.get(event.pointerId);
        touches.delete(event.pointerId);
        if (start !== undefined && !start.moved) pick(event);
      });
      // a finger the browser took for a scroll, a pan or a pinch picks nothing
      frame.addEventListener("pointercancel", (event) => touches.delete(event.pointerId));
      frame.addEventListener("pointerleave", (event) => {
        if (event.pointerType === "mouse" || (event.pointerType === "pen" && event.buttons === 0)) release();
      });
    },
  };
}
