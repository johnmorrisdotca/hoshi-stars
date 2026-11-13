---
title: A constellation in 3D
section: how-to
order: 9
description: Place the stars of a constellation in space from their parallaxes, with the range each error allows, and draw it from the side, or embed the demo's turnable 3D view.
---

[日本語](ja/constellation-in-3d.md)

Seen from the Earth a constellation is a flat pattern. Its stars are at very different distances, and every star with a parallax has one. `@johnmorrisdotca/hoshi-stars/constellation-3d` places the stars of a figure in space, each with the range its parallax error allows, so a page can draw the figure from the side, turn it, or tell a reader how well each distance is known. The demo's `constellation-3d.html` does that with WebGL, and its embed page, `embed-3d.html`, puts the same turnable view in a page.

## How well the distances are known

The distances come from the parallaxes of the Yale catalogue (the General Catalogue of Trigonometric Stellar Parallaxes), measured from the ground, and many of their errors are as large as the parallax itself. So each star has a quality: `good` (the error is under 5% of the parallax), `fair` (5% to 20%), `rough` (over 20%, or a parallax with no stated error) or `none` (no parallax, so no distance).

- A star with **no parallax** is never put at a guessed distance. It has no `position`, only its line of sight from the Earth (`sight`), and the demo draws it as a dotted ray labelled "distance unknown". Alnilam, the middle star of Orion's belt, is one.
- A star whose error bar is **wider than its distance** (`wide`: the error is over 41% of the parallax, or reaches it) is not put at a point either. Its range is the whole stretch it could be in, and the demo draws that as a faint streak with no dot in the middle. Where the error reaches the parallax the far end is `Infinity`: the star could be any distance beyond the near end.
- Most of the bright stars are in the second group: of the 593 stars in the 88 figures, 25 have a good distance, 108 a fair one, 370 a rough one and 90 none, so only some constellations (the Great Bear, Cepheus, Cetus, Virgo, Aries) look meaningful in space today. `distanceQualityTable()` lists them all.

## The numbers

```js
import { constellationIn3D } from "@johnmorrisdotca/hoshi-stars/constellation-3d";

// Orion in space: every star of the figure with the range its parallax error allows. A star with no parallax has no distance and no place; it is never given a guess.
const orion = constellationIn3D("Ori");
for (const { star, lightYears, range, quality } of orion.stars) {
  const far = range === undefined ? "" : Number.isFinite(range[1]) ? `, between ${Math.round(range[0])} and ${Math.round(range[1])}` : `, at least ${Math.round(range[0])}`;
  console.log(`${star.name} (${quality}): ${lightYears === undefined ? "distance unknown" : `${Math.round(lightYears)} ly${far}`}`);
}
console.log(orion.counts);
```

`constellationIn3D(abbreviation)` returns the stars of the figure and its lines (`segments`, pairs of indexes into `stars`). Each star has `position` (light-years on the J2000 equatorial axes: x toward right ascension 0, y toward 6 hours, z toward the north pole, with the viewpoint at the origin), `nearPosition` and `farPosition` (the ends of the range), `lightYears` and `range` (from the viewpoint), `sight` (the Earth's line of sight, which the star lies on), `quality`, `relativeError` and `wide`. `frame` is the direction of the middle of the figure and of north, square to it: looking along `centre` with `up` up, east is on the left, as on a sky chart. Seen from the Earth every star is where the chart puts it, whatever its distance, which is why the demo's first view is the sky chart's.

With `{ from }` the viewpoint moves to another star (a name, a star, or a point `{ x, y, z }` in parsecs, as for `skyFrom`): `constellationIn3D("Ori", { from: "Rigil Kentaurus" })` is Orion seen from Alpha Centauri, and the Earth is at `viewpoint.earth`. A star with no parallax cannot be placed from there, but its Earth line of sight is still a line in space.

`distanceQuality(star)` gives the quality of any star, `DISTANCE_QUALITIES` lists the four in order and `QUALITY_LIMITS` holds the two errors that divide them (`{ good: 0.05, rough: 0.2 }`). `positionIn3D(rightAscension, declination, lightYears)` is the maths that places a star: a direction and a distance on the J2000 equatorial axes.

## From the side, as SVG

A page with no WebGL can draw the figure from the side with the same numbers: the Earth on the left, distance to the right, the sky sideways, a bar for each range.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Great Bear from the side</title>
  </head>
  <body>
    <div id="space"></div>
    <script type="module">
      import { starColour } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/index.js";
      import { constellationIn3D } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/constellation-3d.js";

      // The Earth on the left, distance to the right (light-years), the sky sideways. A bar is the range the parallax error allows.
      const figure = constellationIn3D("UMa");
      const { centre, up } = figure.frame;
      const side = [centre[1] * up[2] - centre[2] * up[1], centre[2] * up[0] - centre[0] * up[2], centre[0] * up[1] - centre[1] * up[0]];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const placed = figure.stars.filter((star) => star.position);
      const reach = Math.max(...placed.map((star) => dot(star.farPosition ?? star.position, centre)));
      const k = 360 / reach;
      const x = (p) => 20 + dot(p, centre) * k;
      const y = (p) => 100 - dot(p, side) * k;

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" role="img" aria-label="The Great Bear from the side"><rect width="400" height="200" fill="#0b1020"/>`;
      for (const [a, b] of figure.segments) {
        const from = figure.stars[a].position;
        const to = figure.stars[b].position;
        if (from && to) svg += `<line x1="${x(from)}" y1="${y(from)}" x2="${x(to)}" y2="${y(to)}" stroke="#6f93e0"/>`;
      }
      for (const star of placed) {
        if (star.nearPosition && star.farPosition) svg += `<line x1="${x(star.nearPosition)}" y1="${y(star.nearPosition)}" x2="${x(star.farPosition)}" y2="${y(star.farPosition)}" stroke="${starColour(star.star)}" stroke-opacity=".6"/>`;
        svg += `<circle cx="${x(star.position)}" cy="${y(star.position)}" r="${Math.max(1.5, 4.5 - star.star.magnitude)}" fill="${starColour(star.star)}"/>`;
      }
      document.querySelector("#space").innerHTML = svg + "</svg>";
    </script>
  </body>
</html>
```

## The live 3D view in an iframe

The demo page's **View from** list offers ten bright stars and Proxima Centauri, the nearest star to the Sun (4.2 light-years), which is not among the bright stars: `{ from: nearbyStarByName("Proxima Centauri") }` with `nearbyStarByName` from `@johnmorrisdotca/hoshi-stars/nearby`. The page reads that table only when Proxima is chosen. The choice is kept in the address as `from=GCTP3278` (the Yale catalogue number; `from=HR5459` is Alpha Centauri), and the embed page reads the same. The **Wide** button at the top right of the view (or the T key) is theatre mode, as on the sky map: the view takes the page's whole column, 16 to 9 and no taller than 80% of the window, and the table of stars goes under it; it is kept in the address as `wide=on`.

The demo's embed page draws the figure with kazoku-ui's shared renderer (one WebGL context, drawn only when something moves, at most 30 frames a second) and takes the family's hands: drag to turn, pinch or Ctrl and the wheel to zoom, and buttons for Play and Pause, Turn 90°, From Earth and zoom. It opens turning, once in 30 seconds, and the demo's page does the same; a reader who prefers reduced motion gets it still, with Play ready. Its address says what to draw: `c` (the constellation, `Ori` when left out), `from` (`HR5459` for Alpha Centauri), `yaw` and `tilt` (degrees), `spin=off` (held still), `lang` (`ja`) and `theme` (`light` or `dark`). On the demo's page a Pause is kept in the address as `spin=off`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hoshi Stars in 3D in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/embed-3d.html?c=UMa&yaw=-90"
      title="The Great Bear in 3D, turned to the side"
      width="480"
      height="360"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

The demo's page has a code panel for each of these ways, with the constellation, the viewpoint and the turn you have chosen filled in.
