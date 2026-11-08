# Hoshi Stars 星

The stars you can see without a telescope: 5,080 of them, with names, positions, proper motion, distance and colour. Typed, no dependencies, about 100 kB gzipped. Hoshi (星) is the Japanese word for a star.

```sh
npm install @johnmorrisdotca/hoshi-stars
```

```ts
import { starByName, starColour, starDistanceLightYears, starPosition, stars } from "@johnmorrisdotca/hoshi-stars";

const sirius = starByName("Sirius")!;
console.log(sirius.designation, sirius.magnitude, starColour(sirius));          // α CMa -1.46 #c9daff
console.log(starDistanceLightYears(sirius)?.toFixed(1), "light-years");          // 8.7
console.log(starPosition(starByName("Arcturus")!, Date.UTC(2100, 0, 1)));        // carried by its proper motion
console.log(stars({ magnitude: 2 }).length, "stars as bright as magnitude 2");    // 50
```

| Function | Gives |
|---|---|
| `stars({ magnitude? })` | the stars as bright as a magnitude, brightest first |
| `starByHr(hr)`, `starByName(text)` | one star by its Bright Star Catalogue number, or its name or designation |
| `starPosition(star, when?)` | right ascension and declination (degrees, J2000 frame) carried by proper motion |
| `starDistanceLightYears(star)` | the distance from the parallax |
| `starTemperatureK(bv)`, `blackBodyColour(kelvin)`, `starColour(star)` | temperature and a colour to draw |

Counts: 15 stars to magnitude 1, 50 to 2, 174 to 3, 518 to 4, 1,630 to 5 and 5,080 to 6.

## The 88 constellations

Their own import, about 2 kB gzipped, so the bright-star entry stays small. Each has its IAU abbreviation, Latin name and genitive, English name, and Japanese name with its hiragana reading (`おおいぬ座`, `おおいぬざ`).

```ts
import { constellation, constellations, starsIn } from "@johnmorrisdotca/hoshi-stars/constellations";

const dog = constellation("CMa")!;            // or "Canis Major", "Great Dog", "おおいぬ座", in any case
console.log(dog.name, dog.genitive, dog.english, dog.japanese, dog.reading);   // Canis Major Canis Majoris Great Dog おおいぬ座 おおいぬざ
console.log(constellations().length);                                          // 88
console.log(starsIn("Ori").slice(0, 2).map((s) => s.name));                   // [ 'Rigel', 'Betelgeuse' ]
```

| Function | Gives |
|---|---|
| `constellations()` | all 88, alphabetical by Latin name |
| `constellation(text)` | one, by abbreviation, Latin name, genitive, English name, Japanese name or reading; `undefined` if none |
| `starsIn(text)` | the bright stars that lie in it, brightest first (`RangeError` for a text that is no constellation) |

## Which constellation, and the boundaries

`@johnmorrisdotca/hoshi-stars/boundaries` is its own import. `constellationAt` says which of the 88 constellations a position is in; `boundaryOf` and `boundaries` give the boundary lines to draw. The boundaries are the IAU's (Delporte 1930) as N. G. Roman (1987) tabulated them on the equinox of B1875.0 (VizieR VI/42); a position is precessed to B1875.0 first, with the IAU 1976 angles from Meeus.

```ts
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { boundaryOf, constellationAt } from "@johnmorrisdotca/hoshi-stars/boundaries";

console.log(constellationAt(starByName("Betelgeuse")!).name);                          // Orion
console.log(constellationAt({ rightAscension: 0, declination: 90 }).abbreviation);      // UMi
console.log(constellationAt({ rightAscension: 135, declination: 65 }, Date.UTC(1950, 0, 1)).abbreviation);   // a position of date: UMa
const outline = boundaryOf("Cru").outlines[0]!;    // closed, J2000 degrees, first point repeated as the last
console.log(outline.length, outline[0]);
```

| Function | Gives |
|---|---|
| `constellationAt(position, when?)` | the `Constellation` the J2000 position is in (a position of date when `when` is given); `TypeError` or `RangeError` for bad input |
| `boundaryOf(text, { step? })` | one constellation's `outlines`: closed rings of `{ rightAscension, declination }` in J2000 degrees (Serpens has two) |
| `boundaries({ step? })` | all 88, in the order of `constellations()` |

- Every edge of the boundaries runs along a line of constant right ascension or constant declination on B1875.0, which after precession is a slightly tilted curve. Each edge is cut into pieces of at most `step` degrees of arc (1 by default, 0.01 to 90), so the whole sky is about 9,700 points at the default; join them with straight lines, and project each point (a ring that crosses 0 h jumps from near 360 to near 0 in raw degrees).
- Checked against Roman's own 8 test positions, every one of the 2,736 bright stars whose catalogue entry names a constellation (all agree), and the areas the IAU lists (Hydra 1302.8, Crux 68.4 square degrees; the 88 add up to the whole sky, 41,253).
- A point within a few arc-seconds of a boundary can fall either side: the table is to a hundredth of a second of time and the precession is the modern one, not 1930's.
- About 7 kB gzipped of data on top of the constellations table, and 100,000 lookups take about 40 ms.

## Map projections

`@johnmorrisdotca/hoshi-stars/projection` turns a sky position into a point on a flat chart, and back. Pure maths, no dependencies, and a page that does not import it does not pay for it. The kinds are `stereographic`, `orthographic`, `gnomonic`, `equidistant`, `equirectangular`, `mollweide` and `hammer` (Hammer-Aitoff).

```ts
import { starByName, starPosition } from "@johnmorrisdotca/hoshi-stars";
import { project, unproject } from "@johnmorrisdotca/hoshi-stars/projection";

const options = { centre: { rightAscension: 83.8, declination: -5.4 }, scale: 300 };   // Orion in the middle
const betelgeuse = project("stereographic", starPosition(starByName("Betelgeuse")!), options);
console.log(betelgeuse);                                      // { x: -26.3, y: 67.4 }: left of the middle, above it
console.log(unproject("stereographic", betelgeuse!, options)); // back to degrees
```

- `x` runs right and `y` runs up. The default is the sky seen looking up: north is up and east is to the LEFT, so `x` grows toward decreasing right ascension. Pass `mirror: true` for the map convention, east right.
- `project` gives `undefined` for a point that is not on the visible side (the far hemisphere of `orthographic` and `gnomonic`, the antipode of `stereographic`). `unproject` gives `undefined` outside the map.
- `scale` is the radius of the sky in drawing units (default 1). `rotation` turns the chart anticlockwise, in degrees. For `equirectangular` to give degrees, pass `scale: 180 / Math.PI`.
- `mollweide` and `hammer` are equal-area ovals of the whole sky, 2 sqrt(2) by sqrt(2) times `scale`, turned so the centre is the middle.
- A million projections take 50 to 230 ms on a laptop (Mollweide is the slowest). The formulas are from J. P. Snyder, *Map Projections: A Working Manual* (USGS Professional Paper 1395, 1987).

## Where the data comes from

The Yale Bright Star Catalogue (Hoffleit and Warren 1991), credited in [NOTICE.md](NOTICE.md). The larger catalogues (Hipparcos, Tycho, Gaia) are ESA's, licensed for non-commercial use only, so an MIT package cannot pass them on. Stars fainter than magnitude 6.0 are not in this package.

## Coming

Constellation lines, deep-sky objects, a Milky Way outline and a star-chart function, each its own import. This package is the sky behind [wakusei-planets](https://github.com/johnmorrisdotca/wakusei-planets); it does not depend on it.

## Licence

MIT: see [LICENSE](LICENSE). Data credits are in [NOTICE.md](NOTICE.md).
