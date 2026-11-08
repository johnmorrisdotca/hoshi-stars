---
title: Constellations and their lines
section: how-to
order: 4
description: The 88 constellations by name in English or Japanese, which one a point is in, their boundaries to draw, and a stick figure for each.
---

[日本語](ja/constellations-and-lines.md)

Three entry points, each its own import so a chart without them stays small: `/constellations` (the names, about 2 kB), `/boundaries` (which constellation a point is in, and the outlines, about 7 kB more) and `/lines` (a stick figure for each, about 2 kB).

## The 88

```js
import { constellation, constellations, starsIn } from "@johnmorrisdotca/hoshi-stars/constellations";

const dog = constellation("おおいぬ座");
console.log(dog.abbreviation, dog.name, dog.english, dog.japanese, dog.reading);
console.log(constellations().length, starsIn("Canis Major").slice(0, 3).map((star) => star.name));
// CMa Canis Major Great Dog おおいぬ座 おおいぬざ
// 88 [ 'Sirius', 'Adhara', 'Wezen' ]
```

`constellation` takes any of the names (the IAU abbreviation, the Latin name or genitive, the English name, the Japanese name with or without 座, in katakana or hiragana, or the hiragana reading) in any case, and gives `undefined` for something else. `starsIn` gives the bright stars in it, brightest first.

## Which constellation is this point in

`constellationAt` takes any J2000 position, not only a star's. The boundaries are the IAU's, from N. G. Roman's table of Delporte's lines, and the answer is exact right up to the line:

```js
import { constellationAt } from "@johnmorrisdotca/hoshi-stars/boundaries";

console.log(constellationAt({ rightAscension: 88.79, declination: 7.41 }).name);
console.log(constellationAt({ rightAscension: 0, declination: 90 }).name);
// Orion
// Ursa Minor
```

`boundaryOf("Ori")` gives the outline as closed rings of `{ rightAscension, declination }`, with a point every degree, ready to project and join with straight lines. A ring that crosses 0 h jumps from near 360 to near 0 in raw degrees: project each point first, and lift your pen where two neighbours land far apart on a wide chart.

## The lines

Each constellation has a stick figure, our own, as pairs of its bright stars:

```js
import { figureOf, figures } from "@johnmorrisdotca/hoshi-stars/lines";

const dipper = figureOf("UMa");
for (const [a, b] of dipper.segments.slice(0, 3)) console.log(a.name, "to", b.name);
console.log(figures().length, "figures;", dipper.stars.length, "stars in the Great Bear's");
// Dubhe to Merak
// Merak to Phecda
// Phecda to Megrez
// 88 figures; 9 stars in the Great Bear's
```

A figure is `{ constellation, stars, segments }`, and each segment is a pair of stars you can project and join. Every star of a line is inside its own constellation, so a figure never runs into the next; that is why a few shapes you know from a book are open here (the Great Square of Pegasus has no Alpheratz corner, because Alpheratz belongs to Andromeda). The figures are drawn from the star data, not copied from any book, atlas or program (see [Data and licences](data-and-licences.md)).
