---
title: The stars
section: how-to
order: 2
description: The 5,080 stars of the Yale Bright Star Catalogue, how to find one by name, number or brightness, what each field means, and how a star moves.
---

[日本語](ja/stars.md)

The main entry point is the bright stars: every star of magnitude 6.0 and brighter in the Yale Bright Star Catalogue, which is about all a person can see from a dark place without a telescope. It is a table of about 100 kB gzipped, and no other part of the package imports it unless it has to.

## How many

Magnitude runs the wrong way: the smaller the number, the brighter the star. `stars({ magnitude })` gives the stars as bright as that and brighter, brightest first:

```js
import { stars } from "@johnmorrisdotca/hoshi-stars";

const counts = [1, 2, 3, 4, 5, 6].map((magnitude) => stars({ magnitude }).length);
console.log(counts.join(" "));
// 15 50 174 518 1630 5080
```

That is 15 stars as bright as magnitude 1, 50 to 2, 174 to 3, 518 to 4, 1,630 to 5 and 5,080 to 6. With no option you get all 5,080.

## Find one

```js
import { starByHr, starByName } from "@johnmorrisdotca/hoshi-stars";

console.log(starByName("betelgeuse")?.designation);
console.log(starByName("α Lyr")?.name);
console.log(starByHr(2491)?.name);
console.log(starByName("Atlantis"));
// α Ori
// Vega
// Sirius
// undefined
```

`starByName` takes a common name (335 stars have one, spelled as the IAU Working Group on Star Names spells them) a katakana name (`シリウス`) or a designation, in any case. `starByHr` takes the Bright Star Catalogue number, which never changes. Both give `undefined` for what is not there, never an error.

## What a star holds

| Field | Meaning |
|---|---|
| `hr` | The catalogue number. |
| `name`, `designation` | `Sirius`, `α CMa`. The designation is the Bayer letter, or the Flamsteed number, with the constellation; faint stars have neither. |
| `nameJa` | The name in katakana (`シリウス`) for each star that has a `name`. |
| `constellation` | The IAU abbreviation (`CMa`), where the star has a designation. For any star, [`constellationAt`](constellations-and-lines.md) gives it. |
| `rightAscension`, `declination` | Degrees, J2000. |
| `magnitude` | Visual magnitude. |
| `colourIndex`, `spectralClass` | B-V and the spectral class. See [Colour and distance](colour-and-distance.md). |
| `properMotionRaMas`, `properMotionDecMas` | How the star drifts, in milliarcseconds a year. |
| `parallaxMas` | The parallax; 0 where the catalogue has none. |

Every star is frozen: you cannot change the shared table by accident.

## Where it is now

The positions are for 2000. A star drifts, a very little each year, and `starPosition(star, when)` carries it to a moment. `when` is a `Date` or milliseconds since 1970, because the package never reads the clock:

```js
import { starByName, starPosition } from "@johnmorrisdotca/hoshi-stars";

const arcturus = starByName("Arcturus");
const later = starPosition(arcturus, Date.UTC(2100, 0, 1));
console.log((later.declination - arcturus.declination).toFixed(3), "degrees in 100 years");
// -0.055 degrees in 100 years
```

The result stays in the J2000 frame. It does not turn the sky for precession; `/sky` does that when you ask for a place and a moment (see [Sky charts](sky-charts.md)).
