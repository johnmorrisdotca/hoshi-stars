# The Messier objects without Sky Catalog 2000.0 (MODULES-781)

Status, 2026-11-09: **ready, not swapped in, nothing shipped.** The package still carries NASA HEASARC's Messier table (compiled from Sky Catalog 2000.0, Hirshfeld and Sinnott) for the 110 Messier magnitudes and sizes, as `NOTICE.md` says. John is writing to HEASARC and Sky & Telescope. This note is the fallback, built so that the answer "no" costs one change, and an audit of today's data made on the way.

## What was built

- `python3 -I scripts/make-deep-sky-data.py --no-sky-catalogue` writes `data-no-sky-catalogue/messier.ts` (same rows and columns as `src/data/messier.ts`, constant `MESSIER_ROWS`) and touches nothing in `src/`. It does not read HEASARC. The default build is unchanged: run from the saved Wikidata answers it rewrites `src/data/messier.ts` and `src/data/ngc-ic.ts` byte for byte as they are now (checked, `git status` clean after).
- Magnitudes: Wikidata's V band (CC0), as before, then `scripts/data/messier-fixes.tsv` (object, value, source, URL, date read, note), 46 lines. A line with an empty value says "no clean source found" and the object gets no magnitude.
- Sizes: `scripts/data/messier-sizes.tsv` (object, size, measure, source, URL, date read), 99 lines, written by `scripts/make-messier-fallback-sources.py` from NED, Harris, the MWSC and Green. Wikidata's own Messier sizes are not used (they are 6 values, none with a reference).
- `test/messier-fallback.test.ts` loads both tables and compares them (the audit below is pinned in it).
- **To swap it in (one change):** `cp data-no-sky-catalogue/messier.ts src/data/messier.ts`, in one commit with the `NOTICE.md` sentence for the Messier magnitudes and sizes rewritten to the sources below. Five existing assertions in `test/deep-sky.test.ts` then fail, and are edited in the same commit (see "What a swap changes"). `data-no-sky-catalogue/` is outside `src/` and not in the package's `files`, so today it ships nowhere.

Downloads are in `~/Projects/backups/hoshi-stars/2026-11-09-messier-fallback/` (Wikidata answers, NED tables, Harris's file, the MWSC rows, Green's page).

## Sources, and what each one asks

- **Wikidata** (https://www.wikidata.org, SPARQL, saved 2026-11-09): "All structured data ... is released into the public domain under Creative Commons Zero" (https://www.wikidata.org/wiki/Wikidata:Licensing). V magnitudes only; same queries as the main build.
- **NASA/IPAC NED** (https://ned.ipac.caltech.edu, Diameters and Photometry tables, read 2026-11-09): free with "This research has made use of the NASA/IPAC Extragalactic Database, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology." (the sentence already in `NOTICE.md`). The values are RC3's (de Vaucouleurs et al. 1991, NED refcode 1991RC3.9.C...0000d), 2MASS's (Jarrett et al. 2003).
- **Harris 1996 (2010 edition)**, https://physwww.mcmaster.ca/~harris/mwgc.dat, read 2026-11-09. The file says: "THE DATA IN THIS CATALOG ARE SUPPLIED FREE OF CHARGE TO ALL USERS. ANY THIRD PARTY WHO SUPPLIES THIS CATALOG IN TURN TO OTHER USERS MUST REFER TO THE ORIGINAL SOURCE ... AND MUST DO SO WITHOUT CHARGE OF ANY FEE", and asks for the citation "Harris 1996 (2010 edition)". Used: V_t and r_h for 29 clusters, not the catalogue. An MIT package given away free meets it; John to confirm.
- **Kharchenko et al. 2013, A&A 558, A53 (MWSC)**, read through the GAVO Data Center's TAP service (https://dc.zah.uni-heidelberg.de/tap, table `mwsc.main`, 2026-11-09). Built from 2MASS and PPMXL, not Gaia. The service page states no licence; the radii are measurements. John to confirm.
- **Green 2025, J. Astrophys. Astron. 46, 14** (D. A. Green's catalogue of Galactic supernova remnants, https://www.mrao.cam.ac.uk/surveys/snrs/, read 2026-11-09): "Please cite" the paper; the page is "Copyright D. A. Green 2024/2025". One number (7 x 5 arc-minutes for the Crab), a fact. John to confirm.
- **Not usable on 2026-11-09:** VizieR, SIMBAD and the CDS archive (`vizier.cds.unistra.fr`, `tapvizier.cds.unistra.fr`, `simbad.cds.unistra.fr`, `cdsarc.cds.unistra.fr`) refused every connection from this Mac (also through the web-fetch tool), and the Harvard VizieR mirror answered "The database is not currently reachable". That is why the H II regions (Sharpless 1959) and planetary nebulae (Strasbourg-ESO catalogue) have no size or magnitude here. Nothing was worked around. Worth another try on a later day.
- **Never used:** HEASARC's Messier table, Sky Catalog 2000.0, SEDS pages, Wikipedia text. The test checks that no line of either tsv names them.

## The magnitudes

### The 14 more than a magnitude off (NOTICE.md's list)

| Object | Wikidata V | Today (HEASARC) | Fallback | Source |
|---|---|---|---|---|
| M10 | 4.98 | 6.6 | 6.60 | Harris V_t |
| M14 | 5.73 | 7.6 | 7.59 | Harris V_t |
| M19 | 5.57 | 7.2 | 6.77 | Harris V_t |
| M22 | 6.17 | 5.1 | 5.10 | Harris V_t |
| M71 | 6.1 | 8.3 | 8.19 | Harris V_t |
| M49 | 12.17 | 8.4 | 8.41 | NED, RC3 V_T |
| M84 | 10.49 | 9.3 | 9.11 | NED, RC3 V_T |
| M88 | 13.18 | 9.5 | 9.63 | NED, RC3 V_T |
| M91 | 13.57 | 10.2 | 10.15 | NED, RC3 V_T |
| M20 | 6.3 | 8.5 | none | no clean source found |
| M27 | 14.089 (central star) | 8.1 | none | no clean source found |
| M57 | 15.769 (central star) | 9.0 | none | no clean source found |
| M76 | 17.48 (central star) | 11.5 | none | no clean source found |
| M97 | 15.777 (central star) | 11.2 | none | no clean source found |

Nine are fixed from a clean source, and each lands within 0.45 of today's value. Five are not: the planetary nebulae's Wikidata values are the central stars', and Wikidata has no nebula magnitude for them; NED has no optical photometry of them (radio, infrared, X-ray only); M20's Wikidata 6.3 cites a docdb.net page. The catalogue that has them (the Strasbourg-ESO planetary nebula catalogue, at CDS) could not be reached. **They have no magnitude in the fallback.** John: leave them blank, or have a clean paper found (the planetary nebulae are NGC 6853, 6720, 650 and 3587).

### Beyond the 14

- **M47** has no magnitude: Wikidata's only V statement (4.4) is ranked deprecated and no clean integrated V was found.
- **Harris's V_t for all 29 globular clusters**, so the whole class shares one source (the 14 above include five of them). Wikidata's SIMBAD-cited values for some of them are far from Harris's: M62 +0.94, M70 +1.19 and M107 +0.92. Each is under a magnitude from today's value, so none was in the list of 14.
- **RC3 V_T for M59, M60, M65, M85, M108, M109** (their only Wikidata reference is a SEDS page, which copies Sky Catalog 2000.0) **and M105** (Wikidata's 9.76 is 0.48 fainter than RC3's 9.28 and today's 9.3).
- **Still the Wikidata value, whose only reference is a SEDS page or none** (not fixed, no clean source was reachable): M1 8.4 (none), M8 6.0, M17 6.0, M21 5.9, M24 4.6, M40 8.4, M42 4.0 (none), M43 9.0 (none), M45 1.6, M52 7.3, M67 6.9, M78 8.3. M26 (SIMBAD and SEDS) too. **If the objection to Sky Catalog extends to SEDS copies, these 13 need a source; they are nebulae and open clusters.** M26, M52 and M45 are among the largest differences below.

## The sizes

The measure is different for each kind, and says so in the tsv. A size is the object's major-axis diameter in arc-minutes.

| Kind | Measure | Source | Objects | Median fallback / today |
|---|---|---|---|---|
| Galaxy | major axis of RC3 D_25 (blue 25 mag/arcsec^2 isophote) | NED Diameters | 40 (M102 as NGC 5866; NED's "M51" page errors, so NGC 5194 was asked) | 1.07 (0.95 to 1.35, over the 39 that have a size today) |
| Globular cluster | twice the half-light radius r_h | Harris | 29 | 0.21 (0.13 to 0.47) |
| Open cluster | twice the radius of the central part r_center | MWSC | 26 | 1.29 (0.55 to 2.73) |
| Supernova remnant | larger side of 7 x 5 | Green | M1 | 1.17 |
| Planetary nebula | K_s 20 mag/arcsec^2 isophote, major axis | NED (Jarrett 2003; 2MASS XSC for M76) | M27, M57, M76 | 0.7 |

**The globular and open cluster measures are a choice for John.** Neither catalogue has a "visual size". Harris's three: half-light diameter (used), core diameter, tidal diameter (about 10 times larger, far past what an eyepiece shows). The MWSC's three radii: core, central part (used), cluster (about twice the central part). Both alternatives are in the tables at the end, so a different choice is one line in `scripts/make-messier-fallback-sources.py`. Half-light diameters are about a fifth of the book's sizes; they say where half the light is, and a symbol drawn at "true size" from them would look small.

### Objects with no clean size (11): John can choose a generic size or ask

| Object | What it is | Why none | Today |
|---|---|---|---|
| M8 Lagoon Nebula | nebula | Sharpless 1959 is at CDS (unreachable); NED has no diameter | 90 |
| M16 Eagle Nebula | nebula | same | 7 |
| M17 Omega Nebula | nebula | same | 46 |
| M20 Trifid Nebula | nebula | same | 29 |
| M42 Orion Nebula | nebula | same | 66 |
| M43 De Mairan's Nebula | nebula | same | 20 |
| M78 | nebula | same | 8 |
| M97 Owl Nebula | planetary nebula | NED's only diameter lines are SDSS pipeline artefacts of 0 to 4 arc-seconds; the Strasbourg-ESO catalogue is at CDS | 3 |
| M24 Sagittarius Star Cloud | star cloud | a patch of the Milky Way, in no catalogue of objects | 90 |
| M40 Winnecke 4 | double star | a pair of stars; no size | none today either |
| M73 | four stars | an asterism (MWSC marks NGC 6994 "asterism" with no radius) | none today either |

Options for the seven nebulae and M24: a generic size by type, or nothing (the package already leaves M40, M73 and M102's size blank), or the Sharpless diameters once CDS answers.

## Today's data against the fallback, object by object

`Wikidata` in the source column names the references on the statement used. Sizes in arc-minutes. A blank is no value.

| Object | Kind | Mag today | Mag fallback | Mag source | Size today | Size fallback | Size source |
|---|---|---|---|---|---|---|---|
| M1 | SNR | 8.4 | 8.4 | Wikidata: (none) | 6 | 7 | Green 2025 |
| M2 | globular | 6.5 | 6.47 | Harris V_t | 13 | 2.1 | 2 r_h (Harris) |
| M3 | globular | 6.4 | 6.19 | Harris V_t | 16 | 4.6 | 2 r_h (Harris) |
| M4 | globular | 5.9 | 5.63 | Harris V_t | 26 | 8.7 | 2 r_h (Harris) |
| M5 | globular | 5.8 | 5.65 | Harris V_t | 17 | 3.5 | 2 r_h (Harris) |
| M6 | open cluster | 4.2 | 4.2 | Wikidata: SIMBAD | 15 | 31.2 | 2 r_center (MWSC) |
| M7 | open cluster | 3.3 | 3.3 | Wikidata: SIMBAD | 80 | 44.4 | 2 r_center (MWSC) |
| M8 | nebula | 5.8 | 6 | Wikidata: SEDS (Frommert) | 90 |  | none |
| M9 | globular | 7.9 | 7.72 | Harris V_t | 9 | 1.9 | 2 r_h (Harris) |
| M10 | globular | 6.6 | 6.6 | Harris V_t | 15 | 3.9 | 2 r_h (Harris) |
| M11 | open cluster | 5.8 | 5.8 | Wikidata: SIMBAD | 14 | 18 | 2 r_center (MWSC) |
| M12 | globular | 6.6 | 6.7 | Harris V_t | 14 | 3.5 | 2 r_h (Harris) |
| M13 | globular | 5.9 | 5.78 | Harris V_t | 17 | 3.4 | 2 r_h (Harris) |
| M14 | globular | 7.6 | 7.59 | Harris V_t | 12 | 2.6 | 2 r_h (Harris) |
| M15 | globular | 6.4 | 6.2 | Harris V_t | 12 | 2 | 2 r_h (Harris) |
| M16 | nebula | 6 | 6 | Wikidata: SIMBAD | 7 |  | none |
| M17 | nebula | 7 | 6 | Wikidata: SEDS (Frommert) | 46 |  | none |
| M18 | open cluster | 6.9 | 6.9 | Wikidata: SIMBAD | 9 | 12 | 2 r_center (MWSC) |
| M19 | globular | 7.2 | 6.77 | Harris V_t | 14 | 2.6 | 2 r_h (Harris) |
| M20 | nebula | 8.5 |  | none | 29 |  | none |
| M21 | open cluster | 5.9 | 5.9 | Wikidata: SEDS (Frommert) | 13 | 12 | 2 r_center (MWSC) |
| M22 | globular | 5.1 | 5.1 | Harris V_t | 24 | 6.7 | 2 r_h (Harris) |
| M23 | open cluster | 5.5 | 5.5 | Wikidata: SIMBAD | 27 | 33.6 | 2 r_center (MWSC) |
| M24 | other | 4.5 | 4.6 | Wikidata: SEDS (Frommert) | 90 |  | none |
| M25 | open cluster | 4.6 | 4.6 | Wikidata: SIMBAD | 32 | 28.2 | 2 r_center (MWSC) |
| M26 | open cluster | 8 | 8.87 | Wikidata: SEDS (Frommert), SIMBAD | 15 | 12 | 2 r_center (MWSC) |
| M27 | planetary neb. | 8.1 |  | none | 8 | 5.6 | K_s isophote (NED) |
| M28 | globular | 6.9 | 6.79 | Harris V_t | 11 | 3.9 | 2 r_h (Harris) |
| M29 | open cluster | 6.6 | 6.6 | Wikidata: SIMBAD | 7 | 7.2 | 2 r_center (MWSC) |
| M30 | globular | 7.5 | 7.19 | Harris V_t | 11 | 2.1 | 2 r_h (Harris) |
| M31 | galaxy | 3.4 | 3.44 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 178 | 190.5 | RC3 D_25 (NED) |
| M32 | galaxy | 8.2 | 8.08 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 8 | 8.7 | RC3 D_25 (NED) |
| M33 | galaxy | 5.7 | 5.72 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 62 | 70.8 | RC3 D_25 (NED) |
| M34 | open cluster | 5.2 | 5.2 | Wikidata: SIMBAD | 35 | 45 | 2 r_center (MWSC) |
| M35 | open cluster | 5.1 | 5.1 | Wikidata: SIMBAD | 28 | 48 | 2 r_center (MWSC) |
| M36 | open cluster | 6 | 6 | Wikidata: SIMBAD | 12 | 14.4 | 2 r_center (MWSC) |
| M37 | open cluster | 5.6 | 5.6 | Wikidata: SIMBAD | 24 | 22.8 | 2 r_center (MWSC) |
| M38 | open cluster | 6.4 | 6.4 | Wikidata: SIMBAD | 21 | 19.2 | 2 r_center (MWSC) |
| M39 | open cluster | 4.6 | 4.6 | Wikidata: SIMBAD | 32 | 39 | 2 r_center (MWSC) |
| M40 | other | 8 | 8.4 | Wikidata: SEDS (Frommert) |  |  | none |
| M41 | open cluster | 4.5 | 4.5 | Wikidata: (none), SIMBAD | 38 | 24 | 2 r_center (MWSC) |
| M42 | nebula | 4 | 4 | Wikidata: (none) | 66 |  | none |
| M43 | nebula | 9 | 9 | Wikidata: (none) | 20 |  | none |
| M44 | open cluster | 3.1 | 3.1 | Wikidata: SIMBAD | 95 | 217.2 | 2 r_center (MWSC) |
| M45 | open cluster | 1.2 | 1.6 | Wikidata: SEDS (Frommert) | 110 | 300 | 2 r_center (MWSC) |
| M46 | open cluster | 6.1 | 6.1 | Wikidata: SIMBAD | 27 | 42 | 2 r_center (MWSC) |
| M47 | open cluster | 4.4 |  | none | 30 | 39.6 | 2 r_center (MWSC) |
| M48 | open cluster | 5.8 | 5.8 | Wikidata: SIMBAD | 54 | 56.4 | 2 r_center (MWSC) |
| M49 | galaxy | 8.4 | 8.41 | RC3 V_T (NED) | 9 | 10.2 | RC3 D_25 (NED) |
| M50 | open cluster | 5.9 | 5.9 | Wikidata: SIMBAD | 16 | 28.2 | 2 r_center (MWSC) |
| M51 | galaxy | 8.1 | 8.36 | Wikidata: Gil de Paz 2007 (GALEX atlas), SEDS (Frommert) | 11 | 11.2 | RC3 D_25 (NED) |
| M52 | open cluster | 6.9 | 7.3 | Wikidata: SEDS (Frommert) | 13 | 19.8 | 2 r_center (MWSC) |
| M53 | globular | 7.7 | 7.61 | Harris V_t | 13 | 2.6 | 2 r_h (Harris) |
| M54 | globular | 7.7 | 7.6 | Harris V_t | 9 | 1.6 | 2 r_h (Harris) |
| M55 | globular | 7 | 6.32 | Harris V_t | 19 | 5.7 | 2 r_h (Harris) |
| M56 | globular | 8.2 | 8.27 | Harris V_t | 7 | 2.2 | 2 r_h (Harris) |
| M57 | planetary neb. | 9 |  | none | 1 | 1.7 | K_s isophote (NED) |
| M58 | galaxy | 9.8 | 9.66 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 5 | 5.9 | RC3 D_25 (NED) |
| M59 | galaxy | 9.8 | 9.63 | RC3 V_T (NED) | 5 | 5.4 | RC3 D_25 (NED) |
| M60 | galaxy | 8.8 | 8.84 | RC3 V_T (NED) | 7 | 7.4 | RC3 D_25 (NED) |
| M61 | galaxy | 9.7 | 9.65 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 6 | 6.5 | RC3 D_25 (NED) |
| M62 | globular | 6.6 | 6.45 | Harris V_t | 14 | 1.8 | 2 r_h (Harris) |
| M63 | galaxy | 8.6 | 8.59 | Wikidata: Gil de Paz 2007 (GALEX atlas), SEDS (Frommert) | 12 | 12.6 | RC3 D_25 (NED) |
| M64 | galaxy | 8.5 | 8.52 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 9 | 10 | RC3 D_25 (NED) |
| M65 | galaxy | 9.3 | 9.33 | RC3 V_T (NED) | 10 | 9.8 | RC3 D_25 (NED) |
| M66 | galaxy | 9 | 8.92 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 9 | 9.1 | RC3 D_25 (NED) |
| M67 | open cluster | 6.9 | 6.9 | Wikidata: SEDS (Frommert) | 30 | 66 | 2 r_center (MWSC) |
| M68 | globular | 8.2 | 7.84 | Harris V_t | 12 | 3 | 2 r_h (Harris) |
| M69 | globular | 7.7 | 7.64 | Harris V_t | 7 | 1.7 | 2 r_h (Harris) |
| M70 | globular | 8.1 | 7.87 | Harris V_t | 8 | 1.4 | 2 r_h (Harris) |
| M71 | globular | 8.3 | 8.19 | Harris V_t | 7 | 3.3 | 2 r_h (Harris) |
| M72 | globular | 9.4 | 9.27 | Harris V_t | 6 | 1.9 | 2 r_h (Harris) |
| M73 | other | 8.9 | 8.9 | Wikidata: SIMBAD |  |  | none |
| M74 | galaxy | 9.2 | 9.46 | Wikidata: The Spitzer Local Volume Legacy (LVL) gl | 10 | 10.5 | RC3 D_25 (NED) |
| M75 | globular | 8.6 | 8.52 | Harris V_t | 6 | 0.9 | 2 r_h (Harris) |
| M76 | planetary neb. | 11.5 |  | none | 2 | 0.7 | K_s isophote (NED) |
| M77 | galaxy | 8.8 | 8.87 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 7 | 7.1 | RC3 D_25 (NED) |
| M78 | nebula | 8 | 8.3 | Wikidata: SEDS (Frommert) | 8 |  | none |
| M79 | globular | 8 | 7.73 | Harris V_t | 9 | 1.3 | 2 r_h (Harris) |
| M80 | globular | 7.2 | 7.33 | Harris V_t | 9 | 1.2 | 2 r_h (Harris) |
| M81 | galaxy | 6.8 | 6.94 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 26 | 26.9 | RC3 D_25 (NED) |
| M82 | galaxy | 8.4 | 8.41 | Wikidata: (none), Gil de Paz 2007 (GALEX atlas) | 11 | 11.2 | RC3 D_25 (NED) |
| M83 | galaxy | 7.6 | 7.52 | Wikidata: The Spitzer Local Volume Legacy (LVL) gl | 11 | 12.9 | RC3 D_25 (NED) |
| M84 | galaxy | 9.3 | 9.11 | RC3 V_T (NED) | 5 | 6.5 | RC3 D_25 (NED) |
| M85 | galaxy | 9.2 | 9.11 | RC3 V_T (NED) | 7 | 7.1 | RC3 D_25 (NED) |
| M86 | galaxy | 9.2 | 8.9 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 7 | 8.9 | RC3 D_25 (NED) |
| M87 | galaxy | 8.6 | 8.63 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 7 | 8.3 | RC3 D_25 (NED) |
| M88 | galaxy | 9.5 | 9.63 | RC3 V_T (NED) | 7 | 6.9 | RC3 D_25 (NED) |
| M89 | galaxy | 9.8 | 9.75 | Wikidata: Gil de Paz 2007 (GALEX atlas), SEDS (Frommert) | 4 | 5.1 | RC3 D_25 (NED) |
| M90 | galaxy | 9.5 | 9.54 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 10 | 9.6 | RC3 D_25 (NED) |
| M91 | galaxy | 10.2 | 10.15 | RC3 V_T (NED) | 5 | 5.4 | RC3 D_25 (NED) |
| M92 | globular | 6.5 | 6.44 | Harris V_t | 11 | 2 | 2 r_h (Harris) |
| M93 | open cluster | 6.2 | 6.2 | Wikidata: SIMBAD | 22 | 30 | 2 r_center (MWSC) |
| M94 | galaxy | 8.1 | 8.24 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 11 | 11.2 | RC3 D_25 (NED) |
| M95 | galaxy | 9.7 | 9.73 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 7 | 7.4 | RC3 D_25 (NED) |
| M96 | galaxy | 9.2 | 9.25 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 7 | 7.6 | RC3 D_25 (NED) |
| M97 | planetary neb. | 11.2 |  | none | 3 |  | none |
| M98 | galaxy | 10.1 | 10.14 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 10 | 9.8 | RC3 D_25 (NED) |
| M99 | galaxy | 9.8 | 9.87 | Wikidata: Gil de Paz 2007 (GALEX atlas), SEDS (Frommert) | 5 | 5.4 | RC3 D_25 (NED) |
| M100 | galaxy | 9.4 | 9.35 | Wikidata: Gil de Paz 2007 (GALEX atlas), SEDS (Frommert) | 7 | 7.4 | RC3 D_25 (NED) |
| M101 | galaxy | 7.7 | 7.86 | Wikidata: Gil de Paz 2007 (GALEX atlas), VizieR | 27 | 28.8 | RC3 D_25 (NED) |
| M102 | galaxy | 9.89 | 9.89 | Wikidata: Gil de Paz 2007 (GALEX atlas) |  | 4.7 | RC3 D_25 (NED) |
| M103 | open cluster | 7.4 | 7.4 | Wikidata: SIMBAD | 6 | 9 | 2 r_center (MWSC) |
| M104 | galaxy | 8.3 | 8 | Wikidata: (none), Gil de Paz 2007 (GALEX atlas) | 9 | 8.7 | RC3 D_25 (NED) |
| M105 | galaxy | 9.3 | 9.28 | RC3 V_T (NED) | 4 | 5.4 | RC3 D_25 (NED) |
| M106 | galaxy | 8.3 | 8.41 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 18 | 18.6 | RC3 D_25 (NED) |
| M107 | globular | 8.1 | 7.93 | Harris V_t | 10 | 3.5 | 2 r_h (Harris) |
| M108 | galaxy | 10 | 10.03 | RC3 V_T (NED) | 8 | 8.7 | RC3 D_25 (NED) |
| M109 | galaxy | 9.8 | 9.83 | RC3 V_T (NED) | 8 | 7.6 | RC3 D_25 (NED) |
| M110 | galaxy | 8 | 8.07 | Wikidata: Gil de Paz 2007 (GALEX atlas) | 17 | 21.9 | RC3 D_25 (NED) |

Of the 104 objects with a magnitude in both: median difference 0.06 (globular clusters 0.13, galaxies 0.05, open clusters 0.00); 38 differ by more than 0.1, 11 by more than 0.3 (9 over, 3 exactly 0.3), 3 by more than 0.5, none by more than 1 (the largest is M17, exactly 1.0).

### The largest magnitude differences, and why

| Object | Today | Fallback | Difference | Cause |
|---|---|---|---|---|
| M17 | 7.0 | 6.0 | 1.0 | An emission nebula: an integrated magnitude is a matter of how much of the nebula is counted. Wikidata's 6.0 is cited to SEDS only, so neither value is clean. |
| M26 | 8.0 | 8.87 | 0.87 | An open cluster: Wikidata's 8.87 cites SIMBAD and SEDS; no measured total was reachable to say which is nearer. |
| M55 | 7.0 | 6.32 | 0.68 | Globular cluster: Harris's measured V_t is 6.32 and today's value is 0.68 fainter. (Wikidata's own 6.49 was 0.17 fainter than Harris's.) |
| M19 | 7.2 | 6.77 | 0.43 | One of the 14: Wikidata 5.57 is wrong; Harris V_t is 6.77 and today's 7.2 is 0.43 fainter. |
| M40 | 8.0 | 8.4 | 0.4 | A double star; Wikidata cites SEDS only. No clean source. |
| M45 | 1.2 | 1.6 | 0.4 | The Pleiades: the total brightness of a bright, huge cluster depends on the members counted. Wikidata 1.6 cites SEDS only. |
| M52 | 6.9 | 7.3 | 0.4 | Open cluster; Wikidata 7.3 cites SEDS only. |
| M68 | 8.2 | 7.84 | 0.36 | Globular: Harris V_t 7.84; today's value is 0.36 fainter. |
| M30 | 7.5 | 7.19 | 0.31 | Globular: Harris V_t. |
| M78, M86, M104 | 8.0, 9.2, 8.3 | 8.3, 8.9, 8.0 | 0.3 each | M78 is a nebula (Wikidata cites SEDS only); M86 and M104 take Wikidata's values, whose reference is the GALEX atlas paper (M104 also unreferenced). |

The pattern: the galaxies (RC3) and globular clusters (Harris) agree with today's values to a median of 0.05 and 0.13; the larger differences are the extended objects (nebulae, big open clusters), where the total depends on what is counted and the fallback's value rests on a SEDS-only statement.

### The largest size differences, and why

All twelve largest ratios are globular clusters, shrunk by 5 to 8 times: M62 14 to 1.8, M80 9 to 1.2, M79 9 to 1.3, M75 6 to 0.9, M2 13 to 2.1, M15 12 to 2.0, M70 8 to 1.4, M54 9 to 1.6, M92 11 to 2.0, M19 14 to 2.6, M30 11 to 2.1, M53 13 to 2.6. **Cause: a different measure (half-light diameter against the book's visual extent), not an error in either.** Next, the open clusters, in both directions: M45 grows from 110 to 300 (2.7 times), M44 from 95 to 217, M67 from 30 to 66, while M7 shrinks from 80 to 44; the MWSC's central part of a nearby cluster is a region degrees wide. Galaxies agree within 0.95 to 1.35 times: The galaxy sizes track today's closely, so the two are probably the same measure. For clusters no measured quantity reproduces today's sizes.

### Globular clusters: Harris's three diameters (arc-minutes)

| Object | 2 r_h (used) | 2 r_c (core) | 2 r_t (tidal) | Today |
|---|---|---|---|---|
| M2 | 2.1 | 0.6 | 24.9 | 13 |
| M3 | 4.6 | 0.7 | 57.4 | 16 |
| M4 | 8.7 | 2.3 | 103.6 | 26 |
| M5 | 3.5 | 0.9 | 47.3 | 17 |
| M9 | 1.9 | 0.9 | 16.0 | 9 |
| M10 | 3.9 | 1.5 | 36.9 | 15 |
| M12 | 3.5 | 1.6 | 34.6 | 14 |
| M13 | 3.4 | 1.2 | 42.0 | 17 |
| M14 | 2.6 | 1.6 | 15.4 | 12 |
| M15 | 2.0 | 0.3 | 54.6 | 12 |
| M19 | 2.6 | 0.9 | 29.1 | 14 |
| M22 | 6.7 | 2.7 | 63.8 | 24 |
| M28 | 3.9 | 0.5 | 22.5 | 11 |
| M30 | 2.1 | 0.1 | 37.9 | 11 |
| M53 | 2.6 | 0.7 | 36.7 | 13 |
| M54 | 1.6 | 0.2 | 19.7 | 9 |
| M55 | 5.7 | 3.6 | 30.6 | 19 |
| M56 | 2.2 | 0.9 | 21.1 | 7 |
| M62 | 1.8 | 0.4 | 22.6 | 14 |
| M68 | 3.0 | 1.2 | 29.8 | 12 |
| M69 | 1.7 | 0.7 | 15.8 | 7 |
| M70 | 1.4 | 0.1 | 19.0 | 8 |
| M71 | 3.3 | 1.3 | 17.8 | 7 |
| M72 | 1.9 | 0.9 | 14.9 | 6 |
| M75 | 0.9 | 0.2 | 11.4 | 6 |
| M79 | 1.3 | 0.3 | 16.0 | 9 |
| M80 | 1.2 | 0.3 | 14.4 | 9 |
| M92 | 2.0 | 0.5 | 24.9 | 11 |
| M107 | 3.5 | 1.1 | 38.0 | 10 |

(Tidal radius is r_c times 10 to the power c, from Harris's c and r_c.)

### Open clusters: the MWSC's three diameters (arc-minutes)

| Object | MWSC name | core | central part (used) | cluster | Today |
|---|---|---|---|---|---|
| M6 | NGC 6405 | 2.4 | 31.2 | 54.0 | 15 |
| M7 | NGC 6475 | 7.2 | 44.4 | 84.0 | 80 |
| M11 | NGC 6705 | 3.6 | 18.0 | 42.0 | 14 |
| M18 | NGC 6613 | 2.4 | 12.0 | 22.8 | 9 |
| M21 | NGC 6531 | 3.0 | 12.0 | 22.8 | 13 |
| M23 | NGC 6494 | 4.2 | 33.6 | 66.0 | 27 |
| M25 | IC 4725 | 4.2 | 28.2 | 45.6 | 32 |
| M26 | NGC 6694 | 4.2 | 12.0 | 19.8 | 15 |
| M29 | NGC 6913 | 2.4 | 7.2 | 14.4 | 7 |
| M34 | NGC 1039 | 19.2 | 45.0 | 87.6 | 35 |
| M35 | NGC 2168 | 4.8 | 48.0 | 117.6 | 28 |
| M36 | NGC 1960 | 3.6 | 14.4 | 31.2 | 12 |
| M37 | NGC 2099 | 7.2 | 22.8 | 58.2 | 24 |
| M38 | NGC 1912 | 3.0 | 19.2 | 46.8 | 21 |
| M39 | NGC 7092 | 9.6 | 39.0 | 108.0 | 32 |
| M41 | NGC 2287 | 4.8 | 24.0 | 52.8 | 38 |
| M44 | NGC 2632 | 24.0 | 217.2 | 372.0 | 95 |
| M45 | Melotte 22 | 42.0 | 300.0 | 744.0 | 110 |
| M46 | NGC 2437 | 4.8 | 42.0 | 68.4 | 27 |
| M47 | NGC 2422 | 10.8 | 39.6 | 75.6 | 30 |
| M48 | NGC 2548 | 6.0 | 56.4 | 86.4 | 54 |
| M50 | NGC 2323 | 3.6 | 28.2 | 55.2 | 16 |
| M52 | NGC 7654 | 3.0 | 19.8 | 39.0 | 13 |
| M67 | NGC 2682 | 12.0 | 66.0 | 123.6 | 30 |
| M93 | NGC 2447 | 4.8 | 30.0 | 60.0 | 22 |
| M103 | NGC 581 | 4.2 | 9.0 | 20.4 | 6 |

## Where the demo's drawing changes

Checked by building the demo twice (`pnpm site`, once on today's data and once with the fallback copied over `src/data/messier.ts`) and drawing the deep-sky layer on a 1440 by 900 dark page, Orion, Sagittarius and Virgo, at 1.5 times (zoomed out, where only the bright objects are labelled) and at 3 times (all labelled). Pictures in `/private/tmp/hoshi-781/`: `<region>-today.png`, `<region>-fallback.png` and `<region>-side-by-side.png`.

- **Symbols do not change**: on `main` each object is a fixed-size symbol by type (a galaxy ellipse, a globular cluster cross, an open cluster dashed circle). Nothing uses the size. At 3 times all three views are byte-identical.
- **Which objects are labelled when zoomed out** (below 2.5 times only an object of magnitude 5 or brighter, or one with no magnitude counted as 9, is labelled): today 11 objects, fallback 10. The one that goes is **M47**, which has no magnitude in the fallback. Seen in the Orion and Virgo views; Sagittarius is identical.
- **At a magnitude limit** (the same rule, and the order labels are given room): 4: no change. 5: M47 lost. 6: M47 lost, M17 gained. 7: M47, M52 lost, M19 gained. 8: M26, M40, M47, M78, M110 lost; M68, M70, M104, M107 gained. 9 and 10: the objects with no magnitude count as 9, so M76, M86, M97 appear at 9 and M76, M97 at 10 (an effect of the demo's `?? 9`, not of the data).
- **The object card** shows "Magnitude" and "Size" only where there is one: M20, M27, M47, M57, M76 and M97 lose the magnitude line, and 11 objects have no size line.
- **On the branch `feat/deep-sky-pictures`** (another session's, not rendered here) objects are drawn at their true size from `sizeArcmin`; there the size changes above would show: globular clusters become small, open clusters (M44, M45, M67) large. Not checked: that branch is not mine to touch.

## What a swap changes in the tests

The five assertions of `test/deep-sky.test.ts` that fail when the fallback is copied in: "every Messier object has a ... magnitude" (six have none), "known answers" (M31 is 3.44, not 3.4), "deepSky narrows by catalogue, magnitude and type" (M31 sits at exactly 3.4 today), "every row of the large table is well formed" (7,364 with a magnitude, not 7,370), and "the large table's lookups ... behave as the small one's" (four planetary nebulae are no longer the ones with a magnitude). The "size under 200" check in the first of them would fail next (M44 217, M45 300). The other 344 tests pass with the fallback in place.

## Decisions for John

1. The five bright planetary nebulae and M20 (and M47) have no magnitude: leave blank, or have a person with ADS find clean values.
2. The 11 objects with no clean size: a generic size by type, or blank.
3. The 13 magnitudes that still rest on a SEDS-only or unreferenced Wikidata statement (list above): accept, or find sources.
4. The size measure for globular clusters (half-light, used) and open clusters (central part, used): or the alternatives in the tables above.
5. Terms of Harris's file ("without charge of any fee", cite), the MWSC at GAVO (no licence stated) and Green's page ("Copyright D. A. Green 2024/2025", please cite): confirm each before the swap. If any is refused, the objects it covers go to "no size".
