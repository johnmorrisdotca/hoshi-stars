---
title: 惑星と月を星図に置く
section: how-to
order: 15
description: "ページが渡す単純なリストから、月と惑星を星図に置く方法です。それぞれ等級に応じて描かれ、月は満ち欠けの形で描かれ、英語か日本語の名前が付き、タップするとどれかが分かり、任意で太陽の年間の通り道（黄道）も描けます。"
---

[English](../sky-chart-bodies.md)

ページは、月、惑星、そのほか自分で位置を求めた天体を星図に置けます。`<hoshi-chart>`でも`chartSvg`でも同じです。このパッケージは位置を計算せず、計算するパッケージも読み込みません。**各天体の位置はページ側で求め**（好きな暦のライブラリでも自分の計算でもかまいません）、星図には単純なリストを渡します。星図は、各天体をその空の位置に、等級に応じた大きさで描き、星図の言語で名前を付け、月は満ち欠けの形で描きます。

## 天体

`SkyBody`はただのオブジェクトで、どの項目もあなたが与えます。

| 項目 | 意味 |
|---|---|
| `id` | タップしたときに知らせる名前です。月は`moon`で、満ち欠けのある円盤として描かれます。 |
| `names` | `{ en, ja }`: そばに書く名前（英語と日本語）です。星図の言語で選ばれ、片方がなければもう一方を使います。 |
| `ra`、`dec` | 位置（度）です。赤経は0から360、赤緯は-90から90で、星と同じJ2000の座標です。数が有限でない天体は描きません。 |
| `magnitude` | 見かけの視等級です。明るいほど大きく描かれ、-4.6等まで大きくなります（金星はシリウスより大きく描かれます）。その拡大率で星図が描く最も暗い星（開いたときの拡大で5等、拡大が10倍になるごとに2.5等ずつ暗く）より暗い天体は省かれます。月は省かれません。 |
| `phase` | 円盤の光っている割合で、0（新月）から1（満月、または満ち欠けを見せない惑星）です。範囲の外の値はその範囲に収めます。 |
| `brightLimb` | 省略できます。光っている側の向きで、明るい縁の中央の位置角を、天の北から東回りに度で表します（天文年鑑の約束です）。省くと、光っている側は星図の右側です。 |
| `size` | 省略できます。見かけの直径（秒角）です。省くと、等級に応じた大きさの点になります。与えると、点より大きい場合は本来の大きさの円盤で描き、幅が4ピクセル以上の円盤は満ち欠けを見せます。 |

月は常に円盤で、本来の大きさがもっと小さくても幅は7ピクセル以上にし、広い星図でも満ち欠けが見えるようにします。光る部分は半月より小さければ三日月、大きければ凸月の形で、明るい縁の向きに回して描きます。

## ページの中で

`bodies`はプロパティ（配列で、属性のリストと同じ整理をします。「リストを整える」を参照）か、`bodies`属性（JSONの文字列）で設定します。最後に設定したものが優先されます。天体をタップすると、`kind`が`body`で、その`id`と`names`を持つ`hoshi-pick`が届きます。黄道は層です。`layers`に`ecliptic`を加えてください。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Moon and a planet on the chart</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/chart/define/+esm"></script>
  </head>
  <body>
    <hoshi-chart projection="equirectangular" ra="230" dec="-15" zoom="1.5" layers="milky lines names ecliptic" style="max-width: 640px"></hoshi-chart>
    <label><input id="line" type="checkbox" checked /> Ecliptic</label>
    <p id="card">Tap the Moon or Venus.</p>
    <script type="module">
      const chart = document.querySelector("hoshi-chart");
      chart.bodies = [
        { id: "moon", names: { en: "Moon", ja: "月" }, ra: 258.14, dec: -27.57, magnitude: -6.9, phase: 0.07, brightLimb: 282.5, size: 1773 },
        { id: "venus", names: { en: "Venus", ja: "金星" }, ra: 200.07, dec: -10.76, magnitude: -4.5, phase: 0.11 },
      ];
      chart.addEventListener("hoshi-pick", (event) => {
        const { kind, id, names } = event.detail;
        if (kind === "body") document.getElementById("card").textContent = `${names.en} (${names.ja}), ${id}`;
      });
      document.getElementById("line").addEventListener("change", (event) => {
        chart.setAttribute("layers", event.target.checked ? "milky lines names ecliptic" : "milky lines names");
      });
    </script>
  </body>
</html>
```

`hoshi-pick`は`ChartPick`を運びます。天体なら`{ kind: "body", id, names }`です。ほかの場所をタップしたときは、これまでどおり選びます。

| 属性またはプロパティ | 意味 |
|---|---|
| `bodies` | 天体のリストです。配列（プロパティ）かJSONの文字列（属性）です。 |
| `layers` | `ecliptic`を含めると、太陽の年間の通り道である黄道を破線で描きます。 |

静止しているときは何も描きません。リスト、層、視点が変わったときだけ、もう一度描きます。

## 1つのSVG文字列として

`chartSvg`も同じ`bodies`オプションを受け取り、黄道には`layers: ["ecliptic"]`を使います。時計は読みません。

```js
import { writeFileSync } from "node:fs";
import { chartSvg } from "@johnmorrisdotca/hoshi-stars/chart";

// The Moon and a planet as your own code worked them out: where (right ascension and declination, in degrees), how bright, and how much is lit.
const bodies = [
  { id: "moon", names: { en: "Moon", ja: "月" }, ra: 258.14, dec: -27.57, magnitude: -6.9, phase: 0.07, brightLimb: 282.5, size: 1773 },
  { id: "venus", names: { en: "Venus", ja: "金星" }, ra: 200.07, dec: -10.76, magnitude: -4.5, phase: 0.11 },
];

// A wide view with the Sun's yearly path, the ecliptic, drawn dashed under them.
const svg = chartSvg({ width: 640, height: 400, projection: "equirectangular", ra: 230, dec: -15, zoom: 1.5, layers: ["milky", "lines", "names", "ecliptic"], bodies });
writeFileSync(new URL("planets.svg", import.meta.url), svg);

console.log("planets.svg", (svg.match(/data-body=/g) ?? []).length, "bodies,", svg.includes('data-layer="ecliptic"') ? "with" : "without", "the ecliptic");
// planets.svg 2 bodies, with the ecliptic
```

## 黄道

黄道は、1年のあいだに太陽が通って見える大円です。星図は自分の座標計算から求めます。赤道を春分点のまわりに、J2000の平均黄道傾斜角（84,381.406秒角、23.4393度。IAU 2006の歳差モデルが公表している定数）だけ回したものです。星と同じJ2000の黄道なので、動きません。`eclipticToEquatorial(longitude, latitude)`と`eclipticLine(step)`は同じ線を数で返し、`OBLIQUITY_J2000`はその定数です。

## 天体の点の大きさ

`bodyRadius(magnitude, limit, grow)`は、天体の点の半径をピクセルで返します。星図が使うのと同じ規則で、星の規則（明るいほど大きい）を等級-4.6まで延ばしてあるので、金星はシリウスより大きくなります。`limit`は星図の`magnitude`の設定（開いたときの倍率で見える最も暗い星）、`grow`は拡大で点がどれだけ大きくなるか（開いたときの倍率で1）です。拡大する前の点は1.4ピクセルより小さくなりません。実際の`size`をもつ天体は、それがこの半径より大きければ、その大きさで描きます。

```js
import { bodyRadius } from "@johnmorrisdotca/hoshi-stars/chart";

console.log(bodyRadius(-4.4, 5, 1) > bodyRadius(1.2, 5, 1)); // true
console.log(bodyRadius(20, 5, 1)); // 1.4
console.log(bodyRadius(1.2, 5, 2) / bodyRadius(1.2, 5, 1)); // 2
```

## リストを整える

`normaliseBodies(list)`は、`bodies`属性が`JSON.parse`のリストに対して行う整理をします。idも位置も等級もない項目は捨て、名前が片方なければもう一方の言語（なければid）を使い、おかしい`phase`は満月として扱い、おかしい`size`は捨て、同じidが2つあれば最初の1つを残します。プロパティと`chartSvg`も同じ整理をするので、乱れたリストでもエラーにはなりません。

## デモ

[星図のデモ](https://johnmorrisdotca.github.io/hoshi-stars/)には**惑星と月**の操作があります。これは**固定の見本で、今の空ではありません**。2026年11月12日0:00（UTC）の月と明るい惑星を、私たち自身の式で一度だけ計算して書き写したもので、月の満ち欠けと、等級による惑星の大きさの違いを見られます。**黄道**の層は、ほかの層と同じ並びにあります。見本は何にも連動しません。自分のページでは、今日の値を渡してください。
