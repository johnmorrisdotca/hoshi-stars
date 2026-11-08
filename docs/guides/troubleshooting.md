---
title: Troubleshooting and FAQ
section: troubleshooting
order: 30
description: Fixes for a chart that is empty or upside down, a line across the whole chart, a missing star, a constellation that is not what a book shows, and other questions.
---

[日本語](ja/troubleshooting.md)

## The chart is empty

`project` gives `undefined` for a point on the far side, and the far side of `orthographic` and `gnomonic` is half the sky. Check the centre: the stars you want must be within 90 degrees of it. With `scale` too small, every star lands in the middle; with it too big, the stars are off the page. For `stereographic`, a scale of about a quarter of the smaller side shows a hemisphere.

## The chart is upside down, or the wrong way round

On purpose, it is the sky seen looking up: north is up, east is to the left. For the map convention pass `mirror: true`. An SVG screen's y runs down while the chart's `y` runs up: draw at `centreY - at.y`.

## A line runs across the whole chart

On the three whole-sky projections the chart has a seam at the edge. A segment between a star on one side and a star on the other is a long line across it. Skip a segment whose ends are more than half the chart apart. A boundary ring that crosses 0 h has the same trouble: lift your pen between two points that land far apart.

## `starByName("sirius")` works but `starByName("alpha Canis Majoris")` does not

A name is a common name (`Sirius`) or a designation as the package writes it (`α CMa`), in any case. Spelled-out letters and genitives are not read. To find stars of a constellation, use `starsIn`.

## A star I can see is not in the table

The table is the stars of magnitude 6.0 and brighter. A fainter one is not in it, and the package never guesses a star.

## The constellation is not the shape in my book

The lines are our own. A figure only joins stars inside its constellation, so a shape that crosses a border (the Great Square of Pegasus) is open. Nothing stops you drawing your own lines from the stars: `starByHr` and `starByName` find them.

## The star names are in English letters on the Japanese page

The package has no Japanese names for stars: it has them for constellations (`おおいぬ座`). A name like `Sirius` is the IAU's spelling.

## `RangeError: ... declination must be between -90 and 90`

The projections check what they are given. A declination outside -90 to 90, or a scale of 0 or less, is a `RangeError`, and a non-number is a `TypeError`, both naming the argument.

## The chart is slow with many stars

Every star is one element. 1,600 (magnitude 5) draws in a few milliseconds; all 5,080 is fine on a desk and slower on an old phone. Draw to a canvas instead, or lower the limit as the chart shrinks.
