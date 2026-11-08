# Notice

Hoshi Stars is original work by John Morris, under the MIT licence in `LICENSE`.

## The stars

- **Bright stars (`@johnmorrisdotca/hoshi-stars`)**: the Yale Bright Star Catalogue, D. Hoffleit and W. H. Warren Jr. (1991), "The Bright Star Catalogue, 5th Revised Edition (Preliminary Version)", Astronomical Data Center (NASA Goddard Space Flight Center) and the Centre de Données astronomiques de Strasbourg, catalogue V/50 (https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50, read through the VizieR mirror at Harvard 2026-11-07), the 5,080 stars to visual magnitude 6.0, written out as numbers by `scripts/make-star-data.py` into `src/data/stars.ts`. The catalogue's own documentation calls it public domain and the Astronomical Data Center asks that it and the authors be acknowledged, which this line does; there is no formal licence text, so this footing is informal.
- **Star names**: our own list after the IAU Working Group on Star Names (https://www.iau.org/science/scientific_bodies/working_groups/280/).
- **Star colour**: Ballesteros's B-V to temperature relation (F. J. Ballesteros 2012, EPL 97, 34008) and a piecewise black-body colour fit.

## The constellations

- **Constellations (`@johnmorrisdotca/hoshi-stars/constellations`)**: facts typed from published lists, in our own table (`src/data/constellations.ts`), with no artwork, lines or boundaries.
  - The 88 constellations, their three-letter abbreviations, Latin names, Latin genitives and English names: the International Astronomical Union's constellation list (https://www.iau.org/public/themes/constellations/). That address returned 404 on 2026-11-08, so the table was read on 2026-11-08 from a 2013 copy of the same IAU page ("The Constellations | IAU") kept at zfelleg.useribm.hu, and every Latin name, genitive and English name was checked against the text of that copy. Two spellings are ours: "Berenice's Hair" for Coma Berenices (the copy has "the Bernice's Hair") and "Hercules" for the constellation (the copy has "the Hercules"); the leading "the" of the English names is left off.
  - The Japanese names: the National Astronomical Observatory of Japan, Ephemeris Computation Office, "星座の名前" (Constellation names; https://eco.mtk.nao.ac.jp/koyomi/faq/constellations.html), read 2026-11-08. It gives the abbreviation, the name in kana and the Latin name of all 88, and every abbreviation and Latin name matched the IAU table. The hiragana reading is worked out from that kana form in code.
  - No Wikipedia text is used.

## Deliberately not used

- ESA's Hipparcos, Tycho and Gaia catalogues: CC BY-NC 3.0 IGO (non-commercial), which an MIT package cannot pass on.
- HYG, AT-HYG and OpenNGC: CC BY-SA 4.0, which would put share-alike terms on this package's data.
- Stellarium's sky-culture files: GPL.
- d3-celestial's data files: the code is BSD-3-Clause but the data licence is not stated.
