---
title: Bundlers
section: how-to
order: 11
description: Use the package with Vite or webpack, and keep the bundle to the parts a chart needs.
---

[日本語](ja/bundlers.md)

The package is plain ES modules with `sideEffects: false`, so a bundler keeps what you import and drops the rest. The entry points are separate files on purpose: import `/lines` or `/boundaries` only where you draw them.

## Vite

```sh
npm install @johnmorrisdotca/hoshi-stars
```

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hoshi Stars with Vite</title>
  </head>
  <body>
    <div id="sky"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts no-run
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

document.querySelector("#sky")!.innerHTML = orionSvg();
```

That is the whole project. The bright-star table is the one big part, about 100 kB gzipped.

## webpack

```js no-run
import { starColour, stars } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

const view = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };

function place(star) {
  const at = project("stereographic", star, view);
  return at && { x: 200 + at.x, y: 200 - at.y };
}

function orionSvg() {
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

const sky = document.createElement("div");
sky.id = "sky";
sky.innerHTML = orionSvg();
document.body.append(sky);
```

```js no-run
import { fileURLToPath } from "node:url";

export default {
  mode: "production",
  entry: "./src/index.js",
  output: { path: fileURLToPath(new URL("./dist", import.meta.url)), filename: "main.js" },
};
```

webpack 5 needs nothing more: the package's `exports` map names each entry point.

## What a bundle weighs

Every bundler that honours `sideEffects: false` (Vite, webpack and esbuild all do) drops a table you never use. A chart that imports only `/projection` carries no star data; one that draws stars carries the table once, however many entry points ask for it. Run `npm run size` in the repository for each entry point, minified and gzipped.
