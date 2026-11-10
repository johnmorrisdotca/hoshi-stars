---
title: 星図
section: how-to
order: 5
description: 7種類の図法で、星、星座の線、境界を平らな図に置き、図の上の点を空の位置に戻す方法です。
---

[English](../sky-charts.md)

パッケージが返すのは星図の数値と計算で、描くのはあなたです（SVG、キャンバス、印刷など）。[デモ](https://johnmorrisdotca.github.io/hoshi-stars/)がその一例で、ソースはリポジトリの`demo/chart.ts`です。

## 7種類の図法

`/projection`には、`stereographic`、`orthographic`、`gnomonic`、`equidistant`、`equirectangular`、`mollweide`、`hammer`があります。`project(kind, point, { centre, scale })`は空の点の図上の位置を返し、`unproject`はその逆です。

```js
import { project, unproject } from "@johnmorrisdotca/hoshi-stars/projection";

const options = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };
const betelgeuse = { rightAscension: 88.79, declination: 7.41 };
const at = project("stereographic", betelgeuse, options);
console.log(at.x < 0, at.y > 0);
console.log(unproject("stereographic", at, options).declination.toFixed(2));
// true true
// 7.41
```

星図は、空を見上げた姿です。北が上で、東が左なので、赤経が大きいほど`x`は小さくなります。`y`は図の上向きなので、画面に描くときは上下を逆にします（`200 - at.y`）。見えない側の点は`undefined`になります。`orthographic`と`gnomonic`の裏側の半球と、`stereographic`の対蹠点です。`mirror: true`にすると、東が右の地図の向きになり、`rotation`で図を回せます。

## SVGの星図

```js
import { starColour, stars } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

const view = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };
const place = (star) => {
  const at = project("stereographic", star, view);
  return at && { x: 200 + at.x, y: 200 - at.y };
};

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Orion"><rect width="400" height="400" fill="#0b1020"/>`;
for (const [a, b] of figureOf("Ori").segments) {
  const from = place(a);
  const to = place(b);
  if (from && to) svg += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#6f93e0"/>`;
}
for (const star of stars({ magnitude: 4 })) {
  const at = place(star);
  if (at) svg += `<circle cx="${at.x}" cy="${at.y}" r="${Math.max(1, 4.2 - star.magnitude * 0.7)}" fill="${starColour(star)}"/>`;
}
console.log((svg + "</svg>").length > 1000);
// true
```

これで全部です。[HTMLとCDN](html-and-cdn.md)、[バンドラー](bundlers.md)、[フレームワーク](frameworks.md)が、同じ絵をページに入れます。

## 天の川

`/milky-way`は、星の数と塵の地図から作った天の川の小さな明るさの地図です（数値は約11 kB）。いて座の方向の明るい中心部と、暗い塵の帯（グレート・リフト、石炭袋、はくちょう座の暗黒帯）が、暗い場所として入っています。`milkyWayBrightness(point)`は、空の点の明るさを0（暗い空）から1（中心部）で返します。`milkyWayBands(levels)`は、地図を明るさのレベルごとに空の点の帯に切り分けます。星の下に、やわらかい帯として塗ることができます。

```js
import { milkyWayBands, milkyWayBrightness } from "@johnmorrisdotca/hoshi-stars/milky-way";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

const core = milkyWayBrightness({ rightAscension: 266.4, declination: -28.9 });
const pole = milkyWayBrightness({ rightAscension: 192.9, declination: 27.1 });
console.log(core > pole);

let paths = "";
for (const band of milkyWayBands([0.15, 0.35, 0.6])) {
  for (const strip of band.strips) {
    const edge = [...strip.upper, ...strip.lower.slice().reverse()].map((p) => project("hammer", p, { centre: { rightAscension: 0, declination: 0 }, scale: 100 }));
    if (edge.every(Boolean)) paths += `<path d="M${edge.map((p) => `${200 + p.x} ${150 - p.y}`).join("L")}Z" fill="#9fb0e6" fill-opacity=".2"/>`;
  }
}
console.log(paths.length > 1000);
// true
// true
```

1本の帯（strip）は、`upper`を順に、`lower`を逆順につないだ多角形です。レベルごとに低い不透明度で重ねて塗り、グループを少しぼかすと、やわらかい縁になります。`equirectangular`、`mollweide`、`hammer`の継ぎ目をまたぐ帯や、半球の裏側に届く帯は、自分で切る必要があります（デモの`demo/chart.ts`にある`milkyWay`が例です）。デモの「天の川」ボタンでこの層を入れたり切ったりでき、`layers=milky`はアドレスにも埋め込みページにも使えます。星図はいつも夜空なので、明るいページでも暗いページでも、暗い地の上に淡い色で描きます。

格子は銀経1度×銀緯0.5度で32段階です。測定値ではなく、陰影をつけるための地図です。`toGalactic`と`fromGalactic`は、赤経・赤緯と銀経・銀緯を相互に変換します。データの出どころは[データとライセンス](data-and-licences.md)にあります。

## 決めておくこと

- **広い星図。** `equirectangular`、`mollweide`、`hammer`の星図には、赤経が折り返す継ぎ目があります。反対側の2つの星を結ぶ線は、図全体を横切ってしまいます。両端が図の半分より離れた線は描かないでください。
- **拡大と縮尺。** `scale`は、空の半径をあなたの単位で表したものです。指の下の空が動くドラッグにするには、`unproject`でポインターの位置の空を聞き、新しい位置との差を使います（デモはそうしています）。デモの拡大は0.1〜8000で、1は図法そのままの大きさ（空全体、または半球）です。0.1では空全体が中央の小さな塊になり、これ以上小さくしても意味がないので下限にしています。上限はこれまで500（デスクトップ幅の図が約0.7度の幅で、ミザールとアルコル、角距離12分角がまだ2つの星に見える）でしたが、今は8000です。写真のある天体のうち最も小さい環状星雲（M57。パッケージの表では幅1分角）から決めました。図の1分角のピクセル数は、図の短いほうの辺 × 0.000073 × 拡大率なので、8000では、図の大きさによらず環状星雲が短いほうの辺の約58%を占め、図の幅は約3分角になります。写真は、その写真自身のピクセルより大きくは描きません。拡大の中心の空に写真があるときは、そこにある最も細かい写真の1ピクセルが図の1ピクセルになるところでデモは拡大を止め（`demo/chart.ts`の`pictureZoomCap`）、縮小はそこから始まります。サーベイの写真（1ピクセルが1〜3秒角）は約300〜2,000で止まり（M31は約300、M91は約600〜1,000、M51は約2,000。図の大きさによります）、環状星雲のハッブルの写真（1ピクセルが0.16秒角）は約7,000〜8,000まで拡大できます。200あたりを超えると、暗い星はそれ以上増えません。UCAC4の星は12等までしかなく、どこまで暗い星を描くかの決まりも、そこで上限に達するからです。それ以上拡大しても、同じ星の小さな一部が見えるだけで、読み込むタイルも同じです。画面の外まで長く伸びる線にも注意してください。20度離れた2つの星を結ぶ線は、500倍では24,000ピクセル、8000倍では約380,000ピクセルの長さになります。端の点が遠いかどうかではなく、図を横切るかどうかで描くか決めます。
- **操作。** デモと埋め込みページは、ファミリー共通の表示コントローラー（`@johnmorrisdotca/kazoku-ui/view-controls`）を使っています。ドラッグで星空を回し、2本指のピンチ、またはCtrl（Mac ではCommand）キーを押しながらホイールで、ポインターを中心に拡大します。図にフォーカスがあるときは、`+`、`-`、矢印キー、`0`も使えます。開いた直後の大きさではホイールはページをスクロールし、拡大したあとは星空を動かします。
- **どの星を描くか。** `stars({ magnitude })`で、いちばん暗い星を決めます。図が小さいときは少なく、拡大したら多く描きます。デモのスライダーは2〜6です。
- **今夜の空。** `/sky`は、場所と時刻から高度と方位を返します（屈折の補正も選べます）。頭上の空の星図には`horizontal`、ほかの惑星には`horizontalFrom`を使います。
- **タップした星座。** タップを`unproject`して、`constellationAt`に聞きます。
