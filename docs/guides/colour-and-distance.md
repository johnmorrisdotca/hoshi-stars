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
// Vega 25 light-years
// Betelgeuse 548 light-years
```

A parallax of a few milliarcseconds is only good to a few tens of per cent, so the distances to the faraway stars are rough. `starDistance` says how rough: it gives the distance with its error and the nearest and farthest it can be.

```js
import { starByName, starDistance } from "@johnmorrisdotca/hoshi-stars";

for (const name of ["Sirius", "Vega", "Betelgeuse"]) {
  const star = starByName(name);
  const distance = starDistance(star);
  const [near, far] = distance.lightYearsRange;
  console.log(`${name} ${star.spectralType} (${star.luminosityClass}): ${distance.lightYears.toFixed(1)} light-years, from ${near.toFixed(1)} to ${far.toFixed(1)}`);
}
// Sirius A1Vm (V): 8.5 light-years, from 8.5 to 8.6
// Vega A0Va (V): 25.1 light-years, from 24.8 to 25.5
// Betelgeuse M1-2Ia-Iab (Ia): 548.2 light-years, from 479.6 to 639.5
```

The range is one standard error either side of the parallax. Sirius is known to a few hundredths of a light-year; Betelgeuse could be anywhere from 480 to 640. A parallax from the Bright Star Catalogue alone (`parallaxSource` is `"BSC"` or `"dynamical"`) has no error, so `lightYearsError` and `lightYearsRange` are `undefined`. Where the error is as large as the parallax, the farthest is `Infinity`.

A few supergiants have a catalogue parallax too poor to print as it stands, so the package does something else for them, and says what in `parallaxNote`. Betelgeuse, Rigel and Polaris take a distance typed from a published paper (`parallaxSource` is `"literature"`): Betelgeuse 168 (+27/-15) parsecs (Joyce et al. 2020), Rigel 0.26 kiloparsecs with a range that reaches 0.45 (de Almeida et al. 2022) and Polaris the Hubble parallax of its companion (Bond et al. 2018). Antares, Canopus and Mu Cephei keep the Yale parallax but with its error widened to at least the parallax itself, so their distance is `rough` and has no farthest limit. Print the range for any distance whose `distanceQuality` is `"rough"`, never the best value alone. The sources are in `NOTICE.md`.

The whole spectral type (`spectralType`, `M1-2Ia-Iab` for Betelgeuse) and the luminosity class in it (`luminosityClass`: `Ia`, `Iab`, `Ib` and `I` supergiants, `II` bright giants, `III` giants, `IV` subgiants, `V` dwarfs, `VI` subdwarfs, `D` white dwarfs) tell a giant from a dwarf of the same colour. `luminosityClass(type)` reads the class from any spectral type string.
