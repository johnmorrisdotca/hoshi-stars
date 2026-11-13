---
title: What you can see tonight
section: how-to
order: 14
description: "The stars you can see from a place at a moment, with the Sun, the sky's darkness and the air taken into account: visibleStars, the twilight, the airmass and how easy each star is."
---

[日本語](ja/tonight.md)

`@johnmorrisdotca/hoshi-stars/tonight` answers "what can I see from here, now". It builds on `horizontal` (the altitude and azimuth of [your sky](sky-charts.md)) and adds the three things that decide whether you see a star: the Sun, the sky's own brightness and the air. It is pure (no DOM, and no clock: you pass the moment in) and its own import, so a page that does not use it does not pay for it. The [Tonight page of the demo](https://johnmorrisdotca.github.io/hoshi-stars/tonight.html) is this call with a place picker.

```js
import { visibleStars } from "@johnmorrisdotca/hoshi-stars/tonight";

const vancouver = { latitude: 49.28, longitude: -123.12 };
const night = visibleStars({ observer: vancouver, when: new Date("2026-11-08T10:00:00Z"), sky: { limit: "suburb" } });
console.log(`${night.twilight}, limit ${night.limitingMagnitude}: ${night.stars.length} stars, the brightest ${night.stars[0].star.name}`);

const noon = visibleStars({ observer: vancouver, when: new Date("2026-11-08T20:00:00Z") });
console.log(`${noon.twilight}: ${noon.stars.length} stars`);

const polaris = night.stars.find((one) => one.star.name === "Polaris");
console.log(`Polaris ${polaris.altitude.toFixed(0)} degrees up, ${polaris.ease}`);
```

The output is:

```text
night, limit 5: 543 stars, the brightest Sirius
day: 0 stars
Polaris 50 degrees up, easy
```

## What the call decides

A star is in the list when all of these hold:

1. **It is above the horizon** (`sky.minAltitude`, default 0 degrees).
2. **The sky is dark enough.** The Sun's altitude gives the twilight: `day`, `civil` (down to -6 degrees), `nautical` (-12), `astronomical` (-18) and `night`. The faintest magnitude seen in each is a rough line of our own (about -5 in the day, 1.5 at the end of civil twilight, 4.5 at the end of nautical, the site's own limit by about -15), not a measurement.
3. **The site's limit.** `sky.limit` is `"city"` (4), `"suburb"` (5), `"rural"` (6, the default), `"dark"` (6.5) or a number: the faintest star seen at the zenith (round figures of our own, near the limits of the Bortle dark-sky scale's classes 8 to 9, 6 to 7, 4 to 5 and 2 to 3). `sky.moonPenalty` lowers it by the magnitudes you pass in for the Moon's glare.
4. **The air.** The airmass is Kasten and Young's (1989): 1 at the zenith, 2 at 30 degrees, about 38 at the horizon. A star loses `0.2 x (airmass - 1)` magnitudes (`sky.extinction`, 0.2 for a clear low site, 0.3 to 0.4 in haze; the zenith's own airmass is already in the site's limit). So a star 3 degrees up is about 3 magnitudes fainter than it is overhead.

Each star in `stars` (brightest first) has its `altitude`, `azimuth` (from north through east), `airmass`, `apparentMagnitude` and an `ease`: `"easy"` (a magnitude or more brighter than the limit), `"needs dark adaptation"` (within a magnitude of it: twenty minutes without a light) or, with `sky.all: true`, `"not tonight"`.

The pieces are exported too: `sunPosition(when)`, `sunAltitude(observer, when)`, `twilightOf(altitude)`, `airmass(altitude)` and `SKY_LIMITS`. The Sun is the Almanac's low-precision formula, good to 0.01 degree from 1950 to 2050.

## Known cases

Polaris is up every night from the northern middle latitudes and never from the far south (from the equator it sits on the horizon, where the air takes it). Sirius is never up north of latitude 73, and it is not in the list in daylight at any latitude. Both are in the package's tests.

## Limits

The limit is an approximation, good for "will I see Orion", not for the faintest star at the threshold. The Moon is not worked out: pass `moonPenalty`. The catalogue stops at magnitude 6.0, so a dark site sees no more than the list holds (the [faint stars](faint-stars.md) go deeper). A planet is not in the list.
