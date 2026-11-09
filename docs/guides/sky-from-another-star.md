---
title: The sky from another star
section: how-to
order: 8
description: Move the stars to where they would be seen from Alpha Centauri, Sirius or any point in space, with the Sun as one of them, and draw that sky with the same charts.
---

[日本語](ja/sky-from-another-star.md)

The sky you see is the view from one place, the Earth. Every star with a parallax has a distance, so the stars can be placed in three dimensions and looked at from somewhere else. `@johnmorrisdotca/hoshi-stars/sky-from` does that: it takes a viewpoint and gives back each star as it would appear from there, with its new right ascension and declination, its distance and its brightness. The Sun is one of the stars.

## The Sun from Alpha Centauri

```js
import { skyFrom } from "@johnmorrisdotca/hoshi-stars/sky-from";

const sky = skyFrom("Rigil Kentaurus");
const sun = sky.find((star) => star.id === "sun");
console.log(`${(sun.rightAscension / 15).toFixed(2)} h ${sun.declination.toFixed(1)} ${sun.magnitude.toFixed(2)} ${sun.lightYears.toFixed(2)}`); // 2.66 h 60.8 0.45 4.35
```

Seen from Rigil Kentaurus, the brighter star of Alpha Centauri, the Sun is a star of magnitude 0.45 at 2 hours 40 minutes and +60.8 degrees: in Cassiopeia, opposite Alpha Centauri's own place in our sky. The Sun's absolute magnitude is 4.83 and its colour index 0.65; the brightness of every star from the viewpoint is `m' = M + 5 log10(d' / 10 parsecs)`, where `M` is the absolute magnitude worked out from the star's magnitude and distance from the Sun.

The viewpoint is a star (the object, or a name `starByName` finds) or a point `{ x, y, z }` in parsecs on the J2000 equatorial axes, the Sun at the origin: the same point a planetarium's star browser flies to. The directions in the answer are on the same axes as the Earth's sky, so the charts, projections and constellation lines work as they do at home.

## What changes

```js
import { skyFrom } from "@johnmorrisdotca/hoshi-stars/sky-from";

const sky = skyFrom("Rigil Kentaurus");
const sirius = sky.find((star) => star.name === "Sirius");
console.log(sirius.lightYears.toFixed(1), sirius.magnitude.toFixed(2)); // 9.5 -1.23
const home = skyFrom({ x: 0, y: 0, z: 0 });
console.log(home.length, home.find((star) => star.name === "Sirius").magnitude.toFixed(2)); // 2563 -1.46
```

- **Near stars move a lot, far ones barely.** Sirius is 8.5 light-years from the Sun and 9.5 from Alpha Centauri, and it moves 27 degrees across the sky; Rigel, 350 light-years off, moves less than a degree.
- **Brightnesses change.** Sirius is magnitude -1.46 from the Earth and -1.23 from there.
- **The viewpoint star is not in its own sky,** and a star nearer to it than the error of its distance is left out too: the other star of Alpha Centauri is 0.00004 light-years away by the catalogue's positions, and the distance is good to 0.03, so where it is from there is not known.
- **From the Sun's own place the sky is today's:** `{ x: 0, y: 0, z: 0 }` gives the same positions and magnitudes as `stars()`, for the stars that have a distance, without the Sun.

## Stars with no distance are left out

Only a star with a distance can be moved, and 2,517 of the 5,080 bright stars have no parallax in the catalogue (Deneb and Alnilam among them). They are not in the answer; `skipped` counts them (with any star left out for being too near the viewpoint). A line of a constellation that joins a missing star cannot be drawn from there either.

```js
import { skyFrom } from "@johnmorrisdotca/hoshi-stars/sky-from";

const sky = skyFrom("Sirius", { magnitude: 0 });
console.log(sky.map((star) => `${star.name} ${star.magnitude.toFixed(2)}`)); // [ 'Procyon -1.31', 'Canopus -0.80', 'Capella -0.07' ]
console.log(sky.skipped > 2500);
```

It also holds only the stars of the table: a star too faint to be in it from the Earth is missing from every other sky, even one it would shine in. The options are `magnitude` (the faintest to include, as seen from the viewpoint) and `among` (the list to move instead of the 5,080). An answer is a list of `SeenStar`, brightest first; each has `id` (`hr-2491`, `gctp-3278`, or `sun`), `name`, `designation`, `rightAscension`, `declination`, `lightYears`, `parsecs`, `magnitude`, `absoluteMagnitude`, `colourIndex` and `star`, the catalogue's own star. The list is a `SeenSky`.

Distances have errors, and the further a star is, the worse. Betelgeuse's parallax is 9.8 milliarcseconds with an error of 4.7: seen from it, the sky is as uncertain as that. `starDistance(star)` gives the error and the range; the viewpoint is only as good as its distance.

## With the nearby stars

The 5,565 stars of `/nearby` can be moved too, from their own import so the plain one stays small. `skyFromWithNearby` takes the same arguments, adds Proxima Centauri, Barnard's Star and the red dwarfs to the stars it moves, and finds a nearby star's name as a viewpoint.

```js
import { skyFromWithNearby } from "@johnmorrisdotca/hoshi-stars/sky-from/nearby";

const sky = skyFromWithNearby("Proxima Centauri", { magnitude: 0 });
console.log(sky.map((star) => star.name ?? star.designation)); // [ 'Rigil Kentaurus', 'Toliman', 'Sirius', 'Canopus', 'Arcturus' ]
console.log(sky.length, sky.skipped); // 5 3018
```

A nearby star with no V magnitude cannot be given a brightness, so it is counted in `skipped` with the stars that have no distance. The nearby table is about 240 kB gzipped; `/sky-from` itself imports only the bright-star table.

## In the demo

The demo has a **View from** choice: the Sun (the Earth's sky) or Alpha Centauri, Sirius, Vega and a few more, and any star you have picked that has a distance. The chart, its constellation lines, the star facts and the Nearby panel are drawn from there, and a note under the choice says where you are and what is hidden. The choice is in the address as `from=HR5459` (the Bright Star Catalogue number), and the embed page takes the same. The constellation boundaries and the Milky Way are the Earth's directions, so the demo leaves the boundaries out from another star.

## Checking it against astropy

`scripts/check-sky-from.py` moves every star to three viewpoints (Alpha Centauri, Sirius, Vega) a second time with astropy, from the parallaxes and positions, and compares: the two agree to a thousandth of an arc-second and a millionth of a magnitude, with the same stars in both. It is run by hand and not by CI, because it needs Python and astropy: the first lines of the script say how.
