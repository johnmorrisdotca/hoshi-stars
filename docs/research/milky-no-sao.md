# A Milky Way without the SAO star counts (MODULES-780)

Written 2026-11-09. Why: the shipped Milky Way grid (`src/data/milky-way.ts`) uses star counts from the SAO Star Catalog as NASA's HEASARC serves it, and that catalogue states no licence (NOTICE.md). John Morris has written to HEASARC. This is the fallback, ready for a "no".

## What is built

`python3 -I scripts/make-milky-way-data.py --no-sao` writes `data-no-sao/milky-way.ts`, the same 360 by 120 grid in the same format. It uses:

- **COBE DIRBE 1.25 micron starlight** (zodi-subtracted mission average, band 1A, 393,216 pixels of the COBE sky cube, NASA LAMBDA) where the SAO counts stood: the Galaxy's own starlight, through the same dust, at a wavelength the dust dims less. Its bright single stars are removed (a cell that stands more than 1.3 times above the median of the strip of cells along the plane round it is set to that), the sky's floor (the median above 35 degrees of latitude) is taken away, and the rest is scaled so the disk's glow has the ratio 2.0 the star counts' ratio had. From there the code is the shipped code, unchanged: the same ridge profile, the same disk model, the same bulge, the same dust darkening.
- **The dust**, unchanged: IRAS 100 micron (public domain) and COBE DIRBE 100 micron to fill its holes.
- **Our own bulge and disk model**, unchanged.

Not used: Gaia, Hipparcos, Tycho, any 2MASS count, HYG, any CC BY-NC or CC BY-SA source, Planck, and DIRBE-derived products that use stellar catalogues in their modelling (the Cosmoglobe DIRBE maps use Gaia; they were left alone).

Licence, with the sentences and the date, is in NOTICE.md ("The Milky Way", fallback paragraph). In short: the NASA/IPAC SkyView survey page for "COBE DIRBE/ZSMA" (all ten bands) says "Provenance COBE Team, Copyright Public Domain", NASA's media guidelines say NASA content "generally [is] not subject to copyright in the United States ... NASA should be acknowledged as the source", and LAMBDA's own pages state no licence; credit is given.

### How the DIRBE file is read (stdlib only, in the script)

The ZSMA FITS file is a table with one row per pixel of the COBE quadrilateralized spherical cube (resolution 9: six faces of 256 by 256, J2000 ecliptic). The face axes were found by laying the cube over SkyView's COBE DIRBE 100 micron map, which is in galactic coordinates: for each of the 6 faces, the one of the 96 ways of putting it down that agreed best (the winners were clear: faces 1 to 4 round the ecliptic at 0, 90, 180 and 270 degrees, face 0 the north pole, face 5 the south). Inside a face, the pixel's number holds its column and row bits interleaved, and the direction comes from the cube's polynomial (28 coefficients). The coefficients and the table of faces are those of Greisen and Calabretta 2002 (section 5.6.2; the paper's TeX source was read from arXiv on 2026-11-09 and its coefficient table compared with the script's by program: identical; its table of faces gives the same six axes the search found). Checks: the polynomial's cells are within 7 percent of equal area (a plain tangent mapping is 38 percent out), and the 100 micron band decoded this way agrees with SkyView's resampling of the same map to a correlation of 0.94 in log intensity (2 degree medians; SkyView's version has noisy strips, so this is a ceiling on the check, not on the decode). The script stops if a file is not resolution 9, 17 bytes a row, 393,216 rows, or is out of pixel order.

## How to swap it in (one change)

```
cp data-no-sao/milky-way.ts src/data/milky-way.ts
```

(or `python3 -I scripts/make-milky-way-data.py --no-sao --out src/data/milky-way.ts`, which writes the same bytes). Nothing in `src/` knows which grid it reads. Then in the same commit:

1. NOTICE.md: the "Star counts: the SAO Star Catalog" bullet and the sentence about the counts in the paragraph's first line are replaced by the fallback paragraph that is already there (it is written as "not shipped" until then).
2. `test/milky-no-sao.test.ts`: delete the comparison test (it would compare the grid with itself); the rest holds.
3. `scripts/make-milky-way-data.py`: the SAO path can stay (it is the history of how today's grid was made) or go; `--no-sao` is then the default.

Trying it without changing anything: `HOSHI_NO_SAO=1 pnpm test` reads the fallback in the tests, and `HOSHI_NO_SAO=1 pnpm site` builds the demo with it (`scripts/milky-source.mjs`). It does not change `pnpm build`'s output.

The default build is unchanged: `python3 -I scripts/make-milky-way-data.py` writes `src/data/milky-way.ts` byte for byte as shipped (checked 2026-11-09 against fresh downloads of the dust maps and the cached SAO file).

## Comparison with today's grid (`node scripts/compare-milky.ts`)

| | |
|---|---|
| Correlation, every cell | 0.956 |
| Correlation, within 10 degrees of the plane | 0.922 |
| Mean absolute difference (0 to 1 of the core's brightness) | 0.013 |
| Band centre line (brightness-weighted latitude, per longitude, within 15 degrees) | mean difference 0.23 degrees, largest 0.82 (l 182.5, the faint anticentre) |
| Brightest cell | l 0.5, b -0.25 in both |
| Share of all brightness within 20 degrees of the Galactic centre | 20.9 percent today, 20.7 percent fallback |
| Core against the anticentre (discs of 8 degrees) | 3.52 today, 3.50 fallback |
| Great Rift (l 18 to 42, b +2 against its sides) | 0.52 today, 0.48 fallback |
| Cygnus Rift (l 72 to 88, b +3 against the plane) | 0.79 today, 0.81 fallback |
| **Coalsack** (l 301 to 305, b -4 to 0 against its sides) | **0.63 today, 1.08 fallback: not reproduced** |

The 10 cells that differ most (brightness 0 to 1; today, then fallback):

| l | b | today | fallback |
|---|---|---|---|
| 1.5 | +3.25 | 0.39 | 0.68 |
| 2.5 | +3.25 | 0.39 | 0.68 |
| 0.5 | +3.25 | 0.45 | 0.71 |
| 1.5 | +3.75 | 0.32 | 0.58 |
| 2.5 | +2.75 | 0.35 | 0.61 |
| 0.5 | +3.75 | 0.39 | 0.65 |
| 2.5 | +3.75 | 0.35 | 0.61 |
| 21.5 | -0.75 | 0.26 | 0.48 |
| 1.5 | +2.75 | 0.39 | 0.61 |
| 0.5 | +4.25 | 0.35 | 0.58 |

They are one place (just north of the Galactic centre, where today's grid has a dark lane across the bulge's top and the fallback has less of one) and one cell at l 21.5. The same list with cells at least 6 degrees apart (the 10 places): the bulge's north side (l 1.5, b +3.25); l 21.5 and l 28.5 (b -0.75, brighter in the fallback); **l 302.5, b -1.25: the Coalsack's southern part (0.16 today, 0.35 fallback)**; l 321.5 and l 307.5 (b +3.25, brighter in the fallback); l 357.5, b -2.75; l 41.5, b -0.75 (the one place where the fallback is darker, 0.35 against 0.48); l 315.5, b -0.75; l 6.5, b -4.75.

### What this says about today's data

Two grids built from different physics (stars brighter than ninth magnitude, nearby; and the whole Galaxy's near-infrared glow) agree to 0.956 over the sky, on the centre line of the band to a quarter of a degree, and on how much of the light is in the core. So today's grid is not an artefact of the SAO counts: its band, its core and its anticentre are what the infrared sky says too. Where they part is where the counts and the infrared differ in kind: the SAO counts see only the near stars, so they see the nearby dark clouds (the Coalsack, the dark clouds just north of the centre) as holes in front of the stars; the infrared sees through them and the dust term alone (100 micron glow) carries them.

## What I see in the pictures

All in `/private/tmp/hoshi-780/`, 1440 wide, dark and light. The demo has two looks (`night`, on the screen, and `paper`, for print); it has no look called "Painted": the whole-sky page's Milky Way is the soft picture `demo/whole-sky-milky.ts` makes from the grid, which is what is rendered below with both of those colour ramps. The grids themselves are drawn through the demo's real ramps, today on the left, the fallback on the right, and a difference map under them (orange: the fallback is brighter; blue: darker).

- `page-today-*` and `page-fallback-*` (`milky-only`, `default`, `dark`, `light`): the real whole-sky page of the demo built with each grid. Whole sky: the two are hard to tell apart at this size. The fallback's band is slightly broader and smoother, and a touch brighter at 10 to 20 degrees from the plane; the core has the same bright arc and the same dark lane under it.
- `whole-night.png`, `whole-paper.png`: the whole sky as a plate carree strip with the difference. The fallback is brighter in the inner Galaxy (orange from l 265 through the centre to l 35, and broader, so a little brighter well off the plane) and dimmer in a few patches of the outer disk (blue near l 165, l 80 and l 205 to 230).
- `cygnus_aquila-*`: the Cygnus Rift (the dark lane splitting the band at l 70 to 90) is there in both, at the same latitude. The fallback is brighter at l 20 to 35 (Aquila and Scutum) and dimmer through Cygnus (blue at l 60 to 100, where it is a few hundredths of the core's brightness below today's).
- `sagittarius_scorpius-*`: **the bulge.** Brightness and shape agree (same arc, same size). The fallback is brighter just north of the centre (l 0 to 3, b +3 to +4), where today's grid has a dark lane across the top of the bulge; a little brighter in the inner disk on the Sagittarius side (l 15 to 30); and a little darker along the plane at l 335 to 355. I cannot tell from numbers which of the two is nearer the optical sky north of the centre; the dust term is the same in both.
- `crux_coalsack-*`: **where the fallback is worse.** Today's grid has a clear dark gap at l 301 to 305; the fallback has none and a bright knot just beside it (the difference map shows orange). The Coalsack is the case the star counts were there for: a near cloud, dark in front of far stars, which an infrared map that sees past it cannot show, and the 100 micron glow of such a cold near cloud does not stand out from the plane's. The Great Rift (Aquila to Serpens) is kept, from the dust term.
- `orion_anticentre-*`: the faint anticentre agrees, both as a thin even band with no feature; the fallback is a little dimmer in patches (blue in the difference map, a few hundredths of the core's brightness).

Summary of where the fallback is worse: the Coalsack (not reproduced, 1.08 against 0.63, so `test/milky-way.test.ts` holds it only to "not brighter" when the grid says it has no star catalogue); the small dark clouds just north of the centre (not looked at in the optical sky); the sharpness of the lanes in general (DIRBE's beam is 0.7 degree, a cell of the grid is 1 by 0.5). Where it is as good or better: the bulge's brightness and size, the centre line, the broad disk and the anticentre.

## What to do next (for John to decide)

- If HEASARC says no, swap in as above. The Coalsack alone could be restored by a dark cloud of our own (a position and a size, as the bulge is a position and a size): a judgement call, left alone here.
- DIRBE's 2.2 micron band (and 1.25 over 2.2, a colour that reddens with dust) was looked at as an extinction map. It reddens along the whole plane and shows no local dip at the Coalsack, so it was not used.
