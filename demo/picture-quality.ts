// Which of the package's deep-sky pictures the demo draws. Every picture was looked at on the map, at the zoom where it first shows and at its cap, and the ones below were left out: their survey tile has
// a hard edge, a seam, a box of a different background or a hole where the survey has no data, which on the map reads as a broken picture, not as sky. An object without a picture is drawn as its outline
// alone, which is true. The files and the package's index are untouched: this is the demo's choice, and a page that draws the pictures itself can make its own.
import { deepSkyPictures, type DeepSkyPicture } from "../src/deep-sky-pictures.ts";

/** The survey pictures the demo leaves out, with what is wrong with each. */
export const LEFT_OUT: Readonly<Record<string, string>> = {
  M8: "a box of speckle noise with hard edges",
  M16: "a crude block of red clipped square at its corner",
  M17: "a box of speckle noise with hard edges",
  M20: "pure noise on one half, with a hard tile edge down the middle",
  M33: "pink strips with hard edges where survey tiles join",
  M110: "a pink wedge with holes where the survey has no data",
  "NGC 1316": "a speckled box",
  "NGC 2403": "a hard seam and a faint rectangle across the sky",
  "NGC 3242": "a speckled box",
  "NGC 5139": "pale green rectangles where the survey has no data",
  "NGC 7009": "a box of speckle noise",
};

/** The finer pictures that are shown with no survey picture under them: this one is most of its object. A finer picture of a small part of an object is a detail, drawn only over the wider picture, never alone as a lone tile. */
const STANDS_ALONE: ReadonlySet<string> = new Set(["M16-heic1501a"]);

let kept: DeepSkyPicture[] | undefined;

/** The pictures the demo draws: all of the package's but the ones left out, and the finer pictures whose wide picture is left out or missing, unless one stands alone. */
export function drawnPictures(): readonly DeepSkyPicture[] {
  if (kept !== undefined) return kept;
  const all = deepSkyPictures();
  const wide = new Set(all.filter((p) => p.id === p.object && LEFT_OUT[p.object] === undefined).map((p) => p.object));
  kept = all.filter((p) => (p.id === p.object ? LEFT_OUT[p.id] === undefined : wide.has(p.object) || STANDS_ALONE.has(p.id)));
  return kept;
}
