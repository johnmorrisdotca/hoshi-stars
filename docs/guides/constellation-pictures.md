---
title: Constellation pictures and facts
section: how-to
order: 5
description: A picture of each of the 88 constellations, in light and dark, as SVG and PNG files or drawn by a function, and a table of facts for a gallery or a list.
---

[日本語](ja/constellation-pictures.md)

A picture of every IAU constellation, drawn by this package from its own stars, lines and boundaries: the constellation framed in a square, its boundary dashed, its stick figure and bright stars in full, and its neighbours' boundaries and stars faint round it. North is up and east is to the left, as the sky looks. There are two looks, `dark` (a night sky) and `light` (ink on paper), and the picture holds no text, so it needs no font and reads in any language.

## The files

The npm package ships the pictures as files, so a page can use them without running any code. The main entry's size is unchanged.

| Path in the package | What |
|---|---|
| `thumbnails/svg/<look>/<abbreviation>.svg` | the picture, scaling to any size (480 pixels by default) |
| `thumbnails/png/160/<look>/<abbreviation>.png` | a picker tile |

`<look>` is `light` or `dark`; `<abbreviation>` is the IAU abbreviation with its capitals (`Ori`, `CMa`, `PsA`). From a CDN: `https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/thumbnails/svg/dark/Ori.svg`. A bundler can import the same path: `@johnmorrisdotca/hoshi-stars/thumbnails/svg/dark/Ori.svg`.

The demo site also has PNGs at 480 pixels (a card) and 1200 pixels (to print or share), for example `https://johnmorrisdotca.github.io/hoshi-stars/thumbnails/png/1200/light/Ori.png`. To make your own folder of files at any sizes, run `pnpm thumbnails <folder> 160,480,1200` in a checkout; the PNGs are drawn from the SVGs by resvg, with no browser.

## Drawing one

`/thumbnails` is its own import, so a page that only shows the files pays nothing for it:

```js
import { constellationThumbnail, THUMBNAIL_UNITS } from "@johnmorrisdotca/hoshi-stars/thumbnails";

const svg = constellationThumbnail("Orion", { theme: "light", size: 160 });
console.log(svg.startsWith("<svg"), svg.includes('width="160"'), THUMBNAIL_UNITS);
// true true 400
```

`constellationThumbnail(text, options)` takes any name `constellation` accepts and gives an SVG string. The options are `theme` (`dark` by default), `size` in pixels (left out, the picture takes the size of its box) and `neighbours` (`false` leaves out the faint boundaries and stars round it). Every star of the constellation is a `<circle>` with its `data-hr`, the Bright Star Catalogue number, so a page can find and mark it.

## The same drawing for other figures

`thumbnailSvg(input, options)` draws any figure from outlines to frame, line segments between sky positions, and a test for which stars belong to it, so another set of figures (the traditional Japanese or Chinese ones, say) is drawn the same way and looks like the rest:

```js
import { boundaryOf } from "@johnmorrisdotca/hoshi-stars/boundaries";
import { thumbnailSvg } from "@johnmorrisdotca/hoshi-stars/thumbnails";

const belt = thumbnailSvg({ title: "The belt", outlines: boundaryOf("Ori").outlines, segments: [], owns: (star) => star.name === "Alnilam" });
console.log(belt.includes('data-hr="1903"'));
// true
```

## Facts for a gallery or a list

`/constellation-facts` holds what the star tables do not: what the name means (English and Japanese), the hemisphere, the best month, who made the constellation and when, how easy it is to find, its asterisms and the meteor showers whose radiant lies in it.

```js
import { allConstellationFacts, constellationFacts } from "@johnmorrisdotca/hoshi-stars/constellation-facts";

const orion = constellationFacts("Orion");
console.log(orion.meaning.en, orion.hemisphere, orion.bestMonth, orion.origin, orion.designer.en, orion.difficulty);
console.log(orion.asterisms.map((a) => a.en), orion.meteorShowers.map((s) => `${s.name.en} ${s.peak}`));
console.log(allConstellationFacts().filter((f) => f.difficulty === "easy" && f.hemisphere === "north").map((f) => f.constellation.abbreviation).join(" "));
// Hunter both 1 ancient Ptolemy easy
// [ "Orion's Belt", 'Winter Triangle', 'Winter Hexagon' ] [ 'Orionids 10-21' ]
// And Aur Boo Cas Cyg Dra Gem Peg Per UMa
```

- **Hemisphere** is `north`, `south` or `both` (it crosses the celestial equator by more than a degree), worked out from the boundary.
- **Best month** is the month, 1 to 12, when it is highest in the evening sky (about 21:00 by the Sun on the 15th), worked out from where its figure is.
- **Origin** is `ancient` (Ptolemy's 48: 47 constellations and Argo Navis, which Lacaille split into Carina, Puppis and Vela, so 50 of today's 88), `voyages` (12 southern ones from the Dutch voyages of the 1590s), `early` (12 added in the 1500s and 1600s) or `modern` (14 by Lacaille, 1756). `designer` and `year` say who and when.
- **Difficulty** is `easy`, `medium` or `hard`, from the brightness of the constellation's stars alone: the third-brightest star decides, and a very bright one helps. It says how easy the stars are to see, not how easy the shape is to learn.
- **Asterisms** and **meteor showers** are small hand-typed tables of well-known facts, in our own words; the showers use the IAU's names and the usual peak night, which moves by a day or so a year. The sources are in `NOTICE.md`.

The types are `ConstellationFacts`, `Words` (a text in `en` and `ja`), `Hemisphere`, `Origin`, `Difficulty`, `MeteorShower`, `ThumbnailInput`, `ThumbnailOptions` and `ThumbnailTheme`.

## In the demo

The demo's pages use the pictures and the facts, so they show what the two entry points are for:

- **The picker** above the sky map on the home page: a strip of all 88 pictures with a search box (by English, Latin or Japanese name, or the abbreviation). Tap one and the map flies there and picks the constellation. Enter in the search picks the first match. `?go=Ori` on the home page does the same from a link.
- **Neighbouring constellations as pictures.** The demo's neighbouring constellations are the picker's card everywhere, one picture with its name under it: the Neighbours on a constellation's page, and the Nearby panel's neighbouring constellations beside the sky map, in a grid that fits the column (as many to a row as fit, three in the map's side panel on a desk, two or three on a phone). A tap goes where the name did before; the cards are links or buttons you can reach by keyboard, and each is named for a screen reader.
- **The gallery**, `constellations.html`: all 88 pictures, 24 a page, with search. A tile opens that constellation's own page.
- **A constellation's page**, `constellation.html?c=Ori`: a big picture with its files, the facts above, the name spoken by your browser (the Latin and the Japanese name), its bright stars and Messier objects, its neighbours as the same picture cards the picker shows (a grid of the pictures with the names under them; a tap opens that constellation's page), and Open on the map.
- **The list**, `constellation-list.html`: a table of the IAU's 88 constellations, the Western sky (the Japanese and Chinese skies are on the sky map), with six filters: the hemisphere, best month, origin, how easy they are to find, asterisms and meteor showers. On a desk each filter is a small chip that shows its choice (`Hemisphere: any`) and opens a menu of its choices; on a phone one Filters button opens a sheet. Several choices in one filter add up, filters narrow each other, a count beside the chips shows how many are left, and Clear all starts again. The choices are kept in the address.

The demo is at https://johnmorrisdotca.github.io/hoshi-stars/ . Every page is in English and Japanese, in light and dark, and the pictures follow the theme.
