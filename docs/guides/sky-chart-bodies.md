---
title: Planets and the Moon on the chart
section: how-to
order: 15
description: "Put the Moon and the planets on the sky chart from a plain list your page passes in: each is drawn by its magnitude, the Moon with its phase, with its name in English or Japanese, a tap says which, and an optional ecliptic line shows the Sun's yearly path."
---

[日本語](ja/sky-chart-bodies.md)

A page can put the Moon, the planets and any other body it has worked out on the sky chart, `<hoshi-chart>` and `chartSvg` alike. This package computes no positions and imports no package that does: **your page works out where each body is** (with an ephemeris library of your choice, or your own arithmetic) and hands the chart a plain list. The chart draws each body where its sky is, by its magnitude, names it in the chart's language, and draws the Moon with its phase.

## A body

`SkyBody` is a plain object, and every field is given by you:

| Field | Means |
|---|---|
| `id` | What a tap says it was. The Moon is `moon`: it is drawn as a disc with its phase. |
| `names` | `{ en, ja }`: the name written beside it, in English and in Japanese. The chart's language chooses; a missing one falls back to the other. |
| `ra`, `dec` | Where, in degrees: right ascension 0 to 360 and declination -90 to 90, in the J2000 frame the stars are in. A body whose number is not finite is not drawn. |
| `magnitude` | The apparent visual magnitude. A body is drawn by it: brighter is larger, to magnitude -4.6 (Venus is larger than Sirius). A body fainter than the chart's faintest star at its zoom (magnitude 5 at the opening zoom, 2.5 fainter for each tenfold zoom) is left out; the Moon never is. |
| `phase` | The lit fraction of the disc, 0 (new) to 1 (full, or a planet with no phase to show). A value outside it is held to it. |
| `brightLimb` | Optional. Where the lit side is: the position angle of the middle of the bright limb in degrees from celestial north through east (the Almanac's convention). Left out, the lit side is the right of the chart. |
| `size` | Optional. The apparent diameter in arc-seconds. Left out, a body is a dot sized by its magnitude. Given, the disc is drawn at its true size where that is larger than the dot, and a disc 4 pixels wide or more shows its phase. |

The Moon is always a disc, at least 7 pixels wide even where its true size is smaller, so that its phase can be seen on a wide chart. Its lit part is a crescent below half and gibbous above, turned toward the bright limb.

## In a page

Set `bodies` as a property (any array, kept as you gave it) or as the `bodies` attribute (JSON text); the last one set wins. A tap on a body sends `hoshi-pick` with `kind` `body`, its `id` and its `names`. The ecliptic is a layer: add `ecliptic` to `layers`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Moon and a planet on the chart</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/chart/define/+esm"></script>
  </head>
  <body>
    <hoshi-chart projection="equirectangular" ra="230" dec="-15" zoom="1.5" layers="milky lines names ecliptic" style="max-width: 640px"></hoshi-chart>
    <label><input id="line" type="checkbox" checked /> Ecliptic</label>
    <p id="card">Tap the Moon or Venus.</p>
    <script type="module">
      const chart = document.querySelector("hoshi-chart");
      chart.bodies = [
        { id: "moon", names: { en: "Moon", ja: "月" }, ra: 258.14, dec: -27.57, magnitude: -6.9, phase: 0.07, brightLimb: 282.5, size: 1773 },
        { id: "venus", names: { en: "Venus", ja: "金星" }, ra: 200.07, dec: -10.76, magnitude: -4.5, phase: 0.11 },
      ];
      chart.addEventListener("hoshi-pick", (event) => {
        const { kind, id, names } = event.detail;
        if (kind === "body") document.getElementById("card").textContent = `${names.en} (${names.ja}), ${id}`;
      });
      document.getElementById("line").addEventListener("change", (event) => {
        chart.setAttribute("layers", event.target.checked ? "milky lines names ecliptic" : "milky lines names");
      });
    </script>
  </body>
</html>
```

`hoshi-pick` carries `ChartPick`: for a body, `{ kind: "body", id, names }`. A tap anywhere else picks as before.

| Attribute or property | Means |
|---|---|
| `bodies` | The bodies: an array (property) or JSON text (attribute). |
| `layers` | Include `ecliptic` to draw the ecliptic, the Sun's yearly path, as a dashed line. |

Nothing is drawn at rest: the chart draws again only when the list, the layers or the view change.

## As one SVG string

`chartSvg` takes the same `bodies` option, and `layers: ["ecliptic"]` for the ecliptic. It reads no clock.

```js
import { writeFileSync } from "node:fs";
import { chartSvg } from "@johnmorrisdotca/hoshi-stars/chart";

// The Moon and a planet as your own code worked them out: where (right ascension and declination, in degrees), how bright, and how much is lit.
const bodies = [
  { id: "moon", names: { en: "Moon", ja: "月" }, ra: 258.14, dec: -27.57, magnitude: -6.9, phase: 0.07, brightLimb: 282.5, size: 1773 },
  { id: "venus", names: { en: "Venus", ja: "金星" }, ra: 200.07, dec: -10.76, magnitude: -4.5, phase: 0.11 },
];

// A wide view with the Sun's yearly path, the ecliptic, drawn dashed under them.
const svg = chartSvg({ width: 640, height: 400, projection: "equirectangular", ra: 230, dec: -15, zoom: 1.5, layers: ["milky", "lines", "names", "ecliptic"], bodies });
writeFileSync(new URL("planets.svg", import.meta.url), svg);

console.log("planets.svg", (svg.match(/data-body=/g) ?? []).length, "bodies,", svg.includes('data-layer="ecliptic"') ? "with" : "without", "the ecliptic");
// planets.svg 2 bodies, with the ecliptic
```

## The ecliptic

The ecliptic is the great circle the Sun appears to follow in a year. The chart computes it from its own frame maths: the equator turned about the March equinox by the mean obliquity of the ecliptic at J2000, 84,381.406 arc-seconds (23.4393 degrees), a constant the IAU 2006 precession model publishes. It is the J2000 ecliptic, the frame the stars are in, so it does not move. `eclipticToEquatorial(longitude, latitude)` and `eclipticLine(step)` give the same line as numbers, and `OBLIQUITY_J2000` the constant.

## Cleaning a list

`normaliseBodies(list)` does the cleaning the `bodies` attribute does for a list from `JSON.parse`: an entry with no id, no place or no magnitude is dropped, a missing name falls back to the other language (then the id), a bad `phase` counts as full and a bad `size` is dropped.

## The demo

The [chart demo](https://johnmorrisdotca.github.io/hoshi-stars/) has a **Planets and Moon** control. It shows **a fixed sample, not live**: the Moon and the bright planets as they stood at 00:00 UTC on 12 November 2026, worked out once with our own formulas and typed in, so that you can see the Moon's phase and the planets by magnitude. The **Ecliptic** layer is in the same row of layers as the others. The sample moves with nothing: a page of your own passes today's figures.
