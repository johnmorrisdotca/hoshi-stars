import { writeFileSync } from "node:fs";
import { chartSvg, markerSpan } from "@johnmorrisdotca/hoshi-stars/chart";

// A comet's track and an observing log: where (right ascension and declination, in degrees) and when.
const markers = [
  { id: "c1", ra: 62, dec: 22, date: "2026-11-01T21:00:00Z", label: "Comet, 1 Nov", group: "Comet", color: "#ff8fb1" },
  { id: "c2", ra: 70, dec: 18, date: "2026-11-04T21:00:00Z", group: "Comet", color: "#ff8fb1" },
  { id: "c3", ra: 79, dec: 13, date: "2026-11-07T21:00:00Z", label: "Comet, 7 Nov", group: "Comet", color: "#ff8fb1" },
  { id: "m42", ra: 83.82, dec: -5.39, date: "2026-11-05T20:30:00Z", label: "M42 with binoculars", group: "Log" },
];

// The first five days of November only, with the comet joined by a line.
const svg = chartSvg({ width: 640, height: 400, ra: 75, dec: 8, zoom: 5, markers, tracks: ["Comet"], timeRange: { from: "2026-11-01", to: "2026-11-05T23:59:59Z" } });
writeFileSync(new URL("november.svg", import.meta.url), svg);

const span = markerSpan(markers);
console.log("november.svg", (svg.match(/data-marker=/g) ?? []).length, "markers,", (svg.match(/data-track=/g) ?? []).length, "track,", (span.to - span.from) / 86_400_000, "days");
// november.svg 3 markers, 1 track, 6 days
