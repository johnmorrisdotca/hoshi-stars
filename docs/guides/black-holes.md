---
title: Black holes
section: how-to
order: 11
description: "301 black holes with a place on the sky, a mass and a distance with their ranges, the companion star, how each was found and the paper behind each fact: Cygnus X-1, V404 Cygni, Gaia BH1, Sagittarius A*, M87* and more."
---

[日本語](ja/black-holes.md)

`@johnmorrisdotca/hoshi-stars/black-holes` is every black hole the sources give a place on the sky: 301 of them, in three kinds. It is its own import (about 22 kB gzipped), so a page that does not draw black holes pays nothing.

| Kind | Count | What it is |
|---|---|---|
| `stellar` | 78 | A black hole in an X-ray binary, found by the X-rays of the gas falling in: Cygnus X-1, V404 Cygni, A0620-00, GRS 1915+105. BlackCAT's 73 systems and five more (Cygnus X-1, LMC X-1, LMC X-3, M33 X-7, 1E 1740.7-2942). |
| `quiet` | 5 | A black hole that gives off almost nothing, found from the orbit of its companion star or from how it bent a star's light: Gaia BH1, BH2 and BH3, VFTS 243 and the lone OGLE-2011-BLG-0462. |
| `supermassive` | 218 | A black hole at the centre of a galaxy with a measured mass: Sagittarius A*, M87*, M31's, and 215 more. |

```js
import { blackHole, blackHoles } from "@johnmorrisdotca/hoshi-stars/black-holes";

const counts = ["stellar", "quiet", "supermassive"].map((kind) => `${blackHoles({ kind }).length} ${kind}`);
console.log(`${blackHoles().length} black holes: ${counts.join(", ")}`);

const cygnus = blackHole("Cygnus X-1");
const lightYears = Math.round(cygnus.distanceParsecs.value * 3.26156);
console.log(`${cygnus.name}: ${cygnus.massSuns.value} Suns, ${lightYears} light-years, companion ${cygnus.companion}`);
console.log(`mass from ${cygnus.sources.mass[0].citation}`);
```

That prints:

```text
301 black holes: 78 stellar, 5 quiet, 218 supermassive
Cygnus X-1: 21.2 Suns, 7241 light-years, companion HDE 226868
mass from Miller-Jones 2021, Science 371, 1046
```

## One black hole

`blackHole(name)` finds one by any of its names, ignoring case, spacing, punctuation and the star after a galaxy's name: `Cygnus X-1`, `cyg x-1`, `HDE 226868`, `V404 Cyg`, `GS 2023+338`, `Sgr A*`, `M87`, `NGC 4486`. A supermassive black hole is named for its galaxy with a star after it, as astronomers write Sagittarius A* and M87*, so `blackHole("M31")` is `M31*`, the black hole, not the galaxy (the galaxy is `deepSkyObject("M31")` in `@johnmorrisdotca/hoshi-stars/deep-sky`).

```js
import { blackHole } from "@johnmorrisdotca/hoshi-stars/black-holes";

const gaia = blackHole("Gaia BH1");
console.log(gaia.kind, gaia.constellation, gaia.foundBy, gaia.year); // quiet Oph orbit 2023
console.log(gaia.massSuns.value, gaia.massSuns.low, gaia.massSuns.high); // 9.62 9.44 9.8
console.log(gaia.rightAscension, gaia.declination); // 262.1712 -0.581
console.log(gaia.companion, "|", gaia.companionType); // Gaia DR3 4373465352415301632 | G dwarf (Sun-like)
```

Each black hole has:

- `id`, `name` and `otherNames`.
- `kind` (`stellar`, `quiet` or `supermassive`) and `status` (`confirmed` where the mass of the unseen object is measured above what a neutron star can have, else `candidate`).
- `rightAscension` and `declination` in degrees at J2000, to 0.0001 degree, and `constellation` (`Cyg`).
- `massSuns` and `distanceParsecs`: a `{ value, low, high, limit }`, `undefined` where nobody has measured it. `low` and `high` are the range the paper gives (about one standard deviation, or the ends of a range with no best value, in which case `value` is `undefined`); `limit` is `"lower"` or `"upper"` where `value` is only a limit (GX 339-4 is more than 5,000 parsecs away).
- `companion` (the star's designation) and `companionType` (its spectral type or kind), `undefined` where there is none.
- `foundBy`: `x-rays`, `orbit` (a companion's orbit), `microlensing` (how it bent a star's light), `stars` (stars orbiting it), `gas`, `masers`, `echoes` (reverberation mapping) or `image` (the Event Horizon Telescope's picture of M87*).
- `year`: for a stellar-mass black hole when its X-ray source was discovered, for a quiet one the year of its discovery paper, and for a supermassive one the year of the mass measurement used.
- `sources`: the papers behind the `position`, `mass`, `distance`, `companion` and `found` facts, each `{ key, citation, link }`, with a NASA ADS, arXiv or Wikidata address in `link`.
- `note`: a short English note where the facts need one, such as a disputed mass.

## Lists and filters

`blackHoles({ kind, status, foundBy, constellation })` narrows the list. The stellar ones come first, then the quiet, then the supermassive, each by right ascension.

```js
import { blackHoles } from "@johnmorrisdotca/hoshi-stars/black-holes";

const heaviest = blackHoles({ kind: "stellar", status: "confirmed" })
  .filter((b) => b.massSuns?.value !== undefined)
  .sort((a, b) => b.massSuns.value - a.massSuns.value)[0];
console.log(heaviest.name, heaviest.massSuns.value); // Cygnus X-1 21.2
console.log(blackHoles({ foundBy: "masers" }).length, blackHoles({ constellation: "Sgr" }).length); // 23 18
```

`BLACK_HOLE_KINDS` and `BLACK_HOLE_FOUND` are the two fixed lists, and the types are `BlackHole`, `BlackHoleKind`, `BlackHoleFound`, `BlackHoleMeasure`, `BlackHoleSource`, `BlackHoleSources` and `BlackHoleOptions`.

## On a sky chart

The black holes are in the same J2000 frame as the stars, so `project` from `@johnmorrisdotca/hoshi-stars/projection` puts them on any of the seven maps. The demo draws its own symbol for each kind, a dark disc with a jet each way for a stellar-mass one, a dashed ring for a quiet one and a dark disc in a tilted ring for a supermassive one, and names them when you zoom in.

## What is and is not here

- **A candidate is not a black hole yet.** `status` is `confirmed` only where the unseen object's mass is measured, from its pull on a companion, on stars, gas or masers around it, or from an image. 54 of the 78 stellar-mass systems are candidates, and most have no measured mass.
- **A mass has a range.** Use `massSuns.low` and `massSuns.high`, and look at `limit`: a lower limit is a minimum, not a measurement. A supermassive black hole's range is log-symmetric about the value the table gives.
- **OGLE-2011-BLG-0462's mass is disputed** (1.6 to 4.4 Suns, 5.8 to 8.7, 7.15 ± 0.83 in three papers); `note` says so and `massSuns` is the first published, 7.1 ± 1.3.
- **The distances of LMC X-1, LMC X-3 and VFTS 243 are the Large Magellanic Cloud's**, and `note` says so.
- **Not every black hole is here.** The list is the black holes that a paper has given a place and a mass or a case for, in the sources in `NOTICE.md`. Many more are inferred (nearly every large galaxy has one) and a measured mass is rarer than a black hole. The gravitational-wave events of LIGO, Virgo and KAGRA are not here: each is an area of sky, not a point, and they are left for a later release. The supermassive group drops the rows of its source that are only upper limits on a mass (55 of 278).
- **Sources and licences.** Every fact carries the paper it comes from. The sources and the terms are in `NOTICE.md`: BlackCAT (cited, with a request to credit it that this guide makes), van den Bosch's 2016 table of black hole masses, NASA/IPAC NED for galaxy centres, Wikidata (CC0) for places, and the discovery papers. Nothing from ESA's Gaia, Hipparcos or Tycho catalogues is used, and no Wikipedia text.

If you use these data, please cite BlackCAT (Corral-Santana et al. 2016, A&A 587, A61) for the stellar-mass black holes and van den Bosch (2016, ApJ 831, 134) for the supermassive ones.
