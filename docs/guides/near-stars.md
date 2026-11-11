---
title: Near stars and their planets
section: how-to
order: 12
description: The 73 star systems within 20 light-years and the nearest and best-known stars with confirmed planets, with names in English and Japanese, a place on the sky, a distance and the source of every value.
---

[日本語](ja/near-stars.md)

Two imports hold the stars that are worth travelling to. `@johnmorrisdotca/hoshi-stars/near-stars` is the **73 star systems within 20 light-years**: Alpha Centauri with Proxima, Barnard's Star, Wolf 359, Sirius and the rest. `@johnmorrisdotca/hoshi-stars/exoplanet-hosts` is the **80 host stars of confirmed planets** that matter to a visitor, with each planet's name and orbital period. Each is its own import (about 6 kB and 9 kB gzipped), so a page that does not need them pays nothing. Both are pure: no DOM, no clock.

```js
import { exoplanetHostByName } from "@johnmorrisdotca/hoshi-stars/exoplanet-hosts";
import { nearStarByName, nearStars } from "@johnmorrisdotca/hoshi-stars/near-stars";

const near = nearStars();
console.log(`${near.length} systems within 20 light-years, the nearest ${near[0].name}`);

const barnard = nearStarByName("Barnard's Star");
console.log(`${barnard.name} (${barnard.nameJa}): ${barnard.lightYears.toFixed(2)} light-years, ${barnard.spectralType}`);
console.log(`position from ${barnard.sources.position}, distance from ${barnard.sources.distance}, ${barnard.constellation}`);

const trappist = exoplanetHostByName("TRAPPIST-1");
console.log(`${trappist.name}: ${trappist.planetCount} planets, periods ${trappist.planets.map((p) => p.periodDays.toFixed(2)).join(", ")} days`);
```

That prints:

```text
73 systems within 20 light-years, the nearest Alpha Centauri
Barnard's Star (バーナード星): 5.98 light-years, M5 V
position from 2MASS, distance from GCTP, Oph
TRAPPIST-1: 7 planets, periods 1.51, 2.42, 4.05, 6.10, 9.21, 12.35, 18.77 days
```

## The stars within 20 light-years

`nearStars({ maxLightYears })` gives the systems, nearest first. `nearStarByName(text)` finds one by its name, its Japanese name, its designation or the name of any of its stars, ignoring case and spacing: `Proxima Centauri`, `Rigil Kentaurus`, `Sirius B`, `GJ 699`, `ウォルフ359`.

A system is one star or a group, and its values are those of its **primary** star (the brightest, or the one the table names). A system with companions lists them in `members`, the primary first: Alpha Centauri has Rigil Kentaurus, Toliman and Proxima Centauri, each with its own place and distance. `starsAtLeast` says how many stars the system has, as published for the well-known multiples (3 for Alpha Centauri, 2 for Sirius and 61 Cygni), and is 1 for a star with no known companion. A companion that the two Yale tables do not hold (Sirius B, Procyon B, the brown dwarfs of Epsilon Indi) is a member with a spectral type and a `note` but no place or distance of its own, and `source: "typed"`.

Each `NearStar` has:

- `id`, `name`, `nameJa`, `designation`, `aliases` and `constellation` (`Cen`).
- `rightAscension` and `declination` in degrees at J2000, with `positionErrorArcsec` where it is known.
- `parallaxMas` and `parallaxErrorMas`, and the distance `lightYears` with its `lightYearsError`. Every system's distance is known to 10% or better.
- `spectralType` and `luminosityClass` (`V` for a dwarf), `magnitude` (V), and the proper motion `properMotionRaMas` and `properMotionDecMas`.
- `members`, `starsAtLeast` and `flags` (`coarsePosition`: the position is the Yale catalogue's own, good to arc-seconds at best; `ambiguousMatch`: the match to the source is not clear).
- `sources`: where each value comes from, as one of `BSC` (the Yale Bright Star Catalogue), `GCTP` (the Yale General Catalogue of Trigonometric Stellar Parallaxes), `2MASS` (the Two Micron All Sky Survey) or `typed` (a published value typed into the package). The distance is `GCTP`, `BSC` or `dynamical` (from the orbit of a binary).

**What is not in it.** The list holds the stars that two sources this package can pass on give a distance to: it is the nearest stars as they were measured by 1995, with modern positions. A star found since and not in those tables (Teegarden's Star, Luhman 16, WISE 0855) is not in the list, because the catalogues that hold its distance are the ESA ones (Hipparcos, Tycho and Gaia), whose non-commercial licence an MIT package cannot pass on. The distances are therefore a little rougher than the modern ones (Proxima is 4.24 light-years here, 4.25 in the literature; Barnard's Star 5.98 and 5.96) and every error is stated.

## The stars with planets

`exoplanetHosts({ maxLightYears, minPlanets })` gives the hosts, nearest first, and `exoplanetHostByName(text)` finds one by its name, its Japanese name, the NASA Exoplanet Archive's name for it (`Proxima Cen`) or the name of one of its planets (`TRAPPIST-1 e`).

**How the hosts were picked.** A host is in if its distance is known to 10% or better and it is one of these:

- within 50 light-years (75 hosts), the nearest first, from Proxima Centauri at 4.2 to a G dwarf at 49;
- a star with an IAU proper name beyond that (4 hosts: Errai, Helvetios, Titawin and Hamal);
- TRAPPIST-1, the star with seven Earth-sized planets, whose distance is typed from its discovery papers.

Each `ExoplanetHost` has `name`, `nameJa`, `designation` (the Archive's name), `constellation`, `rightAscension`, `declination`, `lightYears` with `lightYearsError`, `spectralType`, `magnitude`, `selection` (`near`, `named` or `typed`), `nearStarId` (the id of its system in `/near-stars` where it is within 20 light-years), `planetCount`, `planets` and `sources`. Each planet has `name`, `letter`, `periodDays`, `periodReference` (the paper the period is from), `discoveryYear` and `discoveryMethod`. 134 confirmed planets are in all; a planet whose confirmation the literature disputes is left out.

**Where the values come from.** The planets are the NASA Exoplanet Archive's, and a page that shows them shows `EXOPLANET_ARCHIVE_ACKNOWLEDGEMENT`, the sentence the Archive asks for. The star's place, distance, spectral type and magnitude are **not** the Archive's: the Archive's position and distance columns are taken from the TESS Input Catalog, which is built on Gaia, and from Hipparcos, whose licence is non-commercial. They come from the same two Yale tables and 2MASS as the near stars, with a source on each value. A host those tables do not hold, such as LHS 1140, is left out until a source this package can pass on gives its distance. [NOTICE.md](../../NOTICE.md) has the sentence relied on for each source.
