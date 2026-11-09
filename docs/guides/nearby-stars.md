---
title: Nearby stars
section: how-to
order: 7
description: 5,565 more stars with a measured distance and its error, among them Proxima Centauri, Barnard's Star and Wolf 359, as their own import so the bright-star table stays small.
---

[日本語](ja/nearby-stars.md)

The 5,080 bright stars leave out most of the stars that are really close to the Sun, because the nearest ones are faint red dwarfs. `@johnmorrisdotca/hoshi-stars/nearby` adds the **5,565 stars** of the Yale General Catalogue of Trigonometric Stellar Parallaxes (van Altena, Lee and Hoffleit 1995) that the bright table does not hold. A star is in one list or the other, never both. The table is about 240 kB gzipped and nothing else imports it, so the bright-star import stays the size it was.

## Look a star up

`nearbyStarByName(text)` takes a common name, a name the catalogue gives it, `GJ 551` or `Gliese 551`, `HD 95735`, `GCTP 2576` or a 2MASS designation. `nearbyStars(options)` gives the whole list, nearest first.

```js
import { nearbyStarByName, nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";

const proxima = nearbyStarByName("Proxima Centauri");
console.log(`${proxima.lightYears.toFixed(2)} ${proxima.lightYearsError.toFixed(2)}`); // 4.24 0.03
console.log(`${proxima.positionSource} ${proxima.twoMass}`); // 2MASS 2MASS J14294291-6240465
console.log(nearbyStars().length); // 5565
```

Each `NearbyStar` carries a stable `id`, the names it has (`name`, `designation`, `aliases`, `gctp`, `hd`, `gliese`, `twoMass`), its J2000 position with where it comes from (`positionSource`) and its error (`positionErrorArcsec`), the parallax with its error, the distance in light-years and in parsecs with their errors, the proper motion and its source, the V magnitude with its kind and source, the spectral type and the luminosity class in it (`luminosityClass`: `V` for Proxima Centauri) and `flags`. The options of `nearbyStars` are `magnitude` (the faintest V), `maxRelativeError` and `withDistance`.

## Nearest in space, with them

`nearest` in `/nearest` looks only at the bright stars unless you hand it a list. Pass the two tables together:

```js
import { stars } from "@johnmorrisdotca/hoshi-stars";
import { nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";
import { nearest } from "@johnmorrisdotca/hoshi-stars/nearest";

const among = [...stars(), ...nearbyStars()];
const close = nearest({ x: 0, y: 0, z: 0 }, { by: "space", among, count: 4 });
console.log(close.map((n) => `${n.thing.name} ${n.distance.toFixed(2)}`).join(", ")); // Proxima Centauri 4.24, Toliman 4.35, Rigil Kentaurus 4.35, Barnard's Star 5.98
console.log(close[0].error.toFixed(2)); // 0.03
```

`{ x: 0, y: 0, z: 0 }` is the Sun. Proxima Centauri is first, then the two bright stars of Alpha Centauri, then Barnard's Star. The answer's `error` (light-years) is worked out when both ends are nearby stars (or the target is a point), from the parallax errors; it is `undefined` against a bright star, whose parallax has no error in the bright table. A nearby star with a parallax of 0 or less has no distance and is counted in `skipped`. Nearby stars can be a target too: `nearest(nearbyStarByName("Barnard's Star"), { by: "space", among: nearbyStars() })`.

## How good is a distance

The parallaxes are the catalogue's weighted means and each has a standard error. A distance is graded by its relative error, the parallax's error divided by the parallax (`relativeError`):

| Grade | Relative error | Meaning | Stars |
|---|---|---|---|
| good | under 5% | the distance can be drawn and quoted | 329 |
| fair | 5% to 20% | right to a fifth: fine for a map, not for a ranking | 1,188 |
| rough | over 20% | a hint of how far, no more | 3,552 |
| none | parallax of 0 or less | no distance; left out of 3D | 496 |

```js
import { nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";

const good = nearbyStars({ maxRelativeError: 0.05 });
const fair = nearbyStars({ maxRelativeError: 0.2 });
const all = nearbyStars({ withDistance: true });
console.log(`${good.length} ${fair.length - good.length} ${all.length - fair.length}`); // 329 1188 3552
```

A distance error (`lightYearsError`, `parsecsError`) is the distance times the relative error: a first-order figure, honest while the error is small and only a rough guide when it is over 20%. These are ground-based measurements from before 1996; newer space measurements are better for many of these stars, but their data cannot be passed on under an MIT licence (see [Data and licences](data-and-licences.md)).

## Where a position comes from

The Yale catalogue gives positions for 1900 (the FK4 system, B1900), many of them to a whole second of time or an arc-minute. They are carried to J2000 with the catalogue's own proper motion. For each star the build then looked in the 2MASS survey (a US government-funded sky survey of 1997 to 2001) for the one source that fits: near where the catalogue's star and its motion put it, with a J magnitude that agrees with the star's V and colour.

- **`positionSource: "2MASS"`**: the position is 2MASS's (carried to 2000 with the Yale motion), with an error of a fraction of an arc-second to a few; `twoMass` names the source. 4,352 stars.
- **`positionSource: "GCTP"`** and `flags.coarsePosition`: no single 2MASS source fits, so the Yale position stays. Its error (`positionErrorArcsec`) is arc-seconds at best, and for a high-motion star whose epoch is not known it can be an arc-minute or more. 1,213 stars.
- **`flags.ambiguousMatch`**: a bright star lies within 30 arc-seconds, or several 2MASS sources fit equally well, or the star is brighter than magnitude 6.1 and yet not among the bright stars. Check it before you rely on it. 1,029 stars.
- **`flags.excludedFromSpace`**: the parallax is 0 or less. 496 stars.

`gctpOffsetArcsec` says how far the 2MASS source is from the line the Yale position and motion lay along; half are within 1 arc-second and nine in ten within 22.

## Types

`NearbyStar` is the star, `NearbyFlags` its flags, `NearbyPositionSource` is `"2MASS"` or `"GCTP"` and `NearbyMagnitudeKind` is `"photoelectric"`, `"visual"` or `"blue"`. The catalogue gives the 5,565 stars' magnitudes to two decimals only where they are photoelectric V magnitudes; the others are rougher, and `magnitudeKind` says which.

The credits and the licence footing of both catalogues are in [NOTICE.md](https://github.com/johnmorrisdotca/hoshi-stars/blob/main/NOTICE.md): the Yale catalogue states no licence and is used with credit and removed on request; 2MASS asks for an acknowledgement, which is given there.
