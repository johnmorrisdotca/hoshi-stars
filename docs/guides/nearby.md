---
title: What is near
section: how-to
order: 6
description: The stars and Messier objects nearest a star, an object or a point, by angle on the sky or by distance in space, and the constellations that touch a constellation.
---

[日本語](ja/nearby.md)

`@johnmorrisdotca/hoshi-stars/nearest` answers "what is next to this?" in three calls. It reads the bright-star table (and the Messier table for `kind: "deep-sky"`), and the boundaries for the neighbouring constellations.

## In the sky

`nearest(target, options)` gives the nearest first, each `{ thing, angle }` with the angle in degrees. The target is a star, a deep-sky object, a name that `starByName` or `deepSkyObject` accepts, or `{ rightAscension, declination }` in degrees. The target is never in its own answer.

```js
import { nearest, within } from "@johnmorrisdotca/hoshi-stars/nearest";

const pair = nearest("Mizar", { count: 3 });
console.log(pair.map((n) => `${n.thing.name ?? n.thing.hr} ${n.angle.toFixed(2)}`));
console.log(within("Alcyone", 1, { magnitude: 5 }).map((n) => n.thing.name));
// [ '5055 0.00', 'Alcor 0.20', '5109 1.52' ]
// [ 'Merope', 'Atlas', 'Maia', 'Electra', 'Taygeta' ]
```

Mizar is a double star: the nearest thing is its companion (HR 5055), and Alcor is 0.20 degree away. `within(target, radius)` is `nearest` with no limit on the count. The options:

| Option | Does |
|---|---|
| `count` | how many (10 for `nearest`; `within` gives all) |
| `within` | only answers this near: degrees by sky, light-years by space |
| `kind` | `"star"` (default) or `"deep-sky"` (the Messier objects) |
| `magnitude` | the faintest to include, as in `stars({ magnitude })` (a thing of exactly that magnitude is in) |
| `date` | carry the stars to this moment by proper motion first. Precession turns every object the same way, so it does not change an angle |
| `among` | look through your own list, for example `deepSky()` from `/deep-sky/ngc-ic` |
| `by` | `"sky"` (default) or `"space"` |

The angle is measured with `atan2(|a x b|, a . b)` on unit vectors, which stays exact at 0 and at 180 degrees, at the poles and across right ascension 0 and 360. A query over all 5,080 stars takes about 1 millisecond; nothing is indexed.

## In space

With `by: "space"` each star is placed from its parallax, and the answer is `{ thing, distance, parsecs, error }`: the straight-line distance in light-years and in parsecs.

```js
import { nearest } from "@johnmorrisdotca/hoshi-stars/nearest";

const close = nearest("Sirius", { by: "space", count: 2 });
console.log(close.map((n) => `${n.thing.name} ${n.distance.toFixed(1)}`));
console.log(close.skipped, close[0].error);
// [ 'Procyon 5.1', 'Ran 8.0' ]
// 2547 undefined
```

- **Only this catalogue.** The answers cover the 2,533 of the 5,080 stars that have a parallax; Sirius's nearest neighbour here is Procyon, though fainter, closer stars exist that are not in the table. They will change when a nearby-star catalogue lands.
- **`skipped`** is how many candidates had no usable distance (a parallax of 0 or less, or a deep-sky object) and were left out.
- **`error`** is `undefined`: the Yale catalogue gives each parallax to a whole milliarcsecond and no error, so none can be worked out. A distance is good to a few per cent within 100 light-years and not at all for a faint, far star.
- The target needs a distance: a star with a parallax, `{ rightAscension, declination, lightYears }`, or a point `{ x, y, z }` in parsecs on the J2000 equatorial axes with the Sun at the origin.

## Constellations that touch

```js
import { neighbouringConstellations } from "@johnmorrisdotca/hoshi-stars/nearest";

console.log(neighbouringConstellations("Orion").map((c) => c.abbreviation));
// [ 'Eri', 'Gem', 'Lep', 'Mon', 'Tau' ]
```

Two constellations are neighbours when they share a piece of boundary; meeting at a corner does not count. The table is worked out from the IAU boundaries the first time it is needed (a few milliseconds) and kept. The answer is in the alphabetical order of the Latin names.
