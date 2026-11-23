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
| `layers` | Which of `milky lines boundaries names deep holes ecliptic grid` to draw, space-separated (`milky lines names grid` by default; empty for the stars alone). |
| `constellation` | A figure to show brighter, with its boundary when it is a constellation: `Ori`, or a figure's id in the Japanese and Chinese skies. Set after a tap, it wins again. |
| `culture` | `western` (the default), `japanese` or `chinese`; the Japanese and Chinese figures are loaded only when asked for. |
| `picked` | A star (HR number, `2491` for Sirius) or Messier object (`M42`) marked as picked. Set after a tap, it wins again. |
| `lang` | `en` or `ja`; left out, the nearest `lang` above the element, followed when it changes. |
| `theme` | `light` or `dark`, for the focus ring; the sky is night in both. |
| `show-uncertainty` | Draw the stars of grade C (a rough or missing distance: see [How well a star is known](accuracy.md)) dimmer, so the well-known stars stand out. Off by default; the property is `showUncertainty`. It changes how a star is drawn and nothing else: still nothing is drawn at rest. |
| `controls="none"` | No hands: a still picture. |
| `bodies` | Planets, the Moon and other bodies your page has worked out, drawn by magnitude, the Moon with its phase (see [Planets and the Moon on the chart](sky-chart-bodies.md)); the `ecliptic` layer draws the Sun's yearly path. |
| `markers`, `time-from`, `time-to`, `time-fade`, `tracks` | Your own dated points on the chart, the days shown and the lines joining a group (see [Your own points on the chart](sky-chart-markers.md)). |

| Event | `detail` |
|---|---|
| `hoshi-pick` | `ChartPick`: `{ kind, id, abbreviation? }`. `kind` is `star` (the HR number, with `accuracy`: `{ grade, lightYearsRange, positionResolutionArcsec }`, the star's grade A, B or C, the distance range in light-years, or `null` where there is none, and the size of the last digit of its position in arc-seconds), `deep` (`M42`), `hole` (`cygnus-x-1`), `figure` (its id, with `abbreviation` for a constellation), `body` (one of your `bodies`: its `id`, with its `names`) or `none`. |
| `hoshi-view` | `ChartViewDetail`: `{ projection, ra, dec, zoom, final }`, as the view changes; `final` once the hand has settled. |
| `hoshi-marker` | `ChartMarkerDetail`: `{ marker, id, index, source }`, when one of your own points (`markers`) is clicked, tapped, or chosen with Enter or Space. |

`element.setView({ ra, dec, zoom })` moves it from code, and `element.view` says where it is; `View` is their type. `HoshiChartElement` is the class, `CHART_TAG` the tag, and `defineChart(registry?)` defines it once (a page that loads it twice, or two copies of the package, never throws).

**The hands are kazoku-ui.** They are the family's view controls, `@johnmorrisdotca/kazoku-ui`, this package's one dependency, which npm installs with it and jsDelivr's `/+esm` brings by itself. Only `/chart/element` and `/chart/define` load it: `chartSvg` and every other entry load nothing of it.

## How well a star is known

A tap on a star says how well it is known: the `accuracy` of the `hoshi-pick` detail holds its grade, the nearest and farthest the distance can be (one standard error of the parallax each way; the farthest is `Infinity` where the error is as large as the parallax) and the position's resolution. The grade is `/accuracy`'s (see [How well a star is known](accuracy.md)). The `show-uncertainty` attribute (or `chartSvg`'s `showUncertainty`) draws the grade C stars at 45% strength (`UNCERTAIN_OPACITY`), each marked `data-uncertain="C"`; grades A and B are drawn as before. The same pieces, `pickAccuracy(star)` and `dimsForUncertainty(star)`, are pure and exported from `/chart`.

```js
import { writeFileSync } from "node:fs";
import { chartSvg, pickAccuracy } from "@johnmorrisdotca/hoshi-stars/chart";
import { starByName } from "@johnmorrisdotca/hoshi-stars";

// Orion with the stars of grade C (a rough or missing distance) drawn dimmer.
const svg = chartSvg({ width: 640, height: 400, constellation: "Ori", showUncertainty: true });
writeFileSync(new URL("orion-uncertain.svg", import.meta.url), svg);

// What a pick says of Betelgeuse: its grade, the distance range in light-years and the position resolution in arc-seconds.
const { grade, lightYearsRange, positionResolutionArcsec } = pickAccuracy(starByName("Betelgeuse"));
console.log("orion-uncertain.svg", svg.includes('data-uncertain="C"'), grade, lightYearsRange.map(Math.round).join("-"), Math.round(positionResolutionArcsec * 10) / 10);
// orion-uncertain.svg true B 480-640 1.5
```

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>How well is the star known?</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/chart/define/+esm"></script>
  </head>
  <body>
    <hoshi-chart ra="88.79" dec="7.41" zoom="12" show-uncertainty style="width: 640px; height: 400px"></hoshi-chart>
    <p id="card">Tap a star.</p>
    <script type="module">
      document.querySelector("hoshi-chart").addEventListener("hoshi-pick", (event) => {
        const { kind, id, accuracy } = event.detail;
        if (kind !== "star") return;
        const [low, high] = accuracy.lightYearsRange ?? [];
        const range = low === undefined ? "no stated range" : `${Math.round(low)} to ${Math.round(high)} light-years`;
        document.getElementById("card").textContent = `HR ${id}: grade ${accuracy.grade}, ${range}, position to ${accuracy.positionResolutionArcsec} arc-seconds`;
      });
    </script>
  </body>
</html>
```

## Filter by distance and brightness

Two filters keep only the stars you want: a **distance** range in light-years and a **brightness** limit, the faintest apparent magnitude kept (smaller is brighter; the eye reaches about 6). They work on every sky the package draws: `<hoshi-chart>`, `<hoshi-my-sky>` and `<hoshi-flight>` (where the distance and the magnitude are the ones seen from the camera), and `chartSvg` as options. Only star dots and star names are filtered; the constellation lines and the names of the figures stay.

```js
import { chartSvg } from "@johnmorrisdotca/hoshi-stars/chart";
import { starFilterFromText, starPasses } from "@johnmorrisdotca/hoshi-stars/star-filter";

// Orion with only the stars within 100 light-years that are no fainter than magnitude 4.5: the lines of the figures stay.
const all = chartSvg({ width: 640, height: 400, constellation: "Ori" });
const near = chartSvg({ width: 640, height: 400, constellation: "Ori", distanceMax: 100, magnitudeLimit: 4.5 });
const dots = (svg) => (svg.match(/<circle/g) ?? []).length;
console.log(dots(near) < dots(all), near.includes("<path"));

// The same limits as the text of the attributes, and the rule for one star: with a distance limit set, a star with no known distance is hidden.
const filter = starFilterFromText("20", "any", "4.5");
console.log(JSON.stringify(filter), starPasses(filter, 3, 40), starPasses(filter, 3, undefined));
// true true
// {"distanceMin":20,"magnitudeLimit":4.5} true false
```

| Attribute | Property | Meaning |
| --- | --- | --- |
| `distance-min` | `distanceMin` | Only stars at least this far, in light-years. Left out (property: 0) for no limit. |
| `distance-max` | `distanceMax` | Only stars no farther than this, in light-years. Left out (property: `Infinity`) for no limit. |
| `magnitude-limit` | `magnitudeLimit` | Hide stars fainter than this, however far you zoom in. `magnitude` is the faintest at the opening zoom and deepens as you zoom; this is a hard limit on top of it. |
| `filter-bar` | | Shows the two bars over the sky: a distance range (nearest and farthest) and a brightness limit, as real range inputs with labels, in English and Japanese. On a box narrower than 520 pixels they start folded; `filter-bar="open"` keeps them open. |

- **Stars with no known distance.** About half of the bright stars have no measured distance. They are shown while the distance is not narrowed, and **hidden as soon as `distance-min` or `distance-max` is set**, because a range cannot say that a star of unknown distance is inside it. The bars say how many stars that is. A magnitude limit alone never hides them.
- **Short numbers for an address.** The attributes are plain numbers (`distance-max="100"`, `magnitude-limit="4.5"`), rounded to 3 figures; `any`, `off` or nothing is no limit. `starFilterToText` and `starFilterFromText` from `@johnmorrisdotca/hoshi-stars/star-filter` write and read them for a site that keeps the filter in its address.
- **The event.** A bar writes the attributes and the element sends `hoshi-filter` with `{ distanceMin, distanceMax, magnitudeLimit, final }`: `final` is false while the hand is on a bar and true when it lets go (write your address then, as the demo does with `dmin`, `dmax` and `mlim`). The bar's own value is read aloud (for example "100 ly", "4.5 mag") and the line under it says how many stars match.
- **Cost.** The filter is applied to the data, not star by star at each frame: the stars it keeps are worked out once for a filter (the flight: once for a place and a filter), and a redraw only looks them up. A page that does not use it loads none of it.
- **Your own bar.** The parts the bars are made of are exported for a page that draws its own. From `@johnmorrisdotca/hoshi-stars/star-filter`: `STAR_FILTER_ATTRIBUTES` (the attribute names), `DISTANCE_STOPS` and `MAGNITUDE_STOPS` (the stops the bars snap to), `distanceStep`, `distanceOfStep`, `magnitudeStep` and `magnitudeOfStep` (a value to its stop and back), `normaliseStarFilter` (drops limits that do nothing), `starFilterActive` (is any limit set), `distanceNarrowed` (is the distance set, so stars of unknown distance are hidden) and `starFilterKey` (one string per filter, for a cache). From `/star-filter/bright`: `brightCount` (how many stars a filter keeps and how many have no distance), `brightShown` and `brightWithoutDistance`. From `/star-filter/bar`: `mountFilterBar` (the bars themselves, in any element), `FILTER_BAR_STYLE` (their CSS), `filterOf` and `setFilterOf` (read and write the filter on an element's attributes), `starFilterWords` and `starFilterSummary` (the bars' words and count line, in English and Japanese).

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

`chartSvg(options)` takes `width` and `height` and, as the element's attributes, `projection`, `ra`, `dec`, `zoom`, `magnitude`, `layers` (a list of `CHART_LAYERS`), `lang`, `culture` (the culture itself, imported from `@johnmorrisdotca/hoshi-stars/cultures/japanese` or `/chinese`, so a page pays only for the one it draws), `constellation`, `picked`, `showUncertainty`, `bodies` (planets and the Moon: see [Planets and the Moon on the chart](sky-chart-bodies.md)), `markers`, `timeRange` and `tracks` (your own points: see [Your own points on the chart](sky-chart-markers.md)) and `label` (the accessible name, "Star chart" or 星図). It returns an `<svg>` with a `viewBox` of the size and its own night background. It reads no clock and fetches nothing.

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
