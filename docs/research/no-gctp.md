# A build without the Yale parallax catalogue (MODULES-779)

Status: built and tried, **not switched on**. The package ships the Yale General Catalogue of Trigonometric Stellar Parallaxes (GCTP, VizieR I/238A) as before; this is the fallback for the day CDS says no. Written 2026-11-09.

The GCTP states no licence (NOTICE.md). It gives this package two things: the `/nearby` layer, and better parallaxes, with errors, for 2,329 of the 5,080 bright stars. The fallback leaves both out and does **not** look for another source: no Gaia, no Hipparcos, no Tycho, no other catalogue. Every parallax in it is the Bright Star Catalogue's own (HEASARC bsc5p, public domain with credit, already in NOTICE.md).

## How to use it

| | |
|---|---|
| Try it for one run | `HOSHI_NO_GCTP=1 pnpm build`, `HOSHI_NO_GCTP=1 pnpm site`, `HOSHI_NO_GCTP=1 pnpm test` (`=0` forces the Yale data) |
| Swap it in for good (**the one change**) | `scripts/data-source.mjs`: `DEFAULT_NO_GCTP = false` becomes `true`. The build, the demo, the tests and the data export all follow it. Nothing in `src/` knows. |
| Make the data again | `python3 -I scripts/make-star-data.py --no-gctp --from <bsc5p.tdat.gz>` then `node scripts/set-star-constellations.ts data-no-gctp/stars.ts`; `python3 -I scripts/make-nearby-data.py --no-gctp` (reads nothing). Raw files used today: `~/Projects/backups/hoshi-stars/2026-11-09-bsc-gctp-raw/` |
| Where it lives | `data-no-gctp/stars.ts` and `data-no-gctp/nearby.ts`, outside `src/`, so the npm package does not carry them until the flip |

How the swap reaches each tool: `scripts/build.mjs` (tsc, then the fallback tables over `dist/data/stars.js` and `nearby.js`); `scripts/site.ts` (an esbuild resolve plugin, and `__HOSHI_NO_GCTP__` so the demo can say what is missing); `scripts/data-source-hook.mjs` (a node resolve hook, for `pnpm test` and `pnpm export:data`).

**What ships today does not change.** `src/data/stars.ts` and `src/data/nearby.ts` are byte for byte what they were (regenerated from the raw files to check). The default `dist/` differs from `origin/main`'s in one line of `dist/nearby.js`: an empty table is read as no rows instead of one empty row (`src/nearby.ts`, needed so the fallback's empty nearby table does not make a NaN star). Nothing else in `dist/` changes.

**At the flip, also:** drop the Yale GCTP and 2MASS paragraphs from NOTICE.md and add the fallback's sentence; rewrite the pages that describe the nearby layer and Yale errors (`docs/guides/nearby.md`, `nearby-stars.md`, `star-profile.md`, `stars.md`, `colour-and-distance.md`, `data-files.md`, `sky-from-another-star.md`, each with its `ja/` twin, `docs/site.json`, `README.md`, the TSDoc of `src/stars.ts` and `src/nearby.ts`); update `scripts/check-package.ts` (it asserts Proxima Centauri); and decide what becomes of the `/nearby` and `/sky-from/nearby` exports (they still work and are empty; removing one is a major version, which needs John's yes). Twenty-four tests that pin Yale numbers carry `onlyWithGctp` (`test/gctp.ts`) and are skipped on the fallback; `test/no-gctp.test.ts` is the fallback's own suite and passes on either default.

## What is left, in numbers

| | Yale (ships today) | Fallback |
|---|---|---|
| Bright stars | 5,080 | 5,080, every other field identical (checked by digest) |
| Parallax from the Yale GCTP | 2,329 | 0 |
| Parallax from the Bright Star Catalogue (whole milliarcsecond) | 71 | 2,370 |
| Dynamical parallax (BSC, kept) | 163 | 163 |
| Stars with a distance | 2,563 | **2,533** (30 lose it) |
| Stars with a distance error range | 2,329 | **0** |
| Nearby-layer stars | 5,565 (5,069 with a distance) | **0** |

- **Bright stars that keep a distance: 2,299 of the 2,329 Yale ones** (2,299 + the 234 that already had a BSC or dynamical parallax = 2,533). 30 lose it, because the BSC gives them no parallax; Mimosa and Nunki are two of them.
- **Bright stars that lose their error range: all 2,329.** The Yale errors are a median 9.7 milliarcseconds.
- No bright star gains a distance. 62 distances move by more than a factor of two, 155 by more than half, 350 by more than a quarter, 984 by more than a tenth. Of the 364 stars whose Yale parallax is good (error under 20% of it), 175 move by more than 5%.
- **Can `/nearby` be offered from the BSC alone? No.** The nearby tier is by definition the GCTP stars the 5,080 bright stars do **not** hold, and the 5,080 are the whole BSC to magnitude 6, so from the BSC alone there is nothing to put in it. Its table is empty, gracefully: `nearbyStars()` is `[]`, `nearbyStarByName(...)` is `undefined`, `skyFromWithNearby` is `skyFrom` over the bright stars and throws the ordinary "is not a star this package knows" `RangeError` for a name like Proxima Centauri. What the BSC does hold, the nearer bright stars with distances, is already answered by `/nearest` by space: 47 bright stars within 30 light-years (48 on the Yale data) and 137 within 50 (129).

## What gets worse

The one that matters most is quiet. **Without an error, `starProfile` assumes half a milliarcsecond** (the BSC's rounding; `src/profile.ts`, as it already does for the 71 BSC stars). The Yale errors are about twenty times that. So ranges get *narrower and more confident*, not wider, and more stars look measurable. Measured over the 2,299 stars that keep a distance: the BSC and Yale parallaxes differ by a median 1.6 milliarcseconds, only 11% are within the half a milliarcsecond assumed, but 93.5% are within one Yale error and 96.5% within two. So the BSC parallaxes agree with the Yale ones inside the Yale errors, and the half-milliarcsecond range is the wrong size for them.

| Result | Yale | Fallback |
|---|---|---|
| `starDistance` | distance, error, range | distance only; `lightYearsError` and `lightYearsRange` are `undefined` (whole-milliarcsecond parallax: a far star's distance moves in big steps, 2 mas is 1,631 ly and 3 mas is 1,087 ly) |
| `starProfile` luminosity | known for 1,360 stars, "poor parallax" for 1,183 | known for 2,464, "poor parallax" for 30 |
| `starProfile` radius from the parallax | 696 stars | 2,217 stars, with ranges far too tight for most of them (Alioth: see below) |
| `starProfile` for 30 stars | poor parallax | "no parallax" (Mimosa, Nunki, ...) |
| `portrait`, `comparison` | from those radii | from those radii: a different size for any star whose radius came from the parallax; the 4,140 (3,762) stars with a radius still get a picture |
| nearest by space (`/nearest`) | distance with error | distance only (`error` is `undefined`); the order moves: Sirius's fifth nearest bright star is HR 1325 at 10.7 ly with the Yale data and at 10.2 with the BSC |
| sky from another star (`/sky-from`) | a companion nearer than the viewpoint's error is left out and counted | the viewpoint's error is 0, so a companion that shares its parallax stays a few thousandths of a light-year away: **seen from Alpha Centauri A, Alpha Centauri B shines at magnitude -24**. The demo drops it (`demo/from.ts`); the API does not. A one-line fix for the flip is for `skyFrom` to give a viewpoint with no error the half-milliarcsecond `starProfile` assumes. It was not made here, because it would also change the 234 BSC and dynamical viewpoints of the Yale build. |
| `/constellation-3d` (`distanceQuality`) | parallax errors give "good" (error under 5%) or "fair"; 25 "good" and 108 "fair" over the 88 figures' stars | no error, so nothing is "good": 0 good, 11 fair (dynamical), 489 "rough" (370 on the Yale data); every placed star has no error bar (Ursa Major: 9 of 9 placed, 9 "rough", 0 with an error range, against 5 "fair" and 4 "rough" with ranges) |
| `/nearby`, `/sky-from/nearby` | 5,565 stars | none |
| data export | `parallaxErrorMas` filled for 2,329 stars; `nearby-stars.csv` 5,565 rows | `parallaxErrorMas` is `\N` for every star; `nearby-stars.csv` has a header and no rows; `parallaxSource` is `BSC` or `dynamical` |

## The 10 named stars that change most

The two that lose their distance, then the eight whose distance moves most (relative), among the named stars whose Yale parallax is replaced. Parallax in milliarcseconds, distance in light-years, radius in solar radii. Pinned in `test/no-gctp.test.ts`.

| Star | Yale parallax | Yale distance | Fallback parallax | Fallback distance | Radius, Yale | Radius, fallback |
|---|---|---|---|---|---|---|
| Mimosa (β Cru) | 2.0 ± 11.9 | 1,631 (range 235 to infinity) | none | none | unknown | unknown |
| Nunki (σ Sgr) | 8.1 ± 15 | 403 (141 to infinity) | none | none | 3.9 (typical for its type) | 3.9 (typical) |
| Marfik (λ Oph) | 21.7 ± 1.9 | 150 (138 to 165) | 10 | 326 | 2.8 (2.2 to 3.6) | 6.0 (4.9 to 7.5) |
| Betelgeuse | 9.8 ± 4.7 | 333 (225 to 640) | 5 | 652 | 336 (149 to 987) | 659 (391 to 1,119) |
| Pherkad (γ UMi) | 0.2 ± 6.8 | 16,308 (466 to infinity) | 3 | 1,087 | unknown (poor parallax) | 33 (25 to 44) |
| Miram (η Per) | 0.7 ± 10.2 | 4,659 (299 to infinity) | 6 | 544 | unknown | 83 (55 to 127) |
| Saclateni (ζ Aur) | 1.4 ± 7.3 | 2,330 (375 to infinity) | 5 | 652 | unknown | 102 (69 to 152) |
| Azmidi (ξ Pup) | 1.0 ± 12.7 | 3,262 (238 to infinity) | 3 | 1,087 | unknown | 161 (98 to 272) |
| Brachium (σ Lib) | 24.0 ± 7.3 | 136 (104 to 195) | 64 | 51 | 88 (typical) | 88 (typical) |
| Tianguan (ζ Tau) | 3.3 ± 7.3 | 988 (308 to infinity) | 8 | 408 | unknown | 6.7 (5.9 to 7.7) |

The names people look for first change little in distance, but a range that was wide is now narrow: Sirius 381.6 ± 2.2 to 375 (8.5 to 8.7 ly), Procyon 286.7 to 288 (11.4 to 11.3), Vega 129.7 to 123 (25.1 to 26.5), Rigel 9.3 ± 6.2 to 13 (351 to 251 ly; luminosity range unknown before, 5,400 to 12,800 solar after). **Alioth** is the clearest warning: the Yale parallax (8.6 ± 15) is useless and the profile says so; the BSC's (9) looks usable with a range of 14 to 18 solar radii, but both are far from the modern value (about 40 milliarcseconds, 80 light-years, from outside this package, not used), so the fallback is confidently wrong where the Yale build was honestly unsure.

## The demo pages that change

The demo never imports the nearby tier, so only the parallaxes move.

- **Main page, a picked star's card** (`index.html`): the distance reads "9 light-years (no error given)" in place of "8.5 ± 0.1"; the profile's radius, luminosity and temperature rows are there, with different numbers and ranges, and a note under them says no parallax error is given and the ranges allow only for the catalogue's rounding.
- **Nearby panel**: by space it lists different, re-ordered stars with whole-number-based distances, says how many stars have no distance, and a new line says the build has no nearby-star layer. By sky it is unchanged.
- **View from**: the same stars to view from (all ten have BSC parallaxes); distances differ (Vega 26.5 ly, not 25.1); Alpha Centauri B is left out of the sky from Alpha Centauri A.
- **Embed page** (`embed.html`, `?from=`, `?pick=`) and **star page** (`star.html`): the same numbers change as on the main page; no new words.
- **Constellation in 3D** (`constellation-3d.html`, `embed-3d.html`): the stars are placed from the new parallaxes, so their places move; no star has an error bar, and the quality table reads "rough" for most (`sp_noError` already says so); a figure with no parallax at all is as before.
- **Constellation pages** (`constellation.html`, `constellation-list.html`, `constellations.html`) and **whole-sky.html**, **kids.html**: the distance of a star where one is shown moves; nothing else.
- **Docs-site guides**: pages that quote Yale figures, the nearby layer or Proxima Centauri are wrong on the fallback until rewritten (list above); their tested examples that call `nearbyStarByName("Proxima Centauri")!` would throw.

The new words are `noErrorGiven`, `nearbyNoLayer` and `noGctpProfileNote` in `scripts/page-words.ts`, English and Japanese; they show only on the fallback build.

## Checks

`pnpm test` passes on both builds (358 tests: all pass on the Yale default; 334 pass and 24 skip with `HOSHI_NO_GCTP=1`). `test/no-gctp.test.ts` runs both builds in their own node and checks the counts, the named stars, that nothing throws or prints NaN (every star's distance, profile, portrait and comparison, and the data export), the empty nearby layer, nearest by space and the Alpha Centauri sky. `e2e/no-gctp.demo.ts` plays the demo on the fallback site (`HOSHI_NO_GCTP=1 pnpm site`, then `HOSHI_NO_GCTP=1 TEST_PORT=8266 npx playwright test e2e/no-gctp.demo.ts`); it is skipped on the Yale build.

## One thing to check with CDS

The Bright Star Catalogue's own parallaxes may themselves come from an earlier edition of the Yale parallax catalogue (they are close to it: within one Yale error for 93.5% of the stars). The BSC ReadMe was not read for this; HEASARC's column description does not say. If CDS says the GCTP cannot be used, the BSC's parallaxes are worth a look at the same time, since the fallback is built on them.
