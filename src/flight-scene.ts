// The flying view's scene, through kazoku-ui's shared renderer: the camera stays at the middle of the scene and the sky is put around it again from where the flight is (`skyFrom`), each star a point in its
// direction, as large and as strong as its magnitude from there, in the colour of its temperature. The Sun is one of them. The star the camera is beside is the ball the demo's star page draws too (star-body.ts),
// placed in units of its own radius from the camera (the floating origin: `fromCamera`), so it grows from the point it was; its point fades as the ball takes over, and the ball hides the stars behind it.
// The element (flight-element.ts) moves the flight: `advance` is called before each draw and says whether it is still moving. Nothing is drawn while it is not.
import type * as THREE from "three";
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import { blackBodyColour, starTemperatureK } from "./colour.ts";
import type { FlightPoint } from "./flight.ts";
import type { SeenSky } from "./sky-from.ts";
import { starBody, type BodyThree, type StarBody, type StarLook } from "./star-body.ts";

/** The parts of three.js the flight draws with: a page that hands over its own module (`setThreeLoader`) needs only these. */
export type FlightThree = BodyThree & Pick<typeof THREE, "AdditiveBlending" | "PerspectiveCamera" | "Points" | "Scene" | "WebGLRenderer">;

/** The faintest star drawn: what the eye sees under a dark sky. */
export const FAINTEST = 6.5;
/** The widest a point is drawn, in CSS pixels: the Sun from Mercury is no wider than Sirius from here times this. */
const WIDEST = 14;
/** The ball is drawn once it is this many of its radii away or nearer: under a pixel wide before that. */
export const BALL_WITHIN = 600;
/** The sky's points are this far from the camera, in scene units: a direction, not a distance. */
const SKY = 50;

/** The star the camera is beside. */
export interface FlightBody {
  /** The id `skyFrom` gives it, so its point can fade. */
  id: string;
  look: StarLook;
  seed: number;
  /** Where its middle is from the camera, in its own radii. */
  offset: [x: number, y: number, z: number];
}

/** A place the page puts a name on: its direction from the camera. */
export interface FlightMark {
  id: string;
  direction: FlightPoint;
}

/** Where a mark is in the view, in CSS pixels from its top left; `shown` is false behind the camera or off the view. */
export interface FlightMarkPlace {
  id: string;
  x: number;
  y: number;
  shown: boolean;
}

/** What is drawn at one moment. A new `stamp` says something changed. */
export interface FlightFrame {
  stamp: number;
  sky: SeenSky;
  /** The direction the camera faces: a vector of length 1 on the flight's axes. */
  look: FlightPoint;
  /** The view's height in degrees. */
  fieldOfView: number;
  body: FlightBody | undefined;
  marks: readonly FlightMark[];
}

export interface FlightSceneInput {
  /** The most stars a sky can hold. */
  capacity: number;
  /** Move the flight by `seconds` and say whether it is still moving. Called before each draw. */
  advance(seconds: number): boolean;
  frame(): FlightFrame;
  /** Called after each change with where the marks are. */
  onMarks(places: FlightMarkPlace[]): void;
}

/** The scene, with what a test reads of it. */
export interface FlightScene extends Scene3D {
  /** Stars drawn as points now. */
  readonly points: number;
  /** The id of the star drawn as a ball now. */
  readonly ball: string | undefined;
}

const VERTEX = /* glsl */ `
attribute float aSize;
attribute vec4 aColour;
uniform float uRatio;
varying vec4 vColour;
void main() {
  vColour = aColour;
  gl_PointSize = aSize * uRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
varying vec4 vColour;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float soft = smoothstep(1.0, 0.25, r);
  gl_FragColor = vec4(vColour.rgb * vColour.a * soft, 1.0);
}`;

const colours = new Map<number, [number, number, number]>();
function colourOf(colourIndex: number | undefined): [number, number, number] {
  const key = Math.round((colourIndex ?? 0.65) * 20);
  let rgb = colours.get(key);
  if (rgb === undefined) {
    const hex = blackBodyColour(starTemperatureK(key / 20));
    rgb = [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
    colours.set(key, rgb);
  }
  return rgb;
}

const RADIANS = Math.PI / 180;

export function flightItem(input: FlightSceneInput): Item3D<FlightThree> {
  return {
    key: "flight",
    build({ three: T, width, height }: BuildContext<FlightThree>): FlightScene {
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(60, Math.max(1e-3, width / Math.max(1, height)), 0.05, 4 * BALL_WITHIN);
      camera.up.set(0, 0, 1);
      const positions = new Float32Array(input.capacity * 3);
      const sizes = new Float32Array(input.capacity);
      const tints = new Float32Array(input.capacity * 4);
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
      geometry.setAttribute("aSize", new T.BufferAttribute(sizes, 1));
      geometry.setAttribute("aColour", new T.BufferAttribute(tints, 4));
      const material = new T.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: { uRatio: { value: Math.min(2, globalThis.devicePixelRatio || 1) } }, blending: T.AdditiveBlending, transparent: true, depthWrite: false });
      const points = new T.Points(geometry, material);
      points.frustumCulled = false;
      scene.add(points);
      let size = { width, height };
      let drawn = Number.NaN;
      let count = 0;
      let body: { id: string; made: StarBody } | undefined;
      const corner = new T.Vector3();

      const dropBody = (): void => {
        if (body === undefined) return;
        scene.remove(body.made.group);
        body.made.dispose();
        body = undefined;
      };

      const place = (): void => {
        const frame = input.frame();
        if (frame.stamp === drawn) return;
        drawn = frame.stamp;
        camera.fov = frame.fieldOfView;
        camera.updateProjectionMatrix();
        camera.lookAt(frame.look.x, frame.look.y, frame.look.z);
        camera.updateMatrixWorld();
        const perRadian = size.height / 2 / Math.tan((frame.fieldOfView * RADIANS) / 2);

        // The ball, and how much of its star's point is left: all of it while the ball is a speck, none once the ball is wider than a point can be.
        const near = frame.body;
        let fade = 1;
        if (near === undefined) dropBody();
        else {
          const away = Math.hypot(...near.offset);
          if (away > BALL_WITHIN) dropBody();
          else {
            if (body?.id !== near.id) {
              dropBody();
              const made = starBody(T, near.look, near.seed, [64, 48]);
              made.axisLine.visible = false;
              scene.add(made.group);
              body = { id: near.id, made };
            }
            body.made.group.position.set(...near.offset);
            fade = Math.min(1, Math.max(0, (WIDEST - perRadian / away) / (WIDEST / 2)));
          }
        }

        count = Math.min(frame.sky.length, input.capacity);
        for (let i = 0; i < count; i += 1) {
          const star = frame.sky[i]!;
          const ra = star.rightAscension * RADIANS;
          const dec = star.declination * RADIANS;
          const flat = Math.cos(dec) * SKY;
          positions[i * 3] = flat * Math.cos(ra);
          positions[i * 3 + 1] = flat * Math.sin(ra);
          positions[i * 3 + 2] = Math.sin(dec) * SKY;
          const bright = Math.max(0, FAINTEST - star.magnitude);
          sizes[i] = Math.min(WIDEST, 1.6 + 0.62 * bright);
          const [r, g, b] = colourOf(star.colourIndex);
          tints[i * 4] = r;
          tints[i * 4 + 1] = g;
          tints[i * 4 + 2] = b;
          tints[i * 4 + 3] = Math.min(1, 0.3 + 0.14 * bright) * (star.id === near?.id ? fade : 1);
        }
        geometry.setDrawRange(0, count);
        for (const name of ["position", "aSize", "aColour"]) geometry.getAttribute(name)!.needsUpdate = true;

        input.onMarks(
          frame.marks.map((mark) => {
            corner.set(mark.direction.x, mark.direction.y, mark.direction.z).multiplyScalar(SKY).project(camera);
            const shown = corner.z < 1 && Math.abs(corner.x) <= 1 && Math.abs(corner.y) <= 1;
            return { id: mark.id, x: ((corner.x + 1) / 2) * size.width, y: ((1 - corner.y) / 2) * size.height, shown };
          }),
        );
      };
      place();
      return {
        scene,
        camera,
        get points() {
          return count;
        },
        get ball() {
          return body?.id;
        },
        update(dt: number): boolean {
          // A frame that came late (a tab that was away) is not a leap.
          const moving = input.advance(Math.min(dt, 0.1));
          place();
          return moving;
        },
        resize(w: number, h: number) {
          size = { width: w, height: h };
          camera.aspect = Math.max(1e-3, w / Math.max(1, h));
          drawn = Number.NaN;
          place();
        },
        dispose() {
          dropBody();
          geometry.dispose();
          material.dispose();
        },
      };
    },
  };
}
