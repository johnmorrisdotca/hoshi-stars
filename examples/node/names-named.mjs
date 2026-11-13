import { findName, nameRows, searchNames } from "@johnmorrisdotca/hoshi-stars/names/named";

const rows = nameRows();
console.log(`${rows.length} rows, first ${rows[0].id}`);
console.log(findName("alpha Ori").id, findName("NGC 224").id);
console.log(searchNames("andro", { limit: 3 }).map((row) => row.id).join(" "));
