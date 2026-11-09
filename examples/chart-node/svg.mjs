import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chartSvg, loadChartData } from "@johnmorrisdotca/hoshi-stars/chart";

// A server draws the same chart a browser does: read the data of the layers once, then the string is pure.
const options = { width: 640, height: 480, projection: "mollweide", zoom: 1, layers: ["milky-way", "lines", "names"], lang: "ja" };
await loadChartData(options);
const svg = chartSvg(options);
writeFileSync(join(tmpdir(), "hoshi-chart.svg"), svg);
console.log("hoshi-chart.svg", svg.includes("オリオン座"));
