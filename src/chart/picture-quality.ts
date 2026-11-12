// Which of the package's deep-sky pictures the demo draws. Every picture was looked at on the map, at the zoom where it first shows and at its cap, and the ones below were left out: their survey tile has
// a hard edge, a seam, a box of a different background or a hole where the survey has no data, which on the map reads as a broken picture, not as sky. An object without a picture is drawn as its outline
// alone, which is true. The files and the package's index are untouched: this is the demo's choice, and a page that draws the pictures itself can make its own.
import { deepSkyPictures, type DeepSkyPicture } from "../deep-sky-pictures.ts";

/**
 * The survey pictures the demo leaves out, with what is wrong with each. Nine that were here are now natural-colour photographs (M8, M16, M17, M20, M33, M110, NGC 1316, NGC 2403 and NGC 5139) and are drawn;
 * the two planetary nebulae have no clearly licensed photograph that is natural colour and can be placed (the nearest are two narrow filters in false colour, a black-and-white picture and a small Hubble gallery tile with no position).
 */
export const LEFT_OUT: Readonly<Record<string, string>> = {
  "NGC 3242": "a speckled box",
  "NGC 7009": "a box of speckle noise",
};

let kept: DeepSkyPicture[] | undefined;

/** The pictures the demo draws: all of the package's but the ones left out, and the finer pictures whose wide picture is left out or missing (a finer picture of a small part of an object is a detail, never drawn alone as a lone tile). */
export function drawnPictures(): readonly DeepSkyPicture[] {
  if (kept !== undefined) return kept;
  const all = deepSkyPictures();
  const wide = new Set(all.filter((p) => p.id === p.object && LEFT_OUT[p.object] === undefined).map((p) => p.object));
  kept = all.filter((p) => (p.id === p.object ? LEFT_OUT[p.id] === undefined : wide.has(p.object)));
  return kept;
}
