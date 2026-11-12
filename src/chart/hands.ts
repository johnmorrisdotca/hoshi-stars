// The hands of the sky chart: the family's view controller (drag, two-finger pinch, wheel, keys, double tap and the zoom buttons) turned into this chart's own moves.
// The controller keeps a zoom, a pan and a turn; the chart's truth is its View (centre and zoom, in sky coordinates), so every change of the controller is read as
// the step it made (a zoom about a point, a slide, a turn) and played onto the View with the chart's own projection maths (`zoomedAbout`, `dragged`).
// Zoom 1 of the controller is the chart's opening zoom, "Fit": there the plain wheel scrolls the page and a drag turns the sky; zoomed in, the wheel and a drag move it.
import { createViewController, type ViewController, type ViewState } from "@johnmorrisdotca/kazoku-ui/view-controls";
import { DEFAULT_VIEW, dragged, fitScale, ZOOM_MAX, ZOOM_MIN, zoomedAbout, type View } from "./chart.ts";

export interface HandsHost {
  view(): View;
  size(): { width: number; height: number };
  /** The zoom the chart opens at (the controller's Fit). */
  opening(): number;
  /** The chart's view changed: redraw it; `final` once the hand has settled (a release, a key, a wheel step, a button). */
  moved(view: View, final: boolean): void;
  /** Where Home, 0 and the reset button go; the opening view of Orion when left out. */
  home?(): View;
  /** The most the view may zoom in about the chart's pixel (`x`, `y`): `ZOOM_MAX` when left out. The demo stops a zoom over a picture where the picture's own pixels run out. */
  zoomCap?(view: View, x: number, y: number): number;
}

export interface Hands {
  readonly controller: ViewController;
  /** The view was set from outside (a flight, a search, a reset, the address): tell the controller where it is now. */
  sync(): void;
  zoomBy(factor: number): void;
  /** Where Home and 0 go. */
  home(): View;
  /** Let go of the element: the controller's listeners and this module's own. */
  destroy(): void;
}

const KEY_STEP = 48;
const KEY_STEP_FAR = 160;
const wrap180 = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180;

/** Bind the family's hands to `box` (the element the pointer, the wheel and the keys go to) and play what they do onto the chart through `host`. */
export function attachHands(box: HTMLElement, host: HandsHost): Hands {
  let syncing = false;
  let shift = false;
  const controller = createViewController({
    turnable: true,
    limits: { tiltMax: 1e9, zoomMin: 0.01, zoomMax: 10 },
    objectSize: { width: 1e7, height: 1e7 },
    onChange: (state, info) => {
      // The family's gesture check (kazoku-ui/testing `checkGestures`) reads the view from the element: its `controller`, its `state` and a `kazoku-viewchange` event for every change.
      box.dispatchEvent(new CustomEvent("kazoku-viewchange", { detail: { ...state, final: info.final, reason: info.reason } }));
      change(state, info.reason, info.final);
    },
  });
  Object.defineProperties(box, { controller: { value: controller, configurable: true }, state: { get: () => ({ ...controller.state }), configurable: true } });
  let last: ViewState = { ...controller.state };
  const keys = (event: KeyboardEvent): void => {
    shift = event.shiftKey;
  };
  box.addEventListener("keydown", keys, true);

  const home = (): View => host.home?.() ?? { ...host.view(), ra: DEFAULT_VIEW.ra, dec: DEFAULT_VIEW.dec, zoom: host.opening() };

  function sync(): void {
    const { width, height } = host.size();
    const view = host.view();
    const open = host.opening();
    controller.limits.zoomMin = ZOOM_MIN / open;
    controller.limits.zoomMax = ZOOM_MAX / open;
    controller.grabRadius = fitScale(view.projection, width, height) * open;
    syncing = true;
    controller.set({ zoom: view.zoom / open, panX: 0, panY: 0, yaw: 0, tilt: 0, roll: 0 }, false, "sync");
    syncing = false;
    last = { ...controller.state };
  }

  function change(state: ViewState, reason: string, final: boolean): void {
    if (syncing) return;
    const before = last;
    last = { ...state };
    const { width, height } = host.size();
    let view = host.view();
    if (reason === "fit" || reason === "front" || reason === "centre") {
      if (reason === "front") return;
      view = home();
      host.moved(view, true);
      sync();
      return;
    }
    const open = host.opening();
    const k = state.zoom / before.zoom;
    if (Math.abs(k - 1) > 1e-9) {
      // A zoom about the point that stays put: the one point the controller's move (scale by k, then slide) leaves where it was. At Fit and below it zooms about the middle.
      const slideX = state.panX - k * before.panX;
      const slideY = state.panY - k * before.panY;
      const atX = state.zoom <= 1 ? 0 : slideX / (1 - k);
      const atY = state.zoom <= 1 ? 0 : slideY / (1 - k);
      const x = width / 2 + atX;
      const y = height / 2 + atY;
      view = zoomedAbout(view, width, height, (state.zoom * open) / view.zoom, x, y, host.zoomCap?.(view, x, y));
    } else {
      const turnX = wrap180(state.yaw - before.yaw);
      const turnY = state.tilt - before.tilt;
      if (reason === "key") {
        const step = shift ? KEY_STEP_FAR : KEY_STEP;
        const side = turnX !== 0 ? turnX : shift ? wrap180(state.roll! - before.roll!) : 0;
        // Arrow keys look the way they point.
        view = dragged(view, width, height, -Math.sign(side) * step, Math.sign(turnY) * step);
      } else if (turnX !== 0 || turnY !== 0) {
        const pixelsPerDegree = (controller.grabRadius as number) * state.zoom * (Math.PI / 180);
        view = dragged(view, width, height, turnX * pixelsPerDegree, -turnY * pixelsPerDegree);
      } else if (state.panX !== before.panX || state.panY !== before.panY) {
        view = dragged(view, width, height, state.panX - before.panX, state.panY - before.panY);
      }
    }
    host.moved(view, final);
    // A zoom the chart stopped short of (a picture's own pixels ran out): the controller is told where the view really is, so a step out starts from there.
    if (Math.abs(view.zoom - state.zoom * open) > 1e-6 * view.zoom) sync();
  }

  sync();
  const unbind = controller.bind(box);
  return {
    controller,
    sync,
    zoomBy: (factor) => controller.zoomBy(factor),
    home,
    destroy: () => {
      unbind();
      box.removeEventListener("keydown", keys, true);
      controller.destroy();
      Reflect.deleteProperty(box, "controller");
      Reflect.deleteProperty(box, "state");
    },
  };
}
