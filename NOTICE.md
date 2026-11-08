# Notice

Hoshi Stars is original work by John Morris, under the MIT licence in `LICENSE`.

## The stars

- **Bright stars (`@johnmorrisdotca/hoshi-stars`)**: the Yale Bright Star Catalogue, D. Hoffleit and W. H. Warren Jr. (1991), "The Bright Star Catalogue, 5th Revised Edition (Preliminary Version)", Astronomical Data Center (NASA Goddard Space Flight Center) and the Centre de Données astronomiques de Strasbourg, catalogue V/50 (https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50, read through the VizieR mirror at Harvard 2026-11-07), the 5,080 stars to visual magnitude 6.0, written out as numbers by `scripts/make-star-data.py` into `src/data/stars.ts`. The catalogue's own documentation calls it public domain and the Astronomical Data Center asks that it and the authors be acknowledged, which this line does; there is no formal licence text, so this footing is informal.
- **Star names**: our own list after the IAU Working Group on Star Names (https://www.iau.org/science/scientific_bodies/working_groups/280/).
- **Star colour**: Ballesteros's B-V to temperature relation (F. J. Ballesteros 2012, EPL 97, 34008) and a piecewise black-body colour fit.

## The map projections

- **Projections (`@johnmorrisdotca/hoshi-stars/projection`)**: stereographic, orthographic, gnomonic, azimuthal equidistant, equirectangular, Mollweide and Hammer, written from the formulas in J. P. Snyder, "Map Projections: A Working Manual", U.S. Geological Survey Professional Paper 1395 (1987), a U.S. Government work in the public domain. The formulas are mathematics; no library's code is copied.

## Deliberately not used

- ESA's Hipparcos, Tycho and Gaia catalogues: CC BY-NC 3.0 IGO (non-commercial), which an MIT package cannot pass on.
- HYG, AT-HYG and OpenNGC: CC BY-SA 4.0, which would put share-alike terms on this package's data.
- Stellarium's sky-culture files: GPL.
- d3-celestial's data files: the code is BSD-3-Clause but the data licence is not stated.
