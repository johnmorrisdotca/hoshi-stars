---
title: A sky chart in your page
section: how-to
order: 13
description: "The sky chart of the demo in your own page: <hoshi-chart> with the family's hands, or chartSvg as one SVG string for a server, a build or a print; its attributes, its events, its sizes and the frameworks."
---

[日本語](ja/sky-chart.md)

The demo's sky chart is published: the bright stars (the 5,080 of the Yale Bright Star Catalogue) on any of seven projections, with the Milky Way, the figures' lines, the names, the constellation boundaries, the deep-sky objects, the black holes and a grid, in English or Japanese, in the Western, Japanese or Chinese sky. Two ways to have it:

- `<hoshi-chart>` (`@johnmorrisdotca/hoshi-stars/chart/element`, defined by `/chart/define`): an element that fills its box, moves and zooms in your hands, and says what a tap lands on.
- `chartSvg` (`@johnmorrisdotca/hoshi-stars/chart`): the same drawing as one SVG string, with no DOM and no clock, for a server, a build, a print, or a page that runs no script element.

## The element

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A sky chart from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/chart/define/+esm"></script>
  </head>
  <body>
    <hoshi-chart constellation="Ori" layers="milky lines names boundaries" style="max-width: 640px"></hoshi-chart>
    <p id="picked">Tap a star.</p>
    <script type="module">
      document.querySelector("hoshi-chart").addEventListener("hoshi-pick", (event) => {
        const { kind, id } = event.detail;
        document.getElementById("picked").textContent = kind === "none" ? "Nothing there." : `${kind} ${id}`;
      });
    </script>
  </body>
</html>
```

A drag moves the sky, two fingers or Ctrl (Command) and the wheel zoom about the pointer, the arrow keys look round, `+` and `-` zoom, and Home or `0` goes back to the opening view. A tap on a star, a deep-sky object, a black hole or a figure sends `hoshi-pick` and marks it. The element draws only when something changes, so at rest it asks the browser for nothing.

| Attribute | Means |
|---|---|
| `projection` | `stereographic` (the default), `orthographic`, `gnomonic`, `equidistant`, `equirectangular`, `mollweide` or `hammer`. |
| `ra`, `dec` | The middle of the chart in degrees (84 and 0, Orion, by default). |
| `zoom` | The chart's own zoom, not the family's "1 is Fit": 1 fits the projection's whole sky (or a hemisphere) in the smaller side, and more is closer. Left out, the projection's opening zoom for the element's size: about 90 degrees of sky across (60 under 600 pixels wide), 3.86 for a 640 by 400 stereographic chart. Home and `0` go back there. |
| `zoom-min`, `zoom-max` | The zoom range in the same unit, 0.1 to 500. `zoom-max` goes as far as 8000, the range the deep-sky pictures need (they come in a later version). |
| `magnitude` | The faintest star at the opening zoom (5); zooming in shows fainter ones, as a telescope does. |
| `layers` | Which of `milky lines boundaries names deep holes grid` to draw, space-separated (`milky lines names grid` by default; empty for the stars alone). |
| `constellation` | A figure to show brighter, with its boundary when it is a constellation: `Ori`, or a figure's id in the Japanese and Chinese skies. Set after a tap, it wins again. |
| `culture` | `western` (the default), `japanese` or `chinese`; the Japanese and Chinese figures are loaded only when asked for. |
| `picked` | A star (HR number, `2491` for Sirius) or Messier object (`M42`) marked as picked. Set after a tap, it wins again. |
| `lang` | `en` or `ja`; left out, the nearest `lang` above the element, followed when it changes. |
| `theme` | `light` or `dark`, for the focus ring; the sky is night in both. |
| `controls="none"` | No hands: a still picture. |

| Event | `detail` |
|---|---|
| `hoshi-pick` | `ChartPick`: `{ kind, id, abbreviation? }`. `kind` is `star` (the HR number), `deep` (`M42`), `hole` (`cygnus-x-1`), `figure` (its id, with `abbreviation` for a constellation) or `none`. |
| `hoshi-view` | `ChartViewDetail`: `{ projection, ra, dec, zoom, final }`, as the view changes; `final` once the hand has settled. |

`element.setView({ ra, dec, zoom })` moves it from code, and `element.view` says where it is; `View` is their type. `HoshiChartElement` is the class, `CHART_TAG` the tag, and `defineChart(registry?)` defines it once (a page that loads it twice, or two copies of the package, never throws).

**The hands are kazoku-ui.** They are the family's view controls, `@johnmorrisdotca/kazoku-ui`, this package's one dependency, which npm installs with it and jsDelivr's `/+esm` brings by itself. Only `/chart/element` and `/chart/define` load it: `chartSvg` and every other entry load nothing of it.

## As one SVG string

```js
import { writeFileSync } from "node:fs";
import { chartSvg } from "@johnmorrisdotca/hoshi-stars/chart";
import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";

const svg = chartSvg({ width: 800, height: 500, ra: 56.9, dec: 24.1, zoom: 8, culture: japanese, lang: "ja", constellation: "subaru" });
writeFileSync(new URL("subaru.svg", import.meta.url), svg);
console.log("subaru.svg", svg.length > 10000, svg.includes('aria-label="星図"'));
// subaru.svg true true
```

`chartSvg(options)` takes `width` and `height` and, as the element's attributes, `projection`, `ra`, `dec`, `zoom`, `magnitude`, `layers` (a list of `CHART_LAYERS`), `lang`, `culture` (the culture itself, imported from `@johnmorrisdotca/hoshi-stars/cultures/japanese` or `/chinese`, so a page pays only for the one it draws), `constellation`, `picked` and `label` (the accessible name, "Star chart" or 星図). It returns an `<svg>` with a `viewBox` of the size and its own night background. It reads no clock and fetches nothing.

The names are laid out by the width of their text: measured with a canvas where there is a document, else with a built-in table, so a browser and a server can place a name a pixel or two apart. Pass `measure: (text, font) => width` (a font's metrics, or a fixed width a character) for the same SVG everywhere. The types are `ChartSvgOptions` and `ChartLayer`.

## In a bundler and in a framework

The element is plain DOM: import `/chart/define` once and write `<hoshi-chart>` like any element.

Vite (or any bundler), with `<hoshi-chart>` in the page:

```ts no-run
import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";

document.querySelector("hoshi-chart")!.addEventListener("hoshi-pick", (event) => {
  const { kind, id } = (event as CustomEvent<ChartPick>).detail;
  document.getElementById("picked")!.textContent = `${kind} ${id ?? ""}`;
});
```

React:

```tsx
import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";
import { createElement, useEffect, useRef, useState } from "react";

export function SkyChart() {
  const chart = useRef<HTMLElement>(null);
  const [picked, setPicked] = useState("Tap a star.");
  useEffect(() => {
    const element = chart.current!;
    const onPick = (event: Event) => {
      const { kind, id } = (event as CustomEvent<ChartPick>).detail;
      setPicked(`${kind} ${id ?? ""}`);
    };
    element.addEventListener("hoshi-pick", onPick);
    return () => element.removeEventListener("hoshi-pick", onPick);
  }, []);
  return (
    <>
      {createElement("hoshi-chart", { ref: chart, constellation: "Cyg", layers: "milky lines names" })}
      <p>{picked}</p>
    </>
  );
}
```

Vue, with `isCustomElement` in the plugin's options so Vue leaves the tag to the browser (`vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("hoshi-") } } })`):

```vue
<script setup lang="ts">
import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";
import { ref } from "vue";

const picked = ref("Tap a star.");
const onPick = (event: Event) => {
  const { kind, id } = (event as CustomEvent<ChartPick>).detail;
  picked.value = `${kind} ${id ?? ""}`;
};
</script>

<template>
  <hoshi-chart constellation="Lyr" layers="milky lines names" @hoshi-pick="onPick"></hoshi-chart>
  <p>{{ picked }}</p>
</template>
```

Svelte:

```svelte
<script lang="ts">
  import "@johnmorrisdotca/hoshi-stars/chart/define";
  import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";

  let picked = $state("Tap a star.");
  const onPick = (event: Event) => {
    const { kind, id } = (event as CustomEvent<ChartPick>).detail;
    picked = `${kind} ${id ?? ""}`;
  };
</script>

<hoshi-chart constellation="Sco" layers="milky lines names" onhoshi-pick={onPick}></hoshi-chart>
<p>{picked}</p>
```

Angular, with `CUSTOM_ELEMENTS_SCHEMA`:

```ts no-run
import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from "@angular/core";

@Component({
  selector: "app-sky-chart",
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<hoshi-chart constellation="Cas" layers="milky lines names" (hoshi-pick)="onPick($event)"></hoshi-chart><p>{{ picked() }}</p>`,
})
export class SkyChartComponent {
  readonly picked = signal("Tap a star.");
  onPick(event: Event): void {
    const { kind, id } = (event as CustomEvent<ChartPick>).detail;
    this.picked.set(`${kind} ${id ?? ""}`);
  }
}
```

## What it costs

| Entry | Minified and gzipped |
|---|---|
| `@johnmorrisdotca/hoshi-stars/chart` | 198.0 kB |
| `@johnmorrisdotca/hoshi-stars/chart/element` | 217.6 kB |
| `@johnmorrisdotca/hoshi-stars/chart/define` | 217.7 kB |

Most of it is the bright catalogue (the package's main entry is 126.0 kB) with the boundaries, the figures, the Milky Way and the black holes the layers draw. Nothing of the NGC and IC objects, the nearby stars or the faint stars comes with it, and the Japanese and Chinese figures load only when a chart asks for them (about 8 kB each). The figures are measured as `docs/bundle-size.json` says.
