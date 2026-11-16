---
title: See my sky
section: how-to
order: 15
description: "The sky as someone standing outside sees it: the <hoshi-my-sky> element, and the maths under it (the Moon's phase, rise and set, the planets, the Sun and the camera)."
---

[日本語](ja/my-sky.md)

`<hoshi-my-sky>` shows what a person standing at a place sees looking up at a moment: a horizon with N, E, S and W on it, the stars and the constellations where they really are, the Moon in its real phase with its rise and set, the planets that are up, the Sun by day, and a dark ground under the horizon. A drag turns you round and tips your head up and down. The [My sky page of the demo](https://johnmorrisdotca.github.io/hoshi-stars/my-sky.html) is the element with a place and a time to choose.

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/my-sky/define/+esm"></script>
<hoshi-my-sky latitude="49.28" longitude="-123.12" timezone="America/Vancouver" style="height: 80vh"></hoshi-my-sky>
```

It fills its box, so give it a height. With no `time` it is live: it follows the clock and redraws every ten seconds while the page is showing (a minute for a reader who prefers reduced motion), and at rest it draws nothing.

## The attributes

| Attribute | What it does |
|---|---|
| `latitude`, `longitude` | The place, in degrees (north and east are positive). Both are needed; without them the element says so. |
| `time` | A moment as an ISO text or milliseconds. Left out, the sky is live. |
| `lang` | `en` or `ja`; else the nearest `lang` above it, watched. |
| `heading` | The compass direction to face to start: 0 north, 90 east. Left out, toward the equator: south in the north, north in the south. |
| `pitch` | Degrees above the horizon to start (35). |
| `fov` | The angle across the smaller side, 20 to 130 (90). |
| `timezone` | An IANA name for the Moon's rise and set times (`America/Vancouver`); the reader's own by default. |
| `info="none"` | Hides the panel of the Moon and the planets. |
| `constellation-lines` | A strength from 0 to 1, or `off`. The default is a quiet 0.32 in a dark sky. |
| `star-names` | How many star names, or `off`. The default fits the size. |
| `daylight="show"` | Draw the stars even when the Sun is up. |

The properties are `latitude`, `longitude`, `time` (a `Date`, or `null` for live), `heading`, `pitch`, `fov`, `setView({ heading, pitch, fov })` and the read-only `sky`, the same report as `skyReport` below. The element sends `hoshi-sky-view` (`MySkyViewDetail`: `heading`, `pitch`, `fov`, `final`) as the view turns, and `hoshi-sky-pick` (`MySkyPick`: `kind` `sun`, `moon`, `planet`, `figure` or `none`, and `id`) when a tap lands on something. The class is `HoshiMySkyElement`, its tag `MY_SKY_TAG` (`hoshi-my-sky`) and `defineMySky()` defines it; `@johnmorrisdotca/hoshi-stars/my-sky/define` does that when imported and `/my-sky/element` only exports the class.

A drag, two fingers (pinch), Ctrl and the wheel, the arrow keys (Shift for a bigger step), + and - and Home are the family's view controls, `@johnmorrisdotca/kazoku-ui`. The sky is drawn with the stereographic projection, which keeps shapes true to a view 130 degrees across, so the horizon is a curve. The Moon and the planets are drawn larger than their true size, as every picture of the sky draws them. Stars are hidden as the Sun rises (a star is seen only when it is brighter than a limit that falls from 6 in the dark to -3 in daylight) and dimmed by the air near the horizon.

## The maths under it

The element only draws. Every number it draws is a pure function in `@johnmorrisdotca/hoshi-stars/my-sky` (no DOM, no clock, no star table), with tests against published values:

```js
import { moonPhase, moonRiseSet, skyReport } from "@johnmorrisdotca/hoshi-stars/my-sky";

const vancouver = { latitude: 49.28, longitude: -123.12 };
const evening = new Date("2026-11-17T04:00:00Z");
const report = skyReport(vancouver, evening);
console.log(Math.round(report.moon.phase.illuminated * 100), report.moon.phase.name, report.planets.filter((p) => p.up).map((p) => p.id).join()); // 47 first-quarter saturn

const next = moonRiseSet(vancouver, evening);
console.log(new Date(next.set).toISOString().slice(0, 16), next.rise > next.set); // 2026-11-17T06:58 true
console.log(moonPhase(new Date("2026-11-24T15:01:00Z")).name); // full
```

- `skyReport(observer, when)` is the Sun, the Moon (`MoonInSky`: altitude, azimuth, its `phase`, the next `rise` and `set`, its size and the direction of the Sun) and the five planets (`PlanetInSky`), with `limit`, the faintest star seen against that sky (`limitingMagnitude(sunAltitude)`). `SkyReport` is its type.
- `moonPosition(when)` (`MoonPosition`), `moonPhase(when)` (`MoonPhase`, `MoonPhaseName`), `moonHorizontal(observer, when)` and `moonRiseSet(observer, when)`: the Almanac's low-precision lunar series, good to about 0.3 degrees, a few minutes in a rise or set and 0.3 percent in the lit part. A test holds them to wakusei-planets' ELP series, which is a development tool only: this package never imports it.
- `planetPlaces(when)` (`PlanetPlace`, `NakedEyePlanet`, `NAKED_EYE_PLANETS`): Mercury to Saturn from Standish's approximate elements for 1800 to 2050 (a few arc-minutes) with the Almanac's magnitudes.
- `sunPlace(when)`: the Sun's position of the date and its distance.
- `localFrame(observer, when)` (`LocalFrame`, `Direction`) and `altitudeAzimuth(direction)`: one turn from a J2000 position to east, north and up, equal to `horizontal` in [your sky](sky-charts.md) and fast enough for the whole catalogue.
- The camera: `SkyCamera`, `ScreenSpot`, `CameraAxes`, `cameraAxes`, `projectDirection`, `directionAt`, `viewScale`, `degreesPerPixel`, `clampView`, `openingHeading`, `PITCH_MIN`, `PITCH_MAX`, `FOV_MIN` and `FOV_MAX`.
- The colours of the sky and ground: `skyColours(sunAltitude)` and `paintBackground`.
- The words: `mySkyWords(language)` (`MySkyWords`, `MySkyLanguage`), `say`, `compassPoint` and `COMPASS` (`CompassPoint`).

## Opening it from a button

A page that has a place (from the reader's location, or a choice) puts the element in a dialog or a full-screen panel and gives it the numbers:

```html
<dialog id="sky"><hoshi-my-sky id="my-sky" style="width: min(96vw, 900px); height: 85vh"></hoshi-my-sky></dialog>
<button id="see">See my sky</button>
<script type="module">
  import "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/my-sky/define/+esm";
  document.getElementById("see").addEventListener("click", () => {
    const sky = document.getElementById("my-sky");
    sky.latitude = 49.28;
    sky.longitude = -123.12;
    document.getElementById("sky").showModal();
  });
</script>
```
