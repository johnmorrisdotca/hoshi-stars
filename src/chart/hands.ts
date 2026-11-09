// The hands of the sky chart: the family's view controller (drag, two-finger pinch, wheel, keys, double tap and the zoom buttons) turned into this chart's own moves.
// The controller keeps a zoom, a pan and a turn; the chart's truth is its View (centre and zoom, in sky coordinates), so every change of the controller is read as
// the step it made (a zoom about a point, a slide, a turn) and played onto the View with the chart's own projection maths (`zoomedAbout`, `dragged`).
// Zoom 1 of the controller is the chart's opening zoom, "Fit": there the plain wheel scrolls the page and a drag turns the sky; zoomed in, the wheel and a drag move it.
// The element carries them itself (kazoku-ui's `carryControls`): `controls="none"` takes them off, and the module is read only when they are on.
import type { carryControls, ViewController, ViewState } from "@johnmorrisdotca/kazoku-ui/view-controls";
import { DEFAULT_VIEW, dragged, fitScale, ZOOM_MAX, ZOOM_MIN, zoomedAbout, type View } from "./draw.ts";

export interface HandsHost {
  view(): View;
  size(): { width: number; height: number };
  /** The zoom the chart opens at (the controller's Fit). */
  opening(): number;
  /** The chart's view changed: redraw it; `final` once the hand has settled (a release, a key, a wheel step, a button). */
  moved(view: View, final: boolean): void;
  /** Where Home, 0 and the reset button go; the opening view of Orion when left out. */
  home?(): View;
}

/** What `attachHands` needs of `@johnmorrisdotca/kazoku-ui/view-controls`: the page's own call, so the module is read only when the hands are on. */
export interface HandsKit {
  carryControls: typeof carryControls;
}

export interface Hands {
  readonly controller: ViewController;
  /** The view was set from outside (a flight, a search, a reset, the address): tell the controller where it is now. */
  sync(): void;
  zoomBy(factor: number): void;
  /** Where Home and 0 go. */
  home(): View;
  /** Let every hand go. */
  unbind(): void;
}

const KEY_STEP = 48;
const KEY_STEP_FAR = 160;
const wrap180 = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180;

/** Put the family's hands on `box` (the element the pointer, the wheel and the keys go to) and play what they do onto the chart through `host`. */
export function attachHands(kit: HandsKit, box: HTMLElement, host: HandsHost): Hands {
  let syncing = false;
  let shift = false;
  const carried = kit.carryControls(box, {
    turnable: true,
    limits: { tiltMax: 1e9, zoomMin: 0.01, zoomMax: 10 },
    objectSize: { width: 1e7, height: 1e7 },
    onChange: (state, info) => change(state, info.reason, info.final),
  });
  const controller: ViewController = carried.controller;
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
      view = zoomedAbout(view, width, height, (state.zoom * open) / view.zoom, width / 2 + atX, height / 2 + atY);
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
  }

  sync();
  return {
    controller,
    sync,
    zoomBy: (factor) => controller.zoomBy(factor),
    home,
    unbind() {
      box.removeEventListener("keydown", keys, true);
      carried.unbind();
    },
  };
}
