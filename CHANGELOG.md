# Changelog

## [Unreleased]

- Map projections for star charts as their own import, `@johnmorrisdotca/hoshi-stars/projection`: `project` and `unproject` for stereographic, orthographic, gnomonic, azimuthal equidistant, equirectangular, Mollweide and Hammer-Aitoff (`hammer`), with the sky's east-left convention, `mirror`, `rotation` and `scale`.
- First version: the 5,080 stars of the Yale Bright Star Catalogue to magnitude 6.0 with names, positions, proper motion, distance and colour (`stars`, `starByHr`, `starByName`, `starPosition`, `starDistanceLightYears`, `starTemperatureK`, `blackBodyColour`, `starColour`). Moved unchanged from wakusei-planets' `/stars`.
