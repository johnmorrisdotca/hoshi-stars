// "My sky": the sky as someone standing outside sees it, at a place and a moment: the maths (the turn from the stars to your horizon, the Sun, the Moon's place, shape, rise and set, the five bright planets, and the camera of a view that
// looks round and up). Pure: no DOM and no clock. The element that draws it is `@johnmorrisdotca/hoshi-stars/my-sky/element` (`<hoshi-my-sky>`, defined by `/my-sky/define`).
export { paintBackground, skyColours } from "./background.ts";
export { altitudeAzimuth, localFrame, type Direction, type LocalFrame } from "./frame.ts";
export { moonHorizontal, moonPhase, moonPosition, moonRiseSet, type MoonPhase, type MoonPhaseName, type MoonPosition } from "./moon.ts";
export { limitingMagnitude, skyReport, type MoonInSky, type PlanetInSky, type SkyReport } from "./report.ts";
export { NAKED_EYE_PLANETS, planetPlaces, type NakedEyePlanet, type PlanetPlace } from "./planets.ts";
export { sunPlace } from "./sun.ts";
export { cameraAxes, clampView, degreesPerPixel, directionAt, FOV_MAX, FOV_MIN, openingHeading, PITCH_MAX, PITCH_MIN, projectDirection, viewScale, type CameraAxes, type ScreenSpot, type SkyCamera } from "./view.ts";
export { COMPASS, compassPoint, mySkyWords, say, type CompassPoint, type MySkyLanguage, type MySkyWords } from "./words.ts";
