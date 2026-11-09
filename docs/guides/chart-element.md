---
title: The chart element
section: how-to
order: 9
description: Put a sky chart in a page with one tag, <hoshi-chart>, that draws, zooms and turns itself, or get the same chart as an SVG string; from a CDN, Vite, React, Vue, Svelte, Angular or Node.
---

[日本語](ja/chart-element.md)

`@johnmorrisdotca/hoshi-stars/chart` is the demo's chart as an import. It has two parts: the `<hoshi-chart>` element, which draws what its attributes say and carries the drag, the pinch, the wheel and the keys itself, and `chartSvg`, a plain function that gives the same chart as an SVG string for a page that runs no element (a server, a print, an email). The demo and the [embed page](embed-in-an-iframe.md) are made of this element.

## A tag on a page

A page with no build step needs the module and an import map for the one package the hands come from (kazoku-ui). Then the tag is all there is:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A sky chart from jsDelivr</title>
    <script type="importmap">
      { "imports": { "@johnmorrisdotca/kazoku-ui/view-controls": "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/kazoku-ui/dist/view-controls/index.js" } }
    </script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/chart.js"></script>
  </head>
  <body>
    <hoshi-chart projection="stereographic" ra="84" dec="0" layers="milky-way,lines,names" style="width: 100%; max-width: 640px"></hoshi-chart>
  </body>
</html>
```

The element is as wide as the page gives it and three to four, unless you give it a height too. Children are laid over the chart, so a button of your own can sit in a corner (`keepClear` keeps the names off it).

## The attributes

| Attribute | |
|---|---|
| `projection` | `stereographic` (the default), `orthographic`, `gnomonic`, `equidistant`, `equirectangular`, `mollweide` or `hammer`. |
| `ra`, `dec` | The point in the middle, in degrees: right ascension 0 to 360 (84 by default) and declination -90 to 90 (0). Orion. |
| `zoom` | 0.1 to 500; 1 fits the whole sky (or a hemisphere) in the smaller side. Left out, the opening view: Orion about 90 degrees wide on a desk, 60 on a phone, kept as the chart is resized. |
| `magnitude` | The faintest star drawn, 2 to 6 (5). |
| `layers` | A comma list of `milky-way`, `lines`, `names`, `boundaries`, `deep-sky` (the Messier objects) and `grid`, or `none`. Left out, `milky-way,lines,names,grid`. |
| `constellation` | One constellation (`Ori`) drawn brighter, with its boundary. |
| `lang` | `en` or `ja`: the names of the constellations and stars. Left out, the page's `lang`. |
| `theme` | `dark` (the night sky, the default) or `light` (ink on paper). |
| `near`, `by` | `near` is a star (`S:2491`, its Bright Star Catalogue number), a Messier object (`D:M31`) or a constellation (`C:Ori`): it is picked, and what is near it is ringed. `by="space"` measures a star's nearness in light-years instead of degrees on the sky. |
| `controls` | `none` takes the controls off, and the chart is a picture. |
| `hover` | Tell the page which constellation the mouse is over, with `hoshi-hover`. |

The attributes set the view; where the chart looks after a drag is `chart.view` (`{ projection, ra, dec, zoom }`) and the `hoshi-viewchange` event. Setting `chart.view` moves the chart and sends no event. `chart.zoomBy(1.6)` and `chart.reset()` are for the page's own buttons, `chart.size` is the pixels it is drawn in, and `chart.hits` is what a tap can land on (type `Hit`). The events are `hoshi-viewchange` (`detail.view`, `detail.final`, type `ViewChangeDetail`), `hoshi-pick` (a tap: `detail.key` is `S:2491`, `D:M31`, `C:Ori` or `null`, type `PickDetail`), `hoshi-hover`, `hoshi-resize` and `hoshi-draw`. The functions `toScreen` and `fromScreen` turn a point of the sky into a pixel of the chart and back, with `defaultZoom` for the opening zoom, and `ZOOM_MIN` and `ZOOM_MAX` are the limits; the type of a view is `View`.

## The controls

A drag turns the sky (and moves it once you are zoomed in), two fingers pinch, move and twist, and a double tap goes in and out. At the opening view the plain wheel scrolls the page, so the chart is never a trap; Ctrl, Command or Alt with the wheel zooms about the pointer, and once zoomed in the plain wheel moves the sky. The arrow keys turn it, + and - zoom, and 0 or Home put it back, once the chart has the focus (it gets `tabindex="0"`). This is kazoku-ui's `carryControls`, the same hands as the page's other family elements, and a page that wants buttons adds its own, as the demo does. `controls="none"` takes it all off, and then the controls' code is never read.

## With Vite

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A sky chart with Vite</title>
  </head>
  <body>
    <hoshi-chart id="chart" projection="hammer" ra="84" dec="0" zoom="1" layers="milky-way,lines,names" style="width: 100%; max-width: 640px"></hoshi-chart>
    <p><button id="orion" type="button">Orion</button> <button id="plain" type="button" data-testid="plain">Without the controls</button></p>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts no-check
import { chartSvg, type HoshiChart, type PickDetail } from "@johnmorrisdotca/hoshi-stars/chart";

const chart = document.querySelector<HoshiChart>("#chart")!;

chart.addEventListener("hoshi-pick", (event) => {
  console.log((event as CustomEvent<PickDetail>).detail.key);
});
document.querySelector("#orion")!.addEventListener("click", () => {
  chart.setAttribute("projection", "stereographic");
  chart.setAttribute("ra", "84");
  chart.setAttribute("dec", "0");
  chart.setAttribute("zoom", "2");
  chart.setAttribute("constellation", "Ori");
});
document.querySelector("#plain")!.addEventListener("click", () => chart.setAttribute("controls", "none"));

// The same chart as a string, for a page that runs no element.
const svg = chartSvg({ width: 320, height: 240, layers: ["lines", "names"] });
document.body.insertAdjacentHTML("beforeend", `<div data-testid="string">${svg}</div>`);
```

Setting an attribute is how a page moves the chart; the element draws again by itself, at most once a frame.

## React, Vue, Svelte and Angular

The element is a plain custom element, so each framework only has to let it through. In React 19 a custom element takes its props as attributes. `createElement` needs no declaration (to write `<hoshi-chart>` in JSX, add the tag to `JSX.IntrinsicElements` for TypeScript):

```tsx
import { createElement } from "react";
import "@johnmorrisdotca/hoshi-stars/chart";

export function Chart({ constellation }: { constellation?: string }) {
  return createElement("hoshi-chart", { projection: "stereographic", ra: 84, dec: 0, layers: "milky-way,lines,names", constellation, style: { width: "100%", maxWidth: 640 } });
}
```

In Vue, say that `hoshi-chart` is a custom element (in `vite.config.ts`, `vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === "hoshi-chart" } } })`), then:

```vue
<script setup lang="ts">
import "@johnmorrisdotca/hoshi-stars/chart";

defineProps<{ constellation?: string }>();
</script>

<template>
  <hoshi-chart projection="stereographic" ra="84" dec="0" layers="milky-way,lines,names" :constellation="constellation" style="width: 100%; max-width: 640px" />
</template>
```

Svelte needs nothing:

```svelte
<script lang="ts">
  import "@johnmorrisdotca/hoshi-stars/chart";

  let { constellation }: { constellation?: string } = $props();
</script>

<hoshi-chart projection="stereographic" ra="84" dec="0" layers="milky-way,lines,names" {constellation} style="width: 100%; max-width: 640px"></hoshi-chart>
```

Angular wants `CUSTOM_ELEMENTS_SCHEMA` on the component:

```ts no-check
import { Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import "@johnmorrisdotca/hoshi-stars/chart";

@Component({
  selector: "app-chart",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<hoshi-chart projection="stereographic" ra="84" dec="0" layers="milky-way,lines,names" constellation="Ori" style="width: 100%; max-width: 640px"></hoshi-chart>`,
})
export class ChartComponent {}
```

## As a string, with no element

`chartSvg(options)` takes the same options as the attributes (`projection`, `ra`, `dec`, `zoom`, `magnitude`, `layers`, `constellation`, `lang`, `theme`, `near`, `by`, `width` and `height`) and gives the SVG as a string, the same string the element draws. It is pure, so the same options always give the same string. The stars, the constellation lines and names and the grid are ready. A chart that asks for `milky-way`, `boundaries`, `deep-sky`, a `constellation` or `near` has to read that data first, once, with `await loadChartData(options)`; `chartSvg` throws, naming what is missing, when it is not there. The element does it itself.

```js
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chartSvg, loadChartData } from "@johnmorrisdotca/hoshi-stars/chart";

// A server draws the same chart a browser does: read the data of the layers once, then the string is pure.
const options = { width: 640, height: 480, projection: "mollweide", zoom: 1, layers: ["milky-way", "lines", "names"], lang: "ja" };
await loadChartData(options);
const svg = chartSvg(options);
writeFileSync(join(tmpdir(), "hoshi-chart.svg"), svg);
console.log("hoshi-chart.svg", svg.includes("オリオン座"));
```

## What it costs

A page pays for the layers it draws and no more. The chart entry itself is the bright-star table, the constellation names and lines and the drawing, **127 kB gzipped** (the stars are 114 kB of it; the drawing is 13 kB). The controls are another 6 kB, read only when they are on. Each layer is a file of its own that is read when a chart first asks for it:

| Layer | Adds, gzipped |
|---|---|
| `milky-way` | 8 kB |
| `boundaries` (and a `constellation`) | 8 kB |
| `deep-sky` (the Messier objects) | 4 kB |
| `near` (the nearest tier; it shares the boundaries and the Messier objects with them) | 13 kB, or 2 kB beside those two |

With every layer and the controls the entry is 160 kB. The deep-sky catalogue of NGC and IC objects and the nearby stars are not read by the chart at all.
