// The sky out to a distance in 3D, drawn with three.js through kazoku-ui's shared renderer (one WebGL context for the page, drawn on demand, at most 30 frames a second). The Earth is at the middle; transparent shells mark 10, 50, 100, 500
// and 1,000 light-years (decades beyond that, said so on the page); a thing with a distance is a glowing point at its true place in the colour of its band; a thing whose distance is uncertain is a faint streak along its line of sight
// over the range its error allows and has no dot. Nothing is placed at a guess. The labels are HTML over the canvas: this file reports where each shell's belongs on every frame.
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import { pixelRatioFor } from "@johnmorrisdotca/kazoku-ui/renderer";
import type { DistanceLayers } from "../src/distance.ts";
import { BAND_COLOURS, UNCERTAIN_COLOUR } from "./distance-layers.ts";
import { layoutLayers, type LayersLayout } from "./layers-layout.ts";
import { pace } from "./space-scene.ts";
import { RESTING_POSE, type Pose } from "./space-camera.ts";
import type * as ThreeModule from "./three-subset.ts";

type Three = typeof ThreeModule;

/** Where the shells' labels belong on a frame: the screen place of each, in pixels from the top left of the view. */
export interface LayersFrame {
  width: number;
  height: number;
  points: Array<{ key: string; x: number; y: number; visible: boolean }>;
}

export interface LayersInput {
  layers: DistanceLayers;
  /** The labels' places, after each draw. */
  onFrame(frame: LayersFrame): void;
  /** Ask for a frame: set after the view is made. */
  invalidate: () => void;
  /** True when the reader asks for no motion: a turn then jumps. */
  still(): boolean;
}

export interface LayersScene extends Scene3D {
  pose(pose: Pose, snap?: boolean): void;
  readonly info: { dots: number; streaks: number; shells: number; scale: "linear" | "log" };
  readonly now: Pose;
}

const BACKGROUND = "#0b1020";
const SHELL_COLOUR = "#6f93e0";

const POINT_VERTEX = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
attribute float aKind;
uniform float uRatio;
uniform float uScale;
varying vec4 vColor;
varying float vKind;
void main() {
  vColor = aColor;
  vKind = aKind;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(aSize * uScale * uRatio, 90.0);
}`;

const POINT_FRAGMENT = /* glsl */ `
varying vec4 vColor;
varying float vKind;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  float a;
  if (vKind < 0.5) {
    float core = 1.0 - smoothstep(0.1, 0.42, r);
    float glow = 1.0 - smoothstep(0.0, 1.0, r);
    a = max(core, glow * 0.55);
  } else {
    float s = abs(p.x) + abs(p.y);
    a = 1.0 - smoothstep(0.72, 0.95, s);
  }
  a *= vColor.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}`;

const LINE_VERTEX = /* glsl */ `
attribute vec4 aColor;
varying vec4 vColor;
void main() {
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const LINE_FRAGMENT = /* glsl */ `
varying vec4 vColor;
void main() {
  if (vColor.a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a);
}`;

const hex = (text: string): [number, number, number] => [parseInt(text.slice(1, 3), 16) / 255, parseInt(text.slice(3, 5), 16) / 255, parseInt(text.slice(5, 7), 16) / 255];
const wrap = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180;
/** How far from the middle the camera sits when the view is at no zoom: the unit sphere and its shells fit with a margin. */
const FIT = 3.1;

/** The shells as rings: three great circles each, as pairs of points. */
function shellLines(layout: LayersLayout): { positions: number[]; colours: number[] } {
  const positions: number[] = [];
  const colours: number[] = [];
  const [r, g, b] = hex(SHELL_COLOUR);
  const pieces = 96;
  for (const shell of layout.shells) {
    const radius = shell.radius;
    const alpha = shell.radius >= 0.999 ? 0.32 : 0.2;
    for (const plane of [0, 1, 2]) {
      for (let i = 0; i < pieces; i += 1) {
        for (const t of [i, i + 1]) {
          const angle = (t / pieces) * Math.PI * 2;
          const c = Math.cos(angle) * radius;
          const s = Math.sin(angle) * radius;
          positions.push(...(plane === 0 ? [c, s, 0] : plane === 1 ? [c, 0, s] : [0, c, s]));
          colours.push(r, g, b, alpha);
        }
      }
    }
  }
  return { positions, colours };
}

/**
 * The item the renderer draws for layers.
 *
 * @param input - The layers and what to tell the page.
 * @returns The item, with its layout.
 */
export function layersItem(input: LayersInput): Item3D<Three> & { readonly layout: LayersLayout } {
  const layout = layoutLayers(input.layers);
  const key = `layers:${Number.isFinite(input.layers.limit) ? input.layers.limit : "all"}:${input.layers.things.length}`;
  return {
    key,
    layout,
    build({ three: T, assets, width, height }: BuildContext<Three>): LayersScene {
      const scene = new T.Scene();
      const size = { width, height };
      const ratioNow = (): number => pixelRatioFor(size.width, size.height, typeof devicePixelRatio === "number" ? devicePixelRatio : 1);
      const pointMaterial = assets.acquire(
        `${key}:points`,
        () => new T.ShaderMaterial({ vertexShader: POINT_VERTEX, fragmentShader: POINT_FRAGMENT, uniforms: { uRatio: { value: ratioNow() }, uScale: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending }),
        (m) => m.dispose(),
      );
      const lineMaterial = assets.acquire(
        `${key}:lines`,
        () => new T.ShaderMaterial({ vertexShader: LINE_VERTEX, fragmentShader: LINE_FRAGMENT, transparent: true, depthTest: false, depthWrite: false }),
        (m) => m.dispose(),
      );
      const geometryOf = (id: string, make: (g: InstanceType<Three["BufferGeometry"]>) => void): InstanceType<Three["BufferGeometry"]> =>
        assets.acquire(
          `${key}:geometry:${id}`,
          () => {
            const geometry = new T.BufferGeometry();
            make(geometry);
            return geometry;
          },
          (g) => g.dispose(),
        );

      // the shells, then the streaks, then the points over them
      const shells = shellLines(layout);
      const lineGeometry = geometryOf("shells", (g) => {
        g.setAttribute("position", new T.BufferAttribute(new Float32Array(shells.positions), 3));
        g.setAttribute("aColor", new T.BufferAttribute(new Float32Array(shells.colours), 4));
      });
      scene.add(Object.assign(new T.LineSegments(lineGeometry as ConstructorParameters<Three["LineSegments"]>[0], lineMaterial), { frustumCulled: false }));

      const [ur, ug, ub] = hex(UNCERTAIN_COLOUR);
      const { streaks, dots } = layout;
      if (streaks.count > 0) {
        const positions = new Float32Array(streaks.count * 6);
        const colours = new Float32Array(streaks.count * 8);
        for (let i = 0; i < streaks.count; i += 1) {
          positions.set(streaks.near.subarray(i * 3, i * 3 + 3), i * 6);
          positions.set(streaks.far.subarray(i * 3, i * 3 + 3), i * 6 + 3);
          colours.set([ur, ug, ub, 0.5, ur, ug, ub, 0.08], i * 8);
        }
        const geometry = geometryOf("streaks", (g) => {
          g.setAttribute("position", new T.BufferAttribute(positions, 3));
          g.setAttribute("aColor", new T.BufferAttribute(colours, 4));
        });
        scene.add(Object.assign(new T.LineSegments(geometry as ConstructorParameters<Three["LineSegments"]>[0], lineMaterial), { frustumCulled: false }));
      }

      // the Earth at the middle, then the things
      const total = dots.count + 1;
      const positions = new Float32Array(total * 3);
      const sizes = new Float32Array(total);
      const colours = new Float32Array(total * 4);
      const kinds = new Float32Array(total);
      positions.set(dots.positions, 3);
      sizes[0] = 12;
      colours.set([0.44, 0.82, 1, 1], 0);
      for (let i = 0; i < dots.count; i += 1) {
        const [r, g, b] = hex(BAND_COLOURS[dots.bands[i]!]!);
        sizes[i + 1] = dots.sizes[i]!;
        colours.set([r, g, b, 0.92], (i + 1) * 4);
        kinds[i + 1] = dots.kinds[i]!;
      }
      const pointGeometry = geometryOf("points", (g) => {
        g.setAttribute("position", new T.BufferAttribute(positions, 3));
        g.setAttribute("aSize", new T.BufferAttribute(sizes, 1));
        g.setAttribute("aColor", new T.BufferAttribute(colours, 4));
        g.setAttribute("aKind", new T.BufferAttribute(kinds, 1));
      });
      scene.add(Object.assign(new T.Points(pointGeometry, pointMaterial), { frustumCulled: false }));
      scene.background = new T.Color(BACKGROUND);

      const camera = new T.PerspectiveCamera(40, width / height, 0.01, 100);
      let current: Pose = { ...RESTING_POSE };
      let target: Pose = { ...RESTING_POSE };
      let rest = false;
      const tmp = new T.Vector3();
      const place = new T.Vector3();
      const frame: LayersFrame = { width, height, points: [] };
      const request = pace(() => input.invalidate());

      const aim = (): void => {
        const yaw = (current.yaw * Math.PI) / 180;
        const tilt = (current.tilt * Math.PI) / 180;
        // a tall view (a phone held upright) needs the camera farther back to hold the width
        const back = (FIT / Math.max(0.05, current.zoom)) * (size.width / size.height < 1 ? 1 / Math.max(0.35, size.width / size.height) : 1);
        camera.position.set(Math.cos(tilt) * Math.cos(yaw) * back, Math.cos(tilt) * Math.sin(yaw) * back, Math.sin(tilt) * back);
        camera.up.set(0, 0, 1);
        camera.lookAt(0, 0, 0);
        if (Math.abs(current.roll) > 1e-6) camera.rotateZ((current.roll * Math.PI) / 180);
        camera.aspect = size.width / size.height;
        camera.near = 0.01;
        camera.far = back + 5;
        camera.setViewOffset(size.width, size.height, -current.panX, -current.panY, size.width, size.height);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
      };

      const project = (): void => {
        frame.points.length = 0;
        for (const shell of layout.shells) {
          // the label sits where the shell meets the line up through the Earth (the north pole of the sky)
          tmp.set(0, 0, shell.radius).applyMatrix4(camera.matrixWorldInverse);
          const visible = tmp.z < -camera.near * 1.01;
          place.copy(tmp).applyMatrix4(camera.projectionMatrix);
          frame.points.push({ key: `shell:${shell.lightYears}`, x: (place.x * 0.5 + 0.5) * size.width, y: (-place.y * 0.5 + 0.5) * size.height, visible: visible && Math.abs(place.x) < 1.3 && Math.abs(place.y) < 1.3 });
        }
        frame.width = size.width;
        frame.height = size.height;
        input.onFrame(frame);
      };

      return {
        scene,
        camera,
        info: { dots: dots.count, streaks: streaks.count, shells: layout.shells.length, scale: layout.scale },
        get now() {
          return current;
        },
        pose(next, snap = false) {
          target = { ...next, yaw: current.yaw + wrap(next.yaw - current.yaw), roll: current.roll + wrap(next.roll - current.roll) };
          rest = false;
          if (snap || input.still()) {
            current = { ...target };
            target = { ...target };
          }
          request();
        },
        update(dt: number): boolean {
          if (!rest) {
            const k = input.still() ? 1 : 1 - Math.exp(-Math.max(dt, 1 / 60) / 0.085);
            const moved = (a: number, b: number, tolerance: number): number => (Math.abs(b - a) < tolerance ? b : a + (b - a) * k);
            current = {
              yaw: moved(current.yaw, target.yaw, 0.05),
              tilt: moved(current.tilt, target.tilt, 0.05),
              roll: moved(current.roll, target.roll, 0.05),
              zoom: Math.exp(moved(Math.log(current.zoom), Math.log(target.zoom), 0.0005)),
              panX: moved(current.panX, target.panX, 0.1),
              panY: moved(current.panY, target.panY, 0.1),
            };
            rest = (["yaw", "tilt", "roll", "zoom", "panX", "panY"] as const).every((name) => Math.abs(current[name] - target[name]) < 1e-9);
          }
          pointMaterial.uniforms["uScale"]!.value = 0.85 + 0.15 * Math.min(4, current.zoom);
          pointMaterial.uniforms["uRatio"]!.value = ratioNow();
          aim();
          project();
          if (!rest) request();
          return false;
        },
        resize(w: number, h: number) {
          size.width = Math.max(1, w);
          size.height = Math.max(1, h);
          rest = false;
          request();
        },
        dispose() {
          scene.clear();
        },
      };
    },
  };
}
