// The scene of the constellation in 3D, drawn with three.js through kazoku-ui's shared renderer (one WebGL context for the page, drawn on demand, at most 30 frames a second). Stars are glowing points sized by magnitude and
// coloured by temperature; a distance error bar is a line with a cap at each end; a star whose error bar is wider than its distance is a faint streak along its whole range with no dot in the middle; a star with no distance
// is a ray from the Earth. Nothing in it is a guess: every position is the catalogue's. The labels are HTML over the canvas (space-labels.ts); this file reports where each one belongs on every frame.
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import { pixelRatioFor } from "@johnmorrisdotca/kazoku-ui/renderer";
import type { Constellation3D, Point3, StarIn3D } from "../src/constellation-3d.ts";
import { starColour } from "../src/stars.ts";
import { cameraFor, frontTan, RESTING_POSE, sideDistance, type Fit, type Pose } from "./space-camera.ts";
import type * as ThreeModule from "./three-subset.ts";

export type Three = typeof ThreeModule;

/** Where the labels belong on a frame: the screen place of each anchor, in pixels from the top left of the view. */
export interface Frame {
  width: number;
  height: number;
  /** 0 seen from the viewpoint, 1 seen across the lines of sight. */
  across: number;
  points: Array<{ key: string; x: number; y: number; visible: boolean }>;
}

export interface SpaceInput {
  figure: Constellation3D;
  /** True for the light look (paper, dark stars), false for the night. Read on every frame. */
  light(): boolean;
  /** The labels' places, after each draw. */
  onFrame(frame: Frame): void;
  /** Ask for a frame: set after the view is made (`view.invalidate`). */
  invalidate: () => void;
  /** True when the reader asks for no motion: a turn then jumps. */
  still(): boolean;
}

/** The scene, with the calls that move it. */
export interface SpaceScene extends Scene3D {
  /** Move the camera to a pose (by easing, or at once when `snap`). */
  pose(pose: Pose, snap?: boolean): void;
  /** The look changed (light or night): redraw. */
  restyle(): void;
  /** What the scene was built from, for tests and the page. */
  readonly info: { reach: number; middle: number; lateral: number; anchors: string[]; streaks: number; rays: number; bars: number };
  /** The pose now (eased), and where it is going. */
  readonly now: Pose;
}

/** A frame no more often than every 33 ms (30 a second), however fast the hand moves. */
export function pace(invalidate: () => void, now: () => number = () => performance.now(), minimum = 33): () => void {
  let last = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer !== undefined) return;
    const wait = last + minimum - now();
    if (wait <= 0) {
      last = now();
      invalidate();
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      last = now();
      invalidate();
    }, wait);
  };
}

const POINT_VERTEX = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
attribute vec4 aColorL;
attribute float aKind;
uniform float uRatio;
uniform float uScale;
uniform float uLight;
varying vec4 vColor;
varying float vKind;
void main() {
  vColor = mix(aColor, aColorL, uLight);
  vKind = aKind;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * view;
  gl_PointSize = min(aSize * uScale * uRatio, 160.0);
}`;

const POINT_FRAGMENT = /* glsl */ `
uniform float uLight;
uniform float uFade;
varying vec4 vColor;
varying float vKind;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  float a = 0.0;
  vec3 colour = vColor.rgb;
  if (vKind < 0.5) {
    float core = 1.0 - smoothstep(0.1, 0.42, r);
    float glow = 1.0 - smoothstep(0.0, 1.0, r);
    a = max(core, glow * (0.6 - 0.2 * uLight));
    colour = mix(colour, vec3(1.0), core * 0.5 * (1.0 - uLight));
  } else if (vKind < 1.5) {
    float s = max(abs(p.x), abs(p.y));
    a = 1.0 - smoothstep(0.7, 0.92, s);
  } else if (vKind < 2.5) {
    a = 1.0 - smoothstep(0.72, 0.96, r);
  } else {
    a = smoothstep(0.5, 0.68, r) * (1.0 - smoothstep(0.86, 1.0, r));
  }
  a *= vColor.a * uFade;
  if (a < 0.004) discard;
  gl_FragColor = vec4(colour, a);
}`;

const LINE_VERTEX = /* glsl */ `
attribute vec4 aColor;
attribute vec4 aColorL;
uniform float uLight;
varying vec4 vColor;
void main() {
  vColor = mix(aColor, aColorL, uLight);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const LINE_FRAGMENT = /* glsl */ `
uniform float uFade;
varying vec4 vColor;
void main() {
  float a = vColor.a * uFade;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}`;

const hex = (text: string): [number, number, number] => [parseInt(text.slice(1, 3), 16) / 255, parseInt(text.slice(3, 5), 16) / 255, parseInt(text.slice(5, 7), 16) / 255];

/** The colours of the two looks. */
export const LOOKS = {
  night: { background: "#0b1020", figure: "#6f93e0", shell: "#6f93e0", sight: "#9fb2e6", axis: "#9aa6d0", earth: "#6fd0ff", sun: "#ffdf8a", unknown: "#c9a7ff", rough: 0.78 },
  light: { background: "#f1efe8", figure: "#2f58b8", shell: "#2f58b8", sight: "#4a5f9a", axis: "#4a5568", earth: "#117bb8", sun: "#c98a06", unknown: "#7b3fc4", rough: 0.85 },
} as const;

type Rgb = [number, number, number];
/** A colour in each look. */
interface Pair {
  night: Rgb;
  light: Rgb;
}

/** A star's colour in the night, and the same darkened for the paper. */
function starPair(star: StarIn3D["star"]): Pair {
  const [r, g, b] = hex(starColour(star));
  const grey = (r + g + b) / 3;
  return { night: [r, g, b], light: [Math.max(0, (grey + (r - grey) * 1.5) * 0.62), Math.max(0, (grey + (g - grey) * 1.5) * 0.62), Math.max(0, (grey + (b - grey) * 1.5) * 0.66)] };
}

const pairOf = (name: keyof typeof LOOKS.night): Pair => ({ night: hex(LOOKS.night[name] as string), light: hex(LOOKS.light[name] as string) });

/** The size of a star's glow in CSS pixels: brighter is bigger. */
export const sizeOf = (magnitude: number): number => Math.min(30, Math.max(7, 9 + (3 - magnitude) * 2.7));

const dot = (a: Point3, b: Point3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lengthOf = (a: Point3): number => Math.hypot(a[0], a[1], a[2]);
const at = (origin: Point3, direction: Point3, t: number): Point3 => [origin[0] + direction[0] * t, origin[1] + direction[1] * t, origin[2] + direction[2] * t];
const mixPoint = (a: Point3, b: Point3, t: number): Point3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A nice step (1, 2 or 5 times a power of ten) near `raw`. */
export function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const share = raw / power;
  return (share < 1.5 ? 1 : share < 3.5 ? 2 : share < 7.5 ? 5 : 10) * power;
}

/** What a star is drawn as. */
export type StarShape = "bar" | "streak" | "point" | "ray";

export function shapeOf(one: StarIn3D): StarShape {
  if (one.position === undefined) return "ray";
  if (one.range === undefined) return "point";
  return one.wide ? "streak" : "bar";
}

/** How far a star's range is drawn: its far end, but no more than three times its distance (a range that has no end fades out there). */
export function displayFar(one: StarIn3D): number {
  const best = one.sight.best ?? 0;
  const far = one.sight.far ?? best;
  return Math.min(far, best * 3);
}

/**
 * The layout of a figure in the scene: how far the view reaches along the lines of sight, and the distance the camera looks at. The view is fitted to where the stars are, not to the far end of every range: a star
 * whose range has a far end (or none) at ten times its distance would otherwise squeeze the rest into a tenth of the view, so such a streak runs on past the edge, which is what it means. Pure, so it can be tested.
 */
export function layoutOf(figure: Constellation3D): { middle: number; reach: number; lateral: number; rayLength: number; extent: number } {
  const { centre } = figure.frame;
  const depthOf = (p: Point3): number => dot(p, centre);
  const sideOf = (p: Point3): number => Math.sqrt(Math.max(0, lengthOf(p) ** 2 - depthOf(p) ** 2));
  const bests: number[] = [];
  let wanted = 0;
  let lateral = 0;
  let extent = 0;
  for (const one of figure.stars) {
    if (one.position === undefined) continue;
    const origin = one.sight.origin;
    bests.push(depthOf(one.position));
    const shape = shapeOf(one);
    const near = one.sight.near === undefined ? one.position : at(origin, one.sight.direction, one.sight.near);
    const far = shape === "bar" ? at(origin, one.sight.direction, displayFar(one)) : shape === "streak" ? at(origin, one.sight.direction, displayFar(one)) : one.position;
    wanted = Math.max(wanted, shape === "bar" ? depthOf(far) * 1.05 : shape === "streak" ? depthOf(near) * 1.25 : depthOf(one.position) * 1.1);
    lateral = Math.max(lateral, sideOf(one.position), sideOf(near), shape === "bar" ? sideOf(far) : 0);
    extent = Math.max(extent, depthOf(far));
  }
  bests.sort((a, b) => a - b);
  const middle = bests.length === 0 ? 100 : Math.max(1, bests[Math.floor(bests.length / 2)]!);
  // most of the stars lie within the 80th percentile of the distances: the view holds them with a margin
  const spread = bests.length === 0 ? 200 : bests[Math.min(bests.length - 1, Math.floor(bests.length * 0.8))]! * 1.3;
  const reach = Math.max(wanted, spread, middle * 1.6, depthOf(figure.viewpoint.earth) * 1.1, 10);
  lateral = Math.max(lateral, sideOf(figure.viewpoint.earth), 1);
  const rayLength = reach;
  for (const one of figure.stars) if (one.position === undefined) extent = Math.max(extent, depthOf(at(one.sight.origin, one.sight.direction, rayLength)));
  return { middle, reach, lateral, rayLength, extent: Math.max(extent, reach) };
}

/** Float arrays that grow, for building a geometry: each colour is kept for both looks. */
class Builder {
  points: number[] = [];
  sizes: number[] = [];
  colours: number[] = [];
  coloursLight: number[] = [];
  kinds: number[] = [];
  lines: number[] = [];
  lineColours: number[] = [];
  lineColoursLight: number[] = [];
  point(p: Point3, size: number, colour: Pair, alpha: number, kind: number, alphaLight = alpha): void {
    this.points.push(p[0], p[1], p[2]);
    this.sizes.push(size);
    this.colours.push(colour.night[0], colour.night[1], colour.night[2], alpha);
    this.coloursLight.push(colour.light[0], colour.light[1], colour.light[2], alphaLight);
    this.kinds.push(kind);
  }
  line(a: Point3, b: Point3, colour: Pair, alphaA: number, alphaB = alphaA, lightScale = 1): void {
    this.lines.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    this.lineColours.push(...colour.night, alphaA, ...colour.night, alphaB);
    this.lineColoursLight.push(...colour.light, Math.min(1, alphaA * lightScale), ...colour.light, Math.min(1, alphaB * lightScale));
  }
}

const STREAK_DOTS = 30;

/** The shared-renderer item for a figure. */
export function spaceItem(input: SpaceInput): Item3D<Three> & { readonly anchors: string[] } {
  const { figure } = input;
  const layout = layoutOf(figure);
  const anchors: string[] = [];
  return {
    key: `space:${figure.constellation.abbreviation}:${figure.viewpoint.name ?? "earth"}`,
    anchors,
    build({ three: T, assets, width, height }: BuildContext<Three>): SpaceScene {
      anchors.length = 0;
      const key = `space:${figure.constellation.abbreviation}:${figure.viewpoint.name ?? "earth"}`;
      const scene = new T.Scene();
      const size = { width, height };
      const ratioNow = (): number => pixelRatioFor(size.width, size.height, typeof devicePixelRatio === "number" ? devicePixelRatio : 1);
      const pointMaterial = (id: string, fade: number): InstanceType<Three["ShaderMaterial"]> =>
        assets.acquire(
          `${key}:${id}`,
          () => new T.ShaderMaterial({ vertexShader: POINT_VERTEX, fragmentShader: POINT_FRAGMENT, uniforms: { uRatio: { value: ratioNow() }, uScale: { value: 1 }, uLight: { value: 0 }, uFade: { value: fade } }, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending }),
          (m) => m.dispose(),
        );
      const lineMaterial = (id: string, fade: number): InstanceType<Three["ShaderMaterial"]> =>
        assets.acquire(
          `${key}:${id}`,
          () => new T.ShaderMaterial({ vertexShader: LINE_VERTEX, fragmentShader: LINE_FRAGMENT, uniforms: { uFade: { value: fade }, uLight: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false }),
          (m) => m.dispose(),
        );
      const body = new Builder();
      const axis = new Builder();
      const sights = new Builder();
      const shell = new Builder();
      const feature = new Builder();
      const seen = new Map<string, StarIn3D>();
      const anchorAt: Array<{ key: string; point: Point3 }> = [];
      const info = { reach: layout.reach, middle: layout.middle, lateral: layout.lateral, anchors: [] as string[], streaks: 0, rays: 0, bars: 0 };
      const rgb = pairOf;
      const origin: Point3 = [0, 0, 0];
      const { centre } = figure.frame;

      // The Earth's lines of sight, the scale along the middle line, the Earth and the viewpoint.
      const step = niceStep(layout.reach / 5);
      axis.line(origin, [centre[0] * layout.reach, centre[1] * layout.reach, centre[2] * layout.reach], rgb("axis"), 0.5, 0.18);
      for (let d = step; d <= layout.reach * 1.001; d += step) {
        const p: Point3 = [centre[0] * d, centre[1] * d, centre[2] * d];
        axis.point(p, 5, rgb("axis"), 0.85, 1);
        anchorAt.push({ key: `tick:${Math.round(d * 1000) / 1000}`, point: p });
      }
      const earth = figure.viewpoint.earth;
      const fromAnotherStar = lengthOf(earth) > 0;
      if (fromAnotherStar) {
        body.point(earth, 15, rgb("sun"), 1, 0);
        anchorAt.push({ key: "sun", point: earth });
        body.point(origin, 7, rgb("earth"), 0.9, 3);
      } else {
        feature.point(origin, 8, rgb("earth"), 1, 2);
        anchorAt.push({ key: "earth", point: origin });
      }

      for (const one of figure.stars) {
        const id = `s:${one.id}`;
        seen.set(id, one);
        const colour = starPair(one.star);
        const base = sizeOf(one.star.magnitude);
        const shape = shapeOf(one);
        const sightColour = rgb("sight");
        if (shape === "ray") {
          info.rays += 1;
          const end = at(one.sight.origin, one.sight.direction, layout.rayLength);
          sights.line(one.sight.origin, end, rgb("unknown"), 0.55, 0.08);
          // dotted: a row of faint dots along the ray, brightest at the Earth
          for (let i = 1; i <= 24; i += 1) body.point(at(one.sight.origin, one.sight.direction, (layout.rayLength * i) / 24), 3.2, rgb("unknown"), 0.55 * (1 - i / 26), 2);
          body.point(at(one.sight.origin, one.sight.direction, layout.rayLength * 0.04), base * 0.55, colour, 0.6, 3);
          anchorAt.push({ key: id, point: end });
          continue;
        }
        const best = one.position!;
        const near = one.nearPosition;
        const bestT = one.sight.best!;
        if (shape === "point") {
          body.point(best, base, colour, LOOKS.night.rough, 0, LOOKS.light.rough);
          sights.line(one.sight.origin, best, sightColour, 0.14);
          anchorAt.push({ key: id, point: best });
          continue;
        }
        const nearT = one.sight.near!;
        const farT = displayFar(one);
        const farP = at(one.sight.origin, one.sight.direction, farT);
        if (shape === "bar") {
          info.bars += 1;
          body.point(best, base, colour, 1, 0);
          sights.line(one.sight.origin, near!, sightColour, 0.14);
          feature.line(near!, farP, colour, 0.85);
          feature.point(near!, 4, colour, 0.85, 1);
          feature.point(farP, 4, colour, 0.85, 1);
          anchorAt.push({ key: id, point: best });
          continue;
        }
        // a streak: the whole range as a row of faint glows, no dot in the middle; a range with no end, or one cut short, fades out
        info.streaks += 1;
        const open = (one.sight.far ?? 0) > farT * 1.0001 || !Number.isFinite(one.sight.far ?? 0);
        sights.line(one.sight.origin, near!, sightColour, 0.12);
        for (let i = 0; i < STREAK_DOTS; i += 1) {
          const t = i / (STREAK_DOTS - 1);
          const fade = open ? 1 - 0.85 * t : 1;
          body.point(at(one.sight.origin, one.sight.direction, nearT + (farT - nearT) * t), base * 0.95, colour, 0.1 * fade, 0, 0.16 * fade);
        }
        feature.line(near!, farP, colour, 0.34, open ? 0.02 : 0.34);
        feature.point(near!, 4, colour, 0.7, 1);
        if (!open) feature.point(farP, 4, colour, 0.7, 1);
        void bestT;
        anchorAt.push({ key: id, point: near! });
      }

      // The figure: its lines at the stars' places where both ends have one (fainter where an end is a streak), and on a sky at the middle distance (the chart's lines) for every pair.
      const figureColour = rgb("figure");
      for (const [a, b] of figure.segments) {
        const from = figure.stars[a]!;
        const to = figure.stars[b]!;
        if (from.position !== undefined && to.position !== undefined) {
          const faint = shapeOf(from) === "streak" || shapeOf(to) === "streak" || shapeOf(from) === "point" || shapeOf(to) === "point";
          body.line(from.position, to.position, figureColour, faint ? 0.3 : 0.7);
        }
        const directionOf = (one: StarIn3D): Point3 | undefined => (lengthOf(earth) === 0 ? one.sight.direction : one.position === undefined ? undefined : ([one.position[0] / lengthOf(one.position), one.position[1] / lengthOf(one.position), one.position[2] / lengthOf(one.position)] as Point3));
        const da = directionOf(from);
        const db = directionOf(to);
        if (da === undefined || db === undefined) continue;
        const pieces = 10;
        let last: Point3 = [da[0] * layout.middle, da[1] * layout.middle, da[2] * layout.middle];
        for (let i = 1; i <= pieces; i += 1) {
          const m = mixPoint(da, db, i / pieces);
          const k = layout.middle / lengthOf(m);
          const next: Point3 = [m[0] * k, m[1] * k, m[2] * k];
          shell.line(last, next, figureColour, 0.32);
          last = next;
        }
      }

      // Geometry from the builders, kept by the cache.
      const geometryOf = (id: string, make: (g: InstanceType<Three["BufferGeometry"]>) => void): InstanceType<Three["BufferGeometry"]> =>
        assets.acquire(
          `${key}:${id}`,
          () => {
            const geometry = new T.BufferGeometry();
            make(geometry);
            return geometry;
          },
          (g) => g.dispose(),
        );
      const pointsOf = (id: string, builder: Builder, fade: number): InstanceType<Three["Points"]> | undefined => {
        if (builder.sizes.length === 0) return undefined;
        const geometry = geometryOf(id, (g) => {
          g.setAttribute("position", new T.BufferAttribute(new Float32Array(builder.points), 3));
          g.setAttribute("aSize", new T.BufferAttribute(new Float32Array(builder.sizes), 1));
          g.setAttribute("aColor", new T.BufferAttribute(new Float32Array(builder.colours), 4));
          g.setAttribute("aColorL", new T.BufferAttribute(new Float32Array(builder.coloursLight), 4));
          g.setAttribute("aKind", new T.BufferAttribute(new Float32Array(builder.kinds), 1));
        });
        const mesh = new T.Points(geometry, pointMaterial(`${id}:material`, fade));
        mesh.frustumCulled = false;
        return mesh;
      };
      const linesOf = (id: string, builder: Builder, fade: number): InstanceType<Three["LineSegments"]> | undefined => {
        if (builder.lines.length === 0) return undefined;
        const geometry = geometryOf(id, (g) => {
          g.setAttribute("position", new T.BufferAttribute(new Float32Array(builder.lines), 3));
          g.setAttribute("aColor", new T.BufferAttribute(new Float32Array(builder.lineColours), 4));
          g.setAttribute("aColorL", new T.BufferAttribute(new Float32Array(builder.lineColoursLight), 4));
        });
        const mesh = new T.LineSegments(geometry as ConstructorParameters<Three["LineSegments"]>[0], lineMaterial(`${id}:material`, fade));
        mesh.frustumCulled = false;
        return mesh;
      };
      const pointMeshes = [pointsOf("body", body, 1), pointsOf("axisPoints", axis, 0), pointsOf("feature", feature, 1)];
      const lineMeshes = [linesOf("shell", shell, 1), linesOf("sights", sights, 1), linesOf("axisLines", axis, 0), linesOf("features", feature, 1), linesOf("figure", body, 1)];
      // draw order: shell and lines of sight under, then the figure's lines and bars, then the points over them
      for (const mesh of [lineMeshes[0], lineMeshes[1], lineMeshes[2], lineMeshes[3], lineMeshes[4], pointMeshes[0], pointMeshes[1], pointMeshes[2]]) if (mesh !== undefined) scene.add(mesh);
      const axisMeshes = [pointMeshes[1], lineMeshes[2]].filter((m): m is NonNullable<typeof m> => m !== undefined);
      const allLines = lineMeshes.filter((m): m is NonNullable<typeof m> => m !== undefined);
      const allPoints = pointMeshes.filter((m): m is NonNullable<typeof m> => m !== undefined);
      const background = new T.Color(LOOKS[input.light() ? "light" : "night"].background);
      scene.background = background;

      const camera = new T.PerspectiveCamera(40, width / height, 0.05, (layout.extent + 1) * 40);
      const fit = (): Fit => ({ centre: figure.frame.centre, up: figure.frame.up, radius: figure.radius, middle: layout.middle, reach: layout.reach, lateral: layout.lateral, aspect: size.width / size.height, height: size.height });
      let current: Pose = { ...RESTING_POSE };
      let target: Pose = { ...RESTING_POSE };
      const tmp = new T.Vector3();
      const place = new T.Vector3();
      const frame: Frame = { width, height, across: 0, points: [] };
      const request = pace(() => input.invalidate());
      let lastLight: boolean | undefined;

      const aim = (): void => {
        const spec = cameraFor(fit(), current);
        camera.position.set(...spec.position);
        camera.up.set(...spec.up);
        camera.lookAt(spec.target[0], spec.target[1], spec.target[2]);
        camera.fov = (2 * Math.atan(spec.tanHalf) * 180) / Math.PI;
        camera.aspect = size.width / size.height;
        camera.near = Math.max(0.05, layout.middle * 0.002);
        camera.far = (layout.extent + sideDistance(fit())) * 4;
        // a pan slides the picture: the pixels the hands ask for, whatever the depth of the stars
        camera.setViewOffset(size.width, size.height, -current.panX, -current.panY, size.width, size.height);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        frame.across = spec.across;
        for (const mesh of axisMeshes) (mesh.material as InstanceType<Three["ShaderMaterial"]>).uniforms["uFade"]!.value = Math.max(0, Math.min(1, (spec.across - 0.12) / 0.4));
      };

      const styleFor = (): void => {
        const nowLight = input.light();
        if (nowLight === lastLight) return;
        lastLight = nowLight;
        const look = LOOKS[nowLight ? "light" : "night"];
        background.set(look.background);
        for (const mesh of [...allPoints, ...allLines]) (mesh.material as InstanceType<Three["ShaderMaterial"]>).uniforms["uLight"]!.value = nowLight ? 1 : 0;
        for (const mesh of allPoints) (mesh.material as InstanceType<Three["ShaderMaterial"]>).blending = nowLight ? T.NormalBlending : T.AdditiveBlending;
      };

      const project = (): void => {
        frame.points.length = 0;
        for (const { key: name, point } of anchorAt) {
          tmp.set(point[0], point[1], point[2]).applyMatrix4(camera.matrixWorldInverse);
          const visible = tmp.z < -camera.near * 1.01;
          place.copy(tmp).applyMatrix4(camera.projectionMatrix);
          frame.points.push({ key: name, x: (place.x * 0.5 + 0.5) * size.width, y: (-place.y * 0.5 + 0.5) * size.height, visible: visible && Math.abs(place.x) < 1.3 && Math.abs(place.y) < 1.3 });
        }
        frame.width = size.width;
        frame.height = size.height;
        input.onFrame(frame);
      };

      const wrap = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180;
      let rest = false;
      const result: SpaceScene = {
        scene,
        camera,
        info,
        get now() {
          return current;
        },
        pose(next, snap = false) {
          // the shortest way round for the angles
          target = { ...next, yaw: current.yaw + wrap(next.yaw - current.yaw), roll: current.roll + wrap(next.roll - current.roll) };
          rest = false;
          if (snap || input.still()) {
            current = { ...target };
            target = { ...target };
          }
          request();
        },
        restyle() {
          lastLight = undefined;
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
            rest = ["yaw", "tilt", "roll", "zoom", "panX", "panY"].every((name) => Math.abs((current as unknown as Record<string, number>)[name]! - (target as unknown as Record<string, number>)[name]!) < 1e-9);
          }
          styleFor();
          for (const mesh of allPoints) {
            const material = mesh.material as InstanceType<Three["ShaderMaterial"]>;
            material.uniforms["uScale"]!.value = 0.85 + 0.15 * Math.min(4, current.zoom);
            material.uniforms["uRatio"]!.value = pixelRatioFor(size.width, size.height, typeof devicePixelRatio === "number" ? devicePixelRatio : 1);
          }
          aim();
          project();
          // still easing: the next frame comes in 33 ms, not at the display's rate
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
      anchors.push(...anchorAt.map((one) => one.key));
      info.anchors = [...anchors];
      void frontTan;
      return result;
    },
  };
}
