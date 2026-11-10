// Draws the 88 constellation pictures into files: an SVG a look, and a PNG a look and a size, rendered from the SVG by resvg (no browser). The drawing itself is src/thumbnails.ts.
//   <dir>/svg/<light|dark>/<abbreviation>.svg
//   <dir>/png/<size>/<light|dark>/<abbreviation>.png
// The pictures of a sky culture's own figures (the Chinese asterisms, the traditional Japanese figures) are made the same way by `writeCultureThumbnails`, into the Pages build only: the npm package ships the 88.
//   <dir>/<culture>/png/<size>/<light|dark>/<figure id>.png
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { constellations } from "../src/constellations.ts";
import type { Culture } from "../src/culture.ts";
import { figures, type CultureFigure } from "../src/lines.ts";
import { constellationThumbnail, thumbnailSvg, type ThumbnailTheme } from "../src/thumbnails.ts";

export const THEMES: readonly ThumbnailTheme[] = ["light", "dark"];
/** The PNG sizes: a picker tile, a card, and a print or share picture. */
export const SIZES = [160, 480, 1200] as const;
/** The size an SVG file is given in its width and height; the viewBox scales it to any other. */
export const SVG_SIZE = 480;

/** Writes the pictures and returns how many files. `sizes` are the PNG sizes to make (none for the SVGs alone). */
export function writeThumbnails(dir: string, sizes: readonly number[] = SIZES): number {
  let count = 0;
  for (const theme of THEMES) {
    mkdirSync(join(dir, "svg", theme), { recursive: true });
    for (const size of sizes) mkdirSync(join(dir, "png", String(size), theme), { recursive: true });
    for (const c of constellations()) {
      const svg = constellationThumbnail(c.abbreviation, { theme, size: SVG_SIZE });
      writeFileSync(join(dir, "svg", theme, `${c.abbreviation}.svg`), svg);
      count += 1;
      for (const size of sizes) {
        writeFileSync(join(dir, "png", String(size), theme, `${c.abbreviation}.png`), new Resvg(svg, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: false } }).render().asPng());
        count += 1;
      }
    }
  }
  return count;
}

/** The PNG sizes of a culture's pictures: a strip card, and a gallery card (the gallery shows them 240 pixels wide). */
export const CULTURE_SIZES = [160, 480] as const;

/** The figures of a culture that have a picture of their own: all of the Chinese figures, and the Japanese ones that are not one of the 88 (those use the constellation's picture). Nothing for the Western sky. */
export const ownPictureFigures = (culture: Culture): CultureFigure[] => (culture.id === "western" ? [] : figures(culture).filter((figure) => figure.asterism.kind !== "constellation"));

/** The picture of one figure of a sky culture: its stars full and every other star near it faint, no boundary, and the lines our own joins of its stars. */
export function figureThumbnailSvg(figure: CultureFigure, culture: Culture, theme: ThumbnailTheme): string {
  const a = figure.asterism;
  const mine = new Set(figure.stars.map((star) => star.hr));
  const reading = a.readings.zh ?? a.readings.ja;
  return thumbnailSvg(
    {
      title: `${a.name}${reading === undefined ? "" : ` (${reading})`}, a figure of the ${culture.names.en.split(" (")[0]} sky, with our own joins of its stars`,
      outlines: [],
      frame: figure.stars,
      segments: figure.segments,
      owns: (star) => mine.has(star.hr),
    },
    { theme, size: SVG_SIZE },
  );
}

/** Writes a culture's own pictures as PNGs (no SVG: they are for the Pages build) and returns how many files. */
export function writeCultureThumbnails(dir: string, culture: Culture, sizes: readonly number[] = CULTURE_SIZES): number {
  let count = 0;
  const list = ownPictureFigures(culture);
  for (const theme of THEMES) {
    for (const size of sizes) mkdirSync(join(dir, culture.id, "png", String(size), theme), { recursive: true });
    for (const figure of list) {
      const svg = figureThumbnailSvg(figure, culture, theme);
      for (const size of sizes) {
        writeFileSync(join(dir, culture.id, "png", String(size), theme, `${figure.asterism.id}.png`), new Resvg(svg, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: false } }).render().asPng());
        count += 1;
      }
    }
  }
  return count;
}
