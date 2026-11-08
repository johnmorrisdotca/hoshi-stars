# Changelog

## [Unreleased]

- New entry point `@johnmorrisdotca/hoshi-stars/constellations`: the 88 IAU constellations with abbreviation, Latin name and genitive, English name, and Japanese name (おおいぬ座) with its hiragana reading (`constellations`, `constellation`, `starsIn`).
- Map projections for star charts as their own import, `@johnmorrisdotca/hoshi-stars/projection`: `project` and `unproject` for stereographic, orthographic, gnomonic, azimuthal equidistant, equirectangular, Mollweide and Hammer-Aitoff (`hammer`), with the sky's east-left convention, `mirror`, `rotation` and `scale`.
- First version: the 5,080 stars of the Yale Bright Star Catalogue to magnitude 6.0 with names, positions, proper motion, distance and colour (`stars`, `starByHr`, `starByName`, `starPosition`, `starDistanceLightYears`, `starTemperatureK`, `blackBodyColour`, `starColour`). Moved unchanged from wakusei-planets' `/stars`.
