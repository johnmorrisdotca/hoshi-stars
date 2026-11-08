---
title: Getting started
section: tutorial
order: 1
description: Look up a star, find its constellation and draw a small sky chart with its lines, in a few minutes and with no dependency.
---

[日本語](ja/getting-started.md)

Hoshi Stars is the stars you can see without a telescope, as data you can draw: 5,080 stars with names, positions, distance and colour; the 88 constellations with their lines and boundaries; the Messier objects; and seven map projections. It draws nothing itself. You get numbers, and put them on a page, a canvas, an SVG or a printout as you like. It has no dependency, and it never reads the clock: a moment is always your argument.

## Install

```sh
npm install @johnmorrisdotca/hoshi-stars
```

It needs Node 22 or later, or any current browser. Everything is an ES module with its types, and each part is its own import, so a page pays only for what it uses.

## A star

```js
import { starByName, starColour, starDistanceLightYears } from "@johnmorrisdotca/hoshi-stars";

const sirius = starByName("Sirius");
console.log(sirius.designation, sirius.magnitude, starColour(sirius));
console.log(starDistanceLightYears(sirius).toFixed(1), "light-years");
// α CMa -1.46 #c9daff
// 8.7 light-years
```

A smaller magnitude is a brighter star. Sirius, the brightest, is -1.46. [The stars](stars.md) says what every field is.

## Its constellation, and its lines

```js
import { constellationAt } from "@johnmorrisdotca/hoshi-stars/boundaries";
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";

const rigel = starByName("Rigel");
const orion = constellationAt(rigel);
console.log(orion.name, orion.japanese);
console.log(figureOf(orion.abbreviation).segments.length, "lines to draw");
// Orion オリオン座
// 8 lines to draw
```

The constellations are in [English and Japanese](constellations-and-lines.md), and each has a stick figure of its own.

## A chart

A star's place on a page comes from a map projection. Put the centre of the chart where you want to look, and ask where each star lands:

```js
import { stars } from "@johnmorrisdotca/hoshi-stars";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

const view = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };
const seen = stars({ magnitude: 4 }).filter((star) => {
  const at = project("stereographic", star, view);
  return at !== undefined && Math.hypot(at.x, at.y) < 200;
});
console.log(seen.length, "stars within 200 units of Orion's belt");
```

[Sky charts](sky-charts.md) turns this into a picture, and the demo is one: https://johnmorrisdotca.github.io/hoshi-stars/ . To put a chart in a page, see [Plain HTML and a CDN](html-and-cdn.md), [Bundlers](bundlers.md), [Frameworks](frameworks.md) or [an iframe](embed-in-an-iframe.md).
