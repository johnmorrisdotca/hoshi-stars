// Where the sky out to a distance goes in space: every certain thing at its direction and its distance, every uncertain thing as a streak along its line of sight over the range its error allows, and the shells at 10, 50, 100, 500 and 1,000 light-years.
// Numbers only (no three.js, no DOM), so it can be tested. Out to 1,000 light-years the scale is true and linear; beyond, the distances are compressed (each decade the same step) and the page says so.
import { DISTANCE_LIMITS, type DistanceLayers } from "../src/distance.ts";

export interface LayersLayout {
  /** `linear` out to 1,000 light-years; `log` beyond, where each ring is ten times the one inside. */
  scale: "linear" | "log";
  /** The light-years at the edge of the scene (radius 1). */
  edge: number;
  /** A distance in light-years as a radius in the scene, 0 to 1. */
  radial(lightYears: number): number;
  /** The shells to draw: a distance and its radius. */
  shells: Array<{ lightYears: number; radius: number }>;
  /** The certain things: three numbers each (x, y, z at radius), the band, a size in pixels and 1 for a galaxy, 0 for a star. */
  dots: { count: number; positions: Float32Array; bands: Uint8Array; sizes: Float32Array; kinds: Uint8Array };
  /** The uncertain things: where each streak starts and ends (the nearest and the farthest its error allows, cut at the edge), three numbers each. */
  streaks: { count: number; near: Float32Array; far: Float32Array };
}

/** The tangent of nothing: a unit vector in J2000 equatorial axes, x toward right ascension 0, y toward 6 hours, z toward the north celestial pole. */
export function direction(rightAscension: number, declination: number): [number, number, number] {
  const ra = (rightAscension * Math.PI) / 180;
  const dec = (declination * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** The size in pixels of a thing's dot: bigger for a brighter star, never under 4. */
export const dotSize = (magnitude: number | undefined, galaxy: boolean): number => (galaxy ? 9 : Math.max(4, Math.min(16, 6.5 + (5.5 - (magnitude ?? 9)) * 1.1)));

/** How far the scene reaches in light-years for these layers: the limit out to 1,000, else a little past the farthest certain thing. */
export function edgeOf(layers: DistanceLayers): number {
  if (layers.limit <= DISTANCE_LIMITS[DISTANCE_LIMITS.length - 1]!) return layers.limit;
  const farthest = layers.things.reduce((most, thing) => (thing.uncertain ? most : Math.max(most, thing.lightYears)), 1000);
  return Math.min(layers.limit, 10 ** Math.ceil(Math.log10(farthest * 1.05)));
}

const LOG_FROM = 3;
const LOG_INNER = 0.05;

/**
 * The layout for layers.
 *
 * @param layers - From `layersByDistance`.
 * @returns The layout.
 */
export function layoutLayers(layers: DistanceLayers): LayersLayout {
  const edge = edgeOf(layers);
  const scale = layers.limit <= DISTANCE_LIMITS[DISTANCE_LIMITS.length - 1]! ? "linear" : "log";
  const radial = (lightYears: number): number => {
    if (scale === "linear") return Math.max(0, Math.min(1, lightYears / edge));
    if (lightYears <= LOG_FROM) return Math.max(0, (lightYears / LOG_FROM) * LOG_INNER);
    return Math.min(1, LOG_INNER + (1 - LOG_INNER) * (Math.log(lightYears / LOG_FROM) / Math.log(edge / LOG_FROM)));
  };
  const shellsAt: number[] = scale === "linear" ? DISTANCE_LIMITS.filter((ly) => ly <= edge) : Array.from({ length: Math.floor(Math.log10(edge)) }, (_, i) => 10 ** (i + 1));
  const certain = layers.things.filter((thing) => !thing.uncertain);
  const streaky = layers.things.filter((thing) => thing.uncertain);
  const dots = { count: certain.length, positions: new Float32Array(certain.length * 3), bands: new Uint8Array(certain.length), sizes: new Float32Array(certain.length), kinds: new Uint8Array(certain.length) };
  certain.forEach((thing, i) => {
    const [x, y, z] = direction(thing.rightAscension, thing.declination);
    const r = radial(thing.lightYears);
    dots.positions.set([x * r, y * r, z * r], i * 3);
    dots.bands[i] = thing.band;
    dots.sizes[i] = dotSize(thing.magnitude, thing.kind === "deep-sky");
    dots.kinds[i] = thing.kind === "deep-sky" ? 1 : 0;
  });
  const streaks = { count: streaky.length, near: new Float32Array(streaky.length * 3), far: new Float32Array(streaky.length * 3) };
  streaky.forEach((thing, i) => {
    const [x, y, z] = direction(thing.rightAscension, thing.declination);
    const near = radial(Math.min(thing.low, edge));
    const far = radial(Math.min(thing.high, edge));
    streaks.near.set([x * near, y * near, z * near], i * 3);
    streaks.far.set([x * far, y * far, z * far], i * 3);
  });
  return { scale, edge, radial, shells: shellsAt.map((lightYears) => ({ lightYears, radius: radial(lightYears) })), dots, streaks };
}
