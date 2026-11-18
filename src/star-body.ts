// A star's ball drawn from its numbers, as three.js objects: a ball (or, for a star with a measured shape, the spheroid interferometers measured, tipped and turned as they found it) in the colour of its temperature,
// darker toward the edge by its limb-darkening coefficient (the linear law, I(mu) = 1 - u(1 - mu), with u from Claret and Bloemen 2011 through `/profile`), darker at the equator of a fast spinner as its cooler equator is
// (the flux goes as the temperature to the fourth power), and covered in generic convection cells of the size its kind of star has. The cells are not this star's surface. The flight's ball and the demo's star pages share it.
import type * as THREE from "three";
import { blackBodyColour } from "./colour.ts";
import type { PortraitLook } from "./portrait.ts";
import type { StarProfile } from "./profile.ts";

/** The parts of three.js the ball is made of. */
export type BodyThree = Pick<typeof THREE, "BufferAttribute" | "BufferGeometry" | "Group" | "LineBasicMaterial" | "LineSegments" | "Mesh" | "ShaderMaterial" | "SphereGeometry" | "Vector3">;

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

/** The star's body, made from a look: the ball (or spheroid) with its shader, tipped as its axis is, ready to add to a scene. Let it go with `dispose`. */
export interface StarBody {
  /** The group to add to a scene; its scale is the star's radius (1 for the unit ball). */
  readonly group: InstanceType<BodyThree["Group"]>;
  /** The ball itself, which the reader's turn rotates about its own axis. */
  readonly ball: InstanceType<BodyThree["Mesh"]>;
  readonly material: InstanceType<BodyThree["ShaderMaterial"]>;
  /** The spin axis and its poles, a line the guide shows. */
  readonly axisLine: InstanceType<BodyThree["LineSegments"]>;
  dispose(): void;
}

/** Make the body: the same ball the star's own page draws and the constellation's close-up draws, so there is one look. `segments` is the sphere's detail (128 by 96 for a full-size star, fewer for a small one). */
export function starBody(T: BodyThree, look: StarLook, seed: number, segments: [number, number] = [128, 96]): StarBody {
  const geometry = new T.SphereGeometry(1, segments[0], segments[1]);
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
      uSeed: { value: (seed % 997) * 0.731 },
      uGuide: { value: 0 },
    },
  });
  const ball = new T.Mesh(geometry, material);
  ball.scale.set(1, look.squash, 1);
  // The spin axis is the body's y. Tip it toward the viewer until it is `inclination` from the line of sight, then turn it on the sky by the position angle (north up, east to the left).
  const group = new T.Group();
  group.rotation.order = "ZXY";
  group.rotation.z = (look.positionAngle * Math.PI) / 180;
  group.rotation.x = ((90 - look.inclination) * Math.PI) / 180;
  group.add(ball);
  // The spin axis, through the poles and out past them; the star hides the half behind it.
  const reach = 1.32 * look.squash + 0.2;
  const axisGeometry = new T.BufferGeometry();
  axisGeometry.setAttribute("position", new T.BufferAttribute(new Float32Array([0, -reach, 0, 0, reach, 0]), 3));
  const axisMaterial = new T.LineBasicMaterial({ color: 0xc8d4e6, transparent: true, opacity: 0.75 });
  const axisLine = new T.LineSegments(axisGeometry, axisMaterial);
  group.add(axisLine);
  return {
    group,
    ball,
    material,
    axisLine,
    dispose() {
      geometry.dispose();
      material.dispose();
      axisGeometry.dispose();
      axisMaterial.dispose();
    },
  };
}
