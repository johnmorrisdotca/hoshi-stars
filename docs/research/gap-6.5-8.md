# Filling the gap between the bright stars and UCAC4: SAO against APASS + 2MASS

Ticket MODULES-660, 2026-11-09. Kept on file whichever source ships. Every number here is in `docs/research/gap-6.5-8.json` and is made by `scripts/make-gap-sao.py`, `scripts/make-gap-apass.py` and `scripts/compare-gap.py`.

## The short answer

- **The gap.** The bright stars stop at magnitude 6.0 and UCAC4's own stars thin out below about 9.5. Between 6.5 and 8 the faint layer holds 3,138 stars where the sky holds about 33,600.
- **SAO fills it, everywhere.** The SAO Star Catalog gives 31,034 stars between 6.5 and 8 (the sky expects about 33,600), and 22,012 of them are not already in the layer. It covers the whole sky (0.7 to 1.8 stars a square degree between 7.5 and 8.5, against 1.15 expected).
- **APASS + 2MASS fills only the south.** APASS DR10 holds 22,948 stars between 6.5 and 8 once matched to 2MASS, but it has **no bright stars north of declination +20 degrees**: between 7.5 and 8.5 it holds 96 in 100 of SAO's count south of +20 and 15 in 100 north of it, with a sharp edge at +20. A map filled to the south of +20 and empty north of it would show the seam.
- **Which ships.** *Nothing yet.* John is asking NASA HEASARC to confirm SAO's terms (it states none, as the Yale parallax catalogue states none), and APASS + 2MASS has clean terms but is not usable alone. **When HEASARC confirms, SAO ships**, with one flag: `python3 -I scripts/make-faint-data.py build --gap sao`. If John wants APASS's better positions and magnitudes where it has them, `--gap apass-2mass,sao` (APASS + 2MASS first) gives both, and the one source is the only one needed to cover the sky. Until then the tiles in `faint-tiles/` are unchanged, byte for byte, and the demo's jump past the gap (`FAINT_JUMP_ZOOM`, `FAINT_PAST_GAP` in `demo/chart.ts`) stays as it is.
- **A finding that matters more than the choice.** UCAC4's magnitudes of its bright stars are too faint, by 0.4 to 1.2 magnitudes (see the finding below). Much of the thin band is real stars that the layer holds with the wrong magnitude, so the fill and a magnitude correction should go together (new ticket).

## The two sources and their terms (read 2026-11-09)

### SAO Star Catalog, through NASA HEASARC (table `sao`)

- The Smithsonian Astrophysical Observatory Star Catalog (SAO Staff 1966), the Astronomical Data Center's J2000 version (VizieR I/131A), 258,944 stars. The file is `heasarc_sao.tdat.gz` (13,825,579 bytes, SHA-256 `8ad1b253efc0b5386b4e3b8e5150eab4c54b61c090cd3eae6a88eed833702a67`) from https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_sao.tdat.gz, whose header says `table_security = public`.
- **Terms: none stated.** HEASARC's table page (https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/sao.html, last modified 20 October 2026) has provenance and no licence, credit line or terms: its words are "This database is based on the electronic version of the SAO catalog from the Astronomical Data Center, which is itself based on an original binary version of the Smithsonian Astrophysical Observatory Star Catalog (SAO, SAO Staff 1966)." HEASARC's acknowledgement page could not be found (every address tried answered 404), and the Harvard mirror's ReadMe of I/131A states no terms. The Smithsonian's catalogue is not a US government work by default.
- **So the footing is the Yale parallax catalogue's: no licence, use with credit, removal on request, which is not the clear-licence rule.** John is asking HEASARC to confirm; **the NOTICE line is marked "confirmation requested 2026-11-09" and no SAO star is in `faint-tiles/`.**
- **It measured its own stars, none from ESA.** It is built from ground catalogues (the table's source-catalogue codes are the AGK2, the Yale, Cape and Melbourne zone catalogues, the Boss General Catalogue, the FK3 and FK4), and the ADC's documentation says its J2000 positions and proper motions are Clayton A. Smith's (U.S. Naval Observatory) computed from them: "who computed the J2000 positions and proper motions and added them to the data records". It holds no Hipparcos, Tycho or Gaia value; only the catalogue's own SAO, HD, DM and GC numbers are read.

### APASS DR10 and 2MASS

- **APASS DR10** (the AAVSO Photometric All-Sky Survey, Henden et al.), through the GAVO Data Center's TAP service (https://dc.g-vo.org/tap, table `apass.dr10`, 130 million rows). VizieR's copy (II/336, DR9) could not be used: CDS refuses the connection and the Harvard mirror answers a cone search of this table with no rows.
- **Terms: free use with credit.** AAVSO's own page (https://www.aavso.org/apass) answers a script with a Cloudflare challenge and was not read that way; the Internet Archive's copy of 10 January 2026 (https://web.archive.org/web/20260110231551/https://www.aavso.org/apass) says: "APASS is a public service to the astronomical community" and "You should also acknowledge APASS with the following credit line: “This research was made possible through the use of the AAVSO Photometric All-Sky Survey (APASS), funded by the Robert Martin Ayers Sciences Fund and NSF AST-1412587.”" GAVO's "Copyright, License, Acknowledgements" for `apass.dr10` says: "If you use this data in a paper, please include the following acknowledgement: “This paper makes use of data from the AAVSO Photometric All Sky Survey, whose funding has been provided by the Robert Martin Ayers Sciences Fund and from the NSF (AST-1412587).”" VizieR's II/336 ReadMe asks for the same acknowledgement (text in NOTICE.md). AAVSO's query page also asks that its form not be called as an API ("over 5.2 million calls to this service in the last six years, 93% of them from 10 institutions. That is not okay"): this build does not touch AAVSO's servers, and GAVO's is the Virtual Observatory route AAVSO's own page names ("APASS DR 9 and subsequent data releases are available on VizieR and the Virtual Observatory").
- **2MASS Point Source Catalog** (Cutri et al. 2003), through NASA/IPAC IRSA's TAP service (`fp_psc`). The sentence relied on is in NOTICE.md (read 2026-11-08): IRSA lists it as a US government work and IPAC asks for the acknowledgement NOTICE.md gives. Public domain, with credit.
- The GAVO and IRSA tables that join APASS or 2MASS to Gaia (`gaia_dr2_apassdr9_*`, `gaia_ppmxl_*`) are never read.

## How each build works

Both write level 0 tiles in the faint layer's format, into `~/Projects/backups/hoshi-stars/2026-11-09-gap-tiles/<name>/` (not in the repository), and both drop a star that is one of the 5,080 bright stars (within 20 arc-seconds and 1.5 magnitudes) or one of the 950,428 UCAC4 stars to magnitude 11 that the layer keeps (within 5 arc-seconds and 2 magnitudes; to 11 because UCAC4's magnitudes of bright stars run faint, see the finding below). Both run from 6.0 to 9.0, which is where the bright stars end and UCAC4's own stars take over.

- **SAO** (`scripts/make-gap-sao.py`): position = SAO's J2000 position, magnitude = SAO's visual magnitude to 0.05, colour from the spectral type by Mamajek's dwarf sequence. Read 258,944; no visual magnitude 1,467; with a magnitude from 6.0 to 9.0: 148,002; dropped as bright 689; dropped as UCAC4's 116,854; **kept 30,459** (30,027 with a colour from the type, 432 without).
- **APASS + 2MASS** (`scripts/make-gap-apass.py`): APASS DR10 stars with V from 6.0 to 9.2 (98,081 rows, in 36 bands of declination), each matched to the nearest 2MASS source of J 9.5 or brighter (1,776,401 read) within 5 arc-seconds with a plausible V-J; 97,353 matched (674 had none, 54 shared a 2MASS source with another APASS row, 1,226 had more than one candidate and took the nearest). Position = 2MASS's, magnitude = APASS V to 0.05, colour = APASS B-V where both are APASS's with errors under 0.1. With a V from 6.0 to 9.0: 76,649; dropped as bright 1,447; as UCAC4's 58,600; **kept 16,602** (12,079 with a colour).
- The raw downloads are in `~/Projects/backups/hoshi-stars/2026-11-09-sao-raw/` and `2026-11-09-apass-2mass-raw/`.

## Counts for each quarter magnitude, against the sky

"Sky expects" is a model: the Bright Star Catalogue's 4,800 stars to 6.0 and a slope of 0.47 dex a magnitude, which the Durchmusterung and Tycho-2 star counts give between 6 and 10 (about 14,000 to 7, 41,000 to 8, 120,000 to 9, 350,000 to 10); good to about 15 in 100. "All" is every star the source holds in the quarter; "new" is what is left after the two drops. "UCAC4's own" is counted from the raw files by the build's rule, so 6.5 to 8.0 reads 3,158 here against the 3,138 in the tiles (the tiles also drop the stars that are bright-star duplicates).

| From | Sky expects | Bright 5,080 | UCAC4's own | SAO, all | APASS+2MASS, all | SAO, new | APASS+2MASS, new |
|---|---:|---:|---:|---:|---:|---:|---:|
| 6.00 | 1,491 | 57 | 18 | 1,804 | 526 | 1,148 | 57 |
| 6.25 | 1,955 | 0 | 26 | 1,673 | 959 | 1,632 | 317 |
| 6.50 | 2,562 | 0 | 45 | 3,306 | 1,565 | 3,279 | 1,251 |
| 6.75 | 3,358 | 0 | 36 | 2,913 | 2,284 | 2,867 | 2,221 |
| 7.00 | 4,401 | 0 | 33 | 5,198 | 3,229 | 4,874 | 3,173 |
| 7.25 | 5,769 | 0 | 207 | 4,147 | 4,074 | 3,382 | 3,741 |
| 7.50 | 7,561 | 0 | 920 | 8,299 | 5,216 | 4,973 | 3,324 |
| 7.75 | 9,910 | 0 | 1,917 | 7,171 | 6,580 | 2,637 | 1,826 |
| 8.00 | 12,989 | 0 | 3,715 | 18,843 | 8,630 | 3,252 | 458 |
| 8.25 | 17,024 | 0 | 5,844 | 16,265 | 11,229 | 941 | 122 |
| 8.50 | 22,314 | 0 | 11,863 | 42,222 | 14,114 | 946 | 61 |
| 8.75 | 29,246 | 0 | 24,215 | 36,161 | 18,243 | 528 | 51 |

By band: from 6.5 to 8.0 the sky expects 33,561, UCAC4's own stars are 3,158, SAO holds 31,034 (22,012 new), APASS + 2MASS holds 22,948 (15,536 new). From 6.0 to 6.5: expected 3,446, UCAC4's own 44, SAO 3,477 (2,780 new), APASS + 2MASS 1,485 (374 new). From 6.0 to 9.0: SAO 148,002 (30,459 new), APASS + 2MASS 76,649 (16,602 new).

- SAO's counts are near the sky's up to 8.0 and then run high at 8.0 to 9.0 (the catalogue's magnitudes pile up at whole numbers, 8.0, 8.5, 9.0, from its Durchmusterung and photographic sources), so it is the *new* column that matters there: after the drops SAO adds 5,667 at 8.0 to 9.0, because most of its stars there are ones UCAC4 holds under a magnitude too faint (see the finding below).
- **APASS is no use below about 7.** At 6.0 to 6.5 most of its "stars" are bright stars that saturated and read faint (of 1,485 in 6.0 to 6.5, 1,003 are not in SAO), and AAVSO's page says: "There are saturated stars in the catalog. Anything brighter than V=7 is not usable." GAVO gives its range as 7.5 to 16.5. Here it agrees with SAO from 7.0 (under 2 in 100 have no SAO counterpart at 6.75 to 7.5, and the offset is 0.05 to 0.10 magnitudes); between 6.5 and 7.0 the offset is already -0.15 and 13 in 100 of the stars of 6.5 to 6.75 have no SAO counterpart. **Trust APASS from 7.0, fully from 7.5.**

## The overlap of the two

Matched through the same 2MASS source (SAO's star within 10 arc-seconds of it): 65,471 SAO stars are also APASS + 2MASS stars. APASS's stars that SAO also holds:

| From | SAO stars | APASS+2MASS stars | APASS stars SAO also holds | APASS only |
|---|---:|---:|---:|---:|
| 6.50 | 3,306 | 1,565 | 1,362 | 203 |
| 7.00 | 5,198 | 3,229 | 3,202 | 27 |
| 7.50 | 8,299 | 5,216 | 5,062 | 154 |
| 8.00 | 18,843 | 8,630 | 8,081 | 549 |
| 8.50 | 42,222 | 14,114 | 12,013 | 2,101 |

From 6.75 to 8.25 SAO holds 90 to 99 in 100 of APASS's stars, so SAO is a superset there and APASS adds nothing in the way of stars. Of SAO's 30,459 new stars, 14,410 are not among APASS's 16,602 (and the union is about 31,000).

## Position: SAO (J2000) against 2MASS

147,600 of SAO's 148,002 stars from 6.0 to 9.0 (99.7 in 100) have a 2MASS source within 15 arc-seconds. The distance between them: **median 1.14 arc-seconds, 95th percentile 3.12**; no worse than 1.25 and 3.31 at any quarter magnitude from 6.5 (0.84 and 2.55 at 6.0).

SAO's J2000 positions are at **epoch 2000** already (the ADC's documentation: "at equinox and epoch J2000.0 and on the system of the FK5"), so no proper motion is applied. The check: for the 10,402 stars that move 0.1 arc-seconds a year or more, the position as given is 1.26 arc-seconds (median) from 2MASS, and moving it 50 years on with the catalogue's FK5 proper motion makes it 8.15 arc-seconds off. APASS + 2MASS positions are 2MASS's own (a fraction of an arc-second, epoch about 2000, no proper motion applied), the same epoch.

## Magnitude: SAO against APASS

For the stars both hold (65,471), SAO's V minus APASS's V, by APASS's V (median; the scatter is 1.4826 times the median absolute deviation; values are on the 0.05 grid):

| APASS V | Stars | Median | Scatter |
|---|---:|---:|---:|
| 6.0 to 6.5 | 484 | -0.10 | 0.22 |
| 6.5 to 7.0 | 3,613 | -0.15 | 0.22 |
| 7.0 to 7.5 | 7,213 | +0.05 | 0.30 |
| 7.5 to 8.0 | 11,369 | +0.10 | 0.30 |
| 8.0 to 8.5 | 18,240 | +0.05 | 0.22 |
| **7.5 to 8.5** | **29,609** | **+0.10** | **0.22** (16th to 84th percentile -0.15 to +0.35) |

So from 7.0 SAO and APASS agree to a tenth of a magnitude in the mean and 0.2 to 0.3 in scatter, which is the catalogue's own claim (visual magnitudes good to about 0.3), and the map shows stars to a tenth.

## Sky coverage and holes

Stars from 7.5 to 8.5 for each square degree, by band of declination (the sky expects 1.15):

| Declination | SAO | APASS+2MASS | UCAC4's own |
|---|---:|---:|---:|
| -90 to -80 | 0.71 | 0.53 | 0.28 |
| -80 to -70 | 0.80 | 1.02 | 0.23 |
| -70 to -60 | 1.22 | 1.38 | 0.43 |
| -60 to -50 | 1.49 | 1.42 | 0.44 |
| -50 to -40 | 1.17 | 1.24 | 0.32 |
| -40 to -30 | 1.20 | 1.00 | 0.34 |
| -30 to -20 | 1.26 | 0.96 | 0.29 |
| -20 to -10 | 1.00 | 0.94 | 0.24 |
| -10 to 0 | 0.97 | 0.92 | 0.21 |
| 0 to +10 | 0.95 | 0.92 | 0.22 |
| +10 to +20 | 1.13 | 0.97 | 0.23 |
| +20 to +30 | 1.15 | **0.23** | 0.35 |
| +30 to +40 | 1.57 | **0.23** | 0.38 |
| +40 to +50 | 1.81 | **0.20** | 0.33 |
| +50 to +60 | 1.57 | **0.24** | 0.38 |
| +60 to +70 | 1.48 | **0.24** | 0.30 |
| +70 to +80 | 1.15 | **0.22** | 0.21 |
| +80 to +90 | 0.93 | **0.17** | 0.22 |

- **APASS's hole is the whole northern sky.** Degree by degree, APASS holds 0.91 to 1.15 stars a square degree (7.5 to 8.5) from +10 to +19, 0.62 at +20, and 0.10 to 0.16 from +21 to +27 (the SAO count is 1.05 to 1.21 in the same rows). South of +20 it holds 96 in 100 of SAO's count; north of +21, 15 in 100; that sky is 33 in 100 of the whole. It leaves Cygnus, Lyra, Ursa Major, Cassiopeia and Perseus without bright stars. 164 of the 442 level 0 tiles hold under half of SAO's count (SAO 20 or more).
- **SAO has no hole.** Its density is steady (0.71 to 1.81), a little thin within 20 degrees of the south pole (0.71 and 0.80; APASS has 0.53 and 1.02 there) and a little rich in the north (1.57 to 1.81 at +30 to +60). One tile (south, -80, column 5) holds under half of APASS's count.
- **The galactic plane** is thicker for both and the cross-match is harder (1,226 APASS stars had more than one 2MASS candidate within 5 arc-seconds); the nearest was taken.

## A finding: UCAC4's bright magnitudes are too faint

The faint layer's magnitude for a UCAC4 star is APASS DR6's V, or UCAC4's own model magnitude where there is none. APASS saturates near V 7 to 10 and the model magnitude has no bright calibration, and the stars read faint. For the same stars, UCAC4's V minus APASS DR10's V (south of +15, UCAC4 stars to 11 as the layer keeps them):

| APASS DR10 V | Stars | Median | 16th to 84th percentile |
|---|---:|---:|---|
| 7.0 to 7.5 | 407 | +1.23 | +0.03 to +1.57 |
| 7.5 to 8.0 | 6,164 | +0.98 | +0.07 to +1.26 |
| 8.0 to 8.5 | 16,858 | +0.70 | +0.11 to +0.97 |
| 8.5 to 9.0 | 28,245 | +0.43 | +0.09 to +0.68 |

Against SAO the same stars show +0.9 (SAO 7.5 to 8.0), +0.6 (8.0 to 8.5) and +0.5 (8.5 to 9.0). SAO and APASS DR10, two independent sources, agree with each other (section on magnitudes); UCAC4 is the one that is off. The consequence: of the 35,108 SAO stars of 8.0 to 8.5, 30,937 have a UCAC4 star within 5 arc-seconds, at a median magnitude 0.6 fainter, which is why this layer looks thin at 7.5 to 8.5 even once the gap is filled (the union of SAO and UCAC4's own holds 10,447 stars at 7.5 to 8.0 against 17,500 expected, and 13,752 at 8.0 to 8.5 against 30,000). **A fill adds the stars UCAC4 left out; it does not correct the ones it holds with the wrong magnitude.** A new ticket proposes replacing UCAC4's magnitude, where an APASS DR10 or SAO star matches, by the better value.

## What it looks like on the demo's map

Counts of the faint stars drawn (the bright 5,080 are drawn besides), measured in the demo with the same view; the zoom is the readout's, 1280 by 900 pixels. "Before" is `faint-tiles/` as it is; "SAO" is the same build with `--gap sao` (30,431 stars after the merge drops 28 SAO pairs closer than 5 arc-seconds) and nothing else changed; "SAO, jump lifted" also sets `FAINT_JUMP_ZOOM` out of reach and `FAINT_FROM` to 6.5 (tried and put back).

| View | Before | With SAO | With SAO, jump lifted |
|---|---:|---:|---:|
| Orion, 2x | 0 | 0 | 495 (to 6.9) |
| Orion, 3x | 263 (to 8.6) | 1,012 (to 8.6) | 342 (to 7.4) |
| Orion, 5x | 556 (to 9.2) | 860 (to 9.2) | 209 (to 7.9) |
| Cygnus, 2x | 0 | 0 | 0 |
| Cygnus, 3x | 1,258 (to 8.6) | 2,311 (to 8.6) | 553 (to 7.4) |
| Cygnus, 5x | 1,862 (to 9.2) | 2,308 (to 9.2) | 460 (to 7.9) |

What the screenshots show (kept in `/private/tmp/hoshi-660/`, not in the repository): with SAO and the jump kept, Orion and Cygnus at 3x go from a sparse scatter to an even, dense field of the same small coloured dots (nearly four times as many in Orion, nearly twice as many in Cygnus), nothing odd at the edges and no seam; with the jump lifted the map is honest to magnitude 7.4 but plainly emptier than it is now, because the jump is also what lets 8.5-to-9 UCAC4 stars through. **So when SAO ships, keep the jump.** Lowering it only makes sense once UCAC4's magnitudes are corrected.

## Recommendation

1. **Ship SAO for the band once HEASARC confirms its terms** (`--gap sao`): it covers the whole sky, with 22,012 new stars at 6.5 to 8 and 30,459 at 6.0 to 9.0, positions good to 1.1 arc-seconds (median), magnitudes to a quarter of a magnitude, one source and one footing. It is 0.18 MB (30,459 stars at 6 bytes a star), in level 0 tiles with UCAC4's own.
2. **APASS + 2MASS is not usable alone**: clean terms and better numbers (0.1 arc-second positions, magnitudes to a few hundredths, measured B-V), but nothing north of +20. It is kept on file with its raw data, its script and this report. If John would rather have its numbers wherever they exist, `--gap apass-2mass,sao` ships both (APASS + 2MASS first; SAO fills the north and 6.0 to 7.0 and the rest), at the price of two sources to credit and a quality step at +20.
3. **If HEASARC says no**, ship `--gap apass-2mass` (16,602 stars, south of +20 only) only if John accepts the seam; otherwise leave the band as it is.
4. **Correct UCAC4's bright magnitudes** (new ticket), since that, not the dropped copies, is most of what makes 7.5 to 9 look thin.
5. The tile format has no room for a mark on each star. The source of a star is recorded per source in `faint-tiles/index.json` (`gapFill`), not in the tile.

## Reproduce

```
python3 -I scripts/make-gap-sao.py download && python3 -I scripts/make-gap-sao.py build
python3 -I scripts/make-gap-apass.py download && python3 -I scripts/make-gap-apass.py build
python3 -I scripts/compare-gap.py
python3 -I scripts/make-faint-data.py build --gap sao        # or --gap apass-2mass,sao, or --gap none (the default now)
```

The downloads go a band at a time with pauses (GAVO: 36 bands of 5 degrees, two to three minutes each; IRSA: 18 bands of 10 degrees) and take about 90 minutes in all.

## Update 2026-11-10: the magnitudes are corrected where APASS DR10 has the star (MODULES-786), and the ghosts are gone (MODULES-769)

The finding above is acted on, for the part that has a clean source. Where an APASS DR10 star of V 7.0 to 10.2 south of declination +20.0 lies within 5 arc-seconds of a star of the layer, the layer takes DR10's V (and B-V): 227,998 stars, 155,858 with a colour. The layer then holds 7,838 stars between 6.5 and 8 (3,138 before) and 77,770 between 7.5 and 9 (48,474), against about 33,600 and 99,000 in the sky. It is still short between 6 and 8.5 (a SAO fill is still what that needs), and `--gap` now also drops a gap star that duplicates a star the correction made brighter.

- **APASS's edge.** From +19.0 to +20.5 degrees DR10 holds 2.7 to 3.3 bright stars (V 7.0 to 9.2) a square degree, 1.6 between +20.5 and +20.6, and 0.3 to 0.5 beyond. A third of the sky (33 in 100) has no correction.
- **The change by UCAC4's own magnitude** (median of UCAC4 minus DR10, the stars that took DR10's V, south of +20; the quarter magnitude is UCAC4's): 7.75 +0.05, 8.00 +0.10, 8.25 +0.10, 8.50 +0.15, 8.75 +0.35, 9.00 +0.45, 9.25 +0.30, 9.50 +0.15, 9.75 +0.05, 10.00 0.00. The 16th to 84th percentile at 8.75 is +0.05 to +0.95: the error of a single star is nine tenths of a magnitude wide.
- **What a blanket offset would do (not applied).** Taking those medians as a correction for the stars with no APASS star (north of +20, or in the south where APASS lacks them; 100,744 and 35,791 stars of UCAC4 magnitude 8.5 to 10) would move 142,452 stars (104,907 north of +20) by a median of 0.15 magnitude. By comparison with SAO (UCAC4 minus SAO, median, before and after the offset) it works in every zone at 8.0 to 9.5: south of +20, 8.5 to 9 +0.30 to 0.00 and 9 to 9.5 +0.50 to +0.15; +20 to +60, +0.40 to +0.10 and +0.45 to +0.10; north of +60, +0.40 to +0.10 and +0.35 to 0.00. But it would pile stars up: 19,911 in 8.25 to 8.5 and 39,572 in 8.5 to 8.75 (the sky holds about 17,000 and 22,300; with APASS alone the layer holds 12,648 and 19,164). A decision for John: the stars of UCAC4 magnitude 8.5 to 10 with no APASS star stay about 0.4 too faint, or the offset is applied and the counts are wrong in the other direction.
- **The SAO hook.** `make-faint-data.py build --correct apass,sao` takes SAO's V for 67,713 more stars (UCAC4 gives 9.5 or brighter, APASS did not correct); it is not on while NASA HEASARC has not confirmed SAO's terms.
- **Ghosts.** 857 stars lie in the halo of a bright star, 182 are confirmed by 2MASS, 675 are dropped. UCAC4's object type 5 is most of them (560), and across the whole sky only 31 in 100 of its stars are confirmed (ordinary stars: 96 in 100), which is a separate finding (MODULES-798).
