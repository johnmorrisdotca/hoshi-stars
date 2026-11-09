// The last step of scripts/make-deep-sky-data.py: each deep-sky object's constellation is the IAU constellation its position is in, by the official boundaries
// (`constellationAt`), not Wikidata's "constellation" statement, which is wrong for a few (IC 2888 was given as Orion; it is in Leo). Rewrites the constellation
// column of src/data/messier.ts and src/data/ngc-ic.ts in place and says how many changed.
//
//     node scripts/deep-sky-constellations.ts
//     node scripts/deep-sky-constellations.ts --fallback    # the Messier fallback's data-no-sky-catalogue/messier.ts only (make-deep-sky-data.py --no-sky-catalogue)
import { readFileSync, writeFileSync } from "node:fs";
import { constellationAt } from "../src/boundaries.ts";

const RA = 4, DEC = 5, CONSTELLATION = 8;
let changed = 0;
const files = process.argv.includes("--fallback") ? ([["data-no-sky-catalogue/messier.ts", "MESSIER_ROWS"]] as const) : ([["src/data/messier.ts", "MESSIER_ROWS"], ["src/data/ngc-ic.ts", "NGC_IC_ROWS"]] as const);
for (const [file, constant] of files) {
  const path = new URL(`../${file}`, import.meta.url);
  const text = readFileSync(path, "utf8");
  const match = new RegExp(`${constant} = \`([\\s\\S]*?)\``).exec(text);
  if (match === null) throw new Error(`${constant} not found in ${file}`);
  const rows = match[1]!.split("\n").map((line) => {
    const fields = line.split("|");
    const at = constellationAt({ rightAscension: Number(fields[RA]) / 10000, declination: Number(fields[DEC]) / 10000 }).abbreviation;
    if (fields[CONSTELLATION] !== at) {
      console.log(`${file}: ${fields.slice(0, 3).join("|")} ${fields[CONSTELLATION] || "(none)"} -> ${at}`);
      fields[CONSTELLATION] = at;
      changed += 1;
    }
    return fields.join("|");
  });
  writeFileSync(path, text.replace(match[1]!, () => rows.join("\n")));
}
console.log(`constellations set from the IAU boundaries: ${changed} changed`);
