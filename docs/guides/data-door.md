---
title: Outside data, the data door
section: how-to
order: 41
description: How to hand the package your own stars or deep-sky objects as a source with its own licence and credit, how to switch one off, and how a page shows whose data is on the screen. Non-commercial and share-alike sources are allowed from a caller, with the licence printed beside the credit.
---

[日本語](ja/data-door.md)

The package draws, and you bring the data. `@johnmorrisdotca/hoshi-stars/door` is the one way to hand it more stars or more deep-sky objects, and the same door shows whose data is on the screen. With no source the package draws what it always drew, from its own data: the Yale Bright Star Catalogue, UCAC4 and the deep-sky list from Wikidata (`OWN_SOURCES`, written from `NOTICE.md`). The package bundles only data that is clear to pass on; a source of yours may be non-commercial or share-alike, and the credit line prints that beside the licence.

The shapes (`SourceInfo`, `Licence`, `RecordSource`, `TileSource`, `Credit`, `MapPlace`, `ImageTile`) and four small functions (`validateSource`, `creditLine`, `loadRecords`, `createTileStore`) are the family's data door, one file copied unchanged into each package (`src/data-door.ts`, from kazoku-ui's `templates/data-door.ts`). The door re-exports them, so one import is enough.

## A source of stars

A source is an object with a `kind`, an `info` and its functions. `info` says who it is: an `id` (lower-case letters, digits and hyphens, unique in the view), a `name` and a `credit` in English and Japanese (never empty), the `licence` (a name and a link, with `nonCommercial` or `shareAlike` where it is so), the source's page and the day it was retrieved. A star source is made of tiles: `need(field, magnitude)` names the tile keys for a round patch of sky, `load(key, signal)` fetches one as a `FaintTile` (parallel arrays of right ascension, declination, magnitude and B-V), and `bytes(tile)` says what it holds, for the budget.

```js
import { creditLine, starSky } from "@johnmorrisdotca/hoshi-stars/door";

// A source of your own: here two stars in one tile, held in memory. A real one would fetch its tiles from a server, and says whose they are and under what licence.
const mine = {
  kind: "tiles",
  info: {
    id: "my-stars",
    name: { en: "My stars", ja: "私の星" },
    credit: { en: "My stars, A. Person (2026)", ja: "私の星（A. Person、2026年）" },
    licence: { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", nonCommercial: true },
    url: "https://example.org/my-stars",
    retrieved: "2026-11-10",
  },
  need: () => ["tile-0"],
  load: async () => {
    const column = (values) => Float64Array.from(values);
    return { id: { level: 0, band: 0, column: 0 }, count: 2, rightAscension: column([83.8, 83.9]), declination: column([-5.4, -5.3]), magnitude: column([9.1, 10.4]), colourIndex: column([0.6, NaN]) };
  },
  bytes: (tile) => tile.count * 32,
};

const sky = starSky({ sources: [mine] });
const orion = { rightAscension: 83.8, declination: -5.4, radius: 1 };
await sky.load(orion, 12);
const { stars } = sky.stars(orion, 12);
console.log(`${stars.length} stars, the brightest of magnitude ${stars[0].magnitude}`);
console.log(creditLine(sky.credits(), "en"));
console.log(creditLine(sky.credits(), "ja"));

sky.enable("my-stars", false);
console.log(`${sky.stars(orion, 12).stars.length} stars with the source off`);
```

`starSky` checks every source with `validateSource` when it is added, so an empty credit, no licence, a clashing id or a missing function is a `TypeError` at once. `load(field, magnitude)` fetches the tiles of the patch from every source, six at a time for each, under one budget (`TILE_BUDGET_BYTES`, 48 MB for all of them, `budgetBytes` to change it, `maxTiles` to cap the count). The six is `MAX_IN_FLIGHT`. `stars(field, magnitude, max)` answers from the tiles that are here and sends nothing, so at rest the door is silent; a failed tile is tried again by the next `load`. A tile that fails, is not a faint tile or holds a star whose position or magnitude is not a finite number is counted in `stats()` and never drawn.

## Whose data is on the screen

`credits()` lists the sources that gave at least one star to the last `stars` call, the package's own first, and `creditLine(credits, "en" | "ja")` writes them as a line with the licence beside each: "Faint stars: UCAC4 … (UCAC4 terms of use); My stars, A. Person (2026) (CC BY-NC 4.0; non-commercial)." The package's own bright stars are drawn from the main entry, so a page puts `ownCredit("yale-bsc", count)` first. `onCredits` fires when the set of sources changes, not at each draw. The demo's whole-sky page shows this line under the map.

## Off

`addSource` returns a `remove()`; `removeSource(id)`, `enable(id, false)` and `ownOnly(true)` do the same for a layers panel or for "the package's data only". Off aborts that source's loads (their `AbortSignal`), frees its tiles and drops its credit, and the picture is the first one again.

## Deep-sky objects and pictures

A source of objects is a list that fits in memory, at most 200,000 records (`MAX_RECORDS`), read once. `withObjects(sources, { own })` adds them to the objects a page already draws (`own`, for example `messier()`), and leaves out and counts a record with a position that is not on the sky, a number that is not finite, an unknown kind or an id already taken; a source that throws or holds too many is reported in `failed` and adds nothing. `SkyPictureSource` is the shape of a sky picture in tiles (a place in right ascension and declination, a detail in pixels across the circle, an `ImageTile`); the package draws none yet, and a source of that shape already works with `createTileStore`.

```ts no-check
import { messier } from "@johnmorrisdotca/hoshi-stars/deep-sky";
import { creditLine, withObjects, type ObjectSource } from "@johnmorrisdotca/hoshi-stars/door";

declare const mine: ObjectSource; // records of your own, with an info as above

const read = await withObjects([mine], { own: messier() });
console.log(read.objects.length, read.skipped, creditLine(read.credits, "en"));
```

## What stays as it was

`faintSky` is `starSky` with the package's own `ucac4Source` and nothing else, so every option and answer is as it was (its `fetch` now also receives `{ signal }`). `FaintTile` gains the optional columns `parallaxMas`, `properMotionRa` and `properMotionDec` (milliarcseconds and milliarcseconds a year, `NaN` for none): types only, nothing reads them yet.
