<p align="center"><a href="https://johnmorrisdotca.github.io/hoshi-stars/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/johnmorrisdotca/hoshi-stars/main/docs/images/thumbnail-dark.png"><img src="https://raw.githubusercontent.com/johnmorrisdotca/hoshi-stars/main/docs/images/thumbnail.png" alt="Hoshi Stars: a sky chart of Orion with its constellation lines, on the soft band of the Milky Way." width="1200"></picture></a></p>

# Hoshi Stars 星

<p>Part of <strong>SpaceProgramX (SPX)</strong>, the space packages: <a href="https://github.com/johnmorrisdotca/wakusei-planets">Wakusei Planets</a> · <a href="https://github.com/johnmorrisdotca/hoshi-stars">Hoshi Stars</a> · <a href="https://github.com/johnmorrisdotca/chikyu-earth">Chikyu Earth</a> · <a href="https://github.com/johnmorrisdotca/uchusen-rockets">Uchusen Rockets</a></p>

**[Try the demo](https://johnmorrisdotca.github.io/hoshi-stars/)**: a sky chart you turn, zoom and search, in English and Japanese.

The stars you can see without a telescope: 5,080 of them, with names, positions, proper motion, distance and colour. Typed, no dependencies, about 100 kB gzipped. Hoshi (星) is the Japanese word for a star.

```sh
npm install @johnmorrisdotca/hoshi-stars
```

```ts
import { starByName, starColour, starDistanceLightYears, starPosition, stars } from "@johnmorrisdotca/hoshi-stars";

const sirius = starByName("Sirius")!;
console.log(sirius.designation, sirius.magnitude, starColour(sirius));          // α CMa -1.46 #c9daff
console.log(starDistanceLightYears(sirius)?.toFixed(1), "light-years");          // 8.7 light-years
console.log(starPosition(starByName("Arcturus")!, Date.UTC(2100, 0, 1)).rightAscension.toFixed(1));   // 213.9
console.log(stars({ magnitude: 2 }).length, "stars as bright as magnitude 2");    // 50 stars as bright as magnitude 2
```

| Function | Gives |
|---|---|
| `stars({ magnitude? })` | the stars as bright as a magnitude, brightest first |
| `starByHr(hr)`, `starByName(text)` | one star by its Bright Star Catalogue number, or its name (English or katakana) or designation |
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

## Constellation lines

`@johnmorrisdotca/hoshi-stars/lines` is its own import, about 2 kB gzipped, so a chart without lines pays nothing. Each of the 88 constellations has a stick figure: pairs of its bright stars to join with a line. The figures are our own, decided from the star data (`NOTICE.md`); every star of a line lies inside the constellation, so one figure never runs into the next.

```ts
import { figureOf, figures } from "@johnmorrisdotca/hoshi-stars/lines";

const orion = figureOf("Ori");               // or "Orion", "Hunter", "オリオン座"
console.log(orion.stars.length, orion.segments.length);
for (const [a, b] of orion.segments) console.log(a.name ?? a.designation, "to", b.name ?? b.designation);
console.log(figures().length);               // 88
```

| Function | Gives |
|---|---|
| `figures()` | all 88 figures, in the order of `constellations()` |
| `figureOf(text)` | one, by any name `constellation` accepts: its `constellation`, the `stars` it uses and the `segments` (pairs of stars) to draw (`RangeError` for a text that is no constellation) |

- Project each star with `/projection` and draw each pair as a line. On a wide projection (equirectangular, Mollweide, Hammer) skip a line whose two ends land more than half the chart apart: it crosses the edge.
- A figure with one star and no lines is allowed where a figure makes no sense; every constellation at this version has lines.

## Map projections

`@johnmorrisdotca/hoshi-stars/projection` turns a sky position into a point on a flat chart, and back. Pure maths, no dependencies, and a page that does not import it does not pay for it. The kinds are `stereographic`, `orthographic`, `gnomonic`, `equidistant`, `equirectangular`, `mollweide` and `hammer` (Hammer-Aitoff).

```ts
import { starByName, starPosition } from "@johnmorrisdotca/hoshi-stars";
import { project, unproject } from "@johnmorrisdotca/hoshi-stars/projection";

const options = { centre: { rightAscension: 83.8, declination: -5.4 }, scale: 300 };   // Orion in the middle
const betelgeuse = project("stereographic", starPosition(starByName("Betelgeuse")!), options);
console.log(betelgeuse!.x.toFixed(1), betelgeuse!.y.toFixed(1));            // -26.3 67.4
console.log(unproject("stereographic", betelgeuse!, options).rightAscension.toFixed(1));   // 88.8
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
console.log(horizontalFrom(deneb, mars, { latitude: 90, longitude: 0 }, new Date()).altitude.toFixed(1)); // 79.8
```

- **The stars look the same from every planet.** The nearest star, Proxima Centauri, shifts about 40 arc-seconds seen from Pluto (parallax 0.77 arc-second times 49 AU at the farthest), a typical star far less, so a J2000 position serves anywhere in the solar system. Only the pole and the turning change.
- `rate` is degrees a day and may be negative (Venus and Uranus turn the other way). The pole's slow drift and the periodic terms of the IAU tables are not applied: pass the pole for the date if you want them. The moment is UTC, like every moment here; it is turned into Terrestrial Time inside (leap seconds from 1972, delta T before), which turns Mars by 0.28 degree. A leap second announced after 2017 is not known until the table in `src/time-scale.ts` gets its row. Latitude is the angle from the planet's equator on a sphere.
- A spin equal to the Earth's gives the Earth's sky (pole at declination 90 and right ascension 270, `w0` 280.46061837, `rate` 360.98564736629), apart from the precession since J2000.
- A hundred thousand `horizontal` conversions take about 26 ms on a laptop. The formulas are from J. Meeus, *Astronomical Algorithms* (2nd ed.), chapters 12, 13, 16 and 21.

## Deep-sky objects

Two imports, so a page pays only for what it uses. `@johnmorrisdotca/hoshi-stars/deep-sky` is the 110 Messier objects (about 3 kB gzipped); `@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic` adds the NGC and IC objects, 11,898 in all (about 150 kB gzipped). Both have the same three functions. The data is Wikidata's (CC0), read on 2026-11-08 and checked against NASA/IPAC NED; the numbers are in [NOTICE.md](NOTICE.md).

```ts
import { deepSky, deepSkyObject, messier } from "@johnmorrisdotca/hoshi-stars/deep-sky";

const m31 = deepSkyObject("M31")!;              // or "NGC 224", "Messier 31", "Andromeda Galaxy", in any case
console.log(m31.id, m31.ngc, m31.name, m31.type, m31.magnitude);                  // M31 NGC 224 Andromeda Galaxy galaxy 3.4
console.log(m31.rightAscension.toFixed(3), m31.declination.toFixed(3));           // 10.685 41.269
console.log(messier().length, deepSky({ type: "globular cluster" }).length);      // 110 29
console.log(deepSky({ magnitude: 4 }).map((o) => o.id));                          // [ 'M7', 'M31', 'M42', 'M44', 'M45' ]
```

| Function | Gives |
|---|---|
| `messier()` | the 110, M1 to M110 (in `/deep-sky` only) |
| `deepSky({ catalogue?, magnitude?, type? })` | the objects that meet the options, in catalogue order: Messier, then NGC, then IC. `catalogue` is `"messier"`, `"ngc"` or `"ic"` (objects with a number in it); `magnitude` the faintest to include |
| `DEEP_SKY_CATALOGUES`, `DEEP_SKY_TYPES` | the catalogue names `catalogue` takes (`"messier"`, `"ngc"`, `"ic"`) and the kinds of object `type` takes |
| `deepSkyObject(text)` | one object by `M31`, `NGC 224`, `IC 434`, any other NGC or IC number it carries, or an English name; `undefined` if none |

An object has `id`, `messier`, `ngc`, `ic` (each a string such as `"NGC 224"`), `otherIds`, `name`, `type` (`galaxy`, `globular cluster`, `open cluster`, `nebula`, `planetary nebula`, `supernova remnant` or `other`), `constellation` (the IAU abbreviation), `rightAscension` and `declination` (degrees, J2000), `magnitude` (visual, or `undefined`) and `sizeArcmin` (the major axis, or `undefined`).

- **M102** is the Messier object nobody can agree on: Messier's own description fits M101, and the modern lists take it for the galaxy NGC 5866, which is what this table does. **M40** is a double star (Winnecke 4) and **M73** four stars in a row; both are `other`, because Messier listed them.
- **Magnitudes and sizes of the Messier objects** are the published visual magnitudes and major axes of NASA HEASARC's Messier table, because Wikidata's V-band magnitudes for 14 of them are more than a magnitude off (the central star's, for the four planetary nebulae). The NGC and IC magnitudes are Wikidata's, except that a planetary nebula has none (Wikidata's is its central star's); about four in ten have none, and almost none has a size.
- **Positions** are Wikidata's. Every Messier object was compared with NED and a sample of the others too; the objects that were more than an arc-minute apart are listed in [NOTICE.md](NOTICE.md), and where Wikidata was wrong the table has NED's position.

## The Milky Way

`@johnmorrisdotca/hoshi-stars/milky-way` is a brightness map of the Milky Way in about 11 kB: the band along the galactic equator, the bright core toward Sagittarius, and the Great Rift, the Coalsack and the Cygnus Rift as dimmer places. It is made by `scripts/make-milky-way-data.py` from SAO star counts, NASA's IRAS 100 micron dust map and a bulge of our own figures (see [NOTICE.md](NOTICE.md)); no picture of the sky is traced.

```ts
import { milkyWayBands, milkyWayBrightness } from "@johnmorrisdotca/hoshi-stars/milky-way";

console.log(milkyWayBrightness({ rightAscension: 266.4, declination: -28.9 }) > 0.7);  // true
console.log(milkyWayBands([0.2, 0.5]).map((band) => band.strips.length));              // [ 188, 10 ]
```

`milkyWayBrightness(point)` is 0 (dark sky) to 1 (the core); `milkyWayBands(levels, { step })` gives ribbons of sky points for `project`; `toGalactic` and `fromGalactic` change the frame. The demo draws it as soft bands under the stars, in every projection, and its **Milky Way** button turns it off.

## What is near

`@johnmorrisdotca/hoshi-stars/nearest` finds the stars (or Messier objects) nearest a star, an object, a name or a point, by angle on the sky or by distance in space, and the constellations that touch a constellation. One query over all 5,080 stars takes about 1 ms (0.5 to 1.1 ms on a laptop, measured by `test/nearest.test.ts`); there is no index, every star is looked at.

```ts
import { nearest, neighbouringConstellations, within } from "@johnmorrisdotca/hoshi-stars/nearest";

const alcor = nearest("Mizar", { count: 3 }).find((n) => n.thing.name === "Alcor")!;
console.log(alcor.angle.toFixed(2));                                                          // 0.20
console.log(within("Alcyone", 1, { magnitude: 5 }).length);                                // 5
const close = nearest("Sirius", { by: "space", count: 2 });
console.log(close.map((n) => `${n.thing.name} ${n.distance.toFixed(1)}`));                    // [ 'Procyon 5.1', 'Ran 8.0' ]
console.log(close.skipped);                                                                   // 2547
console.log(nearest("M31", { kind: "deep-sky", count: 2 }).map((n) => n.thing.id));          // [ 'M32', 'M110' ]
console.log(neighbouringConstellations("Ori").map((c) => c.abbreviation));                    // [ 'Eri', 'Gem', 'Lep', 'Mon', 'Tau' ]
```

| Function | Gives |
|---|---|
| `nearest(target, { count?, within?, by?, kind?, date?, magnitude?, among? })` | the nearest first, each `{ thing, angle }` (degrees) or, with `by: "space"`, `{ thing, distance, parsecs, error }` (light-years) |
| `within(target, radius, options?)` | all of them within a radius (degrees, or light-years by space) |
| `neighbouringConstellations(text)` | the constellations that share a piece of boundary |

The target is a star, a deep-sky object, a name (`"Mizar"`, `"M31"`), `{ rightAscension, declination }` or, by space, a point `{ x, y, z }` in parsecs. The three-dimensional answers cover only this catalogue: the 2,533 stars of the 5,080 that have a parallax, and the parallaxes are whole milliarcseconds, so `error` is `undefined` and `skipped` counts the stars left out. They will change when a nearby-star catalogue lands. [What is near](https://johnmorrisdotca.github.io/hoshi-stars/docs/) has the details.

## Put a chart in a page

The package gives numbers; a chart is a few lines of SVG. In React, for example (Vue, Svelte, Angular, Vite, webpack, a plain `<script type="module">` from a CDN, Node and TypeScript are in the [guides](https://johnmorrisdotca.github.io/hoshi-stars/docs/)):

```tsx
import { starColour, stars, type Star } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

const view = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };

function place(star: Star): { x: number; y: number } | undefined {
  const at = project("stereographic", star, view);
  return at && { x: 200 + at.x, y: 200 - at.y };
}

function orionSvg(): string {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Orion"><rect width="400" height="400" fill="#0b1020"/>`;
  for (const [a, b] of figureOf("Ori").segments) {
    const from = place(a);
    const to = place(b);
    if (from && to) svg += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#6f93e0"/>`;
  }
  for (const star of stars({ magnitude: 4 })) {
    const at = place(star);
    if (at) svg += `<circle cx="${at.x}" cy="${at.y}" r="${Math.max(1, 4.2 - star.magnitude * 0.7)}" fill="${starColour(star)}"/>`;
  }
  return svg + "</svg>";
}

export function Orion() {
  return <div dangerouslySetInnerHTML={{ __html: orionSvg() }} />;
}
```

For a page that cannot run script, use the embed page in an iframe; the demo's "Put it in your page" panel writes the address for the chart you are looking at:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hoshi Stars in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/embed.html?proj=stereographic&ra=84&dec=0&zoom=1.5&mag=5&layers=lines,names&c=Ori"
      title="A chart of the sky around Orion"
      width="480"
      height="360"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

Docs: https://johnmorrisdotca.github.io/hoshi-stars/docs/ , with a Japanese page for every guide. The embed page is https://johnmorrisdotca.github.io/hoshi-stars/embed.html .

## Where the data comes from

The Yale Bright Star Catalogue (Hoffleit and Warren 1991), credited in [NOTICE.md](NOTICE.md). The larger catalogues (Hipparcos, Tycho, Gaia) are ESA's, licensed for non-commercial use only, so an MIT package cannot pass them on. Stars fainter than magnitude 6.0 are not in this package. The deep-sky objects are Wikidata's (CC0), with NASA HEASARC's Messier table and NED as checks. The Milky Way's brightness comes from SAO star counts (NASA HEASARC; no licence stated, used with credit and removed on request) and NASA's IRAS and COBE dust maps.

## Coming

A star-chart function as its own import. This package is the sky behind [wakusei-planets](https://github.com/johnmorrisdotca/wakusei-planets); it does not depend on it.

## The family

<!-- family:start (made by scripts/family-readme.mjs from scripts/family-template.mjs; change those, not this) -->
Hoshi Stars is one of thirty-seven packages, each made for the same site, each at
[github.com/johnmorrisdotca](https://github.com/johnmorrisdotca) or [github.com/spxis](https://github.com/spxis). The code of every one is MIT.

**Games — board**

- [Domino](https://github.com/johnmorrisdotca/domino) (ドミノ): dominoes and Mexican Train. [Demo](https://johnmorrisdotca.github.io/domino/).
- [Gunjin](https://github.com/johnmorrisdotca/gunjin) (軍人): five hidden-rank strategy games with pass-the-device play. [Demo](https://johnmorrisdotca.github.io/gunjin/).
- [Narabe](https://github.com/johnmorrisdotca/narabe) (並べ): one rules engine for abstract board games, from gomoku and Reversi to Go and checkers. [Demo](https://johnmorrisdotca.github.io/narabe/).
- [Sugoroku](https://github.com/johnmorrisdotca/sugoroku) (双六): backgammon and its variants, with the doubling cube and match play. [Demo](https://johnmorrisdotca.github.io/sugoroku/).
- [Tenka](https://github.com/johnmorrisdotca/tenka) (天下): world conquest for two to six, on a map of the real world. [Demo](https://johnmorrisdotca.github.io/tenka/).

**Games — cards & tiles**

- [Hitotsu](https://github.com/johnmorrisdotca/hitotsu) (一つ): a colour-card shedding game for two to eight, with the house rules people play. [Demo](https://johnmorrisdotca.github.io/hitotsu/).
- [Jarajara](https://github.com/johnmorrisdotca/jarajara) (ジャラジャラ): mahjong tiles drawn as SVG, stacked layouts, and the matching solitaire Awase. [Demo](https://johnmorrisdotca.github.io/jarajara/).
- [Kumimoji](https://github.com/johnmorrisdotca/kumimoji) (組み文字): a crossword tile race, in English and Japanese kana. [Demo](https://johnmorrisdotca.github.io/kumimoji/).
- [Toranpu](https://github.com/johnmorrisdotca/toranpu) (トランプ): a deck of playing cards, card games with computer players, and solitaires. [Demo](https://johnmorrisdotca.github.io/toranpu/).

**Games — puzzles**

- [Houseki](https://github.com/johnmorrisdotca/houseki) (宝石): gem and stone matching puzzles: falling triplets, stone collapse, colour chains and gem swap. [Demo](https://johnmorrisdotca.github.io/houseki/).
- [Jirai](https://github.com/johnmorrisdotca/jirai) (地雷): minesweeper on shaped grids with verified no-guess boards. [Demo](https://johnmorrisdotca.github.io/jirai/).
- [Karakuri](https://github.com/johnmorrisdotca/karakuri) (からくり): eight hyper-casual puzzle games, some of them physics: draw a shield, pull pins, cut ropes, slide blocks, pour tubes. [Demo](https://johnmorrisdotca.github.io/karakuri/).
- [Kazu](https://github.com/johnmorrisdotca/kazu) (数): grid number puzzles: Sudoku and its variants, Futoshiki and Skyscrapers. [Demo](https://johnmorrisdotca.github.io/kazu/).
- [Kyuubu](https://github.com/johnmorrisdotca/kyuubu) (キューブ): a turning cube for the browser, 2×2 to 7×7, with record solves to replay. [Demo](https://johnmorrisdotca.github.io/kyuubu/).
- [Meikyuu](https://github.com/johnmorrisdotca/meikyuu) (迷宮): mazes on squares, hexagons, triangles and circles, made from a seed and drawn through with a finger or the mouse. [Demo](https://johnmorrisdotca.github.io/meikyuu/).
- [Suido](https://github.com/johnmorrisdotca/suido) (水道): a pipe puzzle: turn the pieces until the water reaches every drain. [Demo](https://johnmorrisdotca.github.io/suido/).
- [Tobiishi](https://github.com/johnmorrisdotca/tobiishi) (飛び石): peg solitaire with nine boards and seeded solvable challenges. [Demo](https://johnmorrisdotca.github.io/tobiishi/).
- [Tsunagi](https://github.com/johnmorrisdotca/tsunagi) (繋ぎ): a line-joining logic puzzle whose every level has exactly one answer. [Demo](https://johnmorrisdotca.github.io/tsunagi/).

**Games — dice & random**

- [Korokoro](https://github.com/johnmorrisdotca/korokoro) (コロコロ): dice, with notation, exact odds, real sounds and the dice of many games. [Demo](https://johnmorrisdotca.github.io/korokoro/).
- [Tane](https://github.com/johnmorrisdotca/tane) (種): seeded random numbers and daily seeds, the same in every browser and on every server. [Demo](https://johnmorrisdotca.github.io/tane/).

**Language**

- [Bushu](https://github.com/johnmorrisdotca/bushu) (部首): find a kanji by the parts it is made of. [Demo](https://johnmorrisdotca.github.io/bushu/).
- [Hikidashi](https://github.com/johnmorrisdotca/hikidashi) (引き出し): a drawer of small Japanese text tools: era dates, kanji numerals, readings and sentence difficulty. [Demo](https://johnmorrisdotca.github.io/hikidashi/).
- [Kotoba](https://github.com/johnmorrisdotca/kotoba) (言葉): word lists and word-game rules in English, French, German and Japanese. [Demo](https://johnmorrisdotca.github.io/kotoba/).

**Geography & data**

- [address-plus](https://github.com/johnmorrisdotca/address-plus) (アドレスプラス): parse and format addresses in the United States, Canada, Japan, Australia, France, Germany and the United Kingdom. [Demo](https://johnmorrisdotca.github.io/address-plus/).
- [Chikyu Earth](https://github.com/johnmorrisdotca/chikyu-earth) (地球): a line-drawn globe that turns at the Earth's own rate, with an optional realistic Earth from space and markers for any place. [Demo](https://johnmorrisdotca.github.io/chikyu-earth/).
- [Chizu](https://github.com/johnmorrisdotca/chizu) (地図): maps of the world and of countries' regions, in English and Japanese, with a quiz and callouts. [Demo](https://johnmorrisdotca.github.io/chizu/).
- [Hako Devices](https://github.com/johnmorrisdotca/hako-devices) (箱): line drawings and 3D views of computers, phones, consoles and NAS boxes, from published sizes. [Demo](https://johnmorrisdotca.github.io/hako-devices/).
- [Hata](https://github.com/johnmorrisdotca/hata) (旗): country and regional flags as SVG, at their true proportions and keyed by ISO code. [Demo](https://johnmorrisdotca.github.io/hata/).
- [Hoshi Stars](https://github.com/johnmorrisdotca/hoshi-stars) (星): the stars you can see without a telescope, with names, colours and distances, the constellations with their lines and boundaries, and the Messier objects, drawn on any of seven sky maps. [Demo](https://johnmorrisdotca.github.io/hoshi-stars/).
- [Kuni](https://github.com/johnmorrisdotca/kuni) (国): countries and their regions, with ISO codes and names in English and Japanese. [Demo](https://johnmorrisdotca.github.io/kuni/).
- [Uchusen Rockets](https://github.com/johnmorrisdotca/uchusen-rockets) (宇宙船): rockets drawn from sourced sizes, as line drawings and 3D views you can take apart and turn, with a check that a rocket really goes together. [Demo](https://johnmorrisdotca.github.io/uchusen-rockets/).
- [Wakusei Planets](https://github.com/johnmorrisdotca/wakusei-planets) (惑星): the Sun, the planets and their moons, as line drawings, shaded drawings and painted surface maps, with their real sizes, tilt and rotation. [Demo](https://johnmorrisdotca.github.io/wakusei-planets/).

**Sports**

- [Dougu Sports](https://github.com/johnmorrisdotca/dougu-sports) (道具): sports emblems as SVG: trophies, medals, crests, and the ball and gear of every sport, with optional 3D turning. [Demo](https://johnmorrisdotca.github.io/dougu-sports/).
- [Kyogijo Stadiums](https://github.com/johnmorrisdotca/kyogijo-stadiums) (競技場): sports fields, rinks, courts and ballparks drawn to scale as SVG, with each team and the score on them. [Demo](https://johnmorrisdotca.github.io/kyogijo-stadiums/).
- [Senshu Jerseys](https://github.com/johnmorrisdotca/senshu-jerseys) (選手): sports jerseys, sweaters, kits, caps, helmets and retired-number banners as SVG, front and back, with optional 2.5D turning. [Demo](https://johnmorrisdotca.github.io/senshu-jerseys/).
- [Taisen Brackets](https://github.com/johnmorrisdotca/taisen-brackets) (対戦): a sport-agnostic tournament bracket, drawn as SVG, from a list of ties. [Demo](https://johnmorrisdotca.github.io/taisen-brackets/).

**Developer tools**

- [REST in Pieces](https://github.com/spxis/rest-in-pieces) (レスト・イン・ピーシーズ): seeded test data and REST APIs for frontend development, with latency and error drills. [Demo](https://spxis.github.io/rest-in-pieces/).


**This package is Hoshi Stars.** The demos of all thirty-seven share one header and footer, so each links the rest.
<!-- family:end -->

## Licence

MIT: see [LICENSE](LICENSE). Data credits are in [NOTICE.md](NOTICE.md).
