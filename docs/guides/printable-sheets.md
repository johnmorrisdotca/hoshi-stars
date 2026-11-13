---
title: Printable sheets
section: how-to
order: 6
description: Connect-the-dots constellations, the constellations for your country and region, a cut-out star wheel for your latitude and a sky map for each month, on A4 or US Letter, in English and Japanese, with ready-made PDFs.
---

[日本語](ja/printable-sheets.md)

`/sheets` draws four printable things from the package's own stars and figures, each as one SVG string measured in millimetres (a millimetre of the picture is a millimetre of the paper), so it has no browser and no dependency:

- **Connect the dots** (`dotsSvg`, `dotsFigure`): a constellation's figure as big dots, sized by brightness and numbered in the order the lines are drawn, for a child; an answer page has the lines, 1 mm thick. No dot is larger than a third of the distance to its nearest dot (between the floor and the ceiling of `DOT_LIMITS`: 1 to 5 mm for a child, 0.6 to 2 mm for the normal type), and where two stars lie too close on the page for the smallest dots they are moved apart, by 2 mm at the most, so that the dots can be told apart (the picture is not to scale there; it is for joining dots, not for measuring). Every number is put where it touches no dot, line or other number; a test holds that for all the figures, at every level, type and paper. Three levels: `easy` joins the brightest 5 to 10 stars in one line, `medium` joins every star of the figure, `hard` has the dots and no numbers to find. Where a figure has more than one line the pencil is lifted: the dot where a new line starts has a ring. A star the lines pass again carries both numbers (`4·8`).
- **Your sky** (`skyForLatitude`, `regionGuideSvg`): the constellations that are always up at a latitude, the best of the evening sky in a month (about 21:00 by the Sun on the 15th), and the ones that are never seen. Latitude decides most of it. Ursa Minor is never seen from Sydney, the Southern Cross never from Toronto, and the Big Dipper never sets there.
- **A star wheel** (`starWheelDisc`, `starWheelPlate`, `starWheelPoster`): a planisphere for a latitude, to cut out: the disc of stars and figures with the date round its edge, and the plate with the horizon as a window and the hours round its edge. Turn the disc until the date is at the time you look. A poster version is 400 mm across, to tile over pages. Wheels are made for 20 to 70 degrees north or south.
- **A sky map for a month** (`skyMapSvg`): the evening sky over a latitude, the horizon at the edge and the zenith in the middle, with the figures and the names of the best known constellations that are up.

```ts
import { DOT_LIMITS, dotsSvg, latitudeBand, monthName, skyForLatitude, skyMapSvg, starWheelPlate } from "@johnmorrisdotca/hoshi-stars/sheets";

const room = { widthMm: 184.6, heightMm: 190 };
console.log(dotsSvg("Ori", { ...room, level: "easy", lang: "en" }).includes("Join the dots from 1 to"), DOT_LIMITS.kid.ceiling);

const sydney = skyForLatitude(-33.9);
console.log(sydney.find((one) => one.constellation.abbreviation === "UMi")?.standing, sydney.find((one) => one.constellation.abbreviation === "Cru")?.standing);
console.log(latitudeBand(-33.9, "en"), monthName(7, "en"));
console.log(starWheelPlate(-34, { ...room, lang: "en" }).includes('data-cut="window"'), skyMapSvg(-34, 7, { ...room }).includes("Face north"));
```

## The functions

| Function | Gives |
|---|---|
| `DOT_LEVELS`, `DOT_LIMITS`, `dotsFigure(name, { level, widthMm, heightMm, type })` | the levels (`easy`, `medium`, `hard`), the smallest and largest dot of each type in millimetres, and a figure laid out as dots, numbers and lines |
| `dotsSvg(name, { level, widthMm, heightMm, lang, answer, type })`, `dotsSubtitle(constellation, lang)` | a page of the puzzle or its answer, and the line of meaning for a title (`Orion: the Hunter`) |
| `skyForLatitude(latitude, month?)`, `latitudeBand(latitude, lang)`, `monthName(month, lang)`, `whyFamous(abbreviation, lang)` | the constellations as a place sees them, the band of ten degrees, a month's name and a note on a famous constellation |
| `regionGuideSvg(latitude, month, options)` | the sheet "constellations for where you live" |
| `WHEEL_LATITUDES`, `starWheelDisc`, `starWheelPlate`, `starWheelPoster` | the latitudes a wheel is made for (20 to 70) and the three drawings of it |
| `skyMapSvg(latitude, month, options)` | the evening sky of a month |

## The page around a picture

The pictures are the sheet's body. The header (the brand, the package and the title, and a "Name:" underline), the optional box with the region, flag and latitude band, and the footer (credits, version, date and a QR code back to the demo) are [kazoku-ui's print part](https://github.com/johnmorrisdotca/kazoku-ui/blob/main/docs/guides/print.md), which this package does not depend on: the demo builds them, in the `kid` type (names 28 pt, body 18 pt, lines 1.2 mm) or `normal`. Measure the room the page's body really has and give it to the function as `widthMm` and `heightMm`:

```ts no-run
import { buildSheet, printCss, printSheet } from "@johnmorrisdotca/kazoku-ui/print";
import { dotsSvg } from "@johnmorrisdotca/hoshi-stars/sheets";

const layout = { page: "a4", type: "kid", language: "en" } as const;
const holder = document.createElement("div");
holder.style.cssText = "position:absolute;inset:0";
const sheet = buildSheet({ ...layout, brand: "Space Program X", packageName: "Hoshi Stars", title: "Orion", pages: [holder] });

// lay it out out of sight once, to read the body's size
const style = document.createElement("style");
style.textContent = printCss(layout);
document.head.append(style);
sheet.style.cssText = "position:fixed;left:-10000px;visibility:hidden";
document.body.append(sheet);
const body = sheet.querySelector(".kazoku-body")!.getBoundingClientRect();
sheet.style.cssText = "";
holder.innerHTML = dotsSvg("Ori", { level: "medium", widthMm: body.width * 25.4 / 96, heightMm: body.height * 25.4 / 96, lang: "en" });
document.body.append(sheet);
printSheet(sheet);
```

## The place

The demo's picker uses the family's `kuni` (countries and their regions, with a point for each) and `hata` (flags), in the demo only: this package depends on neither. A country gives a latitude; a country that spans many (Canada, the United States, Russia, Brazil, Australia, Japan, China, India, Chile, Argentina, Mexico, New Zealand) gives a region too; the slider takes any latitude; and "Use my location" asks the browser once and never stores or sends the answer. The sheets show the region, its flag where the page carries it, the latitude band and the month.

## Ready-made PDFs

The Pages build prints PDFs from the demo: the dots of twelve famous constellations at each level, the star wheel for every band of latitude, and the constellations for your sky and the sky map for January, April, July and October in four bands, on A4 and US Letter in English and Japanese. [The English list](https://johnmorrisdotca.github.io/hoshi-stars/pdf/) and [the Japanese list](https://johnmorrisdotca.github.io/hoshi-stars/pdf/ja.html).

## How it is checked

Without a browser: every constellation with a figure makes a sheet at every level with its numbers 1 to N once each and every line joining a number to the next; the latitude rules against known places; the wheel's window against the geometry of the horizon (a circle of radius 1/sin(latitude) whose middle is cot(latitude) from the pole); every star of a sky map inside its horizon; every line of text inside the room on A4, Letter, A3 and Tabloid in both languages and both types. In Chromium and WebKit the demo is played, and in Chromium every kind of sheet is printed to a PDF on the four papers and the PDF is read for its paper size and its page count.
