// The hands of "my sky": the family's view controller (drag, two-finger pinch, Ctrl and the wheel, the arrow keys, + and -, Home) turned into the sky's own moves: a drag turns you round and up or down, a pinch narrows or widens what you see.
// The controller keeps a zoom, a pan and a turn; the sky's truth is a heading, a pitch and a field of view, so each change of the controller is read as the step it made and played onto those three. Zoom 1 is the opening field of view.
import { createViewController, type ViewController, type ViewState } from "@johnmorrisdotca/kazoku-ui/view-controls";
import { degreesPerPixel, FOV_MAX, FOV_MIN, PITCH_MAX, PITCH_MIN, viewScale, type SkyCamera } from "./view.ts";

/** A heading, a pitch and a field of view, all in degrees. */
export interface SkyView {
  heading: number;
  pitch: number;
  fov: number;
}

export interface SkyHandsHost {
  /** The camera as it is now, with the size of the picture. */
  camera(): SkyCamera;
  /** The field of view the sky opens at: the controller's zoom 1. */
  opening(): number;
  /** The view changed: redraw it; `final` once the hand has settled (a release, a key, a button). */
  moved(view: SkyView, final: boolean): void;
  /** Where Home and 0 go. */
  home(): SkyView;
}

export interface SkyHands {
  readonly controller: ViewController;
  /** The view was set from outside: tell the controller where it is now. */
  sync(): void;
  zoomBy(factor: number): void;
  destroy(): void;
}

const RAD = Math.PI / 180;
const KEY_STEP = 10;
const KEY_STEP_FAR = 30;
const wrap180 = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180;
/** The controller's zoom for a field of view: the scale the picture has over its scale at the opening field. */
const zoomFor = (fov: number, open: number): number => Math.tan((open * RAD) / 4) / Math.tan((fov * RAD) / 4);
const fovFor = (zoom: number, open: number): number => (4 * Math.atan(Math.tan((open * RAD) / 4) / zoom)) / RAD;

/** Bind the family's hands to `box` (the element the pointer, the wheel and the keys go to) and play what they do onto the sky through `host`. */
export function attachSkyHands(box: HTMLElement, host: SkyHandsHost): SkyHands {
  let syncing = false;
  let shift = false;
  const controller = createViewController({
    turnable: true,
    limits: { tiltMax: 1e9, zoomMin: 0.01, zoomMax: 10 },
    objectSize: { width: 1e7, height: 1e7 },
    onChange: (state, info) => {
      // The family's gesture check reads the view from the element: its `controller`, its `state` and a `kazoku-viewchange` event for every change.
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

  function sync(): void {
    const camera = host.camera();
    const open = host.opening();
    controller.limits.zoomMin = zoomFor(FOV_MAX, open);
    controller.limits.zoomMax = zoomFor(FOV_MIN, open);
    controller.grabRadius = viewScale({ ...camera, fov: open });
    syncing = true;
    controller.set({ zoom: zoomFor(camera.fov, open), panX: 0, panY: 0, yaw: 0, tilt: 0, roll: 0 }, false, "sync");
    syncing = false;
    last = { ...controller.state };
  }

  function change(state: ViewState, reason: string, final: boolean): void {
    if (syncing) return;
    const before = last;
    last = { ...state };
    const camera = host.camera();
    if (reason === "fit" || reason === "front" || reason === "centre") {
      if (reason === "front") return;
      host.moved(host.home(), true);
      sync();
      return;
    }
    const open = host.opening();
    let { heading, pitch, fov } = camera;
    const k = state.zoom / before.zoom;
    const zooming = Math.abs(k - 1) > 1e-9;
    if (zooming) fov = fovFor(state.zoom, open);
    // Two fingers move and zoom the view in one event (the pair never moves in step, so the distance between them is hardly ever the same twice): the zoom is played, and so is the move of their middle, which is what a two-finger drag is. A wheel or a key that zooms keeps the turn it had.
    if (!zooming || reason === "pinch") {
      const turnX = wrap180(state.yaw - before.yaw);
      const turnY = state.tilt - before.tilt;
      // One pixel of the picture is `degreesPerPixel` of sky: dragging the sky right turns you left, and dragging it down lifts your eyes.
      const degrees = degreesPerPixel({ ...camera, fov });
      if (reason === "key") {
        const step = shift ? KEY_STEP_FAR : KEY_STEP;
        const side = turnX !== 0 ? turnX : shift ? wrap180(state.roll! - before.roll!) : 0;
        heading += Math.sign(side) * step;
        pitch += Math.sign(turnY) * step;
      } else if (turnX !== 0 || turnY !== 0) {
        heading -= turnX;
        pitch -= turnY;
      } else if (state.panX !== before.panX || state.panY !== before.panY) {
        heading -= (state.panX - before.panX) * degrees;
        pitch += (state.panY - before.panY) * degrees;
      }
    }
    const held = { heading: (((heading % 360) + 360) % 360), pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch)), fov: Math.max(FOV_MIN, Math.min(FOV_MAX, fov)) };
    host.moved(held, final);
    // a move the sky stopped short of (the pitch met the zenith, the field met its limit): the controller is told where the view really is, so a move back starts from there
    if (held.pitch !== pitch || Math.abs(held.fov - fov) > 1e-9) sync();
  }

  sync();
  const unbind = controller.bind(box);
  return {
    controller,
    sync,
    zoomBy: (factor) => controller.zoomBy(factor),
    destroy: () => {
      unbind();
      box.removeEventListener("keydown", keys, true);
      controller.destroy();
      Reflect.deleteProperty(box, "controller");
      Reflect.deleteProperty(box, "state");
    },
  };
}
