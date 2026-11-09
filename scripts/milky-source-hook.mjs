// `node --import ./scripts/milky-source-hook.mjs …` reads data-no-sao/milky-way.ts in place of src/data/milky-way.ts when `HOSHI_NO_SAO=1` (scripts/milky-source.mjs), and does nothing otherwise.
import { register } from "node:module";
import { MILKY_SWAPPED, noSao } from "./milky-source.mjs";

if (noSao()) register("./milky-source-loader.mjs", { parentURL: import.meta.url, data: { pairs: [[MILKY_SWAPPED.shipped, MILKY_SWAPPED.fallback]] } });
