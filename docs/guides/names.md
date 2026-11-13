---
title: A names index for a search box
section: how-to
order: 15
description: "One row for each bright star and Messier object, and a chunk for the NGC and IC objects: names in English and Japanese, designations, constellation, rank weight, an address-safe id and where to point, with lookup by id and by name."
---

[日本語](ja/names.md)

`@johnmorrisdotca/hoshi-stars/names` is the list a search box needs: every one of the 5,080 bright stars and the 110 Messier objects as a row, built from the tables the package already holds (no new data), so a page pays for it only when it searches. The 11,788 other NGC and IC objects are `@johnmorrisdotca/hoshi-stars/names/ngc-ic`, a chunk of their own.

```js
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
```

The output is:

```text
betelgeuse Betelgeuse ベテルギウス S:2061
m31 Andromeda Galaxy galaxy D:M31
ngc7000 North America Nebula nebula
5190 rows, first sirius
```

## A row

| Field | What it is |
|---|---|
| `id` | An address-safe id that stays the same: `betelgeuse`, `alpha-orionis`, `58-orionis`, `hr-1234`, `m31`, `ngc7000`. A star with a name takes it, one with a Bayer letter or a Flamsteed number takes that spelt out with the constellation's genitive, the rest take `hr-` and the Bright Star Catalogue number. Two stars that would share an id each get `-hr` and their number. Unique in the index, and `nameRowById(id)` is the way back. |
| `kind` | `star`, `cluster` (open and globular), `nebula` (emission, reflection, planetary, supernova remnant), `galaxy` or `other`. The package does not mark double or variable stars, so there is no such kind. |
| `detail` | The deep-sky object's own type (`globular cluster`), or the star's spectral type. |
| `name` | `en` is the common name, else the designation. `ja` is the katakana name for the 335 stars that have one, else for a star with a Bayer letter the usual `オリオン座α星` form, else absent. The package holds no Japanese name for a deep-sky object. The Japanese awaits a native reader. |
| `otherNames`, `designations` | Everything else a reader might type: `α Ori`, `alpha Ori`, `alpha Orionis`, `Alp Ori`, `HR 2061`, `M31`, `Messier 31`, `NGC 224`, `Andromeda Nebula`. |
| `constellation`, `constellationName` | The abbreviation, and the name in English and Japanese. |
| `magnitude`, `weight` | Visual magnitude, and a rank weight, larger first: 8 less the magnitude (between 0 and 14), plus 3 for a common name and 2 for a Messier number. Rows come out in that order. |
| `rightAscension`, `declination`, `pick` | Where to turn the sky (J2000 degrees) and the key the demo's address uses to pick it on the map: `S:2061` for a star, `D:M31` for a deep-sky object. |
| `hr` | The Bright Star Catalogue number of a star. |

## Finding one

`findName(text)` returns the one row a text names exactly, ignoring case, spacing, accents and how the Greek letter is spelt (`α`, `alpha`, `Alp`, `alf`, a superscript `π³` or a number written apart `pi 3 Ori`): `Betelgeuse`, `alpha Ori`, `α Orionis`, `HR 2061`, `M 31`, `Messier 31`, `NGC 224`, `Andromeda Galaxy`, `ベテルギウス`. A text that two rows share (`Alpha Centauri` is both `α1 Cen` and `α2 Cen`) finds none. `searchNames(text, { limit, kinds })` lists the rows whose names start with the text and then those that contain it, each by weight, for a type-ahead box. The NGC and IC chunk has the same three: `ngcIcRows`, `ngcIcRowById`, `findNgcIc` and `searchNgcIc`.

## A small first chunk

A search box wants about 20 kB first, not 135. `@johnmorrisdotca/hoshi-stars/names/named` holds only the 335 stars that have a common name and the 110 Messier objects (445 rows), with `nameRows`, `nameRowById`, `findName` and `searchNames` that work on them at once. Each row is the same row, with the same id, names, designations and position, that `/names` gives for that id, so a page can show results from this chunk and load `/names` (and `/names/ngc-ic`) afterwards for the rest without an id changing.

```js
import { findName, nameRows, searchNames } from "@johnmorrisdotca/hoshi-stars/names/named";

const rows = nameRows();
console.log(`${rows.length} rows, first ${rows[0].id}`);
console.log(findName("alpha Ori").id, findName("NGC 224").id);
console.log(searchNames("andro", { limit: 3 }).map((row) => row.id).join(" "));
```

The output is:

```text
445 rows, first sirius
betelgeuse m31
m31 alpheratz mirach
```

The 335 stars come from a small table that `scripts/make-names-named.ts` writes from the bright-star table (the Yale data already credited in `NOTICE.md`; no new data). The ids are settled over the whole table when it is written, so the chunk needs no star table, and a test runs the script again and fails if the table on disk differs. `/names/named` measures 22.7 kB gzipped. A star without a common name (`alpha-centauri`, `hr-1234`) is not in it: a search that finds nothing there goes on to `/names`.

## Your own index

The pieces the three entry points are made of are exported too, for a page that keeps its own list of rows (the rows of one catalogue, or a short list for one page). They are in `/names` and `/names/named`, and all but `deepSkyRow` in `/names/ngc-ic`.

- `NAME_KINDS` is the list of kinds a row can have (`star`, `cluster`, `nebula`, `galaxy`, `other`), in the order the type `NameKind` gives them.
- `nameKey(text)` is the text folded the way `findName` compares: lower case, no accents, the Greek letter spelt out, one space, a superscript as its digit. `Messier 31`, `M 31` and `m31` all give `m31`, and `NGC 0224` gives `ngc224`.
- `slugOf(text)` is an address-safe id from a text: lower-case letters and digits in runs joined by one hyphen, an accent dropped (`Boötes` gives `bootes`) and a Greek letter spelt out. It is what the ids of the rows are made with.
- `deepSkyRow(object, constellations)` is the row of a deep-sky object from `/deep-sky` or `/deep-sky/ngc-ic`, with the constellations by abbreviation for the names of the one it lies in.
- `nameIndex(rows)` is the index over a list of rows: `rows(kinds)`, `byId(id)`, `find(text)` and `search(text, { limit, kinds })` work as `nameRows`, `nameRowById`, `findName` and `searchNames` do. The rows come out largest weight first, and it throws if two rows have the same id.

```js
import { constellations } from "@johnmorrisdotca/hoshi-stars/constellations";
import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
import { NAME_KINDS, deepSkyRow, nameIndex, nameKey, slugOf } from "@johnmorrisdotca/hoshi-stars/names";

console.log(NAME_KINDS.join(" ")); // star cluster nebula galaxy other
console.log(nameKey("Messier 31"), nameKey("α Ori"), nameKey("NGC 0224")); // m31 alpha ori ngc224
console.log(slugOf("Rigil Kentaurus"), slugOf("Boötes")); // rigil-kentaurus bootes

const byAbbreviation = new Map(constellations().map((c) => [c.abbreviation, c]));
const row = deepSkyRow(deepSkyObject("M31"), byAbbreviation);
console.log(row.id, row.kind, row.pick); // m31 galaxy D:M31

const mine = nameIndex([row]);
console.log(mine.find("Messier 31").id, mine.rows(["star"]).length); // m31 0
```

## Size

The rows are made when first asked for from the tables the package already ships, so the code adds a few kilobytes: `/names` measures 135.7 kB gzipped (the star table with the Messier table) and `/names/ngc-ic` 226.4 kB (the large deep-sky table, and nothing from the stars). Both are over 60 kB, so they are chunks, with the 22.7 kB `/names/named` in front of them, and a page that only wants stars and Messier objects never loads the NGC and IC table. Written out as JSON the rows are larger than the tables they come from, because every spelling of a name is spelt: of the 5,190 rows of `/names` about 300 kB gzipped (5,080 stars about 296 kB), and the 11,788 of `/names/ngc-ic` about 332 kB (the galaxies are most of it). A site that sends its own copy should send the fields it searches and shows, not whole rows.

## Known gaps

- **No HD numbers for the bright stars.** `HD 39801` does not find Betelgeuse: the package holds a Henry Draper number only for the stars of `/nearby`. The Bright Star Catalogue has the column; adding it is a data re-run that needs John's yes (ticket MODULES-1224).
- **Flamsteed numbers of a star that also has a Bayer letter** (58 Ori for Betelgeuse) are not in the data the package exposes, so they are not typed names; a star with only a Flamsteed number has one.
- **The 5,565 nearby stars are not rows yet.**
