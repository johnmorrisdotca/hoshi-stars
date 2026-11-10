---
title: The whole sky on one map
section: how-to
order: 10
description: The whole sky on a wide 2:1 map, galactic or equatorial, with lines that are cut cleanly at the seam, and the demo's page that draws all 88 constellations on it and prints it as a poster.
---

[日本語](ja/whole-sky.md)

`@johnmorrisdotca/hoshi-stars/all-sky` fits the whole sky into a box twice as wide as it is tall, so a picture of it needs no square to waste. It is the maths only: it hands you points in your own units, and you draw them with SVG, canvas or anything else.

## Place a point

```js
import { allSkyProject, allSkyUnproject } from "@johnmorrisdotca/hoshi-stars/all-sky";

const options = { width: 1000 }; // 1000 wide, 500 tall, galactic, Mollweide
const centre = allSkyProject({ rightAscension: 266.4168, declination: -29.0078 }, options); // the centre of the Galaxy
console.log(Math.round(centre.x), Math.round(centre.y));
console.log(allSkyUnproject({ x: 500, y: 250 }, options)?.declination.toFixed(0));
// 500 250
// -29
```

`x` runs to the right and `y` runs DOWN from the top left corner, as on a screen. The options are:

| Option | What |
|---|---|
| `width` | the picture's width in your units (required); it is half as tall |
| `frame` | one of `ALL_SKY_FRAMES`: `galactic` (the default: the Galaxy's plane along the middle, its centre in the middle) or `equatorial` (the celestial equator along the middle, right ascension 12 hours in the middle) |
| `projection` | one of `ALL_SKY_PROJECTIONS`: `mollweide` (the default) or `hammer`, both equal-area ovals, or `equirectangular`, the plain rectangle |
| `centre` | the longitude of the frame that lands in the middle, in degrees (0 for galactic, 180 for equatorial) |
| `mirror` | `false` by default: the sky is seen from inside, so longitude grows to the LEFT; `true` is the map convention |

## Lines, the edge and the grid

A line that crosses the seam (the edge, half a turn from the centre) would be drawn across the whole picture if its points were simply joined. `allSkyLine` follows great circles, cuts them every `step` degrees so a curve stays smooth, and breaks the line at the seam into runs that end ON the edge at the same height, one at each side.

```js
import { allSkyLine, allSkyOutline, allSkyGrid } from "@johnmorrisdotca/hoshi-stars/all-sky";
import { boundaryOf } from "@johnmorrisdotca/hoshi-stars/boundaries";

const options = { width: 1000, frame: "galactic" };
const runs = allSkyLine(boundaryOf("Aur").outlines[0], options);
const d = runs.map((run) => run.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("")).join("");
console.log(runs.length >= 1, d.startsWith("M"), allSkyOutline(options).length, allSkyGrid(options).length);
// true true 183 17
```

`allSkyOutline` is the edge of the oval (or the rectangle) for a background or a clip path, and `allSkyGrid` the meridians and parallels of the picture's own frame: for a galactic picture, the parallel at 0 is the plane of the Milky Way.

## The demo's page

`whole-sky.html` in the demo draws all 88 constellations with their figures, boundaries and names, the Milky Way across the middle, and the choices above. It uses what the package already holds: `boundaries` for the outlines, `lines` for the figures (the sky culture of the main map, Western, Japanese or Chinese, follows), `milky-way` for the brightness, which the page turns into a soft picture in the browser, and `constellationAt` for what is under a pointer.

- **Tap or click** a constellation and the sky map opens on it (`./?go=Ori`, with `culture=` when it is not Western). Hover, or Tab to it, and it lights up with its name; Enter opens it.
- **Zoom and pan** with the family's view controls (the bar, a pinch, Ctrl or Command and the wheel, the keys). More names appear as the map grows; a name that does not fit its constellation gives way to its three letters, and one that would touch another name or a bright star's dot moves aside, gives way to its three letters, or is left out, so no two names overlap and no name covers a bright star.
- **Stars grow with the zoom.** At the whole sky the Bright Star Catalogue's stars are small dots (3.6 pixels across for the brightest, 2.2 and 1.2 for the fainter ones). Zooming in grows them by the sky map's rule at the same pixels to the degree: a magnitude-2 star is about 12 pixels across from 6.5x on, a magnitude-4 star about 8, and a brighter star is never smaller than a fainter one. They are drawn over the figure lines and the boundaries (each bright star on a thin ring of the sky's colour, so a line stops short of it) and over the faint stars, whose dots stay smaller than the faintest of them.
- **Choose** from the strip of pictures or the search, and the map zooms to it with a card that opens it on the sky map.
- **Faint stars** come in as the map is zoomed in, from UCAC4's tiles, with a line under the map that says how deep they go there ([Faint stars](faint-stars.md#on-the-whole-sky-page)). A button in the layers row turns them off.
- **Print** the map on one page (A4, Letter, A3 or Tabloid, turned to suit it) or as a 60 by 30 cm poster in tiles, in kazoku-ui's print layout, with the "Space Program X" header and a QR code of the page's address.

Every choice is kept in the address: `frame=equatorial`, `map=hammer`, `culture=japanese`, `layers=milky,names` (`faint` is one of the layers, on unless left out), `c=Ori`, `paper=a4`, `form=poster`.
