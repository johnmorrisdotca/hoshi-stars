// One star drawn in 3D from its numbers, through kazoku-ui's shared renderer: a ball (or, for a star with a measured shape, the spheroid interferometers measured, tipped and turned as they found it) in the colour of its
// temperature, darker toward the edge by its limb-darkening coefficient (the linear law, I(mu) = 1 - u(1 - mu), with u from Claret and Bloemen 2011 through `/profile`), darker at the equator of a fast spinner as its
// cooler equator is (the flux goes as the temperature to the fourth power), and covered in generic convection cells of the size its kind of star has. The cells are not this star's surface: the page says so.
// It turns as a globe does: the family's view controls keep the angle, which is the turn about the star's own axis (their Auto-turn spins it, a drag turns it by hand and the spin goes on from there), and the
// tilt and roll tip the whole star as seen. A guide that turns with it (a faint grid of latitude and longitude, and the spin axis through the poles) shows that it turns where its surface cannot. Nothing is
// drawn while the view is still.
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import { blackBodyColour } from "../src/colour.ts";
import type { PortraitLook } from "../src/portrait.ts";
import type { StarProfile } from "../src/profile.ts";
import type * as ThreeModule from "./three-subset.ts";

export type Three = typeof ThreeModule;

/** One turn of the drawn star takes this long: a pace to watch, not the star's own spin. */
export const TURN_SECONDS = 40;
/** The same as the view controls' auto-turn speed, in degrees a second. */
export const TURN_SPEED = 360 / TURN_SECONDS;

/** The cell spacing (as a share of the radius) and how bright a cell is over its lanes, by look; the same sizes the SVG portrait uses. */
const CELLS: Partial<Record<PortraitLook, { spacing: number; light: number }>> = {
  supergiant: { spacing: 0.56, light: 0.3 },
  giant: { spacing: 0.3, light: 0.27 },
  "sun-like": { spacing: 0.115, light: 0.28 },
  "red-dwarf": { spacing: 0.16, light: 0.24 },
};

/** What the scene draws, worked out from a profile and a look; `undefined` where the profile has no temperature. */
export interface StarLook {
  /** The equator's and the pole's colours (the same for a star with no measured shape). */
  equator: string;
  pole: string;
  /** The equator's brightness against the pole's, 0.45 to 1 (as the SVG portrait draws it). */
  equatorDim: number;
  /** The linear limb-darkening coefficient. */
  limb: number;
  /** The polar radius over the equatorial, 1 for a ball. */
  squash: number;
  /** The angle between the spin axis and the line of sight, and the axis's direction on the sky from north through east, in degrees. */
  inclination: number;
  positionAngle: number;
  /** The cell spacing as a share of the radius and their brightness, or `undefined` for a smooth star. */
  cells: { spacing: number; light: number } | undefined;
}

export function starLook(profile: StarProfile, look: PortraitLook | undefined): StarLook | undefined {
  const T = profile.temperature?.value;
  if (T === undefined || look === undefined) return undefined;
  const shape = profile.shape;
  const limb = profile.limbDarkening ?? 0.6;
  if (shape === undefined) return { equator: blackBodyColour(T), pole: blackBodyColour(T), equatorDim: 1, limb, squash: 1, inclination: 90, positionAngle: 0, cells: CELLS[look] };
  return {
    equator: blackBodyColour(shape.equatorialTemperatureK),
    pole: blackBodyColour(shape.polarTemperatureK),
    equatorDim: 1 - Math.min(0.55, 1 - (shape.equatorialTemperatureK / shape.polarTemperatureK) ** 4),
    limb,
    squash: shape.polarRadius / shape.equatorialRadius,
    inclination: shape.inclinationDegrees,
    positionAngle: shape.positionAngleDegrees,
    cells: undefined,
  };
}

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

const VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Cellular noise on the star's own surface, so the cells turn with it and foreshorten toward the edge as a sphere's do: the gap between the nearest and the second-nearest of one jittered point per unit cell is small
// only along the borders, which are the thin dark lanes where cooler gas sinks between bright cells.
const FRAGMENT = /* glsl */ `
uniform vec3 uEquator;
uniform vec3 uPole;
uniform float uEquatorDim;
uniform float uLimb;
uniform float uCells;
uniform float uLight;
uniform float uSeed;
uniform float uGuide;
varying vec3 vNormal;
varying vec3 vLocal;
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p + uSeed) * 43758.5453);
}
float lane(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float first = 8.0;
  float second = 8.0;
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
      for (int z = -1; z <= 1; z++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 d = g + hash3(i + g) - f;
        float r = dot(d, d);
        if (r < first) {
          second = first;
          first = r;
        } else second = min(second, r);
      }
  return sqrt(second) - sqrt(first);
}
void main() {
  float mu = clamp(normalize(vNormal).z, 0.0, 1.0);
  float limb = 1.0 - uLimb * (1.0 - mu);
  vec3 local = normalize(vLocal);
  float lat = local.y * local.y;
  vec3 colour = mix(uEquator * uEquatorDim, uPole, lat);
  float grain = 1.0;
  if (uCells > 0.0) {
    float d = lane(local / uCells);
    grain = mix(1.0 - 1.2 * uLight, 1.0 + 0.1 * uLight, smoothstep(0.0, 0.28, d)) * (1.0 + 0.35 * uLight * smoothstep(0.2, 0.7, d));
  }
  // The guide: a line every 30 degrees of latitude and longitude, kept one pixel wide by the screen-space rate of change, the equator a little stronger.
  float guide = 0.0;
  if (uGuide > 0.0) {
    float lat = degrees(asin(clamp(local.y, -1.0, 1.0)));
    float lon = degrees(atan(local.z, local.x));
    vec2 at = vec2(lat, lon) / 30.0;
    vec2 near = abs(fract(at - 0.5) - 0.5) / max(fwidth(at), vec2(1e-4));
    float line = 1.0 - min(min(near.x, near.y), 1.0);
    float equator = 1.0 - min(abs(lat) / max(fwidth(lat), 1e-4), 1.0);
    guide = uGuide * max(line * 0.32, equator * 0.5) * smoothstep(0.98, 0.9, abs(local.y));
  }
  gl_FragColor = vec4(colour * limb * grain * (1.0 - guide), 1.0);
}`;

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];

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
      const geometry = new T.SphereGeometry(1, 128, 96);
      const material = new T.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uEquator: { value: new T.Vector3(...rgb(look.equator)) },
          uPole: { value: new T.Vector3(...rgb(look.pole)) },
          uEquatorDim: { value: look.equatorDim },
          uLimb: { value: look.limb },
          uCells: { value: look.cells?.spacing ?? 0 },
          uLight: { value: look.cells?.light ?? 0 },
          uSeed: { value: (input.seed % 997) * 0.731 },
          uGuide: { value: 0 },
        },
      });
      const body = new T.Mesh(geometry, material);
      body.scale.set(1, look.squash, 1);
      // The spin axis is the body's y. Tip it toward the viewer until it is `inclination` from the line of sight, then turn it on the sky by the position angle (north up, east to the left).
      const axis = new T.Group();
      axis.rotation.order = "ZXY";
      axis.rotation.z = (look.positionAngle * Math.PI) / 180;
      axis.rotation.x = ((90 - look.inclination) * Math.PI) / 180;
      axis.add(body);
      // The spin axis, through the poles and out past them; the star hides the half behind it.
      const reach = 1.32 * look.squash + 0.2;
      const axisGeometry = new T.BufferGeometry();
      axisGeometry.setAttribute("position", new T.BufferAttribute(new Float32Array([0, -reach, 0, 0, reach, 0]), 3));
      const axisMaterial = new T.LineBasicMaterial({ color: 0xc8d4e6, transparent: true, opacity: 0.75 });
      const axisLine = new T.LineSegments(axisGeometry, axisMaterial);
      axis.add(axisLine);
      // The reader's turn and tip, around the star's own tilt on the sky.
      const held = new T.Group();
      held.add(axis);
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
          geometry.dispose();
          material.dispose();
          axisGeometry.dispose();
          axisMaterial.dispose();
        },
      };
    },
  };
}
