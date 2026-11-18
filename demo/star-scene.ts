// One star drawn in 3D from its numbers, through kazoku-ui's shared renderer: a ball (or, for a star with a measured shape, the spheroid interferometers measured, tipped and turned as they found it) in the colour of its
// temperature, darker toward the edge by its limb-darkening coefficient (the linear law, I(mu) = 1 - u(1 - mu), with u from Claret and Bloemen 2011 through `/profile`), darker at the equator of a fast spinner as its
// cooler equator is (the flux goes as the temperature to the fourth power), and covered in generic convection cells of the size its kind of star has. The cells are not this star's surface: the page says so.
// It turns as a globe does: the family's view controls keep the angle, which is the turn about the star's own axis (their Auto-turn spins it, a drag turns it by hand and the spin goes on from there), and the
// tilt and roll tip the whole star as seen. A guide that turns with it (a faint grid of latitude and longitude, and the spin axis through the poles) shows that it turns where its surface cannot. Nothing is
// drawn while the view is still.
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import { starBody, type StarLook } from "../src/star-body.ts";
import type * as ThreeModule from "./three-subset.ts";

export type Three = typeof ThreeModule;
export { starBody, starLook, type StarBody, type StarLook } from "../src/star-body.ts";

/** One turn of the drawn star takes this long: a pace to watch, not the star's own spin. */
export const TURN_SECONDS = 40;
/** The same as the view controls' auto-turn speed, in degrees a second. */
export const TURN_SPEED = 360 / TURN_SECONDS;

/** The reader's view of the star, as the family's view controls keep it: degrees (the angle is the turn about the star's axis), the zoom (1 is Fit) and the pan in CSS pixels. */
export interface StarPose {
  yaw: number;
  tilt: number;
  roll: number;
  zoom: number;
  panX: number;
  panY: number;
}

export const FRONT: StarPose = { yaw: 0, tilt: 0, roll: 0, zoom: 1, panX: 0, panY: 0 };

export interface StarSceneInput {
  /** Kept the same for the same star, so the renderer reuses the build. */
  key: string;
  look: StarLook;
  /** The star's catalogue number, which places its generic cells. */
  seed: number;
  /** Whether the guide (grid and axis) is drawn. Read on every frame. */
  guide(): boolean;
  /** The reader's view. Read on every frame. */
  pose(): StarPose;
}

/** The scene, with what a test or the page reads of it. */
export interface StarScene extends Scene3D {
  /** The turn about the spin axis, in turns (0 to 1). */
  readonly turn: number;
}

export function starItem(input: StarSceneInput): Item3D<Three> {
  const { look } = input;
  return {
    key: input.key,
    build({ three: T, width, height }: BuildContext<Three>): StarScene {
      const scene = new T.Scene();
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.set(0, 0, 4);
      const fit = (w: number, h: number): void => {
        const aspect = Math.max(1e-3, w / Math.max(1, h));
        const half = 1.12;
        camera.left = -half * Math.max(1, aspect);
        camera.right = half * Math.max(1, aspect);
        camera.top = half * Math.max(1, 1 / aspect);
        camera.bottom = -half * Math.max(1, 1 / aspect);
        camera.updateProjectionMatrix();
      };
      fit(width, height);
      const star = starBody(T, look, input.seed);
      const { ball: body, material, axisLine } = star;
      // The reader's turn and tip, around the star's own tilt on the sky.
      const held = new T.Group();
      held.add(star.group);
      scene.add(held);
      let size = { width, height };
      let posed = "";
      const place = (): boolean => {
        const pose = input.pose();
        const guide = input.guide();
        const key = `${pose.yaw}|${pose.tilt}|${pose.roll}|${pose.zoom}|${pose.panX}|${pose.panY}|${guide}|${size.width}|${size.height}`;
        if (key === posed) return false;
        posed = key;
        material.uniforms.uGuide!.value = guide ? 1 : 0;
        axisLine.visible = guide;
        body.rotation.y = (pose.yaw * Math.PI) / 180;
        held.rotation.set((pose.tilt * Math.PI) / 180, 0, (pose.roll * Math.PI) / 180, "XYZ");
        camera.zoom = pose.zoom;
        const across = (camera.right - camera.left) / Math.max(1, size.width);
        camera.position.set((-pose.panX * across) / pose.zoom, (pose.panY * across) / pose.zoom, 4);
        camera.updateProjectionMatrix();
        return true;
      };
      place();
      return {
        scene,
        camera,
        get turn() {
          return (((input.pose().yaw / 360) % 1) + 1) % 1;
        },
        update(): boolean {
          return place();
        },
        resize(w: number, h: number) {
          size = { width: w, height: h };
          fit(w, h);
          place();
        },
        dispose() {
          star.dispose();
        },
      };
    },
  };
}
