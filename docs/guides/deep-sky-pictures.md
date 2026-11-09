---
title: Deep-sky sizes and pictures
section: how-to
order: 7
description: How big a galaxy, cluster or nebula is on the sky, which way it lies, its outline, the pictures of the brightest ones laid at their true place and size, and what is measured and what is only drawn.
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
| `source` | the catalogue: `RC3`, `Messier table`, `NGC 2000.0` or `Wikidata` |

Nothing is guessed. For galaxies the numbers are from RC3 (the Third Reference Catalogue of Bright Galaxies): the diameter at the 25th magnitude isophote, the axis ratio and the angle, for about 7,000 of the 10,282 galaxies. The Messier objects that are not galaxies have the Sky Catalog 2000.0's diameters (and a second one where the object is oval), and most other NGC and IC objects have NGC 2000.0's single diameter. No object outside RC3 has an angle. 8,329 of the 11,898 objects have a size; the rest are drawn as a symbol of fixed size, dotted. `measuredParts(shape)` says which parts are there, and an object whose minor axis or angle is missing is drawn as a circle across its major diameter, never as an ellipse that nobody measured.

There are two imports so a page pays only for what it uses: `@johnmorrisdotca/hoshi-stars/deep-sky/shape` holds the Messier objects' shapes (about 3 kB gzipped) and `.../deep-sky/ngc-ic-shape` all of them (about 45 kB).

## The outline

`deepSkyOutline(centre, shape, points)` is a ring of points on the sky round the object: an ellipse of the major and minor axes at the angle, as seen on the plane that touches the sky at the object (the plane sky photographs are taken on). The points are sky points, so any of the seven projections can draw them, and the ellipse stays the right size and the right way round whatever the map. `offsetOnSky(centre, east, north)` is the same step on its own.

## Pictures

`deepSkyPicture("M31")` says where the widest picture of an object lies: its file in the package's `pictures/` folder, its width and height, the sky point at its middle, the arc-seconds in a pixel, its turn, its credit and its source. `deepSkyPicturesOf("M51")` gives all of an object's pictures, the widest first: some objects also have finer pictures of part of them, to be drawn over the wide one. `deepSkyPictures()` is every picture. `pictureCorners(picture)` gives the four corners on the sky; a map pins a picture by three of them (the page example below). A picture is a WebP with transparency, so laid over a dark sky it adds light and no rectangle.

The wide pictures are survey images that NASA's SkyView cut about each object on the day they were made, so their place on the sky is exact: the request is the placement, and nothing was fitted by eye. There are three surveys, each credited and recorded in `NOTICE.md` in the repository with the file, the address, the credit, the licence and the date read:

- **SDSS g, r, i**: visible light, where the Sloan Digital Sky Survey covers the sky (Creative Commons Attribution).
- **2MASS J, H, K**: near-infrared, everywhere (a US government work).
- **WISE 3.4, 4.6, 12 micron**: mid-infrared, for the nebulae (public domain).

The infrared ones are in false colour. These are survey data made visible and not photographs anyone took, and the demo's card says so.

The finer pictures are ESA/Hubble's images (Creative Commons Attribution 4.0, on https://esahubble.org/copyright/): 18 of the best known objects, among them M1, M16, M31, M33, M42, M51, M57, M81, M82, M83, M104 and 47 Tucanae. Each is placed by the position and turn in the image's own Astronomy Visualization Metadata, laid over the survey picture, resized and with the black of its edges made clear, with the release's credit line kept on its card and in `NOTICE.md`. The Digitized Sky Survey, Stellarium's textures and any picture whose licence is not stated are not used.

82 of the 110 Messier objects have a picture: every galaxy, globular cluster and nebula that a survey shows, and the Pleiades. The rest are open clusters in the star clouds of the Milky Way (in a survey they are one more sheet of faint stars, and their bright stars are ringed on the demo's map instead), the star cloud M24, the asterisms M40 and M73, and M32 (which lies inside the picture of M31). In all there are 130 pictures of 113 objects: those 82, 31 brighter NGC and IC objects, and finer pictures of 18. Nothing in the package loads a picture by itself: a page asks for `pictureUrl(picture, base)` when it wants one. The files are in the package, so from a CDN a picture is `https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/pictures/M31.webp`.

Each file is at most 90 kB. The demo asks for a picture only when the picture's field is at least 90 pixels wide on the screen and shows it from 130 pixels (fully at 360), and never has more than six at once, so a view costs at most about 500 kB of pictures and usually one to two (50 to 150 kB). It fetches the NGC and IC objects (about 190 kB of script) only when the deep-sky layer is on and the map is zoomed in.

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

      document.querySelector("#sky").innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Andromeda"><rect width="400" height="400" fill="#0b1020"/><image href="${pictureUrl(picture, "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars")}" width="${picture.width}" height="${picture.height}" transform="matrix(${matrix.join(" ")})"/><path d="${ring}Z" fill="none" stroke="#e0a458"/></svg>`;
    </script>
  </body>
</html>
```

## In the demo

The **Deep sky** layer draws every object at its true size; the **Pictures** layer lays the pictures. Both are kept in the address (`layers=…,deep,pictures`), and tapping an object opens its card: what is measured (size, angle, source), what is drawn, the picture's credit and licence, and, for an open cluster, the bright catalogue stars inside its outline (ringed on the map). Those stars are where the catalogue puts them; that they belong to the cluster is not checked, because the catalogue gives no cluster distance.

How to read the marks:

- A galaxy is an ellipse at its measured size, axis ratio and angle. Where the axis ratio or the angle is missing it is a dotted circle across the major diameter.
- A globular cluster is a circle with a cross, an open cluster a dashed circle, a planetary nebula a ring with two ticks, a supernova remnant a dashed ring with another inside it and any other nebula a dashed outline.
- Brighter objects are drawn stronger, by magnitude.
- A dimmer dotted symbol of fixed size is an object with no measured size.
- Until an object is big enough to see at its true size, its symbol is drawn at the smallest size.
