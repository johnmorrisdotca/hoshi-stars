---
title: Your own points on the chart
section: how-to
order: 14
description: "Put your own dated points on the sky chart: an observing log, a comet's track, the stars you have seen. A time range shows only what was there when, a track joins a group in date order, a click or Enter says which point, and the data never leaves the page."
---

[日本語](ja/sky-chart-markers.md)

A page can add its own points to the sky chart, `<hoshi-chart>` and `chartSvg` alike: an observing log, a comet's track, the stars you have seen, the places a game has been. Each point has a place and, if you like, a date, a name, a colour, a size and a group. A time range shows only the points dated inside it, so a slider can play a log back. The points stay in your page: the package keeps them in memory, draws them, and sends nothing anywhere.

## A marker

`SkyMarker` is a plain object:

| Field | Means |
|---|---|
| `ra`, `dec` | Where, in degrees: right ascension 0 to 360 and declination -90 to 90 (J2000). A point whose `ra` or `dec` is not a finite number is not drawn. |
| `date` | When: an ISO 8601 text (`2026-11-08T21:30:00Z`), milliseconds since 1970 or a `Date`. A point with no date is always shown and is never joined into a track. |
| `label` | The name written beside the point. Names are placed with the chart's own label placer: clear of the stars and of each other, and a name that finds no free place is left out (the point stays). |
| `color` | Any CSS colour (`#ff8fb1` by default). |
| `size` | The dot's width in pixels (9 by default). |
| `group` | What it belongs to (`Comet`, `Observing log`). A track joins one group at a time. |
| `id` | What a click says it was; `m<position in the list>` when left out. |

A date with no time (`2026-11-08`) is read the way JavaScript reads it, as midnight UTC. Give a time, with a zone (`2026-11-08T21:30:00Z`) or without (`2026-11-08T21:30:00`, the reader's own), when the day matters in the reader's calendar.

## In a page

Set `markers` as a property (any array, kept as you gave it) or as the `markers` attribute (JSON text), `timeRange` as a property or with `time-from`, `time-to` and `time-fade`, and `tracks` as a property or an attribute. The last one set wins. `hoshi-marker` says which point was clicked, tapped, or chosen with Enter or Space.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My observing log on the chart</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/chart/define/+esm"></script>
  </head>
  <body>
    <hoshi-chart ra="84" dec="0" zoom="4" layers="milky lines names" tracks="all" style="max-width: 640px"></hoshi-chart>
    <input id="day" type="range" min="1" max="9" value="9" aria-label="Last day shown" />
    <p id="card">Click a point, or Tab to one and press Enter.</p>
    <script type="module">
      const chart = document.querySelector("hoshi-chart");
      chart.markers = [
        { id: "first", ra: 80, dec: 0, date: "2026-11-01T20:00:00Z", label: "First night" },
        { id: "second", ra: 84, dec: 0, date: "2026-11-05T20:00:00Z", label: "Second night" },
        { id: "third", ra: 88, dec: 3, date: "2026-11-09T20:00:00Z", label: "Third night" },
      ];
      chart.addEventListener("hoshi-marker", (event) => {
        const { marker, source } = event.detail;
        document.getElementById("card").textContent = `${marker.label}, ${new Date(marker.date).toUTCString()} (${source})`;
      });
      document.getElementById("day").addEventListener("input", (event) => {
        chart.timeRange = { to: `2026-11-${String(event.target.value).padStart(2, "0")}T23:59:59Z` };
      });
    </script>
  </body>
</html>
```

`hoshi-marker` carries `ChartMarkerDetail`: `{ marker, id, index, source }`. `marker` is the object you gave (the same one when `markers` was set as a property), `index` its place in the list, and `source` is `pointer` for a click or a tap and `key` for Enter or Space on a point that has the focus. A click on a point sends `hoshi-marker` and not `hoshi-pick`; a click anywhere else picks as before.

| Attribute or property | Means |
|---|---|
| `markers` | The points: an array (property) or JSON text (attribute). |
| `timeRange` | `{ from, to, fade }`: show the points dated from `from` to `to`, ends included; either may be left out. The attributes `time-from`, `time-to` and `time-fade` set the same (a number is milliseconds, any other text an ISO date). `undefined` shows every point. |
| `tracks` | `true` joins every group, or a list of group names; as an attribute, empty or `all` for every group, or names separated by commas. Nothing is joined when left out. |

The points are for a keyboard too: each one drawn is a button with its name, the first 40 in the order given are reached with Tab, Enter and Space choose one, and the focus stays on it when the chart redraws. Every point can still be clicked.

## As one SVG string

`chartSvg` takes the same three options, `markers`, `timeRange` and `tracks`, and draws them in the SVG. It reads no clock: the range is always the one you give.

```js
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
```

## Time ranges and fades

A range is `{ from, to, fade? }` with each end an ISO text, milliseconds or a `Date`. A point dated outside it is not drawn, a point with no date always is. `fade` is a number of days over which a point comes in from an edge: at the edge it is faint, `fade` days inside it is full. It makes a slider look smooth: a point eases in as the window reaches it and out as the window passes.

`markerSpan(markers)` gives the first and last date of a list, which is what a slider spans. `visibleMarkers(markers, range)` gives what a range lets through, each with the `opacity` it is drawn at, and `markerTracks(visible, tracks)` gives the groups joined in date order (a group of one has nothing to join), for a page that draws its own list or card of them. `markerTime(date)` reads a date in milliseconds.

```js
import { markerSpan, markerTime, markerTracks, visibleMarkers } from "@johnmorrisdotca/hoshi-stars/chart";

const log = [
  { id: "late", ra: 30, dec: 10, date: "2026-11-03", group: "Comet" },
  { id: "early", ra: 10, dec: 5, date: "2026-11-01", group: "Comet" },
  { id: "undated", ra: 90, dec: 0 },
];
const shown = visibleMarkers(log, { from: "2026-11-02" });
console.log(shown.map((m) => m.id), markerTracks(visibleMarkers(log), true)[0].items.map((m) => m.id));
console.log(markerSpan(log).to - markerSpan(log).from === 2 * 86_400_000, markerTime("2026-11-01") === Date.UTC(2026, 10, 1));
// [ 'late', 'undated' ] [ 'early', 'late' ]
// true true
```

## Tracks

With `tracks`, each group is joined by a line through its points in date order, whatever order the list was given in. A line runs straight on the chart between neighbours, and is broken where it would cross a whole-sky projection's seam or the far side of the sky. A group of one dated point draws no line, and a range shortens the line with the points: the track of a comet grows as the window moves along.

## CSV and JSON

`markersToCsv(markers)` writes the points as CSV with the header `id,ra,dec,date,label,color,size,group`, and `markersFromCsv(text)` reads it back. The columns may come in any order, only `ra` and `dec` are needed, and a row that cannot be read is dropped. `normaliseMarkers(list)` does the same cleaning for a list from `JSON.parse`: numeric text becomes numbers, right ascension is wrapped into 0 up to 360 and declination held to -90 to 90.

```js
import { markersFromCsv, markersToCsv, normaliseMarkers } from "@johnmorrisdotca/hoshi-stars/chart";

const csv = markersToCsv([{ ra: 83.82, dec: -5.39, date: "2026-11-08T21:30:00Z", label: "M42, Orion Nebula" }]);
console.log(markersFromCsv(csv)[0].label, normaliseMarkers(JSON.parse('[{"ra":"370","dec":12}]'))[0].ra);
// M42, Orion Nebula 10
```

## The demo

[The markers page of the demo](https://johnmorrisdotca.github.io/hoshi-stars/markers.html) puts it together: a sample (stars seen on some evenings, and a comet's path that is invented, not any comet's orbit), a slider with two handles for the days shown, Play and Pause, a card for the point you choose, and import and export as CSV or JSON. The dates it shows are the reader's own. It makes no network request of its own: your file is read in the page and stays there.
