// The chart entry point (`@johnmorrisdotca/hoshi-stars/chart`): `<hoshi-chart>`, the sky chart as a web component with the family's hands, and `chartSvg`, the same chart as a string for a page that runs no element.
// The stars, the constellation lines and names are in it; the boundaries, the Messier objects, the Milky Way and the nearby table are separate files that come in only when a layer asks for them.
export { HoshiChart, type PickDetail, type ViewChangeDetail } from "./chart/element.ts";
export { chartSvg, type ChartSvgOptions } from "./chart/svg.ts";
export { loadChartData, type LayerName } from "./chart/data.ts";
export { defaultZoom, fromScreen, toScreen, ZOOM_MAX, ZOOM_MIN, type Hit, type View } from "./chart/draw.ts";
