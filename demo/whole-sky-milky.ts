// The Milky Way for the whole-sky map, as a soft picture made from the package's brightness numbers: for each pixel of the map the sky under it (`allSkyUnproject`) and the brightness there
// (`milkyWayBrightness`), coloured by a ramp. No photograph is read; the picture is made in the browser, once for each orientation, projection and look, and kept.
import { allSkyUnproject, type AllSkyFrame, type AllSkyProjection } from "../src/all-sky.ts";
import { milkyWayBrightness } from "../src/milky-way.ts";
import type { Look } from "./whole-sky-draw.ts";

type Stop = readonly [number, number, number, number, number];
/** Brightness, then red, green, blue and opacity. */
const RAMPS: Record<Look, readonly Stop[]> = {
  night: [[0, 0, 0, 0, 0], [0.08, 106, 128, 200, 0.1], [0.2, 122, 144, 210, 0.24], [0.4, 166, 182, 230, 0.4], [0.65, 232, 228, 232, 0.58], [1, 255, 243, 216, 0.88]],
  paper: [[0, 0, 0, 0, 0], [0.08, 120, 140, 200, 0.07], [0.2, 110, 130, 195, 0.16], [0.4, 90, 110, 180, 0.28], [0.65, 70, 90, 160, 0.4], [1, 50, 70, 140, 0.52]],
};

function colourAt(ramp: readonly Stop[], b: number): [number, number, number, number] {
  let i = 1;
  while (i < ramp.length - 1 && b > ramp[i]![0]) i += 1;
  const a = ramp[i - 1]!;
  const z = ramp[i]!;
  const t = Math.max(0, Math.min(1, (b - a[0]) / (z[0] - a[0])));
  return [a[1] + (z[1] - a[1]) * t, a[2] + (z[2] - a[2]) * t, a[3] + (z[3] - a[3]) * t, a[4] + (z[4] - a[4]) * t];
}

const made = new Map<string, string>();

/** The Milky Way as a PNG data address, `width` by `width / 2` pixels, clear outside the map's oval. */
export function milkyPicture(frame: AllSkyFrame, projection: AllSkyProjection, look: Look, width: number): string {
  const key = `${frame}|${projection}|${look}|${width}`;
  const found = made.get(key);
  if (found !== undefined) return found;
  const height = Math.round(width / 2);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(width, height);
  const ramp = RAMPS[look];
  const options = { width, frame, projection } as const;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sky = allSkyUnproject({ x: x + 0.5, y: y + 0.5 }, options);
      if (sky === undefined) continue;
      const [r, g, b, a] = colourAt(ramp, milkyWayBrightness(sky, { detail: 1 }));
      const at = (y * width + x) * 4;
      image.data[at] = r;
      image.data[at + 1] = g;
      image.data[at + 2] = b;
      image.data[at + 3] = a * 255;
    }
  }
  context.putImageData(image, 0, 0);
  const url = canvas.toDataURL("image/png");
  made.set(key, url);
  return url;
}
