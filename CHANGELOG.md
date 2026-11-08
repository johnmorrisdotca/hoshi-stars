# Changelog

## [Unreleased]

- New entry point `@johnmorrisdotca/hoshi-stars/sky`: your sky. `horizontal` gives a star's altitude and azimuth (north through east) for a place and a moment, with optional refraction; also `isAboveHorizon`, `greenwichSiderealTime`, `localSiderealTime` and `precess` (J2000 to date). `horizontalFrom` does the same for a place on another planet from its IAU pole and prime meridian, passed in.
- New entry point `@johnmorrisdotca/hoshi-stars/constellations`: the 88 IAU constellations with abbreviation, Latin name and genitive, English name, and Japanese name (おおいぬ座) with its hiragana reading (`constellations`, `constellation`, `starsIn`).
- Map projections for star charts as their own import, `@johnmorrisdotca/hoshi-stars/projection`: `project` and `unproject` for stereographic, orthographic, gnomonic, azimuthal equidistant, equirectangular, Mollweide and Hammer-Aitoff (`hammer`), with the sky's east-left convention, `mirror`, `rotation` and `scale`.
- First version: the 5,080 stars of the Yale Bright Star Catalogue to magnitude 6.0 with names, positions, proper motion, distance and colour (`stars`, `starByHr`, `starByName`, `starPosition`, `starDistanceLightYears`, `starTemperatureK`, `blackBodyColour`, `starColour`). Moved unchanged from wakusei-planets' `/stars`.
