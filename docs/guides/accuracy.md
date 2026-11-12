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

A position is **modern** when its error, or its resolution where it states no error, is 2 arc-seconds or less. The Bright Star Catalogue states no error for its positions, so for a bright star the figure is the resolution of the printed position, 1.5 arc-seconds at most, not a measured error; it is within the 2 arc-seconds, so it counts; a nearby star's is modern when it comes from 2MASS and coarse when it is the Yale catalogue's own position carried from 1900. A parallax with no stated error is rough, so the star is grade C, except a dynamical parallax, which is fair. `STAR_GRADES` lists the grades, best first, and `gradeAtLeast(grade, "B")` tests a grade against a minimum.

## The counts

| Tier | Stars | Grade A | Grade B | Grade C | Source of the numbers | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| Bright (the main import) | 5,080 | 68 | 461 | 4,551 | Yale Bright Star Catalogue and, for some of them, Yale parallaxes | Yale Bright Star Catalogue: public domain, informally, with credit; Yale parallaxes: no licence stated, used with credit and removed on request (`NOTICE.md`) |
| Nearby (`/nearby`) | 5,565 | 235 | 1,282 | 4,048 | Yale General Catalogue of Trigonometric Stellar Parallaxes; 2MASS positions | Yale parallaxes: as above; 2MASS: a US government work, credited (`NOTICE.md`) |

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

## In the data files

The `stars` and `nearby-stars` tables of `pnpm export:data` have the columns `grade` and `distanceQuality`; `stars` also has `positionSource` and `positionResolutionArcsec` (`nearby-stars` already had `positionSource`, `positionErrorArcsec` and `relativeError`).

## What comes next

The grade is on every star of the two tiers today, and `minGrade` filters by it. Still to come: the grade and its error shown when a star is picked on the chart, and a layer that merges the tiers so a star is counted once with its best value in each field.
