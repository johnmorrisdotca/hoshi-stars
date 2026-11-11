---
title: Deep-sky sizes and pictures
section: how-to
order: 7
description: How big a galaxy, cluster or nebula is on the sky, which way it lies, its outline, the pictures of the brightest ones laid at their true place and size, what is measured and what is only drawn, and how far away a galaxy is.
---

[日本語](ja/deep-sky-pictures.md)

Every deep-sky object the package has can be drawn at its true angular size, and the brightest have a picture. This guide says what the numbers are, how to draw them, and which parts are measured and which are only drawn.

## What a shape is

`deepSkyShape(object)` gives the three things a catalogue measured about an object, each one a number or `undefined`:

| Part | Meaning |
|---|---|
| `majorArcmin` | the longest way across, in arc-minutes |
| `minorArcmin` | the shortest way across, where it is measured |
| `positionAngle` | the angle of the major axis, 0 up to 180 degrees from north through east, where it is measured |
| `source` | where the numbers come from: `RC3`, `NED` or `Catalogue row` |

Nothing is guessed. For a galaxy the numbers are RC3's (the Third Reference Catalogue of Bright Galaxies: the diameter at the 25th magnitude isophote, the axis ratio and the angle) or, where RC3 has none, NASA/IPAC NED's diameters table (the same isophote from the ESO-Uppsala and UGC catalogues, else the 2MASS total diameter): 9,711 of the 10,231 galaxies get a shape, 7,013 from RC3 and 2,698 from NED. For every other object (the clusters, the nebulae, the galaxies neither has) the only size is the one diameter the object's own row carries (`Catalogue row`), with no ratio and no angle, and no object outside the galaxies has an angle. In all 9,787 of the 11,898 objects have a size and 7,286 an angle; the rest are drawn as a symbol of fixed size, dotted. `measuredParts(shape)` says which parts are there, and an object whose minor axis or angle is missing is drawn as a circle across its major diameter, never as an ellipse that nobody measured.

RC3's terms are being confirmed (`NOTICE.md`), so the shapes can be built without it: `python3 -I scripts/make-deep-sky-shapes.py --no-rc3` gives the NED-only build (9,572 galaxies, 8,439 with an angle). NGC 2000.0 and the Sky Catalog are not used.

There are two imports so a page pays only for what it uses: `@johnmorrisdotca/hoshi-stars/deep-sky/shape` holds the Messier objects' shapes (about 3 kB gzipped) and `.../deep-sky/ngc-ic-shape` all of them (about 52 kB).

## The outline

`deepSkyOutline(centre, shape, points)` is a ring of points on the sky round the object: an ellipse of the major and minor axes at the angle, as seen on the plane that touches the sky at the object (the plane sky photographs are taken on). The points are sky points, so any of the seven projections can draw them, and the ellipse stays the right size and the right way round whatever the map. `offsetOnSky(centre, east, north)` is the same step on its own.

## Pictures

`deepSkyPicture("M31")` says where the widest picture of an object lies: its file name (`pictures/M31.webp`), its width and height, the sky point at its middle, the arc-seconds in a pixel, its turn, its credit and its source. `deepSkyPicturesOf("M51")` gives all of an object's pictures, the widest first: some objects also have finer pictures of part of them, to be drawn over the wide one. `deepSkyPictures()` is every picture. `pictureCorners(picture)` gives the four corners on the sky; a map pins a picture by three of them (the page example below). A picture is a WebP with transparency, so laid over a dark sky it adds light and no rectangle.

Most of the wide pictures are survey images that NASA's SkyView cut about each object on the day they were made, so their place on the sky is exact: the request is the placement, and nothing was fitted by eye. There are three surveys, each credited and recorded in `NOTICE.md` in the repository with the file, the address, the credit, the licence and the date read:

- **SDSS g, r, i**: visible light, where the Sloan Digital Sky Survey covers the sky (Creative Commons Attribution).
- **2MASS J, H, K**: near-infrared, everywhere (a US government work).
- **WISE 3.4, 4.6, 12 micron**: mid-infrared, for the nebulae (public domain).

The infrared ones are in false colour. These are survey data made visible and not photographs anyone took, and the demo's card says so.

Where a photograph in true colour could be had under a licence that a package can pass on, it is the widest view of the object instead of the survey picture. There are 14: M8, M16, M17, M20, M27, M31, M33, M42, M45, M81, M110, NGC 1316, NGC 2403 and NGC 5139, from NSF NOIRLab and ESO (both Creative Commons Attribution 4.0; `NOTICE.md` has their words, the file, the address, the credit and the date read), and ESA/Hubble's picture of M101 is laid over its survey picture as a finer one. Andromeda's is the Local Group Survey's panorama of the whole galaxy (NOIRLab; T.A. Rector and the Local Group Survey Team), 3.6 degrees long and turned 126 degrees, so that it lies along the galaxy; it replaces the mid-infrared picture, whose false red and cyan made the galaxy look unlike itself, and the Hubble strip is drawn over it. These are photographs an observatory released, not survey data, and the card says so. The Wikimedia Commons photograph by Adam Evans is not used: its Flickr page now says Attribution-NonCommercial, and a package cannot pass that on.

Each is placed on the sky by its stars, not by trust in its tags. The release's own position, scale and turn (its Astronomy Visualization Metadata) start the search; the stars in the photograph are then found and matched to this package's own (the Yale stars to magnitude 6 and the faint tiles' stars to magnitude 12), and the turn, scale and centre are fitted to them by least squares, the worst fifth of the matches left out. The fit puts Andromeda's panorama on 125 stars to 0.6 arc-second and differs from the release's tags by 5 arc-seconds. Where a field of a few arc-minutes holds too few of our stars for that (M20, M110, NGC 2403), only the centre is fitted, to 3 to 7 stars. Where it holds almost none (M27, NGC 1316, and the Hubble picture of M101), the release's own position is used and is not checked. `scripts/natural-pictures.json` keeps, for every picture, which of the three it was, the stars matched, and the residual; for galaxies, the centre and the disc angle measured in the picture itself. For Andromeda the picture's long side runs at 36 degrees east of north against the catalogue's 35, the disc in it is at 38.5 degrees (a fit of the catalogue's own ellipse to the light; the catalogue is RC3's 25th magnitude isophote, and the inner isophotes of the galaxy turn away from the outer disc), and the middle of its bright part is 1.7 arc-minutes from the catalogue's. `scripts/make-natural-pictures.py` makes them.

The finer pictures are ESA/Hubble's images (Creative Commons Attribution 4.0, on https://esahubble.org/copyright/): 19 of the best known objects, among them M1, M16, M31, M33, M42, M51, M57, M81, M82, M83, M101, M104 and 47 Tucanae. Each is placed by the position and turn in the image's own Astronomy Visualization Metadata, laid over the survey picture, resized and with the black of its edges made clear, with the release's credit line kept on its card and in `NOTICE.md`. The Digitized Sky Survey, Stellarium's textures and any picture whose licence is not stated are not used.

82 of the 110 Messier objects have a picture: every galaxy, globular cluster and nebula that a survey shows, and the Pleiades. The rest are open clusters in the star clouds of the Milky Way (in a survey they are one more sheet of faint stars, and their bright stars are ringed on the demo's map instead), the star cloud M24, the asterisms M40 and M73, and M32 (which lies inside the picture of M31). In all there are 131 pictures of 113 objects: the 82 and 31 brighter NGC and IC objects, 98 survey pictures, 14 photographs in true colour and 19 finer ESA/Hubble ones (the Tarantula, NGC 2070, has only its Hubble picture). **The picture files are not in the npm package** (about 10 MB, which every install would otherwise carry): the package holds the code and the index above, and the files are served from the demo site, like the faint stars' tiles. Nothing loads a picture by itself: a page asks for `pictureUrl(picture)` when it wants one, which is an address under `PICTURES_BASE`, `https://johnmorrisdotca.github.io/hoshi-stars/`. To serve them from your own server, copy the repository's `pictures/` folder there and give `pictureUrl(picture, base)` the address its parent is served from.

Each file is at most 90 kB (110 kB for a photograph in true colour). The demo asks for a picture only when the picture's field is at least 90 pixels wide on the screen and shows it from 130 pixels (fully at 360), and never has more than six at once, so a view costs at most about 650 kB of pictures and usually one to two (50 to 150 kB). It fetches the NGC and IC objects (about 190 kB of script) only when the deep-sky layer is on and the map is zoomed in.

The demo never draws a picture larger than its own pixels. Where one lies under the sky you zoom about, the zoom stops where one pixel of the finest picture there is one pixel of the chart: the Ring Nebula's Hubble picture (0.16 arc-second a pixel) lets the map go to its top, 8000, with the 1 arc-minute ring filling over half of the chart's smaller side; a survey picture at 1 to 3 arc-seconds a pixel stops sooner (M91 at about 600 to 1,000, M51 at about 2,000, by the chart's size), and a photograph in true colour at 1 to 9 arc-seconds a pixel sooner still (M31 at about 200 over its Hubble strip, M45 at about 180, M8 at about 115). A step out starts from where it stopped. Flying to an object (the search, a tap on an object's name) goes no closer than that either. An address that asks for more (`zoom=8000` over M91) is honoured, and the picture is then drawn blown up and dimmed (to 0.6 of its strength by 4 times, and to 0.35 by 16 times, where its pixels show as blocks; one blown up more than 120 times is left out), so the object is a soft blur, not bare sky. The wheel, the buttons and flights stop at the cap.

The demo draws 128 of the 131 pictures, of 110 of the 113 objects. Every picture was looked at on the map, at the zoom where it first shows and at its cap. Two survey pictures, with a box of speckle noise, are left out (the planetary nebulae NGC 3242 and NGC 7009: no clearly licensed natural-colour picture of either can be placed, the nearest being two narrow filters in false colour, a black-and-white picture and a small gallery tile with no position), and the finer picture that would lie alone on the sky (NGC 2070's) is not drawn. Nine that were left out before, with hard edges, seams and holes (M8, M16, M17, M20, M33, M110, NGC 1316, NGC 2403 and NGC 5139), are photographs now and are drawn, and so is the Hubble tile of M33, over its photograph. A finer picture is a detail, drawn over the wide picture. The list, with what is wrong with each, is `LEFT_OUT` in `demo/picture-quality.ts`. The files and the package's index are untouched by it: this is the demo's choice, and a page that draws the pictures itself can make its own.

## Stars inside a cluster

`starsInside(object, shape)` lists the Bright Star Catalogue stars (to magnitude 6) inside the circle of an object's major diameter, brightest first, from `@johnmorrisdotca/hoshi-stars/deep-sky/members`. It says where a star is, not what it belongs to: the catalogue gives no cluster distance, so a star in front of the cluster or far behind it is in the list too. Draw them as "inside the outline", not as proven members.

```ts
import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
import { deepSkyShape } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
import { starsInside } from "@johnmorrisdotca/hoshi-stars/deep-sky/members";

const pleiades = deepSkyObject("M45")!;
console.log(starsInside(pleiades, deepSkyShape(pleiades)).slice(0, 3).map((star) => star.name));   // [ 'Alcyone', 'Atlas', 'Electra' ]
```

## On a server

Everything above is pure, so a script can draw the outline and the picture's frame to a file in Node 22 or later:

```js
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
import { deepSkyOutline, deepSkyShape } from "@johnmorrisdotca/hoshi-stars/deep-sky/shape";
import { deepSkyPicture, pictureCorners } from "@johnmorrisdotca/hoshi-stars/deep-sky/pictures";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

// Andromeda at its measured size and angle, and the frame of its picture, on a map 4 degrees across (north up, east on the left).
const m31 = deepSkyObject("M31");
const shape = deepSkyShape(m31);
const picture = deepSkyPicture("M31");
const view = { centre: m31, scale: (800 / 4) * (180 / Math.PI) };
const path = (ring) =>
  ring
    .map((point, i) => {
      const at = project("gnomonic", point, view);
      return `${i === 0 ? "M" : "L"}${(400 + at.x).toFixed(1)} ${(400 - at.y).toFixed(1)}`;
    })
    .join("") + "Z";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="Andromeda"><rect width="800" height="800" fill="#0b1020"/><path d="${path(pictureCorners(picture))}" fill="none" stroke="#6f93e0"/><path d="${path(deepSkyOutline(m31, shape))}" fill="none" stroke="#e0a458"/></svg>`;
writeFileSync(join(tmpdir(), "hoshi-m31.svg"), svg);
console.log("M31", shape.majorArcmin, shape.minorArcmin, shape.positionAngle, picture.file);
```

## In a page

A picture is pinned to the sky by three of its corners; the outline goes over it:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Andromeda and its picture</title>
  </head>
  <body>
    <div id="sky"></div>
    <script type="module">
      import { deepSkyObject } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/deep-sky.js";
      import { deepSkyOutline, deepSkyShape } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/deep-sky-shape.js";
      import { deepSkyPicture, pictureCorners, pictureUrl } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/deep-sky-pictures.js";
      import { project } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/projection.js";

      const m31 = deepSkyObject("M31");
      const picture = deepSkyPicture("M31");
      const view = { centre: m31, scale: (400 / 4) * (180 / Math.PI) };
      const place = (point) => {
        const at = project("gnomonic", point, view);
        return { x: 200 + at.x, y: 200 - at.y };
      };

      // The picture is pinned to the sky by three of its corners: its pixels (0, 0), (width, 0) and (0, height).
      const [topLeft, topRight, , bottomLeft] = pictureCorners(picture).map(place);
      const matrix = [(topRight.x - topLeft.x) / picture.width, (topRight.y - topLeft.y) / picture.width, (bottomLeft.x - topLeft.x) / picture.height, (bottomLeft.y - topLeft.y) / picture.height, topLeft.x, topLeft.y];
      const ring = deepSkyOutline(m31, deepSkyShape(m31)).map((point, i) => `${i === 0 ? "M" : "L"}${place(point).x.toFixed(1)} ${place(point).y.toFixed(1)}`).join("");

      document.querySelector("#sky").innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Andromeda"><rect width="400" height="400" fill="#0b1020"/><image href="${pictureUrl(picture)}" width="${picture.width}" height="${picture.height}" transform="matrix(${matrix.join(" ")})"/><path d="${ring}Z" fill="none" stroke="#e0a458"/></svg>`;
    </script>
  </body>
</html>
```

## How far away a galaxy is

`galaxyDistance(object)` gives the distance to a galaxy, or `null` for any other object and for a galaxy with none. 6,202 of the 10,282 galaxies have one, all 40 Messier galaxies among them. Import it from `@johnmorrisdotca/hoshi-stars/deep-sky` for the Messier galaxies (2 kB more) or from `.../deep-sky/ngc-ic` for all of them (about 70 kB gzipped more).

| Part | Meaning |
|---|---|
| `lightYears`, `parsecs` | the distance, the median of the statements, in both units |
| `error` | the statement's own error in both units (a `DistanceValue`), or `null` where no statement gives one |
| `method` | always `"compiled, method not stated"` |
| `sources` | where the values were read (a `GalaxyDistanceSource`): `name` and `licence`, `items`, the Wikidata item numbers to look the values up by, and `values`, how many statements |
| `count` | how many statements the median is of |
| `spread` | the `low` and the `high` statement, each a `DistanceValue` |
| `disagree` | `true` where the highest is more than 1.2 times the lowest |

The numbers are Wikidata's "distance from Earth" statements (CC0), read on 2026-11-10. Wikidata gathers published values and names no method, so the package does not either: it never averages values as if they came from one method, and the error is the one a statement gives (1,178 galaxies have one), which is a statistical error and not a total. Where there are several values they usually differ from one another by more than any one error says, which is what `disagree` is for: 22 galaxies have values more than 1.2 times apart, and a card or a label should say so and show the range. Statements Wikidata marks deprecated are not used, and neither is any under 20 kiloparsecs (the nearest galaxy in the lists is the Small Magellanic Cloud at 60): a star cluster that the table calls a galaxy has such a value.

NASA/IPAC NED's distances (NED-D), Cosmicflows-4 and HyperLEDA are not used, because their terms do not let an MIT package pass the values on (NED-D's file says "All Rights Reserved"; the question has been asked). A distance with a real method from a paper that is free to reuse can be added to the same record later.

```ts
import { deepSkyObject, galaxyDistance } from "@johnmorrisdotca/hoshi-stars/deep-sky";

const m74 = galaxyDistance(deepSkyObject("M74")!)!;
console.log(Math.round(m74.lightYears / 1e5) / 10, m74.count, m74.disagree);               // 29.2 2 true
console.log(m74.spread.low.parsecs, m74.spread.high.parsecs, m74.method);                  // 7200000 10731000 compiled, method not stated
console.log(galaxyDistance(deepSkyObject("M33")!)!.error?.parsecs, m74.sources[0]?.items);  // 100000 [ 'Q14013' ]
```

The nearest and farthest galaxies are a sort of the whole table:

```ts
import { deepSky, galaxyDistance } from "@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic";

const ranked = deepSky({ type: "galaxy" })
  .map((galaxy) => ({ id: galaxy.id, distance: galaxyDistance(galaxy) }))
  .filter((one) => one.distance !== null)
  .sort((a, b) => a.distance!.parsecs - b.distance!.parsecs);
console.log(ranked.length, ranked[0]?.id, ranked[ranked.length - 1]?.id);  // 6201 NGC 292 IC 4059
```

## In the demo

The **Deep sky** layer draws every object at its true size; the **Pictures** layer lays the pictures. Both are kept in the address (`layers=…,deep,pictures`), and tapping an object opens its card: what is measured (size, angle, source), what is drawn, the picture's credit and licence, and, for a galaxy, its distance with the range of the values and the line saying they are compiled from Wikidata, method not stated, and, for an open cluster, the bright catalogue stars inside its outline (ringed on the map). Those stars are where the catalogue puts them; that they belong to the cluster is not checked, because the catalogue gives no cluster distance.

How to read the marks:

- A galaxy is an ellipse at its measured size, axis ratio and angle. Where the axis ratio or the angle is missing it is a dotted circle across the major diameter.
- A globular cluster is a circle with a cross, an open cluster a dashed circle, a planetary nebula a ring with two ticks, a supernova remnant a dashed ring with another inside it and any other nebula a dashed outline.
- Brighter objects are drawn stronger, by magnitude.
- A dimmer dotted symbol of fixed size is an object with no measured size.
- Until an object is big enough to see at its true size, its symbol is drawn at the smallest size.

A list beside the map, **Nearest and farthest galaxies**, shows the ten nearest or the ten farthest (the choice is kept in the address, `gal=near` or `gal=far`); the first click fetches the NGC and IC tier, and a row opens that galaxy's card.
