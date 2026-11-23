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
| `distance-min`, `distance-max`, `magnitude-limit` | Keep only the stars at least, at most and no fainter than these: light-years from the Earth and an apparent magnitude. A star with no known distance is hidden while a distance is set; the constellation lines stay. See the sky chart guide, "Filter by distance and brightness". |
| `filter-bar` | Shows the distance and brightness bars over the sky (folded on a narrow box; `filter-bar="open"` keeps them open). A bar writes the three attributes and sends `hoshi-filter`. |
| `daylight="show"` | Draw the stars even when the Sun is up. |
| `target` | Turn to something and ring it: see [See it in my sky](#see-it-in-my-sky). |

The properties are `latitude`, `longitude`, `time` (a `Date`, or `null` for live), `heading`, `pitch`, `fov`, `setView({ heading, pitch, fov })`, `target` and `marks` (the next section) and the read-only `sky` (`MySkyReport`: the same report as `skyReport` below, with the `target`). The element sends `hoshi-sky-view` (`MySkyViewDetail`: `heading`, `pitch`, `fov`, `final`) as the view turns, and `hoshi-sky-pick` (`MySkyPick`: `kind` `sun`, `moon`, `planet`, `figure` or `none`, and `id`) when a tap lands on something. The class is `HoshiMySkyElement`, its tag `MY_SKY_TAG` (`hoshi-my-sky`) and `defineMySky()` defines it; `@johnmorrisdotca/hoshi-stars/my-sky/define` does that when imported and `/my-sky/element` only exports the class.

A drag, two fingers (pinch), Ctrl and the wheel, the arrow keys (Shift for a bigger step), + and - and Home are the family's view controls, `@johnmorrisdotca/kazoku-ui`. The sky is drawn with the stereographic projection, which keeps shapes true to a view 130 degrees across, so the horizon is a curve. The Moon and the planets are drawn larger than their true size, as every picture of the sky draws them. Stars are hidden as the Sun rises (a star is seen only when it is brighter than a limit that falls from 6 in the dark to -3 in daylight) and dimmed by the air near the horizon.

## Fonts and parts

The canvas names of `<hoshi-my-sky>` (the stars, the constellations, the Moon and planets, the target and your marks) read the page's CSS custom properties, as the sky-labels names and the chart do: `--hoshi-label-font` (a font family list), and `--hoshi-label-size` and `--hoshi-label-weight` for the star and constellation names. The other canvas text, the compass letters, reads `--hoshi-sky-font`, and so do the filter bars. Left out, each is the package's own font (Hiragino Sans, Noto Sans JP, then the system's), unchanged. They are read at each draw, so a change shows at the next turn of the view or the next tick.

```css
hoshi-my-sky { --hoshi-label-font: "Georgia", serif; --hoshi-label-size: 13px; --hoshi-sky-font: system-ui; }
```

The Moon card and the filter bars can be styled with `::part()`: `panel`, `title` (the card's heading, 14px and 600 by default), `rows` (its lines) and `toggle` (the fold button: 32px high, 8px radius, a blue border) on `<hoshi-my-sky>`; `filters`, `filters-title`, `filters-toggle`, `filters-group`, `filters-legend`, `filters-label`, `filters-range`, `filters-count` and `filters-reset` on the filter bars of the three elements.

```css
hoshi-my-sky::part(title) { font-size: 16px; }
hoshi-my-sky::part(toggle) { border-radius: 999px; border-color: currentColor; }
hoshi-chart::part(filters) { background: #101a3a; }
```

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

## See it in my sky

A page that talks about a star, a planet or a constellation can open My sky turned to it: set `target` and the view glides to the thing (it jumps for a reader who prefers reduced motion), rings it with its name and says whether it is up.

```html
<hoshi-my-sky id="sky" latitude="49.28" longitude="-123.12" timezone="America/Vancouver" style="height: 80vh"></hoshi-my-sky>
<button id="mars">See Mars in my sky</button>
<script type="module">
  import "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/my-sky/define/+esm";
  const sky = document.getElementById("sky");
  document.getElementById("mars").addEventListener("click", () => {
    sky.target = "planet:mars";
  });
  sky.addEventListener("hoshi-sky-target", (event) => console.log(event.detail.label, event.detail.up, event.detail.reached));
</script>
```

`target` is an attribute and a property, and takes:

| Target | What it turns to |
|---|---|
| a star's id, such as `betelgeuse`, `hr-2061` or `alpha-orionis` | The star; the ids are those of `nameRows` in [the names index](names.md), and a Messier object such as `m31` works too. |
| `planet:mars` | One of the five bright planets: `mercury`, `venus`, `mars`, `jupiter`, `saturn`. |
| `moon`, `sun` | The Moon or the Sun. |
| `constellation:Ori` | A constellation, by its abbreviation or any name `constellation` takes (`constellation:Orion`, `constellation:オリオン座`). |
| `{ azimuth, altitude, label }` | A point of your own (the property only): degrees from north through east and above the horizon, and the words to write beside it. |

What it does when set:

- **The view turns to it.** A star, a planet, the Moon, the Sun or a point is centred (the field of view stays, narrowed to 90 degrees if it was wider). A constellation is framed whole: faced at the middle of its stars and wide enough for the farthest, between 20 and 130 degrees, and its lines are lit. The glide takes under a second, never more than one frame is asked for at a time, and when it has arrived nothing is drawn until something changes. A drag, the wheel or a key stops it where it is. Setting the same target again glides to it again, and `null` takes the ring away.
- **It is ringed with its name**, and a card says where it is: `Saturn: 40° above the horizon, south-east`, with when it sets. The ring stays on the object as the sky moves: a live sky works out its place again every ten seconds (a minute under reduced motion), and a rise or a set is not worked out again until it has passed.
- **If it is below the horizon**, the card says so and which way it lies (`Sirius is below the horizon: 25° down, toward the east`) with its next rise (`Rises 11:31 p.m.`), the view faces its direction with the horizon in sight, and a marker on the horizon says where it will come up. A star that never rises at the place says `never rises from here` and one that never sets says `is always above the horizon here`; a planet, the Moon or the Sun with no rise in the next day says so. A constellation counts as up when the middle of its stars is.
- **The page is told.** `hoshi-sky-target` (`MySkyTargetDetail`) is sent when the view has arrived with `reached` true, and with `reached` false if a hand or a new target stopped it first; it holds the target as set, its `kind`, its `label` in the language shown, its `altitude`, `azimuth` and `up`. `sky.target` (`MySkyTargetReport`, in `MySkyReport`) holds the same with the next `rise` and `set` (milliseconds since 1970, or `null`) and `always` and `never`, and is `null` while there is no target or the id names nothing (the card then says `Nothing called … was found`).
- **A target waits for its place.** Set before `latitude` and `longitude`, it turns when they arrive, and when the element has no size yet (in a closed dialog) the view jumps to it, so it is already there when the dialog opens.

A star's id is looked up in the names index the first time one is needed, so a page that only uses planets, the Moon, the Sun, constellations and points never loads it; a star by catalogue number (`hr-2061`) does not need it either.

### The page's own points

`marks` is a list of points a page draws on the sky itself: a satellite's place each second, a probe, a landmark. Each is `{ id, azimuth, altitude, label, kind? }` (`SkyMark`); a `satellite` is drawn as a diamond and anything else as a dot, with the label beside it, dimmed when it is below the horizon.

```html
<script type="module">
  const sky = document.getElementById("sky");
  sky.marks = [{ id: "iss", azimuth: 250, altitude: 42, label: "ISS", kind: "satellite" }];
  sky.addEventListener("hoshi-sky-mark", (event) => console.log(event.detail.id));
</script>
```

A press on a mark (a tap, or Enter on its button: each mark is a button in a list a screen reader and Tab can reach) sends `hoshi-sky-mark` (`MySkyMarkDetail`: `id`, `label`, `kind`, `azimuth`, `altitude`). Nothing is drawn at rest: the sky is drawn again only when the marks or the view change, so a page can set `marks` every second, and a list that is the same as the last one (mark for mark) draws nothing. An entry with no `id`, a number that is not finite or an `id` already in the list is dropped, and no more than 500 are kept (`cleanMarks`, `MARKS_MAX`, `sameMarks`).

### The maths

The same pure functions the element uses are in `@johnmorrisdotca/hoshi-stars/my-sky`, so a page can say where a thing is without the element:

```js
import { resolveStarId, resolveTarget, targetInSky, viewOfObject } from "@johnmorrisdotca/hoshi-stars/my-sky";

const vancouver = { latitude: 49.28, longitude: -123.12 };
const evening = new Date("2026-11-17T04:00:00Z");

const mars = targetInSky(resolveTarget("planet:mars").locator, vancouver, evening);
console.log(mars.up, Math.round(mars.altitude), new Date(mars.rise).toISOString().slice(0, 16)); // false -23 2026-11-17T07:09

const sirius = targetInSky((await resolveStarId("sirius")).locator, vancouver, evening);
console.log(sirius.up, Math.round(sirius.altitude), new Date(sirius.rise).toISOString().slice(0, 16)); // false -25 2026-11-17T06:31
console.log(viewOfObject(sirius.altitude, sirius.azimuth, 90).pitch); // 10
```

- `parseTarget(target)` (`ParsedTarget`, `SkyTarget`, `SkyPoint`) reads a target text or a point and says which kind it is; nothing is looked up. `resolveTarget(target)` works out what needs nothing loaded (a planet, the Moon, the Sun, a constellation, a point, a star by catalogue number) and gives `"later"` for an id that `resolveStarId(id)` looks up in the names index (`ResolvedTarget`: its `kind`, its `label` in English and Japanese, its `locator` and, for a constellation, its `figure`).
- `locate(locator, observer, when)` is where it stands (`altitude`, `azimuth`); `riseAndSet(locator, observer, when)` (`RiseAndSet`) is the next `rise` and `set` and whether it is `always` or `never` up; `targetInSky(locator, observer, when, times?)` (`TargetInSky`) is both, with `up`. A `SkyLocator` is a planet, the Moon, the Sun, a place among the stars (a star's or a constellation's middle) or a point. A star or a planet is followed for 26 hours in steps of six minutes and each crossing found to the second, at the altitude where the air bends its light up (-34 arc-minutes), the Sun at its upper edge (-50 arc-minutes), the Moon by `moonRiseSet`. A star that crosses nothing in a whole turn of the Earth is `always` or `never` up.
- `viewOfObject(altitude, azimuth, fov)` is the view that centres a thing (a thing more than 8 degrees under the horizon is faced at the horizon with the head tipped 10 degrees up); `viewOfGroup(directions)` frames a group of directions, 1.3 times their spread; `glideView(from, to, fraction)` is the view part of the way along a glide, the short way round and slow at both ends.
- The element's own types, from `@johnmorrisdotca/hoshi-stars/my-sky/element`: `MySkyTargetDetail` and `MySkyMarkDetail` (the events), `MySkyReport` and `MySkyTargetReport` (the `sky` property).

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
