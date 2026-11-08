// Gives every star of src/data/stars.ts its constellation: the catalogue's own for a star with a Bayer letter or a Flamsteed number (checked here against the boundaries), and the boundaries' for
// the rest, which have none in the catalogue. Run after scripts/make-star-data.py, which writes an empty constellation for those stars:
//
//     python3 -I scripts/make-star-data.py && node scripts/set-star-constellations.ts
//
// It is not part of the test or the build; test/stars.test.ts holds the result to the boundaries.
import { readFileSync, writeFileSync } from "node:fs";
import { constellationAt } from "../src/boundaries.ts";

const file = new URL("../src/data/stars.ts", import.meta.url);
const text = readFileSync(file, "utf8");
const start = text.indexOf("STAR_ROWS = `") + "STAR_ROWS = `".length;
const end = text.indexOf("`;", start);
let filled = 0;
const rows = text
  .slice(start, end)
  .split("\n")
  .map((row) => {
    const p = row.split("|");
    const found = constellationAt({ rightAscension: Number(p[4]) / 2400, declination: Number(p[5]) / 3600 }).abbreviation;
    if (p[3] !== "" && p[3] !== found) throw new Error(`HR ${p[0]} is ${p[3]} in the catalogue and ${found} by the boundaries`);
    if (p[3] === "") filled += 1;
    p[3] = found;
    return p.join("|");
  });
writeFileSync(file, text.slice(0, start) + rows.join("\n") + text.slice(end));
console.log(`${filled} stars given a constellation from the boundaries; ${rows.length - filled} have the catalogue's`);
