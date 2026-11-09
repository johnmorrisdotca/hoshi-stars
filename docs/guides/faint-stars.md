---
title: Faint stars
section: how-to
order: 8
description: About 2.5 million more stars, to magnitude 12, from UCAC4, in sky tiles that a page loads for the part of the sky it shows. Zooming into the map, or into the whole-sky page, draws them. Only the rows UCAC4 measured itself: nothing copied from Hipparcos or Tycho. The ghosts beside bright stars are left out, and the magnitudes of the bright end are APASS DR10's.
---

[日本語](ja/faint-stars.md)

The bright stars stop at magnitude 6.0. `@johnmorrisdotca/hoshi-stars/faint` adds **2,461,864** more, to magnitude 12, from UCAC4, the fourth U.S. Naval Observatory CCD Astrograph Catalog. They are not code and not one big table: they are small files, the sky cut into tiles, and a page loads only the tiles of the patch of sky it shows. The main import does not change in size, and a page that never imports `/faint` pays nothing.

## What the numbers are

- **Position**: UCAC4's J2000.0 position on the ICRS, good to a fraction of an arc-second. No proper motion is stored.
- **Magnitude**: the limit of 12 is set by **APASS V** where UCAC4 carries an APASS V of its own for the star, and else by **UCAC4's own fit model magnitude**, which is measured between V and R (579 to 642 nm) and is not V. Both are stored to 0.05. In the 4,709,853 rows that were not dropped as copies, 4,308,852 had an APASS V and 401,001 had only the model magnitude. **For 227,998 stars the V is APASS DR10's instead**, because UCAC4's own V of a bright star runs too faint ([The bright end's magnitudes](#the-bright-ends-magnitudes)).
- **Colour**: APASS B-V, to 0.0125, for 2,250,647 of the stars (155,858 of them APASS DR10's, with its V); 211,217 (9 in 100) have none, and a star with none draws pale.
- **Nothing from Hipparcos, Tycho or Gaia.** ESA distributes those under a non-commercial licence, which an MIT package cannot pass on. UCAC4 copies some of their values in, so the build drops every row UCAC4 flags as such: object type 6 (position substituted from FK6, Hipparcos or Tycho-2; 34,472 rows), type 7 (a supplement star taken from them with no CCD data; 4,215 rows) and type 4 (external high-proper-motion data, source not named; 4,932 rows). Where the V or B in a record is Tycho's (the source flag is set and the APASS error is 0), it is not used: 72,164 stars take the model magnitude instead. The same build drops 45 stars that are already among the 5,080 bright stars, and 675 ghosts that lie in the halos of bright ones ([Ghosts beside bright stars](#ghosts-beside-bright-stars)).
- **Kept on purpose**: 2,027,855 of the 2,462,539 stars that were kept before the ghosts were dropped carry a Tycho-2 *cross-reference* in UCAC4 (the source flag is set because UCAC4 matched the star to Tycho-2) while their position and magnitude are UCAC4's own measurement. They stay. [Data and licences](data-and-licences.md) and `NOTICE.md` give the sentences relied on.

## How many, and where it is thin

By magnitude (a star is counted in the half magnitude it is in: `8.0` holds 8.0 up to but not including 8.5; `12.0` holds the stars of exactly 12.0):

| Magnitude | Stars | Magnitude | Stars |
|---|---:|---|---:|
| 6.0 to 6.5 | 7 | 9.5 to 10 | 133,018 |
| 6.5 to 7 | 22 | 10 to 10.5 | 243,186 |
| 7 to 7.5 | 466 | 10.5 to 11 | 358,575 |
| 7.5 to 8 | 7,350 | 11 to 11.5 | 561,902 |
| 8 to 8.5 | 21,686 | 11.5 to 12 | 882,721 |
| 8.5 to 9 | 48,734 | exactly 12.0 | 113,789 |
| 9 to 9.5 | 90,408 | | |

**Between 6 and 8.5 this layer is still thin** (7,838 stars between 6.5 and 8, where the sky holds about 33,600; 77,770 between 7.5 and 9, where it holds about 99,000). The stars UCAC4 only copied from Hipparcos and Tycho are the bright ones, and they are the rows that were dropped. Before the repairs below it held 3,138 between 6.5 and 8 and 48,474 between 7.5 and 9: a star of true magnitude 8 sat in this layer at 9, so the band looked thinner than it is. The map says how deep it is complete (`stars to magnitude 9.5 here`), and the figure comes from the layer's own counts.

**A fill for the band is built and kept on file, and not in the tiles yet.** Two sources were built and compared (`docs/research/gap-6.5-8.md` in the repository): the SAO Star Catalog (30,459 more stars between 6.0 and 9.0, 22,012 of them between 6.5 and 8, over the whole sky; its terms wait on NASA HEASARC's answer) and APASS with 2MASS positions (16,602, clean terms, but APASS has no bright stars north of declination +20 degrees). `NOTICE.md` has the licence sentences. `python3 scripts/make-faint-data.py build --gap sao` merges SAO into level 0 once its terms are confirmed (a gap star within 5 arc-seconds and 2 magnitudes of a star of the layer is dropped by the merge).

## Ghosts beside bright stars

UCAC4 holds detections in the halo of a bright star that are not stars: 516 of the 5,080 bright stars had a faint star within 20 arc-seconds of them, and 595 had at least one ghost within the reach of their halo. The rule that leaves them out:

- **Where.** A star lies in the halo of a bright star of visual magnitude V if it is within 30 arc-seconds x 10^(0.2 x (5.5 - V)) of it, and at most 120 arc-seconds: 24 arc-seconds round a star of magnitude 6, 60 round one of magnitude 4, 95 round one of magnitude 3 and 120 round every brighter than 2.5. The numbers come from counting faint stars in rings round the 5,080: within 10 arc-seconds the density was 30 to 40 times the field's, and the 2MASS test shows where the ghosts stop: round the bright stars of magnitude 5 to 6, about 1 star in 4 is confirmed at 15 to 20 arc-seconds, 1 in 2 at 20 to 30, 4 in 5 at 30 to 45 and 9 in 10 far away.
- **Dropped unless confirmed.** A star in a halo is dropped unless a **2MASS** point source (the Two Micron All Sky Survey's catalogue, a US government work: a second, independent catalogue, which UCAC4's own APASS V is not) lies within 2 arc-seconds, is not flagged as persistence, a diffraction spike, a stripe or a halo, and has a J that is not absurd against the star's V (V - J from -1 to 4.5). A star within 5 arc-seconds of a bright star whose only 2MASS source is the bright star itself (no fainter in J than its V plus 1) is the bright star seen again with a wrong magnitude, and is dropped too. A real companion that 2MASS sees stays.
- **The counts.** 857 stars lay in a halo: 182 are confirmed and kept, 675 are dropped (560 of them UCAC4 object type 5, 52 type 8, 37 type 1, 18 type 0, 8 type 3). 595 of the bright stars lost at least one; 21 now have a faint star within 20 arc-seconds, from 516. Counted in rings again, the density within 10 arc-seconds is 3 times the field's or less, from 30 to 40 times.
- **Object type 1 is not used.** UCAC4 marks "near an overexposed star" as type 1, and 82,604 of the kept stars (3.4 in 100) carry it. They are not ghosts: of 4,000 of them chosen at random 3,873 are confirmed by the same 2MASS test, as 3,835 of 4,000 ordinary stars are. The flag is set for any star near *any* overexposed star, and dropping it would drop real stars.
- **What is not covered.** Only the halos of the 5,080 bright stars are looked at. The halos of fainter overexposed stars (magnitude 6 to 8, which this layer does not hold as bright stars) and UCAC4's object types 5, 8 and 9 elsewhere are not (a ticket is open: samples of them are confirmed by 2MASS far less often than ordinary stars).

`python3 -I scripts/make-faint-data.py build --ghosts off` builds without the rule.

## The bright end's magnitudes

The layer's magnitude of a UCAC4 star is APASS DR6's V (as UCAC4 carries it) or UCAC4's own model magnitude. APASS saturates near V 7 to 10 and the model magnitude has no bright calibration, so the stars read faint: against APASS DR10 and the SAO Star Catalog, which agree with each other, a star that is really 7.5 to 8 sat in this layer 0.95 magnitudes too faint at the median. **Where APASS DR10 holds the star, its V is now the tile's**, and so is its B-V where the errors of both are under 0.1.

- **Which stars.** An APASS DR10 star of V from 7.0 (AAVSO's own page: "Anything brighter than V=7 is not usable") to 10.2, south of declination +20.0, with a V error of 0.3 or less, that lies within 5 arc-seconds of a star of the layer whose magnitude is no more than 0.5 brighter and no more than 2.5 fainter than APASS's. One APASS star to one UCAC4 star (the nearer). 250,380 APASS stars were read, 10,199 had a V error over 0.3, 12,013 had no star of the layer near them (they are the stars UCAC4 only copied, which are dropped), 170 shared a star with a nearer APASS star and **227,998 stars took DR10's V**, 155,858 of them its colour as well.
- **How much it changed them.** The median of UCAC4's V minus APASS DR10's, by DR10's V: +1.20 at 7.0 to 7.5 (404 stars), +0.95 at 7.5 to 8 (6,383), +0.70 at 8 to 8.5 (17,059), +0.40 at 8.5 to 9 (28,597), +0.20 at 9 to 9.5 (45,976), +0.05 at 9.5 to 10 (64,774) and 0.00 at 10 to 10.2 (64,805). 64,528 stars are 0.25 magnitude or more brighter than UCAC4 gave them, 32,810 are 0.5 or more and 6,397 are a magnitude or more; 2,916 are 0.25 or more fainter (the two APASS releases differ near saturation).
- **Where APASS stops.** APASS DR10 has its bright stars (V 7.0 to 9.2) at 2.7 to 3.3 a square degree from declination +19 to +20.5, 1.6 between +20.5 and +20.6, and 0.3 to 0.5 from +20.6 on; **north of about +20.5 it holds a tenth of what is there, and no star north of +20.0 is corrected**: a third of the sky (33 in 100). About 100,000 stars of 8.5 to 10 in that third read about 0.4 magnitudes too faint at 8.5 to 9.5 against the SAO Star Catalog, and so, very likely, do about 36,000 stars of the south that APASS does not hold. The tile format has no room for a mark on each star, so `faint-tiles/index.json` says per tile how many stars took APASS's V (`apassV.tiles`, with the totals and the median change by band).
- **No offset for the rest.** A blanket correction by magnitude (the median change of the matched stars, 0.1 at UCAC4's 8.0 and 8.25, 0.35 to 0.45 at 8.75 and 9.0, 0.15 at 9.5) would leave the median within 0.15 magnitudes of SAO's at 8.0 to 9.5 in every zone of the sky (south of +20, +20 to +60, north of +60), but each star's own error is spread over about 0.9 magnitudes (16th to 84th percentile at UCAC4's 8.75: +0.05 to +0.95), and it would pile stars up: 39,572 in the quarter magnitude 8.5 to 8.75, where the sky holds about 22,300. It is not applied. `docs/research/gap-6.5-8.md` has the figures.
- **A hook for SAO.** `python3 -I scripts/make-faint-data.py build --correct apass,sao` also takes SAO's V for the stars that UCAC4 gives as 9.5 or brighter and APASS did not correct (67,713 stars). It waits for NASA HEASARC to confirm SAO's terms (`NOTICE.md`), and a test fails if SAO's magnitudes are in the tiles before then.

By quarter magnitude, before and after the two repairs, against what the sky holds (a model from the Bright Star Catalogue and the star counts of the Durchmusterungs, good to about 15 in 100):

| From | Before | After | The sky holds about |
|---|---:|---:|---:|
| 7.00 | 32 | 62 | 4,400 |
| 7.25 | 206 | 404 | 5,800 |
| 7.50 | 920 | 2,179 | 7,600 |
| 7.75 | 1,917 | 5,171 | 9,900 |
| 8.00 | 3,715 | 9,038 | 13,000 |
| 8.25 | 5,844 | 12,648 | 17,000 |
| 8.50 | 11,863 | 19,164 | 22,300 |
| 8.75 | 24,215 | 29,570 | 29,200 |
| 9.00 | 39,282 | 39,684 | 38,300 |
| 9.25 | 55,277 | 50,724 | 50,200 |

`python3 -I scripts/make-faint-data.py build --correct none` builds without the correction; `--correct none --ghosts off` reproduces the tiles of version 0.18.1 byte for byte.

## The tiles

A tile is a rectangle of the sky: a band of declination, cut into tiles along right ascension. There are three levels, so that a wide view loads few and coarse tiles and a deep view loads finer ones:

| Level | Holds | Bands | Tiles | Stars |
|---|---|---:|---:|---:|
| 0 | to magnitude 10 | 18 (10° high) | 442 | 321,122 |
| 1 | from 10 to 11 | 30 (6° high) | 1,192 | 628,815 |
| 2 | from 11 to 12 | 36 (5° high) | 1,704 | 1,511,927 |

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
console.log(all.loaded, all.stars.length, all.depth); // true 182 12
console.log(capped.stars.length, capped.depth);       // 99 10.9
console.log(all.stars[0].magnitude, all.stars[0].colourIndex);          // 7.3 -0.125
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

## On the whole-sky page

`whole-sky.html` has the same **Faint stars** layer, on by default and kept in the address the same way (`layers=milky,boundaries,lines,names` leaves it off). It follows the same depth rule and the same 6,000-dot cap, from the same code (`demo/faint-layer.ts` for the rule and the dots, `demo/faint.ts` for the tiles), so a patch of sky of the same width in degrees is as deep on either page: the whole-sky map's zoom is turned into the sky map's zoom that gives the same pixels to the degree (the map at its fit is 1.27 times the sky map at its fit), and the slider's place is taken by 6, the limit of the bright stars the page always draws. The layer starts past magnitude 7, at about 2 times, but a field that wide would take more tiles than a page asks for at once (48), so the first stars come in at about 6 times, where the depth jumps past the thin band to 8.5; at the closest zoom (24 times) the map is about magnitude 10 deep, and only the first level of tiles is ever asked for. A line under the map says how deep it is here, `Stars to magnitude 9.7 here (1,204 faint ones drawn)`, or, zoomed out, how far to zoom in.

The map is an oval (Mollweide or Hammer) or a rectangle in the galactic or the equatorial frame, so the part of the sky on the screen is not round. The page finds the round patch the tiles are asked for (`faintTilesFor`) from where the screen's edges, a grid over the screen and the oval's rim land on the sky, takes a small circle that holds them, and adds a margin, so that a pan by a little finds its tiles already here. The same holds across the seam of the map and at the poles of the map and of the sky: a test places 5,000 stars and 400 random points of the screen for each view, in each of the six pairs of projection and frame, at 4, 8 and 24 times, aimed at the middle, the poles, the seam and the corners of the oval, and every one that is on the screen is inside the patch. The dots are drawn on their own layer of pixels over the map, a little smaller than the faintest bright star there, in the same few paths, never a node for each star. Nothing is drawn or fetched at rest; each tile is fetched once and kept. The printed map does not carry them.
