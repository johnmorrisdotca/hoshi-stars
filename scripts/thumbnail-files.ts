// Draws the 88 constellation pictures into files: an SVG a look, and a PNG a look and a size, rendered from the SVG by resvg (no browser). The drawing itself is src/thumbnails.ts.
//   <dir>/svg/<light|dark>/<abbreviation>.svg
//   <dir>/png/<size>/<light|dark>/<abbreviation>.png
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { constellations } from "../src/constellations.ts";
import { constellationThumbnail, type ThumbnailTheme } from "../src/thumbnails.ts";

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
