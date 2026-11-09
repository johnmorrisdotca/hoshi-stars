// `pnpm thumbnails [dir] [sizes]`: the constellation pictures, made into ./thumbnails (the folder the npm package ships) as SVG and as PNG at 160 pixels. `sizes` is a comma list (default 160); the Pages
// build (site.ts) makes 160, 480 and 1200 into site/thumbnails.
import { resolve } from "node:path";
import process from "node:process";
import { writeThumbnails } from "./thumbnail-files.ts";

const dir = resolve(process.argv[2] ?? "thumbnails");
const sizes = (process.argv[3] ?? "160").split(",").filter((size) => size !== "").map(Number);
console.log(`${writeThumbnails(dir, sizes)} pictures in ${dir}`);
