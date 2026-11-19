---
title: How well a star is known
section: how-to
order: 15
description: For each star, which catalogue its position, magnitude, colour, parallax and proper motion come from, the error that catalogue states, and a grade A, B or C by a rule you can read.
---

[日本語](ja/accuracy.md)

A catalogue says where a star is and how far away, but not always how sure it is. `@johnmorrisdotca/hoshi-stars/accuracy` answers that for every star of the two tiers that hold stars today: the 5,080 bright stars and the nearby stars of `/nearby`. It holds no table of its own and loads no data, only a few kilobytes of rules.

```js
import { starAccuracy } from "@johnmorrisdotca/hoshi-stars/accuracy";
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { nearbyStarByName } from "@johnmorrisdotca/hoshi-stars/nearby";

const sirius = starAccuracy(starByName("Sirius"));
console.log(`Sirius: grade ${sirius.grade}, distance ${sirius.distance.quality} (${(sirius.distance.relativeError * 100).toFixed(1)}%), parallax from ${sirius.parallax.source}`);
console.log(`position from ${sirius.position.source}, to ${sirius.position.resolution.toFixed(1)} ${sirius.position.unit}, stated error ${sirius.position.error}`);

const betelgeuse = starAccuracy(starByName("Betelgeuse"));
console.log(`Betelgeuse: grade ${betelgeuse.grade}, parallax from ${betelgeuse.parallax.source}, ${betelgeuse.distance.quality} distance`);

const proxima = starAccuracy(nearbyStarByName("Proxima Centauri"));
console.log(`Proxima Centauri: grade ${proxima.grade}, position from ${proxima.position.source} (+-${proxima.position.error} ${proxima.position.unit})`);
```

That prints:

```text
Sirius: grade A, distance good (0.6%), parallax from GCTP
position from BSC, to 1.4 arcsec, stated error undefined
Betelgeuse: grade B, parallax from literature, fair distance
Proxima Centauri: grade A, position from 2MASS (+-0.1 arcsec)
```

## What `starAccuracy(star)` gives

A record with the `layer` the star is from (`bright` or `nearby`), its `grade`, and one `FieldAccuracy` each for `position`, `magnitude`, `colour`, `parallax` and `properMotion`, plus `distance`.

Each field has:

- `source`: the catalogue the value is from: `BSC` (the Yale Bright Star Catalogue), `GCTP` (the Yale General Catalogue of Trigonometric Stellar Parallaxes), `2MASS` (the Two Micron All Sky Survey), `dynamical` (the Bright Star Catalogue's parallax from the orbit of a binary) or `literature` (a distance typed from a published paper). `undefined` where the star has no such value.
- `error`: the standard error, in the field's `unit` (`arcsec`, `mag`, `mas` or `mas/yr`), **only where the source states one** (the parallax of a star from the Yale parallax catalogue; the position of a nearby star, which the package works out from 2MASS's own error and the star's motion). Otherwise `undefined`. An error is never guessed.
- `resolution`: the size of the last digit the source prints. It is a floor on the error and not an estimate of it: the Bright Star Catalogue prints a position to 0.1 second of time and 1 arc-second (1.5 arc-seconds at the equator) and states no error, so a bright star's position has a resolution and no error.
- `note`: one plain sentence where there is something to be careful about (a distance typed from a paper, a magnitude that is a photographic blue and not a V).

`distance` has the `relativeError` (the parallax's error divided by the parallax, `0.05` is 5%) and the `quality` band (`good`, `fair`, `rough` or `none`, the same as `distanceQuality` in `/constellation-3d`).

## The grade

The grade is a rule on the stated figures, not a verdict on the star, and `GRADE_RULES` holds its numbers:

| Grade | Rule |
| --- | --- |
| A | the distance is known to under 5% **and** the position is modern |
| B | the distance is known to 20% or better (or to under 5% with a coarse position) |
| C | anything else: a position and a rough distance, or no distance |

A position is **modern** when its error, or its resolution where it states no error, is 2 arc-seconds or less. The Bright Star Catalogue states no error for its positions, so for a bright star the figure is the resolution of the printed position, 1.5 arc-seconds at most, not a measured error; it is within the 2 arc-seconds, so it counts; a nearby star's is modern when it comes from 2MASS and coarse when it is the Yale catalogue's own position carried from 1900. A parallax with no stated error is rough, so the star is grade C, except a dynamical parallax of 2.5 milliarcseconds or more, which is fair: it is given to a whole milliarcsecond, so its rounding, half of one, is its error, and that is over 20% of a parallax of 1 or 2 milliarcseconds, which is rough (Adhara's 1 milliarcsecond is known to 50%). `STAR_GRADES` lists the grades, best first, and `gradeAtLeast(grade, "B")` tests a grade against a minimum.

## The counts

By tier and grade. The typical error is the median of the errors the sources state, over the stars that have one; a figure no source states is not given.

| Tier | Stars | Grade A | Grade B | Grade C | Typical error | Source of the numbers | Licence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bright (the main import) | 5,080 | 68 | 452 | 4,560 | parallax 9.7 mas (the 2,329 with a stated error); position printed to 1.5 arc-seconds, no error stated | Yale Bright Star Catalogue and, for some of them, Yale parallaxes | Yale Bright Star Catalogue: public domain, informally, with credit; Yale parallaxes: no licence stated, used with credit and removed on request (`NOTICE.md`) |
| Nearby (`/nearby`) | 5,565 | 235 | 1,282 | 4,048 | parallax 10.6 mas; position 0.1 arc-seconds (4,352 from 2MASS) | Yale General Catalogue of Trigonometric Stellar Parallaxes; 2MASS positions | Yale parallaxes: as above; 2MASS: a US government work, credited (`NOTICE.md`) |
| Faint (`/faint`) | 2,461,864 | 0 | 0 | 2,461,864 | no parallax; the tiles keep no error for a position | UCAC4, with APASS magnitudes | UCAC4: free of charge, cited; APASS: credited (`NOTICE.md`) |
| **Bright and nearby (`/catalogue`)** | **10,645** | **303** | **1,734** | **8,608** | | | |

A faint star has no parallax, so by the rule it is grade C; the faint tiles are not part of `/catalogue` (below).

Most of the bright stars are grade C because the Bright Star Catalogue has a parallax for few of them, and states no error for those: a distance with no stated error is not graded as if it had one. A modern catalogue would raise many of them; the ones that could be used here cannot be passed on under an MIT licence (`NOTICE.md`, "Deliberately not used").

## Keeping only the stars you can trust

`stars`, `nearbyStars` and `nearest` take `minGrade`: the worst grade to keep, so `"B"` keeps grades A and B. `starGrade(star)` is a star's grade alone, quicker than `starAccuracy(star).grade`, and `checkGrade` is the check that turns a bad `minGrade` into a `RangeError` naming the option.

A query by space (`nearest(..., { by: "space" })`) also says how sure each answer is. Besides `distance` and `error`, every answer has its `range` (the distance one `error` each way, never below 0) and `tied`: `true` where that range overlaps the one before it or after it in the full list, so the data does not settle which of the two is nearer. Rigil Kentaurus and Toliman, the two bright stars of Alpha Centauri, are one such pair. A star with no stated error has no `range` and is never called tied: a missing error is not a small one.

```js
import { starByName, stars } from "@johnmorrisdotca/hoshi-stars";
import { nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";
import { nearest } from "@johnmorrisdotca/hoshi-stars/nearest";

console.log(`${stars({ minGrade: "A" }).length} of ${stars().length} bright stars are grade A; ${nearbyStars({ minGrade: "B" }).length} nearby stars are B or better`);

const found = nearest(starByName("Sirius"), { by: "space", count: 4, minGrade: "B" });
for (const one of found) {
  const range = one.range === undefined ? "no range" : `${one.range[0].toFixed(1)} to ${one.range[1].toFixed(1)} light-years`;
  console.log(`${one.thing.name ?? one.thing.designation}: ${one.distance.toFixed(1)}, ${range}${one.tied ? ", tied with a neighbour" : ""}`);
}
```

That prints:

```text
68 of 5080 bright stars are grade A; 1517 nearby stars are B or better
Procyon: 5.2, 5.2 to 5.3 light-years
Ran: 8.0, 7.9 to 8.0 light-years
Rigil Kentaurus: 9.5, 9.4 to 9.5 light-years, tied with a neighbour
Toliman: 9.5, 9.4 to 9.5 light-years, tied with a neighbour
```

A deep-sky object has no grade. `nearest("M31", { kind: "deep-sky", minGrade: "A" })` is a `RangeError`, and in a mixed `among` list deep-sky objects are left out when `minGrade` is set.

## One catalogue: the tiers together

`@johnmorrisdotca/hoshi-stars/catalogue` joins the bright stars and the nearby stars into one list, each star once, under an id that stays the same: `hr-` and the Bright Star Catalogue number for a bright star (`hr-2491`, Sirius), `gctp-` and the Yale parallax catalogue's number for a nearby star (`gctp-3278`, Proxima Centauri). These are the ids `/distance`, `/names` and `/sky-from` already use. It loads both tables (about 386 kB gzipped), so a page that needs one tier imports that one.

```js
import { catalogueCounts, catalogueStar, catalogueStars } from "@johnmorrisdotca/hoshi-stars/catalogue";

for (const count of catalogueCounts()) console.log(`${count.layer}: ${count.stars} stars, A ${count.grades.A}, B ${count.grades.B}, C ${count.grades.C}`);

const proxima = catalogueStar("gctp-3278");
const [near, far] = proxima.distance.lightYearsRange;
console.log(`${proxima.id} ${proxima.name}: ${proxima.layer} tier, grade ${proxima.grade}, ${near.toFixed(2)} to ${far.toFixed(2)} light-years`);

const sure = catalogueStars({ minGrade: "A", magnitude: 9 });
console.log(`${sure.length} grade A stars to magnitude 9, the faintest ${sure.at(-1).name ?? sure.at(-1).id}`);
```

That prints:

```text
bright: 5080 stars, A 68, B 452, C 4560
nearby: 5565 stars, A 235, B 1282, C 4048
gctp-3278 Proxima Centauri: nearby tier, grade A, 4.20 to 4.27 light-years
104 grade A stars to magnitude 9, the faintest gctp-2345
```

`catalogueStars(options)` gives the stars brightest first (the seven nearby stars with no magnitude last) and takes `layers` (`["bright"]`, `["nearby"]` or both, `CATALOGUE_LAYERS`), `magnitude` and `minGrade`. Each `CatalogueStar` has its `id`, `layer`, `name`, `designation`, `hd`, J2000 position, `magnitude`, `grade`, `distance` (what `starDistance` gives: the distance, its error and its range) and the tier's own record in `star`, for `starAccuracy` and everything else. `catalogueStar(id)` finds a star by its id, `catalogueId(star)` gives a star's id, and `catalogueCounts()` gives the counts of the table above.

How a star is counted once. The two tiers were built so that no star is in both:

- **The Yale parallaxes and the bright stars** (`scripts/make-star-data.py`): a parallax goes to the bright star with the same HD number whose V agrees to 1.0. 2,329 bright stars matched; 2,325 keep that parallax and four take a published paper's distance instead.
- **The nearby tier** (`scripts/make-nearby-data.py`): the Yale parallax catalogue's stars left once the bright ones are taken out, by HD number first and else by position (within 15 arc-seconds, after the star's proper motion) and V (within 1.0). 5,565 are new; 1,029 of them carry `flags.ambiguousMatch` (a bright star within 30 arc-seconds, several 2MASS sources that fit, or a star brighter than 6.1 that is not among the bright stars). A test holds that no HD number is in both tiers and that no unflagged nearby star lies within 15 arc-seconds and a magnitude of a bright star.
- **One epoch and frame.** Both tiers are at J2000 and epoch 2000: the Bright Star Catalogue's own positions, and for a nearby star a 2MASS position carried to 2000 by its motion, or the Yale position carried from 1900.
- **A system.** The Yale catalogue gives one parallax for a system, so the two bright stars of a pair share it (Rigil Kentaurus and Toliman are at the same distance). A companion too faint for the bright tier that the Yale catalogue does not list as a star of its own is in neither tier: 61 Cygni B (HR 8086, V 6.03) is one.
- **The faint tiles** already leave out the bright stars (45 of them, within 20 arc-seconds and 1.5 magnitudes; [Faint stars](faint-stars.md)). They do not yet leave out the nearby stars, which is why they are not in `/catalogue`.

## In the data files

The `stars` and `nearby-stars` tables of `pnpm export:data` have the columns `grade` and `distanceQuality`; `stars` also has `positionSource` and `positionResolutionArcsec` (`nearby-stars` already had `positionSource`, `positionErrorArcsec` and `relativeError`).

## What comes next

The grade is on every star of the bright and nearby tiers, `minGrade` filters by it, the chart shows it when a star is picked, and `/catalogue` counts each of those stars once. Still to come: matching the nearby stars against the faint tiles, so that a star in both is drawn and counted once, with each value from its best source.
