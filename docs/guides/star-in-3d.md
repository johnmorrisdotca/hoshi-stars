---
title: A star in 3D
section: how-to
order: 4
description: Show a star as a slowly turning 3D ball drawn from its numbers, with its limb darkening, its colour, its measured shape where it has one and the Sun at the same scale, in the demo or in an iframe.
---

[日本語](ja/star-in-3d.md)

The demo's star panel has three pictures of a picked star: its portrait, the star in 3D, and the star next to the Sun. The 3D star is a ball that turns slowly, drawn from the same numbers as the portrait (see [A star's size, temperature and portrait](star-profile.md)). Nothing in it is a photograph.

## What is drawn from numbers, and what is generic

- **The colour** is that of a black body at the star's surface temperature (`profile.colour`).
- **The darker edge** is limb darkening: near the edge we see higher, cooler gas. It follows the linear law `I(μ) = 1 − u(1 − μ)`, with the coefficient `u` for the star's temperature and surface gravity from Claret and Bloemen (2011, A&A 529, A75), as `profile.limbDarkening` gives it.
- **The shape** of Altair and Regulus is flattened by their spin, and their axes are tipped as interferometers measured (`profile.shape`, with the paper named in `source`). Their cooler equators are drawn darker, as the light leaving a surface goes with its temperature to the fourth power. Vega is seen almost over its pole, so it looks round. Every other star is drawn as a ball: no other shape is known well enough.
- **The cells** on a cool star are a generic look of its kind (a few huge cells on a supergiant, finer ones on a star like the Sun), not this star's surface. The page says so under the picture. A hot star has no cells we know of, so it is drawn smooth.
- **The size**: under the star a line is as wide as the drawn star, and where the Sun would show at the same scale it is a dot beside it. The radius is written with its range.

The star turns once in 40 seconds, a pace to watch, not its own spin. It turns only while it is on screen; the Play button of the view controls under it stops and starts it, and a reader who asks for reduced motion gets it still, with Play ready. It is drawn with WebGL through the page's one shared renderer, and where WebGL is not available the flat portrait is shown instead, with a line that says so.

## Seeing that it turns

A smooth star has nothing on its face that moves, so a guide turns with it: a faint grid of latitude and longitude every 30 degrees and the spin axis through its poles. The guide is on at first for the smooth stars and the measured shapes; **Grid and axis** turns it on or off for any star, and a line under the picture says the grid and the axis are not on the star.

Under the picture a line says how fast the star spins: the period where a paper gives one (Vega, Regulus) and how many times faster the picture turns, else the Bright Star Catalogue's v sin i (`profile.rotation`, see [A star's size, temperature and portrait](star-profile.md)), or that no speed is measured.

## Turning it by hand

The family's view controls are under the star, and they turn it as a globe turns: their angle is the turn about the star's own axis and their Auto-turn is its spin. A drag turns it (it keeps spinning from where you let go) and tips it, Ctrl and the wheel or a pinch zooms in up to four times, the arrow keys turn and tip it, and a double-click, Home or **Fit** brings it back to the front.

## The numbers it is drawn from

```js
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";
import { portraitLook } from "@johnmorrisdotca/hoshi-stars/portrait";

// What the 3D picture of Altair is drawn from: the colour, the limb-darkening coefficient, the look of its surface and its measured shape.
const altair = starProfile(starByName("Altair"));
const { shape } = altair;
console.log(altair.colour, altair.limbDarkening.toFixed(2), portraitLook(altair));
console.log((shape.polarRadius / shape.equatorialRadius).toFixed(3), shape.inclinationDegrees, shape.source);
```

The package gives numbers and SVG, not a 3D engine. To draw your own 3D star, a sphere scaled by `polarRadius / equatorialRadius` along its axis, tipped `inclinationDegrees` from the line of sight and turned `positionAngleDegrees` from north through east, in `colour` and darkened by `1 − u(1 − μ)` (μ is the cosine of the angle between the surface and the line of sight), is the whole of it.

## In your page

The demo's star embed page draws the turning star from its address: the star's Bright Star Catalogue number (`star=7557`), `view=3d` and `lang=ja` for the words in Japanese.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star in 3D in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/star.html?star=7557&view=3d"
      title="Altair in 3D"
      width="360"
      height="780"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

In the demo, pick a star, choose **3D** above its picture, and open **Embed** with "This star's picture": the iframe is the live 3D star, and the code for a page of your own (HTML, a module, React, Vue, Angular or Svelte) draws its portrait, the still the 3D view stands on. The choice is kept in the demo's address as `pview=3d`.
