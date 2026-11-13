---
title: A digital planisphere
section: how-to
order: 15
description: "The star wheel on screen: drag the disc or pick a date and a time, and the horizon window of your latitude shows what is up. The rings, the geometry, the address and the limits."
---

[日本語](ja/planisphere.md)

The [Planisphere page](https://johnmorrisdotca.github.io/hoshi-stars/planisphere.html) is the [printable star wheel](printable-sheets.md) (`starWheelDisc`) turned under a plate whose window is the horizon of your latitude. Drag the wheel, press the arrow keys, or pick a date and a time, and the window shows the stars above your horizon. The list beside it names the stars in the window.

## What is on the wheel

From the middle out: the stars to magnitude 5 round the pole (the north celestial pole, or the south one for a southern wheel), the figures, the equator and the ecliptic dashed, then three rings.

| Ring | What it is | Spacing |
|---|---|---|
| Months | Each month and the 1st, 10th and 20th of it, placed where the Sun is on that day. | Uneven: the Sun is slower in July than in January, so a day is not always the same angle. |
| Sky's hours | Right ascension, 0 to 23, on the disc. | Even: 15 degrees an hour. |
| Clock | The hours of the day on the plate, 12 at the top and the later hours the way the stars set. | Even: 15 degrees an hour. |

The window is a circle of the same chart. Its radius is `k / sin(latitude)` and its middle is `k / tan(latitude)` from the pole, where `k` is the chart's scale: that circle is the horizon, because a stereographic chart keeps circles round. N, E, S and W are written round its edge. A wheel is made for 20 to 70 degrees north or south; a place nearer the equator is drawn as 20.

## What turning does

The disc turns by the local sidereal time: minus it in the north, plus it in the south. The time is **the Sun's time at your place** (it is noon when the Sun is highest) read as if the place were on the Greenwich meridian, so the page has no time zone and no longitude to ask for. The date and the time boxes, the buttons for an hour earlier and later, a drag and the arrow keys all change that one moment, and the wheel is drawn from it.

- A drag turns the wheel as your hand does. In the north the sky goes round the pole anticlockwise, so a clockwise turn is an earlier time; in the south it is the other way.
- A key turns the disc 15 minutes of the sky's turn (about 3.75 degrees), with Shift an hour, and Page Up and Page Down move the date by a day. Arrow Right and Arrow Up turn it clockwise, Arrow Left and Arrow Down anticlockwise.
- The address keeps `hemi` (`n` or `s`), `lat`, `date` and `time`, for example `?hemi=s&lat=34&date=2026-12-21&time=21:00`. Your own location is not used.

## Does the window agree with the sky?

The window holds a star exactly when `horizontal()` puts it above the horizon. The page's tests check that three ways: against the printed plate's window circle and the printed disc's star positions, against `horizontal()` for every star to magnitude 4.5 at eleven latitudes (north and south, 20 to 70) and twelve hours of a night, and in the browser by reading where the star's circle is on the screen against the window's circle. The disc is drawn at J2000 and not carried to the date, so a star within a degree of the horizon may be on either side; the tests leave those out and say so.

## Limits

- The window is the geometric horizon: no refraction, and no hills.
- It shows the stars that are above it, not the ones you can see: the Sun, the Moon and the sky's darkness are not counted (see [what you can see tonight](tonight.md) for that).
- The month ring places a date by the Sun's place in 2026. In another year it is a day off at most, as on a printed wheel.
- The list names stars brighter than magnitude 2.5, the stars of the Yale Bright Star Catalogue that have a name.
