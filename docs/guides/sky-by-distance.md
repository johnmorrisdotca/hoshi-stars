---
title: The sky by distance
section: how-to
order: 13
description: How to show the stars and galaxies out to 10, 50, 100, 500 or 1,000 light-years, each distance band in its own colour, on the sky map and in 3D, with the things whose distance is uncertain kept apart and none placed at a guess.
---

[日本語](ja/sky-by-distance.md)

`@johnmorrisdotca/hoshi-stars/distance` answers "what is in the sky out to X light-years?" It takes the stars, nearby stars and galaxies your page already loaded, so a page pays only for the tables it uses, and gives back the ones nearer than a limit, each in the band of its distance. The demo uses it twice: on the sky map (a **Distance** row of choices, each band in its own colour, a legend that counts each band) and in 3D (`layers-3d.html`, the Earth in the middle, shells at 10, 50, 100, 500 and 1,000 light-years, stepped out one at a time).

## What is in a layer, and what is never put there

- **The bands** are 0 to 10 light-years, 10 to 50, 50 to 100, 100 to 500, 500 to 1,000 and beyond (`bandOf`, and `DISTANCE_LIMITS` for the edges). A distance exactly at an edge is in the nearer band.
- **A distance known well** (a parallax with an error of 20% or less: `good` under 5%, `fair` from 5% to 20%, from `certaintyOf` and `CERTAINTY_LIMITS`, the same limits the constellation in 3D uses) puts the thing at its best distance, in its band.
- **A distance that is uncertain** (`rough`: the error is over 20% of the parallax, or none is stated, or a galaxy's sources disagree by more than 1.2 times) puts the thing in no band. It is kept apart as **uncertain**, with the nearest and farthest its error allows, and is counted separately. On the map it is a ring where it is on the sky; in 3D it is a streak along its line of sight over that range, with no dot, because no exact place is known. Under a limit it is kept when the nearest its error allows is inside the limit.
- **A thing with no distance** is counted (`unknown`) and never drawn at all. Nothing is placed at a guess.

## Use

`starInput` (a bright star), `nearbyInput` (a star of `/nearby`) and `deepSkyInput` (a deep-sky object with the distance of `galaxyDistance`, or `null`) turn what you have into the `DistanceInput` that `layersByDistance` takes (a `LayerKind` says which it was). It gives back `DistanceLayers`: the `LayeredThing`s within the limit, nearest first (each with its band, its range and whether it is uncertain), the count in each band, the uncertain count and the count with no distance.

```js
import { stars } from "@johnmorrisdotca/hoshi-stars";
import { galaxyDistance, messier } from "@johnmorrisdotca/hoshi-stars/deep-sky";
import { deepSkyInput, layersByDistance, nearbyInput, starInput, stepLimit } from "@johnmorrisdotca/hoshi-stars/distance";
import { nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";

// Everything that has a place on the sky: the bright stars, the nearby stars and the Messier objects, each with the distance its table gives (or none).
const everything = [...stars().map(starInput), ...nearbyStars().map(nearbyInput), ...messier().map((object) => deepSkyInput(object, galaxyDistance(object)))];

// Step the limit out, 10 light-years at a time to start with, and see the sky fill shell by shell.
let limit = 10;
for (let step = 0; step < 6; step += 1) {
  const layers = layersByDistance(everything, { limit });
  console.log(`${limit}: ${layers.things.length} things; bands ${layers.counts.join(" ")}; ${layers.uncertain} uncertain; ${layers.unknown} with no distance`);
  limit = stepLimit(limit, 1);
}

// A star whose distance is uncertain is in no band: it is kept apart, with the range its error allows.
const rigel = layersByDistance(everything, { limit: 700 }).things.find((thing) => thing.name === "Rigel");
console.log(rigel.uncertain, Math.round(rigel.low), Math.round(rigel.high));

// 10: 9 things; bands 9 0 0 0 0 0; 0 uncertain; 3083 with no distance
// 50: 897 things; bands 9 665 0 0 0 0; 223 uncertain; 3083 with no distance
// 100: 4130 things; bands 9 665 870 0 0 0; 2586 uncertain; 3083 with no distance
// 500: 7497 things; bands 9 665 870 329 0 0; 5624 uncertain; 3083 with no distance
// 1000: 7568 things; bands 9 665 870 329 11 0; 5684 uncertain; 3083 with no distance
// Infinity: 7672 things; bands 9 665 870 329 11 37; 5751 uncertain; 3083 with no distance
// true 593 1483
```

`stepLimit(limit, 1)` goes 10, 50, 100, 500, 1,000 and then all (`Infinity`); `-1` goes back. A free slider is `limitAtSlider(position)` and `sliderOfLimit(limit)`, a log scale over `SLIDER_RANGE` (4 light-years to 3 million) whose end is all. The limit is kept in the address as `dist` (`limitFromText` reads it: a number of light-years or `all`; missing, `off` or not a number is no layers; `limitText` writes it), and a page that offers it as an attribute names it `distance-limit` (`DISTANCE_ATTRIBUTE`). It is off until asked for.

## On the sky map

The demo's map has a **Distance** row: Off, 10, 50, 100, 500, 1,000, All, with Nearer and Farther to step and a slider for a limit of your own. A choice draws only the things within it, each in the colour of its band (warm gold near, then orange, coral, magenta, violet and blue far), a diamond for a galaxy, a ring for an uncertain one. The legend counts each band and says how many have no distance and are left out. The faintest-star limit and the faint layer are not used while a distance is chosen, because the nearest stars are faint ones. The choice is `dist=` in the address, and the embed page (`embed.html?dist=100`) and the code to copy follow it.

## In 3D

`layers-3d.html` draws the same layers round the Earth. Out to 1,000 light-years the scale is true and linear, and the page says so; beyond that, each ring is ten times the one inside (compressed, and the page says that too). Drag to turn it, step the limit out to fill the sky shell by shell, and use the shared view controls. It opens turning, held still with Pause (`spin=off`), and still with Play ready for a reader who prefers reduced motion. One WebGL context draws it, at most 30 frames a second, and nothing is drawn at rest or out of sight. The embed page (`embed-layers.html?dist=100`) has the same view with Nearer and Farther buttons and a legend.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hoshi Stars by distance</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/embed.html?dist=100&proj=hammer&ra=180&dec=0&zoom=1&layers=milky"
      title="The sky out to 100 light-years, each distance band in its own colour"
      width="480"
      height="240"
      loading="lazy"
      style="border: 0"
    ></iframe>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/embed-layers.html?dist=100"
      title="The sky out to 100 light-years in 3D"
      width="480"
      height="360"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

## Where the distances come from

A star's distance is 3,261.56 divided by its parallax in milliarcseconds, from the Yale catalogues of bright stars (`starInput`) and of trigonometric parallaxes (`nearbyInput`), with the error of the parallax. A galaxy's is the median of the distances Wikidata gives, with their spread (`deepSkyInput`). No new data was added for this: the sources and their licences are in `NOTICE.md`.
