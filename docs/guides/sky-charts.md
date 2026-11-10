---
title: Sky charts
section: how-to
order: 5
description: Put stars, constellation lines and boundaries on a flat chart with the seven projections, and turn a point on the chart back into a point of the sky.
---

[日本語](ja/sky-charts.md)

The package gives the numbers and the maths for a chart; the drawing is yours (SVG, canvas, a print). The [demo](https://johnmorrisdotca.github.io/hoshi-stars/) is one, and its source is `demo/chart.ts` in the repository.

## The seven projections

`/projection` has `stereographic`, `orthographic`, `gnomonic`, `equidistant`, `equirectangular`, `mollweide` and `hammer`. `project(kind, point, { centre, scale })` gives the place on the chart of a point of the sky, and `unproject` goes back:

```js
import { project, unproject } from "@johnmorrisdotca/hoshi-stars/projection";

const options = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };
const betelgeuse = { rightAscension: 88.79, declination: 7.41 };
const at = project("stereographic", betelgeuse, options);
console.log(at.x < 0, at.y > 0);
console.log(unproject("stereographic", at, options).declination.toFixed(2));
// true true
// 7.41
```

The chart is the sky seen looking up: north is up and east is to the left, so `x` is smaller for a larger right ascension. `y` goes up the chart, so flip it for a screen (`200 - at.y`). A point that is not on the visible side gives `undefined`: the far hemisphere of `orthographic` and `gnomonic`, and the antipode of `stereographic`. `mirror: true` gives the map convention with east to the right, and `rotation` turns the chart.

## A chart as SVG

```js
import { starColour, stars } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

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
console.log((svg + "</svg>").length > 1000);
// true
```

That is the whole of it: [Plain HTML and a CDN](html-and-cdn.md), [Bundlers](bundlers.md) and [Frameworks](frameworks.md) put the same drawing in a page.

## The Milky Way

`/milky-way` is a small brightness map of the Milky Way (about 11 kB of numbers) made from star counts and a dust map, with the bright core toward Sagittarius and the dust lanes (the Great Rift, the Coalsack, the Cygnus Rift) as dimmer places. `milkyWayBrightness(point)` gives 0 (dark sky) to 1 (the core) toward a point of the sky, and `milkyWayBands(levels)` cuts the map into ribbons of sky points, one set per level, to fill as soft bands under the stars:

```js
import { milkyWayBands, milkyWayBrightness } from "@johnmorrisdotca/hoshi-stars/milky-way";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

const core = milkyWayBrightness({ rightAscension: 266.4, declination: -28.9 });
const pole = milkyWayBrightness({ rightAscension: 192.9, declination: 27.1 });
console.log(core > pole);

let paths = "";
for (const band of milkyWayBands([0.15, 0.35, 0.6])) {
  for (const strip of band.strips) {
    const edge = [...strip.upper, ...strip.lower.slice().reverse()].map((p) => project("hammer", p, { centre: { rightAscension: 0, declination: 0 }, scale: 100 }));
    if (edge.every(Boolean)) paths += `<path d="M${edge.map((p) => `${200 + p.x} ${150 - p.y}`).join("L")}Z" fill="#9fb0e6" fill-opacity=".2"/>`;
  }
}
console.log(paths.length > 1000);
// true
// true
```

Each strip is the polygon `upper` forward then `lower` backward; fill the levels in turn with a low opacity so they build up, and blur the group a little for soft edges. A strip that crosses the seam of `equirectangular`, `mollweide` or `hammer`, or reaches the far side of a hemisphere, has to be cut by you (the demo's `milkyWay` in `demo/chart.ts` shows how). The demo's **Milky Way** button turns the layer on and off, and `layers=milky` is in the address and in the embed page's. The chart is always a night sky, so the bands are drawn pale on the dark ground in the light page and the dark one.

The grid is 1 degree of galactic longitude by 0.5 degree of latitude and holds 32 levels, which is a map for shading, not a measurement. `toGalactic` and `fromGalactic` turn right ascension and declination into galactic longitude and latitude and back. Where the data comes from is in [Data and licences](data-and-licences.md).

## Things to decide

- **Wide charts.** On `equirectangular`, `mollweide` and `hammer` the chart has a seam, where right ascension wraps. A line between two stars on opposite sides would run across the whole chart: skip a segment whose two ends are more than half the chart apart.
- **Zoom and scale.** `scale` is the radius of the sky in your units. For a drag that moves the sky under the finger, ask `unproject` where the pointer was and what is at the new place (the demo does). The demo zooms from 0.1 to 8000, where 1 is the projection's own fit (the whole sky, or a hemisphere). At 0.1 the whole sky is a small cluster in the middle, which is as far out as is any use: below that it is a dot. The top was 500 (about 0.7 degree across a desk-wide chart, where Mizar and Alcor, 12 arc-minutes apart, still draw as two stars) and is now 8000, chosen from the smallest deep-sky object that has a picture, the Ring Nebula (M57, 1 arc-minute across in the package's table): a chart's pixels for an arc-minute are its smaller side times 0.000073 times the zoom, so at 8000 the Ring fills about 0.58 of the chart's smaller side, whatever the chart's size, and the chart is about 3 arc-minutes across. A picture is never drawn larger than its own pixels (one stretched more than 1.35 times is not drawn, and fades out from 1.1): where a picture lies under the sky you zoom about, the demo stops the zoom where one pixel of the finest picture there is one pixel of the chart (`pictureZoomCap` in `demo/chart.ts`), and a step out starts from there. The survey pictures, at 1 to 3 arc-seconds a pixel, stop between about 300 and 2,000 (M31 about 300, M91 about 600 to 1,000, M51 about 2,000, depending on the chart's size); the Ring's Hubble picture, at 0.16 arc-second a pixel, not before about 7,000 to 8,000. Past 200 or so the faint stars add nothing new, because UCAC4's stars to magnitude 12 are all there are (the depth rule saturates there), so a deeper zoom shows a smaller piece of the same stars, with the same tiles. Leave room for lines that run far off the edge: a segment between two stars 20 degrees apart is 24,000 pixels long at 500 and 380,000 at 8000, so cull by what crosses the chart, not by how far an end is.
- **Hands.** The demo and the embed page use the family's shared view controller (`@johnmorrisdotca/kazoku-ui/view-controls`): a drag turns the sky, two fingers pinch, Ctrl or Command and the wheel zoom about the pointer, and `+`, `-`, the arrow keys and `0` work with the chart focused. At the opening view the plain wheel scrolls the page; once zoomed in, it moves the sky.
- **Which stars.** `stars({ magnitude })` takes the faintest. Draw fewer as the chart shrinks and more as it zooms in; the demo's slider is 2 to 6.
- **Your sky tonight.** `/sky` gives altitude and azimuth for a place and a moment, with an optional refraction, for a chart of the sky overhead (`horizontal`), and `horizontalFrom` for another planet's.
- **Constellation under a tap.** `unproject` the tap and ask `constellationAt`.
