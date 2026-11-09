// The entry point: the bright stars. Constellations, deep-sky objects and charts will be their own entry points, so a page pays only for what it imports.
export { blackBodyColour, starByHr, starByName, starColour, starDistance, starDistanceLightYears, starPosition, starTemperatureK, stars, type Star, type StarDistance } from "./stars.ts";
export { luminosityClass, type LuminosityClass } from "./spectral.ts";
export type { When } from "./when.ts";
