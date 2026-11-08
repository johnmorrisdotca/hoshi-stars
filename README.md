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

No lines or boundaries yet.

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

## Your sky, and the sky from another planet

`@johnmorrisdotca/hoshi-stars/sky` says where a star stands over your head: its altitude above the horizon and its azimuth (degrees from north through east) at a place and a moment. Pure maths, no dependencies, and a page that does not import it does not pay for it.

```ts
import { starByName, starPosition } from "@johnmorrisdotca/hoshi-stars";
import { horizontal, isAboveHorizon, localSiderealTime } from "@johnmorrisdotca/hoshi-stars/sky";

const vancouver = { latitude: 49.28, longitude: -123.12 };   // degrees north, degrees east
const now = new Date("2026-11-08T06:00:00Z");
console.log(horizontal(starPosition(starByName("Sirius")!), vancouver, now)); // { altitude: ..., azimuth: ... }
console.log(horizontal(starPosition(starByName("Polaris")!), vancouver, now).altitude); // 49.8: within a degree of your latitude
console.log(isAboveHorizon(starPosition(starByName("Sirius")!), vancouver, now));
console.log(localSiderealTime(now, vancouver.longitude));      // the right ascension on your meridian
```

- `horizontal(position, observer, when, options?)` takes a J2000 position (any `{ rightAscension, declination }` in degrees, such as `starPosition(star)`), carries it to the date (`precess`, IAU 1976), finds the hour angle from the local mean sidereal time (`greenwichSiderealTime`, IAU 1982) and returns `{ altitude, azimuth }`. A position that is already of the date (a planet from an almanac) takes `equinox: "date"`.
- The altitude is geometric. `refraction: true` adds the bending of light by the air (Saemundsson's formula: about 0.48 degree at the horizon, 0.017 at 45 degrees up, none at the zenith), with `pressureHpa` (default 1010) and `temperatureC` (default 10); it is not applied below -1 degree. `isAboveHorizon` takes the same options.
- Accuracy: about an arc-minute. UTC stands for UT, and nutation, aberration, parallax and the star's own proper motion (add it with `starPosition(star, when)`) are left out. `heightM` is checked but changes nothing for a star.

### From another planet

The sky of another planet turns about that planet's own pole. `horizontalFrom(position, spin, observer, when)` takes the pole and prime meridian as the IAU Working Group on Cartographic Coordinates and Rotational Elements (WGCCRE) gives them, so the planet data stays with you (this package never imports wakusei-planets):

```ts
import { starByName, starPosition } from "@johnmorrisdotca/hoshi-stars";
import { horizontalFrom } from "@johnmorrisdotca/hoshi-stars/sky";

// Mars, IAU 2015 values at J2000: pole right ascension and declination, and W = w0 + rate * days since J2000
const mars = { pole: { rightAscension: 317.269202, declination: 54.432516 }, primeMeridian: { w0: 176.049863, rate: 350.891982443297 } };
const deneb = starPosition(starByName("Deneb")!);
console.log(horizontalFrom(deneb, mars, { latitude: 90, longitude: 0 }, new Date()).altitude); // 79.8: Deneb is 10 degrees from Mars's pole
```

- **The stars look the same from every planet.** The nearest star, Proxima Centauri, shifts about 40 arc-seconds seen from Pluto (parallax 0.77 arc-second times 49 AU at the farthest), a typical star far less, so a J2000 position serves anywhere in the solar system. Only the pole and the turning change.
- `rate` is degrees a day and may be negative (Venus and Uranus turn the other way). The pole's slow drift and the periodic terms of the IAU tables are not applied: pass the pole for the date if you want them. The moment is read as TDB, so UTC is about 69 seconds early, which turns Mars by 0.28 degree. Latitude is the angle from the planet's equator on a sphere.
- A spin equal to the Earth's gives the Earth's sky (pole at declination 90 and right ascension 270, `w0` 280.46061837, `rate` 360.98564736629), apart from the precession since J2000.
- A hundred thousand `horizontal` conversions take about 26 ms on a laptop. The formulas are from J. Meeus, *Astronomical Algorithms* (2nd ed.), chapters 12, 13, 16 and 21.

## Where the data comes from

The Yale Bright Star Catalogue (Hoffleit and Warren 1991), credited in [NOTICE.md](NOTICE.md). The larger catalogues (Hipparcos, Tycho, Gaia) are ESA's, licensed for non-commercial use only, so an MIT package cannot pass them on. Stars fainter than magnitude 6.0 are not in this package.

## Coming

Constellation lines and boundaries, deep-sky objects, a Milky Way outline and a star-chart function, each its own import. This package is the sky behind [wakusei-planets](https://github.com/johnmorrisdotca/wakusei-planets); it does not depend on it.

## Licence

MIT: see [LICENSE](LICENSE). Data credits are in [NOTICE.md](NOTICE.md).
