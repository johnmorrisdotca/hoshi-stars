---
title: A star's size, temperature and portrait
section: how-to
order: 4
description: Work out how hot, how big and how bright a star is, with the uncertainty of each figure, and draw it from those numbers next to the Sun.
---

[日本語](ja/star-profile.md)

Most pictures of stars are an artist's idea of one. Only a handful of stars have ever been resolved as discs. This package does something more modest and more honest: it works out each star's size and temperature from what the catalogue holds, says how sure it is, and draws a picture from those numbers that says what it is. There are two entry points, `/profile` for the numbers and `/portrait` for the pictures.

## The numbers

`starProfile` takes a star and returns a `StarProfile`: its `temperature` (from a published scale for its spectral type and luminosity class, and from its colour), its `luminosity` and `radius` (in solar units, from its brightness, distance and temperature: `R = sqrt(L) / T²`), the `angularDiameterMas` of its disc as we see it, and its `limbDarkening`. Every figure is an `Estimate`: a `value`, its `error` and the `range` one standard error spans.

```js
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

for (const name of ["Sirius", "Arcturus", "Betelgeuse", "Deneb"]) {
  const profile = starProfile(starByName(name));
  const { temperature, radius, angularDiameterMas } = profile;
  console.log(`${name}: ${Math.round(temperature.value)} K, ${angularDiameterMas.value.toFixed(1)} mas across`);
  console.log(radius === undefined ? `  radius not known: ${profile.unknown.radius}` : `  radius ${radius.value.toFixed(1)} Suns, from ${radius.range[0].toFixed(1)} to ${radius.range[1].toFixed(1)} (${radius.basis})`);
}
// Sirius: 9506 K, 6.5 mas across
//   radius 1.8 Suns, from 1.7 to 2.0 (parallax)
// Arcturus: 4487 K, 18.4 mas across
//   radius 22.4 Suns, from 19.2 to 26.2 (parallax)
// Betelgeuse: 3710 K, 30.6 mas across
//   radius 336.0 Suns, from 148.5 to 986.9 (parallax)
// Deneb: 9125 K, 1.9 mas across
//   radius not known: no-parallax
```

Every one of the 5,080 stars has a temperature, a disc size and a limb darkening. Betelgeuse's radius is anywhere from 320 to 990 Suns: its distance, 548 light-years from a published paper, is still known only to about 15%, and the temperature scale adds to that. Where a figure cannot be worked out it is `undefined` and `unknown` says why (`Unknown`: `"no-parallax"`, `"poor-parallax"`, `"implausible-parallax"`, `"no-typical-radius"`, `"no-class"`, `"odd-type"` or `"no-colour-or-type"`), so a page can say it plainly instead of guessing. About three stars in four have a radius.

The disc size needs no distance: it comes from the brightness and the temperature alone, which is what an interferometer measures, so it is known for every star even where the radius is not. Its `range` is the honest check of the whole method: each of the numbers below is one the method gets wrong by about the amount shown.

`temperature.basis` (a `TemperatureBasis`) says how the temperature was found: from the star's `"spectral type"`, its `"colour"`, or `"spectral type and colour"` together. `radius.basis` (a `RadiusBasis`) is `"parallax"` where the radius was worked out for this star from its distance, and `"type"` where its distance is missing or too uncertain and the typical radius of stars of its type stands in, which the panel and the picture say. A star can be anything with the same fields (`ProfileInput`), so build the Sun by hand:

```js
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

const sun = starProfile({ magnitude: -26.74, colourIndex: 0.65, spectralType: "G2V", luminosityClass: "V", parallaxMas: 206264806.2, parallaxErrorMas: 1, parallaxSource: "GCTP" });
console.log(sun.radius.value.toFixed(2), Math.round(sun.temperature.value), sun.limbDarkening.toFixed(2));
// 1.00 5770 0.65
```

## How good the numbers are

Checked against 43 stars the CHARA Array resolved (A, F and G dwarfs and subgiants, Boyajian et al. 2012) and six famous ones with an interferometric diameter (sources in `NOTICE.md`):

- **The disc**: the one-standard-error range holds the measured disc for 33 of the 43 stars, which is about the two in three it should; the spread is 0.94 standard errors; the method reads 4.7% small on average and 7.5% off for a typical star. The worst are ψ Draconis (F5IV-V, 19% small), θ Pegasi (A2Vp, 16% small) and μ Cassiopeiae (a metal-poor G5V, 14% small): stars whose type and colour read hotter than they are.
- **The radius** from the catalogue's own parallax, for the 37 of the 43 whose parallax fixes a distance: 31 inside the range. (The Hipparcos parallaxes of that paper are not used here.)
- **Sirius A** reads 7% large (its type, A1, is a little cooler than the star itself); **Pollux** 8% large; **Arcturus** 12% small, inside the range; **Aldebaran** 2% small. Its radius, 22.4 against the measured 25.4 Suns, is inside the range.
- **Betelgeuse** reads 28% small and **Antares** 34% small, both inside their wide ranges: the light of a cool red supergiant is hard to turn into a total (its bolometric correction changes by 0.4 magnitude for every 100 K), and the two sit about 0.7 magnitude below the red-supergiant table, their light split by dust and molecules. Their parallaxes are poor, so their radii are broad guesses: Antares's catalogue parallax puts it too near and gives 116 Suns, where its measured 37.4 mas disc at the 170 parsecs usually quoted implies about 680.
- **Altair, Regulus and Vega** are rotating fast and flattened; the disc the method gives is inside the measured width across the poles and across the equator.

## The portrait

`starPortrait` draws a star from its profile as SVG text: a disc in the colour of its temperature, darker toward the edge by its limb darkening, with a generic surface texture of the kind of cells its type has, and a soft glow. `portraitLook` says which look it chose (`PortraitLook`: `"supergiant"` with a few huge convection cells, `"giant"`, `"sun-like"` with fine granulation, `"red-dwarf"`, `"hot"` and smooth, or `"fast-rotator"` for the three below). The picture says, in its own words, that it is drawn from numbers and that the texture is generic; it is our own drawing, never a photograph.

```js
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { portraitLook, starPortrait } from "@johnmorrisdotca/hoshi-stars/portrait";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

const profile = starProfile(starByName("Betelgeuse"));
const svg = starPortrait(profile, { name: "Betelgeuse", size: 320, lang: "ja" });
console.log(portraitLook(profile), svg.startsWith("<svg"), svg.includes("写真ではありません"));
// supergiant true true
```

The options (`PortraitOptions`) are `size` in pixels, `lang` (`"en"` or `"ja"`), `name`, `background` (`"space"` or `"none"` for a transparent picture) and `captions`. The same star is always drawn the same way: the texture is placed by a fixed sequence, so a server render matches a browser's. `starPortrait` returns `undefined` for a star with no temperature to draw.

`starComparison` draws the star next to the Sun at one scale. For a supergiant it fills the picture with the Sun a dot at its centre and the orbits of Earth, Mars and Jupiter drawn over it where they fit, so its size can be read against the solar system:

```js
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starComparison } from "@johnmorrisdotca/hoshi-stars/portrait";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

const betelgeuse = starComparison(starProfile(starByName("Betelgeuse")));
const aldebaran = starComparison(starProfile(starByName("Aldebaran")));
console.log(betelgeuse.includes("Earth's orbit"), aldebaran.includes("Earth's orbit"), aldebaran.includes("times the Sun's radius"));
// true false true
```

## The few stars with a measured shape

Altair and Regulus spin so fast that they are flattened, and Vega is seen almost over its pole. Interferometers have measured all three, and `starShape` gives the published numbers (a `StarShape`) with their source; `starProfile` carries the same shape in `shape`, and the portrait draws Altair and Regulus as ellipses with a cooler, darker equator and Vega as a round disc hotter in the middle. For every other star `starShape` returns `undefined`.

```js
import { starShape } from "@johnmorrisdotca/hoshi-stars/profile";

const altair = starShape(7557);
console.log(altair.kind, altair.equatorialRadius, altair.polarRadius, starShape(2491));
console.log(altair.source);
// oblate 2.029 1.634 undefined
// Monnier et al. 2007, Science 317, 342 (CHARA)
```

## How fast a star spins

The Bright Star Catalogue gives a projected rotation speed for about 2,800 of the 5,080 stars: v sin i, the speed of the equator times the sine of the angle between the spin axis and the line of sight. The true speed is that or more, as the tilt of the axis is not known from it. `starRotation` gives it with the catalogue's marks (`upperLimit` where it gives only a limit, `uncertain` where it marks the value uncertain), and `starProfile` carries it in `rotation`. A star with no figure returns `undefined`.

```js
import { starRotation } from "@johnmorrisdotca/hoshi-stars/profile";

const phecda = starRotation(4554);
console.log(phecda.vSinIKmS, phecda.upperLimit, starRotation(2061));
// 168 false undefined
```

## In your page

On a server, in Node:

```js
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starComparison, starPortrait } from "@johnmorrisdotca/hoshi-stars/portrait";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

// A server draws the same picture a browser does: pure, no DOM, no clock. Here Betelgeuse's portrait and its size beside the Sun, to two files.
const profile = starProfile(starByName("Betelgeuse"));
writeFileSync(join(tmpdir(), "betelgeuse-portrait.svg"), starPortrait(profile, { name: "Betelgeuse", size: 320 }));
writeFileSync(join(tmpdir(), "betelgeuse-and-the-sun.svg"), starComparison(profile, { name: "Betelgeuse", size: 360 }));
console.log(`Betelgeuse ${Math.round(profile.radius.value)} Suns across, from ${Math.round(profile.radius.range[0])} to ${Math.round(profile.radius.range[1])}`);
```

In a plain HTML page from a CDN:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star from jsDelivr</title>
  </head>
  <body>
    <div id="star"></div>
    <script type="module">
      import { starByName } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/index.js";
      import { starProfile } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/profile.js";
      import { starPortrait } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/portrait.js";

      const profile = starProfile(starByName("Arcturus"));
      document.querySelector("#star").innerHTML = starPortrait(profile, { name: "Arcturus", size: 320 });
    </script>
  </body>
</html>
```

In React (the picture is a string, so it goes in as markup; the same lines work in Vue with `v-html`, in Svelte with `{@html}` and in Angular with `[innerHTML]`, and the demo's "What to embed" writes each of them for the star you picked):

```tsx
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starPortrait } from "@johnmorrisdotca/hoshi-stars/portrait";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

const svg = starPortrait(starProfile(starByName("Sirius")!), { name: "Sirius", size: 320 }) ?? "";

export function Star() {
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

And in an iframe, with no script of your own. The star embed page reads the star's Bright Star Catalogue number (`star=2061`), `view=compare` for the star next to the Sun (the portrait is the default) and `lang=ja`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/star.html?star=2061&view=compare"
      title="Betelgeuse next to the Sun"
      width="360"
      height="310"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

## Where the numbers are from

The temperature scales are published ones: Mamajek's dwarf sequence (Pecaut and Mamajek 2013), van Belle et al.'s giants (2021) and Levesque et al.'s red supergiants (2005); the bolometric correction is Flower's (1996) with Torres's (2010) coefficients; the limb darkening is Claret and Bloemen's (2011) model-atmosphere table; the shapes are from the three CHARA papers. `NOTICE.md` names each table and its terms. No photograph, artist's picture or Wikipedia text is used, and the ESA data (Hipparcos, Tycho, Gaia) that the parallax would most improve is not read at all.
