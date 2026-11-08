# Changelog

## [Unreleased]

- New entry point `@johnmorrisdotca/hoshi-stars/boundaries`: `constellationAt` says which of the 88 constellations a J2000 (or of-date) position is in, and `boundaryOf` and `boundaries` give the IAU boundaries as closed J2000 outlines to draw, with a point at least every degree along each edge. From N. G. Roman's table of Delporte's boundaries (VizieR VI/42), precessed to B1875.0; 8 of 8 of Roman's own test positions and all 2,736 bright stars that name a constellation agree.
- New entry point `@johnmorrisdotca/hoshi-stars/constellations`: the 88 IAU constellations with abbreviation, Latin name and genitive, English name, and Japanese name (おおいぬ座) with its hiragana reading (`constellations`, `constellation`, `starsIn`).
- Map projections for star charts as their own import, `@johnmorrisdotca/hoshi-stars/projection`: `project` and `unproject` for stereographic, orthographic, gnomonic, azimuthal equidistant, equirectangular, Mollweide and Hammer-Aitoff (`hammer`), with the sky's east-left convention, `mirror`, `rotation` and `scale`.
- First version: the 5,080 stars of the Yale Bright Star Catalogue to magnitude 6.0 with names, positions, proper motion, distance and colour (`stars`, `starByHr`, `starByName`, `starPosition`, `starDistanceLightYears`, `starTemperatureK`, `blackBodyColour`, `starColour`). Moved unchanged from wakusei-planets' `/stars`.
