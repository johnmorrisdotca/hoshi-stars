---
title: Plain HTML and a CDN
section: how-to
order: 10
description: Draw a sky chart on a page with no build step, from jsDelivr or unpkg, and show a star's facts from a single small import.
---

[日本語](ja/html-and-cdn.md)

A page with no bundler can import the package's ES modules straight from a CDN. jsDelivr and unpkg both serve the files of the npm package as they are, so every address below is a file in the package's `dist` folder.

## A chart, from jsDelivr

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Orion from jsDelivr</title>
  </head>
  <body>
    <div id="sky"></div>
    <script type="module">
      import { starColour, stars } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/index.js";
      import { figureOf } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/lines.js";
      import { project } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/projection.js";

      const view = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };
      const place = (star) => {
        const at = project("stereographic", star, view);
        return at && { x: 200 + at.x, y: 200 - at.y };
      };

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
      document.querySelector("#sky").innerHTML = svg + "</svg>";
    </script>
  </body>
</html>
```

Each part is its own file, so this page loads the bright stars, the figures and the projections, and not the boundaries or the Messier objects. Your code decides what to draw; the package never reads the clock or the page.

## A star's facts, from unpkg

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star's facts from unpkg</title>
  </head>
  <body>
    <p id="facts"></p>
    <script type="module">
      import { starByName, starColour, starDistanceLightYears } from "https://unpkg.com/@johnmorrisdotca/hoshi-stars/dist/index.js";

      const sirius = starByName("Sirius");
      document.querySelector("#facts").textContent = `${sirius.name}: magnitude ${sirius.magnitude}, ${starDistanceLightYears(sirius).toFixed(1)} light-years, colour ${starColour(sirius)}`;
    </script>
  </body>
</html>
```

Import `dist/index.js` alone and the other parts never reach the page. The bright-star table is the one big file, about 100 kB gzipped. Pin a version in the address (`.../hoshi-stars@0.1.0/dist/index.js`) when you do not want a later release to change a page.

## Other parts

The files are `dist/constellations.js`, `dist/lines.js`, `dist/boundaries.js`, `dist/deep-sky.js`, `dist/deep-sky-ngc-ic.js`, `dist/projection.js` and `dist/sky.js`. A file can import another (the lines need the stars), and the CDN serves those too.
