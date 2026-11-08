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

Constellations with English and Japanese names, deep-sky objects, a Milky Way outline and a star-chart function, each its own import. This package is the sky behind [wakusei-planets](https://github.com/johnmorrisdotca/wakusei-planets); it does not depend on it.

## Licence

MIT: see [LICENSE](LICENSE). Data credits are in [NOTICE.md](NOTICE.md).
