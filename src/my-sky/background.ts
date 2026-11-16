// The colour of the sky and of the ground under each pixel of a view: the blue of day, the red and orange of the Sun low down, the dusk and the black-blue of a dark night above the horizon, and a dark ground below it that is not empty
// (it takes a little of the sky's colour at the horizon and darkens toward your feet). It fills a small picture of pixels (`cell` screen pixels each) that the element stretches over its canvas; the horizon itself is drawn crisp on top.
// Pure: it writes numbers into an array. No DOM.
import type { Direction } from "./frame.ts";
import { cameraAxes, viewScale, type SkyCamera } from "./view.ts";

type Colour = readonly [number, number, number];

/** The sky's colours at the zenith and at the horizon for the Sun at a given altitude, in key steps (degrees) that are blended between. */
const KEYS: ReadonlyArray<{ sun: number; zenith: Colour; horizon: Colour }> = [
  { sun: 12, zenith: [62, 124, 206], horizon: [158, 196, 238] },
  { sun: 0, zenith: [52, 92, 168], horizon: [212, 168, 140] },
  { sun: -6, zenith: [20, 34, 84], horizon: [104, 84, 112] },
  { sun: -12, zenith: [9, 15, 42], horizon: [34, 42, 82] },
  { sun: -18, zenith: [5, 8, 22], horizon: [14, 20, 44] },
];

function blend(a: Colour, b: Colour, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * The colours of the sky straight up and along the horizon when the Sun is at an altitude: bright blue by day, red-orange and violet round sunset, deep blue at the end of twilight and nearly black at night.
 *
 * @param sunAltitude - The Sun's altitude in degrees.
 * @returns `{ zenith, horizon }` as red, green and blue from 0 to 255.
 *
 * @example
 * ```ts
 * import { skyColours } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(skyColours(30).zenith[2] > 150, skyColours(-40).zenith[2] < 30); // true true
 * ```
 */
export function skyColours(sunAltitude: number): { zenith: [number, number, number]; horizon: [number, number, number] } {
  if (sunAltitude >= KEYS[0]!.sun) return { zenith: [...KEYS[0]!.zenith], horizon: [...KEYS[0]!.horizon] };
  const last = KEYS[KEYS.length - 1]!;
  if (sunAltitude <= last.sun) return { zenith: [...last.zenith], horizon: [...last.horizon] };
  for (let i = 0; i < KEYS.length - 1; i++) {
    const high = KEYS[i]!;
    const low = KEYS[i + 1]!;
    if (sunAltitude <= high.sun && sunAltitude >= low.sun) {
      const t = (high.sun - sunAltitude) / (high.sun - low.sun);
      return { zenith: blend(high.zenith, low.zenith, t), horizon: blend(high.horizon, low.horizon, t) };
    }
  }
  return { zenith: [...last.zenith], horizon: [...last.horizon] };
}

/**
 * Fill a small picture with the colour of what each pixel looks at: sky above the horizon, ground below it. The picture is `columns` by `rows` pixels, each standing for `cell` pixels of the view.
 *
 * @param data - The picture's pixels as `ImageData.data` (`columns * rows * 4` numbers).
 * @param columns - Pixels across.
 * @param rows - Pixels down.
 * @param cell - Screen pixels each picture pixel covers.
 * @param camera - The view.
 * @param sun - Where the Sun is: the altitude in degrees and its direction (east, north, up).
 *
 * @example
 * ```ts
 * import { paintBackground } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // looking level at the south on a night: the top row is sky (blue-black), the bottom row is ground (darker)
 * const camera = { heading: 180, pitch: 0, fov: 90, width: 40, height: 40 };
 * const data = new Uint8ClampedArray(40 * 40 * 4);
 * paintBackground(data, 40, 40, 1, camera, { altitude: -40, direction: { east: 0, north: 0, up: -0.64 } });
 * console.log(data[2]! > data[(39 * 40) * 4 + 2]!); // true
 * ```
 */
export function paintBackground(data: Uint8ClampedArray, columns: number, rows: number, cell: number, camera: SkyCamera, sun: { altitude: number; direction: Direction }): void {
  const axes = cameraAxes(camera.heading, camera.pitch);
  const scale = viewScale(camera);
  const colours = skyColours(sun.altitude);
  const f = axes.forward;
  const r = axes.right;
  const u = axes.up;
  // the Sun's warm glow low in the sky, strongest when it is on the horizon
  const glow = Math.max(0, 1 - Math.abs(sun.altitude - 1) / 14);
  const sd = sun.direction;
  const ground = { top: [colours.horizon[0] * 0.2 + 6, colours.horizon[1] * 0.2 + 7, colours.horizon[2] * 0.2 + 12], bottom: [3, 4, 8] };
  let i = 0;
  for (let row = 0; row < rows; row++) {
    const Y = (camera.height / 2 - (row + 0.5) * cell) / scale;
    for (let col = 0; col < columns; col++) {
      const X = ((col + 0.5) * cell - camera.width / 2) / scale;
      const rho2 = X * X + Y * Y;
      const depth = (4 - rho2) / (4 + rho2);
      const across = (4 * X) / (4 + rho2);
      const high = (4 * Y) / (4 + rho2);
      const up = depth * f.up + high * u.up;
      let red: number;
      let green: number;
      let blue: number;
      // a cell the horizon runs through is blended by how far over the line it is, so the edge is smooth
      const edge = (cell / scale) * 0.7;
      if (up >= -edge) {
        const altitude = Math.asin(Math.max(0, Math.min(1, up))) * (180 / Math.PI);
        const t = Math.exp(-altitude / 22);
        red = colours.zenith[0] + (colours.horizon[0] - colours.zenith[0]) * t;
        green = colours.zenith[1] + (colours.horizon[1] - colours.zenith[1]) * t;
        blue = colours.zenith[2] + (colours.horizon[2] - colours.zenith[2]) * t;
        if (glow > 0) {
          const east = depth * f.east + across * r.east + high * u.east;
          const north = depth * f.north + across * r.north + high * u.north;
          const cos = Math.max(-1, Math.min(1, east * sd.east + north * sd.north + up * sd.up));
          const away = Math.acos(cos) * (180 / Math.PI);
          const strength = glow * Math.exp(-((away / 32) ** 2)) * Math.exp(-altitude / 40) * 0.75;
          red += (255 - red) * strength;
          green += (140 - green) * strength * 0.8;
          blue += (60 - blue) * strength * 0.6;
        }
        if (up < edge) {
          const k = (up + edge) / (2 * edge);
          red = ground.top[0]! + (red - ground.top[0]!) * k;
          green = ground.top[1]! + (green - ground.top[1]!) * k;
          blue = ground.top[2]! + (blue - ground.top[2]!) * k;
        }
      } else {
        const t = Math.min(1, -Math.asin(Math.max(-1, up)) * (180 / Math.PI) / 30);
        red = ground.top[0]! + (ground.bottom[0]! - ground.top[0]!) * t;
        green = ground.top[1]! + (ground.bottom[1]! - ground.top[1]!) * t;
        blue = ground.top[2]! + (ground.bottom[2]! - ground.top[2]!) * t;
      }
      data[i] = red;
      data[i + 1] = green;
      data[i + 2] = blue;
      data[i + 3] = 255;
      i += 4;
    }
  }
}
