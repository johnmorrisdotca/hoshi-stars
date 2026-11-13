---
title: The colour and brightness of the stars (the Hertzsprung-Russell diagram)
section: how-to
order: 15
description: "Plot the stars by colour and brightness, or by temperature and luminosity: absoluteMagnitude, starProfile, and the demo's life-of-a-star page."
---

[日本語](ja/hr-diagram.md)

A Hertzsprung-Russell diagram plots every star by how hot it is (across, hot on the left) and how bright it really is (up). Most stars fall along a band, the main sequence, where a star like the Sun spends most of its life; giants and supergiants lie above it and white dwarfs below. The [life of a star page of the demo](https://johnmorrisdotca.github.io/hoshi-stars/life.html) draws it for the stars of the catalogue whose accuracy grade is A or B (about 530 of the 5,080, the ones with a distance good enough to trust, see [accuracy](accuracy.md)), with two choices of axes in the same picture:

- **Colour and brightness**: the catalogue's B-V colour index across, and the **absolute magnitude** up (how bright the star would look from 10 parsecs, smaller is brighter). `absoluteMagnitude(star)` works it out from the magnitude and the parallax.
- **Temperature and luminosity**: the temperature in kelvin across and the luminosity in suns up, from [`starProfile`](star-profile.md) (a temperature scale for the star's spectral type and a bolometric correction), with the uncertainty it carries.

```js
import { absoluteMagnitude, starByName } from "@johnmorrisdotca/hoshi-stars";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

for (const name of ["Sirius", "Aldebaran", "Betelgeuse"]) {
  const star = starByName(name);
  const profile = starProfile(star);
  console.log(`${name}: B-V ${star.colourIndex}, absolute magnitude ${absoluteMagnitude(star).toFixed(1)}, ${Math.round(profile.temperature.value / 100) * 100} K, ${Math.round(profile.luminosity.value)} suns`);
}
```

The output is:

```text
Sirius: B-V 0, absolute magnitude 1.4, 9500 K, 24 suns
Aldebaran: B-V 1.54, absolute magnitude -0.7, 3900 K, 403 suns
Betelgeuse: B-V 1.85, absolute magnitude -5.6, 3700 K, 52266 suns
```

## What the page does

- **Click a dot, or press Enter on it, to pick a star.** Its card gives the type, colour, brightness, temperature, luminosity, grade and distance, and a link to find it on the sky map, which opens on that star. Tab to the diagram, then the arrow keys walk the dots from the hottest to the coolest; "Find a star by name" does the same by typing.
- **Stars** chooses the graded set (A and B), grade A only, or the named stars only. A star the catalogue gives no colour or no usable distance has no place on the diagram, and its card says which.
- **The Sun** is drawn as a diamond: it is not a catalogue star, so it is a reference point from the Sun's own figures.
- **The address** keeps the axes (`axes=physical`), the filter (`show=a` or `show=named`) and the picked star (`star=2491`, or `star=sun`), so a link opens the same view.
- **Two lives** lists the stages of a star like the Sun (a nebula, a young T Tauri star, the main sequence, a subgiant, a red giant, a planetary nebula, a white dwarf) and of a massive star (a red supergiant, a supernova remnant, a neutron star), each with the example in our data: Alpha Centauri A or the Sun, Aldebaran, Betelgeuse, M57 and M1. A star opens its card; an object opens on the sky map. T Tauri and Sirius B are not in our data on their own, and the page says so.

## What it does not do yet

The paths a star takes across the diagram, and the times it spends at each stage, are not drawn. The package holds stars as they are today, not how one star changes, and it uses no figures from elsewhere (the Hipparcos, Gaia and stellar-evolution tracks are under licences an MIT package cannot pass on, or are not ours to copy). The tracks and an animation along them come when there is data we may ship.
