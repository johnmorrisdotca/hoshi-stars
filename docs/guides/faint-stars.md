---
title: Faint stars
section: how-to
order: 8
description: About 2.5 million more stars, to magnitude 12, from UCAC4, in sky tiles that a page loads for the part of the sky it shows. Zooming into the map draws them. Only the rows UCAC4 measured itself: nothing copied from Hipparcos or Tycho.
---

[日本語](ja/faint-stars.md)

The bright stars stop at magnitude 6.0. `@johnmorrisdotca/hoshi-stars/faint` adds **2,462,539** more, to magnitude 12, from UCAC4, the fourth U.S. Naval Observatory CCD Astrograph Catalog. They are not code and not one big table: they are small files, the sky cut into tiles, and a page loads only the tiles of the patch of sky it shows. The main import does not change in size, and a page that never imports `/faint` pays nothing.

## What the numbers are

- **Position**: UCAC4's J2000.0 position on the ICRS, good to a fraction of an arc-second. No proper motion is stored.
- **Magnitude**: the limit of 12 is set by **APASS V** where UCAC4 carries an APASS V of its own for the star, and else by **UCAC4's own fit model magnitude**, which is measured between V and R (579 to 642 nm) and is not V. Both are stored to 0.05. In the 4,709,853 rows that were not dropped as copies, 4,308,852 had an APASS V and 401,001 had only the model magnitude.
- **Colour**: APASS B-V, to 0.0125, for 2,240,397 of the stars; 222,142 (9 in 100) have none, and a star with none draws pale.
- **Nothing from Hipparcos, Tycho or Gaia.** ESA distributes those under a non-commercial licence, which an MIT package cannot pass on. UCAC4 copies some of their values in, so the build drops every row UCAC4 flags as such: object type 6 (position substituted from FK6, Hipparcos or Tycho-2; 34,472 rows), type 7 (a supplement star taken from them with no CCD data; 4,215 rows) and type 4 (external high-proper-motion data, source not named; 4,932 rows). Where the V or B in a record is Tycho's (the source flag is set and the APASS error is 0), it is not used: 72,164 stars take the model magnitude instead. The same build drops 45 stars that are already among the 5,080 bright stars.
- **Kept on purpose**: 2,027,855 of the stars carry a Tycho-2 *cross-reference* in UCAC4 (the source flag is set because UCAC4 matched the star to Tycho-2) while their position and magnitude are UCAC4's own measurement. They stay. [Data and licences](data-and-licences.md) and `NOTICE.md` give the sentences relied on.

## How many, and where it is thin

By magnitude (a star is counted in the half magnitude it is in: `8.0` holds 8.0 up to but not including 8.5; `12.0` holds the stars of exactly 12.0):

| Magnitude | Stars | Magnitude | Stars |
|---|---:|---|---:|
| 6.0 to 6.5 | 36 | 9.5 to 10 | 161,934 |
| 6.5 to 7 | 63 | 10 to 10.5 | 239,640 |
| 7 to 7.5 | 238 | 10.5 to 11 | 358,936 |
| 7.5 to 8 | 2,837 | 11 to 11.5 | 562,027 |
| 8 to 8.5 | 9,559 | 11.5 to 12 | 882,821 |
| 8.5 to 9 | 36,078 | exactly 12.0 | 113,803 |
| 9 to 9.5 | 94,559 | | |

**Brighter than about magnitude 9 this layer is thin, and between 6 and 8 it is nearly empty** (3,138 stars between 6.5 and 8). The stars UCAC4 only copied from Hipparcos and Tycho are the bright ones, and they are the rows that were dropped. The map says how deep it is complete (`stars to magnitude 9.5 here`), and the figure comes from the layer's own counts; a fuller 6.5 to 8 band needs another source and is not in this package yet.

## The tiles

A tile is a rectangle of the sky: a band of declination, cut into tiles along right ascension. There are three levels, so that a wide view loads few and coarse tiles and a deep view loads finer ones:

| Level | Holds | Bands | Tiles | Stars |
|---|---|---:|---:|---:|
| 0 | to magnitude 10 | 18 (10° high) | 442 | 326,134 |
| 1 | from 10 to 11 | 30 (6° high) | 1,192 | 624,249 |
| 2 | from 11 to 12 | 36 (5° high) | 1,704 | 1,512,156 |

A file is 6 bytes a star (the largest tile is under 30 kB), 14.8 MB in all, about 12.6 MB gzipped. `FAINT_LEVELS` and `faintGrid(level)` give the grid, `faintTileBounds(tile)` the sky a tile covers and `faintTilePath(tile)` its file (`L2/17-16.bin`). `faintTilesFor(field, limit)` names the tiles a round patch of sky needs for stars to a magnitude, brightest level first; a limit of 9 needs only level 0.

```js
import { faintTilePath, faintTilesFor } from "@johnmorrisdotca/hoshi-stars/faint";

const orion = { rightAscension: 83.8, declination: -5.4, radius: 1 };
console.log(faintTilesFor(orion, 12).map(faintTilePath).join(" ")); // L0/8-8.bin L1/13-13.bin L1/14-13.bin L1/14-14.bin L2/16-16.bin L2/17-16.bin
console.log(faintTilesFor(orion, 9).map(faintTilePath).join(" "));  // L0/8-8.bin
```

## Where the tiles are

The tiles are **not in the npm package** (12.6 MB would be ten times the package). They are in the repository's `faint-tiles/` folder and on the demo's GitHub Pages site, every release's Pages build carrying that release's tiles. `FAINT_TILES_URL`, `https://johnmorrisdotca.github.io/hoshi-stars/faint-tiles/`, is where `faintSky` looks by default; give it a `baseUrl` to read them from a copy of your own (a folder of static files; [Serve it yourself](serve-it-yourself.md)) or from jsDelivr, which serves any file of the repository.

## Using them

`faintSky(options)` is a small loader: it fetches the tiles a patch needs with the `fetch` you give it (the global one by default), decodes them, and keeps the newest 256. `load(field, limit)` fetches what is missing and `stars(field, limit, max)` answers from what is here. `max` keeps the brightest `max` stars and `depth` then says the magnitude the list is complete to; `loaded` says whether every tile the patch needs is here.

```js
import { readFile } from "node:fs/promises";
import { faintSky } from "@johnmorrisdotca/hoshi-stars/faint";

// In a page, `faintSky()` fetches from FAINT_TILES_URL. Here the tiles are read from a folder, so that the example runs offline.
const sky = faintSky({
  baseUrl: "faint-tiles/",
  fetch: async (path) => {
    const bytes = await readFile(path);
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  },
});
const orion = { rightAscension: 83.8, declination: -5.4, radius: 1 };
await sky.load(orion, 12);
const all = sky.stars(orion, 12);
const capped = sky.stars(orion, 12, 100);
console.log(all.loaded, all.stars.length, all.depth); // true 183 12
console.log(capped.stars.length, capped.depth);       // 100 10.9
console.log(all.stars[0].magnitude, all.stars[0].colourIndex);          // 7.15 -0.125
```

In a browser the same, with no `fetch` to give:

```js no-run
import { faintSky } from "@johnmorrisdotca/hoshi-stars/faint";

const sky = faintSky();
await sky.load({ rightAscension: 299, declination: 40, radius: 2 }, 12);
```

`faintSky`'s pieces are on their own for a page with its own way to fetch: `decodeFaintTile(tile, bytes)` turns a tile file into a `FaintTile` (parallel arrays: `rightAscension`, `declination`, `magnitude`, `colourIndex`, `NaN` where there is none, sorted by declination), and `faintStarsIn(tiles, field, limit, max)` picks the stars in a patch from tiles you hold. A star is a `FaintStar`: `rightAscension`, `declination`, `magnitude` and `colourIndex` (`undefined` where there is none). The loader's options are `FaintSkyOptions` (`baseUrl`, `fetch`, `maxTiles`) and what it returns is a `FaintSky`. A tile file is six planes of one byte a star, which `decodeFaintTile` documents. The core is pure: no clock, no DOM; `faintSky` is the only part that does I/O, through the `fetch` you hand it. `FAINT_LIMIT` is 12.

## On the demo's map

The demo's map has a **Faint stars** layer, on by default and kept in the address like the others (`layers=milky,lines,names,grid` leaves it off). It starts where a telescope would show more than magnitude 7: the depth is the Faintest star slider plus 2.5 magnitudes for each tenfold zoom, up to 12. Because UCAC4 holds so few stars between 6.5 and 8, once the map is zoomed in about three times the depth jumps to magnitude 8.5 and deepens from there at the same rate, reaching 12 at about 100 times. A line under the controls says `Stars to magnitude 9.5 here` and how many faint stars are drawn. The stars are a few paths, never a node for each, and a view draws at most 6,000, the brightest first, so the depth reads shallower when it is cut. Nothing is drawn or fetched at rest.
