---
title: 自分の点を星図に置く
section: how-to
order: 14
description: "自分の日付つきの点を星図に置く方法です。観測の記録、彗星の通り道、見た星などを置けます。時間の範囲でその時にあった点だけを表示し、グループを日付順に線でつなぎ、クリックやEnterでどの点かを知らせます。データはページの外に出ません。"
---

[English](../sky-chart-markers.md)

ページは自分の点を星図に置けます。`<hoshi-chart>`でも`chartSvg`でも同じです。観測の記録、彗星の通り道、見た星、ゲームで訪れた場所などを置けます。点にはそれぞれ位置があり、必要なら日付、名前、色、大きさ、グループも付けられます。時間の範囲を指定すると、その範囲の日付の点だけが表示されるので、スライダーで記録を再生できます。点はあなたのページの中にとどまります。パッケージは点をメモリに持って描くだけで、どこにも送りません。

## 点（マーカー）

`SkyMarker`はただのオブジェクトです。

| 項目 | 意味 |
|---|---|
| `ra`、`dec` | 位置（度）。赤経は0から360、赤緯は-90から90（J2000）です。`ra`か`dec`が有限の数でない点は描きません。 |
| `date` | 日時です。ISO 8601の文字列（`2026-11-08T21:30:00Z`）、1970年からのミリ秒、または`Date`です。日付のない点は常に表示され、軌跡にはつながれません。 |
| `label` | 点のそばに書く名前です。名前は星図の文字配置の仕組みで置かれ、星や他の名前を避けます。置ける空きがない名前は省かれます（点は残ります）。 |
| `color` | CSSの色です（既定は`#ff8fb1`）。 |
| `size` | 点の幅（ピクセル）です（既定は9）。 |
| `group` | 点の所属です（`Comet`、`Observing log`など）。軌跡は1つのグループずつつなぎます。 |
| `id` | クリックしたときに知らせる名前です。省くと`m<リストの位置>`になります。 |

時刻のない日付（`2026-11-08`）は、JavaScriptの読み方どおり、UTCの真夜中として読まれます。閲覧する人の暦で日が大切なときは、時刻を付けてください。ゾーンを付けても（`2026-11-08T21:30:00Z`）、付けなくても（`2026-11-08T21:30:00`、閲覧する人の時刻）かまいません。

## ページの中で

`markers`はプロパティ（どんな配列でも、渡したまま保持します）か、`markers`属性（JSONの文字列）で設定します。`timeRange`はプロパティか、`time-from`、`time-to`、`time-fade`の属性で、`tracks`はプロパティか属性で設定します。最後に設定したものが優先されます。`hoshi-marker`は、点がクリック、タップされたとき、またはEnterかSpaceで選ばれたときに、どの点かを知らせます。

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

`hoshi-marker`は`ChartMarkerDetail`、つまり`{ marker, id, index, source }`を運びます。`marker`は渡したオブジェクトです（`markers`をプロパティで設定したときは同じオブジェクトです）。`index`はリストの中の位置で、`source`は、クリックやタップなら`pointer`、フォーカスのある点でEnterかSpaceを押したなら`key`です。点をクリックすると`hoshi-pick`ではなく`hoshi-marker`が送られ、ほかの場所のクリックは今までどおり星などを選びます。

| 属性またはプロパティ | 意味 |
|---|---|
| `markers` | 点です。配列（プロパティ）かJSONの文字列（属性）です。 |
| `timeRange` | `{ from, to, fade }`です。`from`から`to`まで（両端を含む）の日付の点を表示します。どちらも省けます。`time-from`、`time-to`、`time-fade`属性でも同じことを設定できます（数はミリ秒、それ以外の文字列はISOの日付として読みます）。`undefined`ならすべての点を表示します。 |
| `tracks` | `true`ですべてのグループをつなぎ、グループ名のリストならそれだけをつなぎます。属性では、空か`all`ですべてのグループ、名前をカンマで区切るとそれらのグループです。省くと何もつなぎません。 |

点はキーボードでも使えます。描かれた点はそれぞれ名前の付いたボタンで、渡した順の最初の40個はTabで移れ、EnterとSpaceで選べて、星図を描き直してもフォーカスはその点に残ります。どの点もクリックはできます。

## SVGの文字列として

`chartSvg`も同じ3つのオプション、`markers`、`timeRange`、`tracks`を受け取り、SVGに描きます。時計は読みません。範囲はいつも渡したものです。

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

## 時間の範囲とフェード

範囲は`{ from, to, fade? }`で、両端はISOの文字列、ミリ秒、または`Date`です。範囲の外の日付の点は描かれず、日付のない点は常に描かれます。`fade`は、点が範囲の端から現れてくる日数です。端では薄く、端から`fade`日の内側で濃くなります。これでスライダーがなめらかに見えます。窓が届くと点がふわっと現れ、窓が過ぎるとふわっと消えます。

`markerSpan(markers)`はリストの最初と最後の日付を返し、スライダーの範囲になります。`visibleMarkers(markers, range)`は範囲を通った点を、描く濃さ`opacity`と一緒に返します。`markerTracks(visible, tracks)`は日付順につないだグループを返し（点が1つのグループにはつなぐものがありません）、自分で一覧やカードを作るページで使えます。`markerTime(date)`は日付をミリ秒で読みます。

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

## 軌跡

`tracks`を指定すると、各グループは、リストの順番に関係なく、日付順に点を通る線でつながれます。線は隣り合う点のあいだを星図の上でまっすぐ引き、全天の図法の継ぎ目や空の裏側をまたぐところでは途切れます。日付のある点が1つだけのグループには線を引きません。範囲を狭めると線も点に合わせて短くなるので、窓を動かすと彗星の軌跡が伸びていきます。

## CSVとJSON

`markersToCsv(markers)`は点を、`id,ra,dec,date,label,color,size,group`の見出しのCSVで書き出し、`markersFromCsv(text)`はそれを読み戻します。列の順は自由で、必要なのは`ra`と`dec`だけです。読めない行は捨てます。`normaliseMarkers(list)`は`JSON.parse`で得たリストを同じように整えます。数字の文字列は数になり、赤経は0以上360未満に巻き戻され、赤緯は-90から90に収められます。

```js
import { markersFromCsv, markersToCsv, normaliseMarkers } from "@johnmorrisdotca/hoshi-stars/chart";

const csv = markersToCsv([{ ra: 83.82, dec: -5.39, date: "2026-11-08T21:30:00Z", label: "M42, Orion Nebula" }]);
console.log(markersFromCsv(csv)[0].label, normaliseMarkers(JSON.parse('[{"ra":"370","dec":12}]'))[0].ra);
// M42, Orion Nebula 10
```

## デモ

[デモのマーカーのページ](https://johnmorrisdotca.github.io/hoshi-stars/markers.html)は、ここまでをまとめたものです。見本（ある数日の夕方に見た星と、彗星の通り道。通り道は作ったもので、実在の彗星の軌道ではありません）、表示する日を選ぶ2つのつまみのスライダー、再生と一時停止、選んだ点のカード、CSVとJSONの読み込みと書き出しがあります。表示する日時は、閲覧する人自身の時刻です。このページ自身は通信をせず、読み込んだファイルはページの中で読むだけで、外には出ません。
