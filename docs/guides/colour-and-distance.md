---
title: Colour and distance
section: how-to
order: 3
description: Turn a star's colour index into a temperature and a colour to draw, and its parallax into light-years.
---

[日本語](ja/colour-and-distance.md)

## Colour

The catalogue gives each star a B-V colour index: about -0.3 for a hot blue star, 0.65 for the Sun and above 1.5 for a cool red one. `starTemperatureK` turns it into a surface temperature with Ballesteros's relation, and `blackBodyColour` turns a temperature into a colour you can draw. `starColour` does both, and is white where the catalogue has no index:

```js
import { blackBodyColour, starByName, starColour, starTemperatureK } from "@johnmorrisdotca/hoshi-stars";

console.log(Math.round(starTemperatureK(0.65)), "K for a star like the Sun");
console.log(starColour(starByName("Rigel")), starColour(starByName("Betelgeuse")));
console.log(blackBodyColour(10000));
// 5778 K for a star like the Sun
// #c6d8ff #ffbc83
// #cadaff
```

It is the colour a camera would show, not a measurement, and it runs cool for the hottest stars. A star's colour on a screen also depends on the screen, so draw it a little larger than a white one, and not on a bright background.

## Distance

`starDistanceLightYears` divides 3,261.56 by the parallax in milliarcseconds. It returns `undefined` where the catalogue has no parallax, so say so rather than printing 0:

```js
import { starByName, starDistanceLightYears } from "@johnmorrisdotca/hoshi-stars";

for (const name of ["Sirius", "Vega", "Betelgeuse"]) {
  const light = starDistanceLightYears(starByName(name));
  console.log(name, light === undefined ? "not known" : `${Math.round(light)} light-years`);
}
// Sirius 9 light-years
// Vega 27 light-years
// Betelgeuse 652 light-years
```

A parallax of a few milliarcseconds is only good to a few tens of per cent, so the distances to the faraway stars are rough.
