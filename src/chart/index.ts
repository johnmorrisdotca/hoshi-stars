// The sky chart, published: `chartSvg` draws it as one SVG string with no DOM and no clock, for a server, a build, a print or a page that runs no script element. The element is
// `@johnmorrisdotca/hoshi-stars/chart/element` (defined by `/chart/define`). Only the bright catalogue is drawn; nothing is fetched.
export { CHART_LAYERS, chartSvg, type ChartLayer, type ChartSvgOptions } from "./svg.ts";
