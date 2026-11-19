---
title: Where things come from
section: how-to
order: 16
description: "Who found each Messier, NGC and IC object and when, the day the IAU approved a star's name and the language it comes from, and where each catalogue comes from, every fact with the source it was read from."
---

[日本語](ja/provenance.md)

`@johnmorrisdotca/hoshi-stars/provenance` answers the questions a pick card asks after the name: who found it, when, in which catalogue is its number from, and where does the name of the star come from. Every answer says which source it was read from, and where a source gives more than one answer, or one that cannot be right, the answer carries a note. The Messier objects and the 335 named stars are in `/provenance` (8.8 kB gzipped); the other 11,788 NGC and IC objects are the chunk `@johnmorrisdotca/hoshi-stars/provenance/ngc-ic` (40.3 kB gzipped, with the Messier objects in it too).

```js
import { objectDiscovery, starNameFacts, CATALOGUE_ORIGINS, PROVENANCE_SOURCES } from "@johnmorrisdotca/hoshi-stars/provenance";
import { objectDiscovery as anyDiscovery } from "@johnmorrisdotca/hoshi-stars/provenance/ngc-ic";

const crab = objectDiscovery("M1");
console.log(crab.discoverers.map((one) => one.name).join(", "), crab.date.value, crab.catalogue.compiler);

const nebula = anyDiscovery("NGC 7000");
console.log(nebula.id, nebula.discoverers[0].name, nebula.date.value, nebula.catalogue.years.join());

const star = starNameFacts("Betelgeuse");
console.log(star.name, star.approved, star.origin, PROVENANCE_SOURCES[star.sources.approved].address);

console.log(objectDiscovery("M31").notes[0]);
console.log(CATALOGUE_ORIGINS.ic.objects, "objects in the IC");
```

The output is:

```text
John Bevis 1731 Charles Messier
NGC 7000 William Herschel 1786-10-24 1888
Betelgeuse 2016-06-30 Arabic https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt
The date is later than the catalogue the object is in, so it cannot be its discovery; it is shown as Wikidata gives it, and no other source was read to correct it.
5386 objects in the IC
```

## An object's discovery

`objectDiscovery(id)` takes an object's id as `deepSkyObject` gives it (`M1`, `NGC 7000`, `IC 434`; any case, with or without the space) and returns:

| Field | What it is |
|---|---|
| `discoverers` | The people Wikidata names as the discoverer or inventor, each as `{ name, wikidata }` (the name as Wikidata's English label spells it, and its item, `Q437582`), in the order Wikidata gives them. Empty when it names none. |
| `date` | `{ value, grain, year }`: the date as text (`1731`, `1779-01-31`, `-0259` for 259 BC), the finest unit it gives (`year`, `month` or `day`) and the year as a number. `null` when Wikidata gives none. |
| `catalogue` | The catalogue the object's own number is from: its compiler, the years it was published, the number of objects, a note and the source of those. |
| `notes` | Text for each place where the source disagrees with itself or with the catalogue (below). Empty for most. |
| `source` | Always `wikidata`, a key of `PROVENANCE_SOURCES`. |

The answer is `undefined` for an object Wikidata gives neither a discoverer nor a date, and for an id that is not in the tier you imported. A Messier object that also has an NGC number is asked by its Messier id, as `deepSkyObject` has it (`M1`, not `NGC 1952`).

### What Wikidata gives

7,918 of the 11,898 objects have an answer: 7,765 a discoverer and 7,646 a date. The other 3,980 have neither in Wikidata, and the package fills nothing in from anywhere else: a blank stays blank. The discoverer is the statement "discoverer or inventor" (P61) and the date "date of discovery or invention" (P575) of the item that holds the object's Messier, NGC or IC code (P528), and a value that is not a person (an institution) is left out. 106 people are named in all. The two queries are word for word in `NOTICE.md` with the day they were read, and `scripts/make-discovery-data.py` reruns them.

Wikidata is edited by anyone, and some of its dates cannot be discoveries. The package marks what it can see without another source, and shows the value anyway:

- **A date later than the catalogue** (a Messier object after 1800, an NGC or IC object after 1908): Andromeda's `1964-01` is one (4 objects in all). It is shown as Wikidata gives it, with a note that says so, so a page can hide it or show it with the note.
- **More than one date** for an object: the earliest is shown, with a note that there are several (17 objects).
- **A date coarser than a year**: the year is shown, with a note. None of the dates is that coarse today; the note is for a future read.

### The catalogues

`CATALOGUE_ORIGINS` has the three catalogues: `messier` (Charles Messier, 1774 for the preliminary 45 objects and 1781 for the 103 of the final version), `ngc` (John Louis Emil Dreyer, 1888, 7,840 objects) and `ic` (Dreyer's two supplements, 1895 and 1908, 5,386 objects). They are read from the Wikipedia articles "Messier object" and "New General Catalogue" (facts only, no text copied), named by `source`.

## A star's name

`starNameFacts(star)` takes an HR number or the common name (any case) and returns `hr`, `name`, `approved` (the day the IAU Working Group on Star Names approved the name, `2016-06-30` for most), `origin` (the language or culture the name comes from: `Arabic`, `Latin`, `Greek`, `Chinese`, `Wardaman` and the rest), `notes` and `sources`. The approval day is from the IAU Catalog of Star Names (updated 2022-04-04) and the origin from Wikipedia's "List of proper names of stars", column "Name origin"; each is `null` where its source has none.

- **332 of the 335 names have an approval day.** Navi, Men and Rutilicus are in the package's list but not in the IAU's, so they have no day, and a note says so. They have no origin either: the Wikipedia table does not give one.
- **A few origins say `unknown`**: Wikipedia's own word. It is passed on as it stands.

`NAMED_STAR_FACT_IDS` lists the HR numbers of the 335 stars that have facts.

`DISCOVERY_OBJECT_COUNT`, in `/provenance/ngc-ic`, is the number of objects that have an answer (7,918).

## Not here yet

The facts are data and functions. The demo's pick card does not show them yet, and the data files export of MODULES-656 does not hold them yet; both need a browser and a decision about the layout, and are tickets of their own. The discoverers' names are English only.
