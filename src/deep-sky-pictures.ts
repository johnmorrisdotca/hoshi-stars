// Pictures of deep-sky objects and where each lies on the sky. The deep-sky pictures tier (`@johnmorrisdotca/hoshi-stars/deep-sky/pictures`): the index only (about 8 kB gzipped). The picture files
// (about 10 MB in all) are NOT in the npm package: they are served from the demo site (https://johnmorrisdotca.github.io/hoshi-stars/pictures/) and fetched only by a page that draws them; a page that
// wants them from its own server copies the repository's `pictures/` folder there and passes that address to `pictureUrl`. Pure: no DOM, no clock, no state beyond the parsed table.
import { PICTURE_ROWS, PICTURE_SOURCES } from "./data/deep-sky-pictures.ts";
import { offsetOnSky } from "./deep-sky-shape-core.ts";
import type { SkyPoint } from "./projection.ts";

/**
 * Where a picture comes from: the survey, how its colours are made, who is credited and the licence it is used under. The same words are in `NOTICE.md`.
 *
 * @example
 * ```ts
 * import { deepSkyPicture, type PictureSource } from "@johnmorrisdotca/hoshi-stars/deep-sky/pictures";
 *
 * const source: PictureSource = deepSkyPicture("M51")!.source;
 * console.log(source.name, source.credit);
 * ```
 */
export interface PictureSource {
  /** The survey and its bands (`SDSS g, r, i`). */
  name: string;
  /** How the colours are made (`near-infrared, false colour (J, H, K as blue, green, red), stretched`). */
  colour: string;
  /** Who is credited. */
  credit: string;
  /** The licence the survey's data is used under. */
  licence: string;
  /** The survey's own page. */
  page: string;
}

/**
 * A picture of one deep-sky object. It is a tangent-plane image about its centre with north at the top and east on the left (the way sky photographs are), turned by `rotation`, so its place on
 * the sky is exact and `pictureCorners` gives its corners.
 *
 * @example
 * ```ts
 * import { deepSkyPicture, type DeepSkyPicture } from "@johnmorrisdotca/hoshi-stars/deep-sky/pictures";
 *
 * const picture: DeepSkyPicture = deepSkyPicture("M31")!;
 * console.log(picture.file, picture.width, picture.arcsecPerPixel);
 * ```
 */
export interface DeepSkyPicture {
  /** The picture's own id: the object's id (`M31`) for the survey picture, which is the widest view, and the object's id and the release (`M51-heic0506a`) for a finer picture of part of it. Unique. */
  id: string;
  /** The id of the deep-sky object the picture shows (`M31`), the same as `DeepSkyObject.id`. */
  object: string;
  /** The file's path under the folder the pictures are served from, `pictures/M31.webp` (the files are in the repository's `pictures/` and on the demo site, not in the npm package); it is a WebP image with transparency, so laid over a dark sky it adds light and no rectangle. */
  file: string;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** The sky point at the middle of the picture (J2000, degrees). */
  centre: SkyPoint;
  /** The angular size of a pixel in arc-seconds. */
  arcsecPerPixel: number;
  /** Degrees the picture's top is turned from north toward east; 0 for north up. */
  rotation: number;
  /** Where the picture comes from. */
  source: PictureSource;
  /** The credit line for this picture: the survey's, or the release's own for a picture from a space agency. */
  credit: string;
  /** Where the picture was read from: the SkyView address the first band was cut from (the one that says exactly what was asked), or the page of the release. */
  address: string;
}

function build(): DeepSkyPicture[] {
  return PICTURE_ROWS.split("\n").map((row) => {
    const p = row.split("|") as [string, string, string, string, string, string, string, string, string, string, string];
    const source = PICTURE_SOURCES[Number(p[8])] as PictureSource;
    return Object.freeze({
      id: p[0],
      object: p[1],
      file: `pictures/${p[0].replace(" ", "-")}.webp`,
      width: Number(p[4]),
      height: Number(p[5]),
      centre: Object.freeze({ rightAscension: Number(p[2]) / 100000, declination: Number(p[3]) / 100000 }),
      arcsecPerPixel: Number(p[6]) / 100,
      rotation: Number(p[7]) / 10,
      source,
      credit: p[10] === "" ? source.credit : p[10],
      address: p[9].replace(/%7C/g, "|"),
    });
  });
}

let list: DeepSkyPicture[] | undefined;
let byKey: Map<string, DeepSkyPicture[]> | undefined;
const key = (text: string): string => text.replace(/\s+/g, "").toUpperCase().replace(/^MESSIER/, "M");

function load(): void {
  if (list !== undefined) return;
  list = build();
  byKey = new Map();
  for (const picture of list) {
    const k = key(picture.object);
    byKey.set(k, [...(byKey.get(k) ?? []), picture]);
  }
}

/**
 * Every picture the package has: the survey pictures, the Messier objects first in Messier order and then the brighter NGC and IC objects, and then the finer pictures of part of an object.
 *
 * @returns A fresh array of the shared, frozen pictures.
 *
 * @example
 * ```ts
 * import { deepSkyPictures } from "@johnmorrisdotca/hoshi-stars/deep-sky/pictures";
 *
 * console.log(deepSkyPictures().length, deepSkyPictures()[0]?.id);
 * ```
 */
export function deepSkyPictures(): DeepSkyPicture[] {
  load();
  return [...list!];
}

/**
 * The widest picture of an object by its designation (`M31`, `m 31`, `Messier 31`, `NGC 7000`), ignoring case and spacing: the survey picture, which shows the whole object and the sky round it. It is
 * found by the object's own id: `NGC 224` finds nothing, because the picture is filed as `M31`. For the finer pictures of part of an object, use `deepSkyPicturesOf`.
 *
 * @param text - The object's id.
 * @returns The picture, or `undefined` where the object has none.
 * @throws TypeError if `text` is not a string.
 *
 * @example
 * ```ts
 * import { deepSkyPicture } from "@johnmorrisdotca/hoshi-stars/deep-sky/pictures";
 *
 * console.log(deepSkyPicture("M 42")?.source.name, deepSkyPicture("M40")?.file);
 * ```
 */
export function deepSkyPicture(text: string): DeepSkyPicture | undefined {
  if (typeof text !== "string") throw new TypeError(`text must be a string, got ${typeof text}`);
  load();
  return byKey!.get(key(text))?.[0];
}

/**
 * Every picture of an object, the widest first and the finest last: draw them in that order and each finer one lies over the part of the coarser one it shows better. Found like `deepSkyPicture`.
 *
 * @param text - The object's id.
 * @returns A fresh array of the shared, frozen pictures: empty where the object has none.
 * @throws TypeError if `text` is not a string.
 *
 * @example
 * ```ts
 * import { deepSkyPicturesOf } from "@johnmorrisdotca/hoshi-stars/deep-sky/pictures";
 *
 * console.log(deepSkyPicturesOf("M51").map((picture) => picture.id));
 * ```
 */
export function deepSkyPicturesOf(text: string): DeepSkyPicture[] {
  if (typeof text !== "string") throw new TypeError(`text must be a string, got ${typeof text}`);
  load();
  return [...(byKey!.get(key(text)) ?? [])].sort((a, b) => b.arcsecPerPixel - a.arcsecPerPixel);
}

/**
 * The four corners of a picture on the sky, from the top left round to the bottom left, as the tangent plane about its centre puts them (the way the survey cut it). A map in any projection can
 * lay the picture by pinning three of them.
 *
 * @param picture - A picture.
 * @returns The corners: top left, top right, bottom right, bottom left, each a sky point in degrees.
 *
 * @example
 * ```ts
 * import { deepSkyPicture, pictureCorners } from "@johnmorrisdotca/hoshi-stars/deep-sky/pictures";
 *
 * console.log(pictureCorners(deepSkyPicture("M31")!)[0]);
 * ```
 */
export function pictureCorners(picture: DeepSkyPicture): [SkyPoint, SkyPoint, SkyPoint, SkyPoint] {
  const rho = (picture.rotation * Math.PI) / 180;
  const up: [number, number] = [Math.sin(rho), Math.cos(rho)];
  const right: [number, number] = [-Math.cos(rho), Math.sin(rho)];
  const halfWide = (picture.width * picture.arcsecPerPixel) / 120;
  const halfHigh = (picture.height * picture.arcsecPerPixel) / 120;
  const at = (sx: number, sy: number): SkyPoint => offsetOnSky(picture.centre, sx * halfWide * right[0] + sy * halfHigh * up[0], sx * halfWide * right[1] + sy * halfHigh * up[1]);
  return [at(-1, 1), at(1, 1), at(1, -1), at(-1, -1)];
}

/**
 * Where the pictures are served from by default: the demo site of this package. The files are not in the npm package.
 *
 * @example
 * ```ts
 * import { PICTURES_BASE } from "@johnmorrisdotca/hoshi-stars/deep-sky/pictures";
 *
 * console.log(PICTURES_BASE);
 * ```
 */
export const PICTURES_BASE = "https://johnmorrisdotca.github.io/hoshi-stars/";

/**
 * The address of a picture's file: under the demo site by default, or under a folder of your own that holds a copy of the repository's `pictures/` (with or without a closing slash).
 *
 * @param picture - A picture.
 * @param base - The address the `pictures/` folder's parent is served from (`./`, `https://example.org/sky/`); left out, `PICTURES_BASE`.
 * @returns The file's address.
 *
 * @example
 * ```ts
 * import { deepSkyPicture, pictureUrl } from "@johnmorrisdotca/hoshi-stars/deep-sky/pictures";
 *
 * console.log(pictureUrl(deepSkyPicture("M31")!));
 * console.log(pictureUrl(deepSkyPicture("M31")!, "https://example.org/sky"));
 * ```
 */
export function pictureUrl(picture: DeepSkyPicture, base: string = PICTURES_BASE): string {
  return `${base.replace(/\/*$/, "/")}${picture.file}`;
}
