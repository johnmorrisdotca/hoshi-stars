// `node --import ./scripts/data-source-hook.mjs …` reads the fallback parallax tables in place of src/data/stars.ts and nearby.ts when scripts/data-source.mjs says so (HOSHI_NO_GCTP=1, or its default
// flipped), and does nothing otherwise. It is how the tests and the data export follow the same choice as the build and the demo.
import { register } from "node:module";
import { SWAPPED, noGctp } from "./data-source.mjs";

if (noGctp()) register("./data-source-loader.mjs", { parentURL: import.meta.url, data: { pairs: SWAPPED.map((one) => [one.shipped, one.fallback]) } });
