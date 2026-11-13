import { findName, nameRowById, nameRows } from "@johnmorrisdotca/hoshi-stars/names";
import { findNgcIc } from "@johnmorrisdotca/hoshi-stars/names/ngc-ic";

const star = findName("alpha Ori");
console.log(star.id, star.name.en, star.name.ja, star.pick);

const galaxy = nameRowById("m31");
console.log(galaxy.id, galaxy.name.en, galaxy.kind, galaxy.pick);

const nebula = findNgcIc("North America Nebula");
console.log(nebula.id, nebula.name.en, nebula.kind);

const rows = nameRows();
console.log(`${rows.length} rows, first ${rows[0].id}`);
