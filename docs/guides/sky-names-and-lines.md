---
title: Names on the stars and faint constellation lines
section: how-to
order: 12
description: How to put the names of the brightest stars, and the constellation figures as very faint lines, on a sky you draw yourself, with the figure under the pointer at full strength, a body that covers part of the sky, and a look you change by settings alone.
---

[日本語](ja/sky-names-and-lines.md)

`@johnmorrisdotca/hoshi-stars/sky-labels` is for a sky a page draws itself (a 3D scene, a canvas, an SVG). The page keeps the camera and does the drawing; it says where a star is on its screen, and this chooses and lays out: which stars get a name and where the name goes, and the 88 constellation figures as lines, each at a strength. Both are **off until asked for**, so most of the sky is seen without lines or names.

## The attributes and the properties

A page that offers these as attributes on its element (the way a settings panel can set them) reads them with the package's own parsers, so every page means the same by them.

| Attribute | Means | Off when |
|---|---|---|
| `star-names="12"` | Name the 12 brightest stars that are in view and not covered. A bare `star-names` is 10. At most 335, every star that has a name. | missing, `0`, or text that is not a number |
| `star-names-magnitude="1.5"` | Name only stars at least that bright (Sirius is -1.46; 1.5 names the 22 brightest). With `star-names` too, both limits hold. | missing or not a number |
| `constellation-lines="0.16"` | Draw the 88 figures at this strength, 0 to 1. A bare `constellation-lines` is 0.16, a faint line. The figure the pointer is on (on one of its lines or on one of its stars), or that is touched, is at 1 and shows its name. | missing, `0`, `off`, `false` or text that is not a number |

`starNamesFromAttributes(count, magnitude)` and `lineStrengthFromAttribute(value)` read the text of those attributes (`STAR_NAMES_ATTRIBUTES` and `CONSTELLATION_LINES_ATTRIBUTE` hold the attribute names). What cannot be an attribute is given in code:

| Where | Is | For |
|---|---|---|
| the third argument of `StarNames.update(project, view, covered)` | a `CoverMask`: `(x, y) => boolean`, true where a body covers the sky | the Earth, a planet or a panel in front of the stars; a name behind it is left out and the next star is named |
| `style` in the settings of `createStarNames` and `createFigureLines` (and `set`) | a partial `LabelStyle` | the look, below |

The package never knows what covers the sky: the page does, and says so with `discCover(x, y, radius)` for a round body or any function of its own.

## Use

```js
import { createFigureLines, createStarNames, discCover, labelStyleVars, lineStrengthFromAttribute, starNamesFromAttributes } from "@johnmorrisdotca/hoshi-stars/sky-labels";

// Your own sky: this one looks at Orion, 8 pixels to the degree, in a view 1280 by 720.
const project = (ra, dec, out) => {
  const across = ((ra - 84 + 540) % 360) - 180;
  out.x = 640 - across * 8;
  out.y = 360 - dec * 8;
  return Math.abs(across) < 80;
};
const view = { width: 1280, height: 720 };

// The names. The settings come from the page's attributes, star-names="5" here, and a look is a setting too.
const names = createStarNames({ ...starNamesFromAttributes("5", null), style: { case: "upper" } });
names.update(project, view);
console.log(names.labels.map((label) => label.text).join(", "));

// A body in front of the sky hides the stars behind it: here a disc over Sirius, and the next star is named instead.
const sirius = names.labels[0];
names.update(project, view, discCover(sirius.x, sirius.y, 30));
console.log(names.labels.map((label) => label.text).join(", "));

// The lines, from constellation-lines="0.3": every figure at that strength, the one under the pointer at full strength.
const lines = createFigureLines({ strength: lineStrengthFromAttribute("0.3") });
lines.update(project, view);
const orion = lines.figures.find((figure) => figure.abbreviation === "Ori");
lines.point(lines.segments[orion.start * 4], lines.segments[orion.start * 4 + 1]);
const other = lines.figures.find((figure) => figure !== lines.picked);
console.log(lines.picked.abbreviation, lines.name.text, lines.opacityOf(lines.picked), lines.opacityOf(other));

// The look as CSS custom properties, to set on the element that holds the labels.
console.log(labelStyleVars({ size: 14, case: "upper" })["--hoshi-label-size"]);

// SIRIUS, RIGEL, PROCYON, BETELGEUSE, ALDEBARAN
// RIGEL, PROCYON, BETELGEUSE, ALDEBARAN, POLLUX
// Ori Orion 1 0.3
// 14
```

`createStarNames(settings)` returns an object whose `update(project, view, covered)` fills `labels` with the names to draw (a `StarNameLabel` each: the star, the text, the box and the short leader line), brightest first. `createFigureLines(settings)` returns one whose `update(project, view)` lays the lines out in `segments` (four numbers a line; each `FigureOnScreen` in `figures` owns the lines from `start` up to `end`), `opacityOf(figure)` says how strong to draw each, and `point(x, y)` says where the pointer is and answers `true` when the picked figure changed, which is when to draw once more. `point()` with no arguments is the pointer leaving. A finger picks by `point` on touch and the page leaves the pick until the next touch. The picked figure's `name` is a `FigureName`: its text and where to put it, clear above the figure (below it where the figure reaches the top of the view) and never over a star's name: pass `names.labels` as the third argument of `update`, `lines.update(project, view, names.labels)`, and the name steps up past any star's name in the way. Pointing at a star of a figure lights the whole figure, as pointing at a line does. For the keyboard, `step(1)` picks the next figure in view and `step(-1)` the one before (in the catalogue's order, round from the last to the first), answering `true` when the pick changed; the demo binds them to `]` and `[`, and Escape to `point()`.

`project` is a `SkyProjector`: it gets a star's right ascension and declination in degrees and writes where it is into a `ScreenPoint`, answering `false` when the star is not in front of the camera. `view` is a `SkyView`, the size of the part of the screen to use and an optional `margin`. A name is kept only when the whole of it, and its leader line, is inside the view; names never overlap. They are placed brightest first, and each tries the right of its star, then the left, then above, then below (`LABEL_SIDES`, a `LabelSide` each), and takes the first place that covers no other name, no other name's ring and no star's dot (the dots of the stars brighter than `dotMagnitude`, 3 by default, each `dotRadius` pixels, 3 by default: set them to what your page draws). If no place is free the name is left out, and the next star is tried. `placeLabel` is the placing on one side. Names come in English (the IAU spelling) or, with `lang: "ja"` (a `NameLanguage`), in katakana; a star with no katakana is named in English. A constellation's name is Latin or Japanese the same way.

### Another culture's figures

`createFigureLines({ culture })` lays out the figures of a sky culture instead of the 88: pass `japanese` or `chinese` from `@johnmorrisdotca/hoshi-stars/cultures/…` (or a culture of your own, made with `defineCulture`). The figures are the culture's, in its order, and each `FigureOnScreen`'s `abbreviation` is the figure's id (`Ori` for a constellation, `subaru`, `bei3-dou3`). `update`, `point`, `step`, `opacityOf` and the name behave as they do for the 88. A constellation is named as the 88 are (Latin, or Japanese with `lang: "ja"`); an asterism by its English name (`Subaru`) or, in Japanese, by its reading in kana (`すばる`); a figure with no name in the language by its own (`昴宿`). A new culture in `set` makes its figures once and lets the picked figure go; leaving `culture` out draws the 88 again. `set` replaces every setting, so `set({ strength })` alone goes back to the 88 (and to English, and the default look): a strength slider keeps the rest with `lines.set({ ...lines.settings, strength })`.

```ts
import { createFigureLines } from "@johnmorrisdotca/hoshi-stars/sky-labels";
import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";

// the Japanese sky, its names in Japanese, the Pleiades in the middle of the view
const lines = createFigureLines({ culture: japanese, lang: "ja" });
const project = (ra: number, dec: number, out: { x: number; y: number }): boolean => {
  out.x = 640 - (ra - 56.9) * 40;
  out.y = 360 - (dec - 24.1) * 40;
  return Math.abs(ra - 56.9) < 15 && Math.abs(dec - 24.1) < 9;
};
lines.update(project, { width: 1280, height: 720 });
const subaru = lines.figures.find((figure) => figure.abbreviation === "subaru")!;
lines.point(lines.segments[subaru.start * 4]!, lines.segments[subaru.start * 4 + 1]!);
console.log(lines.figures.length, lines.picked?.abbreviation, lines.name?.text);
// 106 subaru すばる
```

## Nothing is redrawn at rest, nothing is allocated while it moves

`update` and `point` are for the moments something changed: the camera moved, the size changed or a setting changed. At rest there is nothing to call and nothing to redraw. After the first call they allocate nothing (the arrays and objects are reused, and `labels` and `figures` are the same ones from one `update` to the next), so a page may call `update` on every frame the camera moves. The one exception is a new `culture` in `set`: the figures are made again, so `segments` and `figures` are new objects after it, and a page that holds on to them (a GPU buffer made from `segments`, say) reads them again. A pointer that moves along without changing the picked figure gets `false` from `point`, and the page draws nothing.

## The default look and its font

The default look, chosen from several proposals, is "Display with catalogue letters": the name in Michroma, in small capitals with wide letter spacing, a thin ring round the star, and the star's catalogue letter underneath in small monospace (`α Ori`; a star with no Bayer letter or Flamsteed number has none to write). Every part is a setting below.

The package does not ship the font. Michroma is the family's font for a name on a body, and your page loads it with kazoku-ui's `loadBodyLabelFont()` (`@johnmorrisdotca/kazoku-ui/body-label`, version 0.36 or later), which fetches the 64 kB file only when it is called; until it is in, the label uses the next family (`system-ui`). A page that wants its own font sets `font` and loads that. The embed page loads Michroma itself, only when its names or lines are on, from a copy in its own site (`fonts/`, with its licence, the SIL Open Font License 1.1).

## The look is a setting

Nothing is fixed: a look is one object, `LabelStyle`, with a default (`DEFAULT_LABEL_STYLE`), and a bad value is held to its range by `labelStyle(part)`, never an error.

| Part | CSS custom property | Is | Default |
|---|---|---|---|
| `font` | `--hoshi-label-font` | the font family | `Michroma, system-ui, sans-serif` |
| `size` | `--hoshi-label-size` | pixels, 6 to 48 | 11 |
| `weight` | `--hoshi-label-weight` | 100 to 900 | 400 |
| `colour` | `--hoshi-label-colour` | any CSS colour | a quiet white |
| `halo` | `--hoshi-label-halo` | the outline colour that keeps letters readable over stars, or `none` | dark blue |
| `haloWidth` | `--hoshi-label-halo-width` | pixels, 0 to 12 | 3 |
| `case` | `--hoshi-label-case` | `small-caps` (drawn with CSS `font-variant: small-caps`), `as-written`, `upper` or `lower` (Japanese is not changed) | `small-caps` |
| `letterSpacing` | `--hoshi-label-letter-spacing` | em, -0.1 to 1 | 0.14 |
| `leader` | `--hoshi-label-leader` | the length in pixels of a short line from the star to its name, 0 to 80; 0 is no line and the name beside the star | 0 |
| `leaderColour` | `--hoshi-label-leader-colour` | any CSS colour | a quiet blue-white |
| `offset` | `--hoshi-label-offset` | pixels from the ring (or the star) to its name or line, 0 to 40 | 4 |
| `ring` | `--hoshi-label-ring` | the radius in pixels of a thin ring round a named star, 0 to 30; 0 is no ring | 6 |
| `ringColour` | `--hoshi-label-ring-colour` | any CSS colour | a quiet blue-white |
| `ringWidth` | `--hoshi-label-ring-width` | pixels, 0.25 to 4 | 0.75 |
| `designation` | `--hoshi-label-designation` | `below` writes the star's catalogue letter (`α Ori`) in small type under its name, `none` leaves it out | `below` |
| `designationFont` | `--hoshi-label-designation-font` | the font family of that line | a small monospace |
| `designationSize` | `--hoshi-label-designation-size` | pixels, 6 to 24 | 9 |
| `designationColour` | `--hoshi-label-designation-colour` | any CSS colour | a quieter white |

`LABEL_STYLE_PROPERTIES` holds those property names. `labelStyleVars(style)` gives the style as custom properties to set on the element that holds the labels, `labelStyleFrom(read)` reads a style back from them (`(name) => getComputedStyle(element).getPropertyValue(name)`), `labelText(name, style)` applies the case, and `labelWidth`, `designationWidth` and `labelHeight` give the room a name and its catalogue letter take. Picking a look is then a change of settings and no new code. The line strength is a setting of its own (`strength`, 0 to 1, `DEFAULT_LINE_STRENGTH` 0.16, held by `clampStrength`), as is how near a line the pointer must be (`reach`, 14 pixels by default, more for a finger) and, for a flat map, the longest line to draw (`maxLength`, so a figure that crosses the map's seam is not drawn across it).

## On the embed page

The page that is made for an iframe reads the same names from its address: `star-names=12`, `star-names-magnitude=1.5`, `constellation-lines=0.16`, and the look as `label-` and the part (`label-size=14`, `label-case=upper`, `label-leader=14`, `label-halo=none`; a `#` in a colour is written `%23`). When `constellation-lines` is there it takes the place of the `lines` layer, and `star-names` the place of the chart's own star names. A mouse picks the figure it rests on (a line or a star of it) and lets go when it leaves; a finger picks what it touches and the pick stays until the next touch.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hoshi Stars with names and faint lines</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/embed.html?ra=84&dec=0&zoom=1.5&layers=milky&star-names=10&constellation-lines=0.16&label-case=upper&label-leader=14"
      title="The sky around Orion with its brightest stars named and its constellations in faint lines"
      width="480"
      height="360"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

## Where the data comes from

The names are the IAU Working Group on Star Names' list, which the catalogue's stars carry already (a name is a fact; the katakana are written by hand, see `NOTICE.md`). The figures are the package's own, from the stars' positions. Nothing here adds a source or a file: the entry point is about 7 kB gzipped as shipped (its comments included), on top of the stars and lines tables a page already loads.
