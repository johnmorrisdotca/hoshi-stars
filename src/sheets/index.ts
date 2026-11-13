// The printable sheets for children and hobbyists: connect-the-dots constellations, the constellations that suit a latitude, a star wheel (planisphere) to cut out and a sky map for each month. Pure: each is a string of SVG measured in millimetres,
// to put inside kazoku-ui's print sheet (the demo does), so the page's header, footer and QR code are not made here and this package has no runtime dependency.
export { DOT_LEVELS, DOT_LIMITS, dotsFigure, dotsSvg, dotsSubtitle, type Dot, type DotLevel, type DotsFigure } from "./dots.ts";
export { latitudeBand, monthName, skyForLatitude, whyFamous, type RegionEntry, type Standing } from "./region.ts";
export { starWheelDisc, starWheelPlate, starWheelPoster, WHEEL_LATITUDES } from "./wheel.ts";
export { skyMapSvg } from "./map.ts";
export { regionGuideSvg } from "./guide.ts";
