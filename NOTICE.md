# Notice

Hoshi Stars is original work by John Morris, under the MIT licence in `LICENSE`.

## The stars

- **Bright stars (`@johnmorrisdotca/hoshi-stars`)**: the Yale Bright Star Catalogue, D. Hoffleit and W. H. Warren Jr. (1991), "The Bright Star Catalogue, 5th Revised Edition (Preliminary Version)", Astronomical Data Center (NASA Goddard Space Flight Center) and the Centre de Données astronomiques de Strasbourg, catalogue V/50, as NASA's HEASARC serves it (table bsc5p, https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html, file heasarc_bsc5p.tdat.gz, read 2026-11-08; a US government source), the 5,080 stars to visual magnitude 6.0, written out as numbers by `scripts/make-star-data.py` into `src/data/stars.ts`. The catalogue's own documentation calls it public domain and the Astronomical Data Center asks that it and the authors be acknowledged, which this line does; there is no formal licence text, so this footing is informal.
- **Star names**: our own list after the IAU Working Group on Star Names (https://www.iau.org/science/scientific_bodies/working_groups/280/).
- **Star colour**: Ballesteros's B-V to temperature relation (F. J. Ballesteros 2012, EPL 97, 34008) and a piecewise black-body colour fit.

## The constellations

- **Constellations (`@johnmorrisdotca/hoshi-stars/constellations`)**: facts typed from published lists, in our own table (`src/data/constellations.ts`), with no artwork or lines.
  - The 88 constellations, their three-letter abbreviations, Latin names, Latin genitives and English names: the International Astronomical Union's constellation list (https://www.iau.org/public/themes/constellations/). That address returned 404 on 2026-11-08, so the table was read on 2026-11-08 from a 2013 copy of the same IAU page ("The Constellations | IAU") kept at zfelleg.useribm.hu, and every Latin name, genitive and English name was checked against the text of that copy. Two spellings are ours: "Berenice's Hair" for Coma Berenices (the copy has "the Bernice's Hair") and "Hercules" for the constellation (the copy has "the Hercules"); the leading "the" of the English names is left off.
  - The Japanese names: the National Astronomical Observatory of Japan, Ephemeris Computation Office, "星座の名前" (Constellation names; https://eco.mtk.nao.ac.jp/koyomi/faq/constellations.html), read 2026-11-08. It gives the abbreviation, the name in kana and the Latin name of all 88, and every abbreviation and Latin name matched the IAU table. The hiragana reading is worked out from that kana form in code.
  - No Wikipedia text is used.

## The constellation boundaries

- **Boundaries (`@johnmorrisdotca/hoshi-stars/boundaries`)**: N. G. Roman (1987), "Identification of a Constellation from a Position", Publications of the Astronomical Society of the Pacific 99, 695, and VizieR catalogue VI/42, which holds her table of the constellation boundaries that the International Astronomical Union adopted from E. Delporte (1930), "Delimitation Scientifique des Constellations" (Cambridge University Press), put into electronic form by Barry Rappaport. The table (`data.dat`, 357 rows, on the equator and equinox of B1875.0) was read on 2026-11-08 from the Harvard mirror of VizieR (https://vizier.cfa.harvard.edu/ftp/cats/VI/42/), because the CDS hosts refused the connection from our machine; the ReadMe, `test.in`, `out.dat` and the FORTRAN `program.f` (for its precession, used in a test) were read there too. No licence stated; removed on request. The rows and the outlines worked out from them are written by `scripts/make-boundary-data.py` into `src/data/boundaries.ts`.
- **Precession to B1875.0**: the rigorous angles of the IAU 1976 system as J. Meeus gives them in "Astronomical Algorithms" (2nd ed., 1998), chapter 21, written out as formulas; no code is copied. The test compares it with Herget's precession as Roman's own program applies it.

## The map projections

- **Projections (`@johnmorrisdotca/hoshi-stars/projection`)**: stereographic, orthographic, gnomonic, azimuthal equidistant, equirectangular, Mollweide and Hammer, written from the formulas in J. P. Snyder, "Map Projections: A Working Manual", U.S. Geological Survey Professional Paper 1395 (1987), a U.S. Government work in the public domain. The formulas are mathematics; no library's code is copied.

## Your sky

- **Horizon view (`@johnmorrisdotca/hoshi-stars/sky`)**: written from the formulas in J. Meeus, "Astronomical Algorithms", 2nd ed. (Willmann-Bell, 1998): Greenwich mean sidereal time (the IAU 1982 expression, chapter 12), equatorial to horizontal coordinates (chapter 13), atmospheric refraction (Saemundsson's formula, chapter 16) and precession from J2000 (the IAU 1976 constants, chapter 21). The formulas are mathematics and the worked examples (12.a, 12.b, 13.b, 21.b) are used only as test values; no book text or library code is copied.
- **UTC to Terrestrial Time (`horizontalFrom`)**: the leap seconds (TAI - UTC, 10 s in 1972 to 37 s in 2017, a table of facts published by the IERS and the BIPM) plus 32.184 s; before 1972, delta T by the polynomial fits of F. Espenak and J. Meeus ("Polynomial Expressions for Delta T", NASA Eclipse Web Site, 2006), written out as formulas in `src/time-scale.ts`; no code is copied. The test compares the leap-second part with wakusei-planets' conversion, a dev-only second opinion.
- **Another planet**: the convention is that of the IAU Working Group on Cartographic Coordinates and Rotational Elements (pole right ascension and declination, and W = W0 + rate d), as in Archinal et al., Celestial Mechanics and Dynamical Astronomy 130, 22 (2018). The tests type in the 2015 Mars values from that report; the package itself holds no planet data.

## The deep-sky objects

- **Messier, NGC and IC objects (`@johnmorrisdotca/hoshi-stars/deep-sky` and `.../deep-sky/ngc-ic`)**: Wikidata (https://www.wikidata.org), read on 2026-11-08 through its SPARQL endpoint (https://query.wikidata.org/sparql) by `scripts/make-deep-sky-data.py`, which writes `src/data/messier.ts` (110 objects) and `src/data/ngc-ic.ts` (11,788 objects). The sentence relied on is Wikidata's own, at https://www.wikidata.org/wiki/Wikidata:Licensing: "All structured data (i.e. the main, Property, Lexeme, and EntitySchema namespaces) is released into the public domain under Creative Commons Zero." Wikidata's labels and aliases are structured data, so the English names are CC0 too; no Wikipedia text is used.
  - What is read: items with a catalog code (P528) in the Messier (Q14530), New General (Q14534) or Index (Q741672) catalogue, qualified by catalogue (P972), with a plain number, that have a right ascension (P6257) and a declination (P6258) in degrees; their type (P31, mapped to galaxy, globular cluster, open cluster, nebula, planetary nebula, supernova remnant or other through the subclasses of Q318, Q42372, Q13632, Q207436, Q11276 and Q11387), V-band apparent magnitude (P1215 with band Q4892529), angular diameter (P5348), English label and aliases, and constellation (P59, turned into the IAU abbreviation with `src/data/constellations.ts`). Statements ranked deprecated are ignored. The epoch qualifier (P6259) is J2000.0 or absent on every position (the property's default is J2000); a position with any other epoch or unit would be dropped, and none is. An item with positions that disagree by more than 1 arc-minute is left out (14 NGC and IC items); one that appears under two numbers within 1 arc-minute of each other is one object.
  - The queries, word for word as in the script. Each begins with the same selection, shown as `<selection>`:

```sparql
<selection> is:
VALUES ?cat { wd:Q14530 wd:Q14534 wd:Q741672 }
  ?item p:P528 ?cs . ?cs ps:P528 ?id ; pq:P972 ?cat .
  FILTER(REGEX(?id, "^(M|NGC|IC) ?[0-9]+[A-Za-z]?$"))
```

  `ids`:

```sparql
SELECT DISTINCT ?item ?id ?cat WHERE {
  <selection>
}
```

  `coordinates`:

```sparql
SELECT DISTINCT ?item ?ra ?raUnit ?raEpoch ?raRank ?dec ?decUnit ?decEpoch ?decRank WHERE {
  <selection>
  ?item p:P6257 ?rs . ?rs psv:P6257 ?rv ; wikibase:rank ?raRank . ?rv wikibase:quantityAmount ?ra ; wikibase:quantityUnit ?raUnit .
  ?item p:P6258 ?ds . ?ds psv:P6258 ?dv ; wikibase:rank ?decRank . ?dv wikibase:quantityAmount ?dec ; wikibase:quantityUnit ?decUnit .
  OPTIONAL { ?rs pq:P6259 ?raEpoch }
  OPTIONAL { ?ds pq:P6259 ?decEpoch }
}
```

  `types`:

```sparql
SELECT DISTINCT ?item ?class ?rank WHERE {
  <selection>
  ?item p:P31 ?ts . ?ts ps:P31 ?class ; wikibase:rank ?rank .
}
```

  `classes`:

```sparql
SELECT DISTINCT ?class ?kind WHERE {
  VALUES ?kind { wd:Q318 wd:Q42372 wd:Q13632 wd:Q207436 wd:Q11276 wd:Q11387 }
  ?class wdt:P279* ?kind .
}
```

  `magnitudes`:

```sparql
SELECT DISTINCT ?item ?mag ?rank WHERE {
  <selection>
  ?item p:P1215 ?ms . ?ms psv:P1215 ?mv ; wikibase:rank ?rank ; pq:P1227 wd:Q4892529 . ?mv wikibase:quantityAmount ?mag .
}
```

  `labels`:

```sparql
SELECT DISTINCT ?item ?label ?constellationLabel WHERE {
  <selection>
  OPTIONAL { ?item rdfs:label ?label . FILTER(LANG(?label) = "en") }
  OPTIONAL { ?item wdt:P59 ?constellation }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

  `aliases`:

```sparql
SELECT DISTINCT ?item ?alias WHERE {
  <selection>
  ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "en")
}
```

  `sizes`:

```sparql
SELECT DISTINCT ?item ?size ?unit ?rank WHERE {
  <selection>
  ?item p:P5348 ?ss . ?ss psv:P5348 ?sv ; wikibase:rank ?rank . ?sv wikibase:quantityAmount ?size ; wikibase:quantityUnit ?unit .
}
```

  - **Cross-check against NASA/IPAC NED** (https://ned.ipac.caltech.edu, object-name lookup at https://ned.ipac.caltech.edu/srs/ObjectLookup, read 2026-11-08, by `scripts/check-deep-sky-ned.py`). NED's page on acknowledging it (https://ned.ipac.caltech.edu/Documents/Overview/Acknowledgments) asks for: "This research has made use of the NASA/IPAC Extragalactic Database, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology." NED is used here as a check and for the positions below, which are facts about where an object is. Every one of the 110 Messier objects and of the 11,788 NGC and IC objects was looked up. All 110 Messier objects were found, 102 within 1 arc-minute of Wikidata's position (median 0.024', 95th percentile 1.05') and 8 over: M8, M24, M29, M34, M35, M45, M50 and M86, which are star clusters and nebulae whose centre is a matter of convention, except M86, which has two declinations 3 arc-minutes apart on Wikidata. Of the NGC and IC objects NED knew 11,599 (the other 189 are nearly all lettered parts such as NGC 602A): 11,057 (95.3 per cent) within 1 arc-minute (median 0.007', 95th percentile 0.90'), 10,183 within 6 arc-seconds, and 542 over 1 arc-minute, the worst IC 2888 at 5,857' (about 98 degrees: a wrong value on Wikidata), then NGC 3132 at 5,515', IC 1930 and IC 917 at over 3,000'. **Wherever Wikidata's position is more than 1 arc-minute from NED's, NED's is used** (550 positions, listed with Wikidata's own and the distance in `scripts/deep-sky-ned-positions.tsv`); after that none is over 1 arc-minute. The 189 that NED does not know keep Wikidata's position and are unchecked.
  - **Constellations of the Messier objects**: each is the constellation Wikidata names (P59). NASA HEASARC's Messier table (below) names the same constellation for every one of the 109 it lists, and in the test each Messier object lies within 35 degrees of a bright star of its constellation.
- **Messier magnitudes and sizes**: NASA's HEASARC Messier table (`heasarc_messier`, https://heasarc.gsfc.nasa.gov/W3Browse/general-catalog/messier.html, file https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_messier.tdat.gz, read 2026-11-08; a US government source), compiled from Table III of "Sky Catalog 2000.0, Volume 2" (Hirshfeld and Sinnott, Sky Publishing, 1985). The numbers used are a visual magnitude and a major axis in arc-minutes for each object, which are measurements, not expression. Wikidata's V magnitude for 14 Messier objects is more than a magnitude from it (the central star's for the planetary nebulae M27, M57, M76 and M97, and values more than a magnitude from HEASARC's for M10, M14, M19, M20, M22, M49, M71, M84, M88 and M91); HEASARC's value is used for all 108 it lists, Wikidata's for M73 and M102. A planetary nebula outside the Messier list gets no magnitude, for the same reason. HEASARC's size is used for the 107 Messier objects it gives one for (Wikidata has a size for only 6; M40, M73 and M102 have none).
  - **M102**: the table has no entry for it. HEASARC's page says: "M 102 is now generally considered to be spurious, and the object so named was actually M 101." Wikidata and the modern lists (and this table) take M102 to be the lenticular galaxy NGC 5866 in Draco; NED answers "M102" with M101, so M102 was compared with NED's NGC 5866 (0.01 arc-minutes apart). **M40** (Winnecke 4, a double star) and **M73** (four stars, NGC 6994) are listed by Messier and are in the table as `other`.

## Deliberately not used

- ESA's Hipparcos, Tycho and Gaia catalogues: CC BY-NC 3.0 IGO (non-commercial), which an MIT package cannot pass on.
- HYG, AT-HYG and OpenNGC: CC BY-SA 4.0, which would put share-alike terms on this package's data. The NGC and IC objects come from Wikidata (CC0) instead, and none of OpenNGC's data is used.
- Stellarium's sky-culture files: GPL.
- d3-celestial's data files: the code is BSD-3-Clause but the data licence is not stated.
