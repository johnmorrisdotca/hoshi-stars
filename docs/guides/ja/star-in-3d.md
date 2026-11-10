---
title: 星を立体で見る
section: how-to
order: 4
description: 星を、数値から描いたゆっくり回る立体の球として表示します。周辺減光、色、形（測定されている星だけ）、同じ縮尺の太陽も描きます。デモでも iframe でも使えます。
---

[English](../star-in-3d.md)

デモで星を選ぶと、その星の絵を 3 種類から選べます。星の姿、立体、太陽とくらべる、の 3 つです。立体の星はゆっくり回る球で、星の姿と同じ数値から描いています（[星の大きさ・温度・姿](star-profile.md) を参照）。写真ではありません。

## 数値から描いた部分と、一般的な見た目の部分

- **色** は、星の表面温度の黒体の色です（`profile.colour`）。
- **ふちが暗い** のは周辺減光です。ふちの近くでは、上のほうの温度の低いガスが見えるためです。線形の式 `I(μ) = 1 − u(1 − μ)` で、係数 `u` は星の温度と表面重力に合う Claret と Bloemen（2011, A&A 529, A75）の値です（`profile.limbDarkening`）。
- **形**：アルタイルとレグルスは速く回っているためつぶれていて、軸のかたむきは干渉計で測定された値です（`profile.shape`、論文名は `source`）。赤道は温度が低いので暗く描きます（表面から出る光は温度の 4 乗に比例します）。ベガはほぼ極の方向から見ているので丸く見えます。ほかの星は球で描きます。形が十分に分かっていないためです。
- 温度の低い星の **表面の粒の模様**（対流のセル）は、その種類の星によくある見た目で（超巨星なら少しの大きなセル、太陽のような星なら細かいセル）、この星の本当の表面ではありません。絵の下にもそう書いてあります。熱い星には粒の模様が知られていないので、なめらかに描きます。
- **大きさ**：星の下の線は描いた星と同じ幅です。同じ縮尺で太陽が見える大きさになるときは、線の横に太陽を点で描きます。半径は範囲と一緒に書きます。

星は 40 秒で 1 回転します。見やすい速さで、星の本当の自転ではありません。画面に見えている間だけ回り、「止める」で止まります。動きを減らす設定の人には、止まった状態で表示し、「動かす」ボタンを用意します。WebGL で、ページ全体で 1 つのレンダラーを共有して描きます。WebGL が使えないときは平面の絵を表示し、そのことを書きます。

## もとになる数値

```js
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";
import { portraitLook } from "@johnmorrisdotca/hoshi-stars/portrait";

// アルタイルの立体の絵のもとになる数値：色、周辺減光の係数、表面の姿、測定された形。
const altair = starProfile(starByName("Altair"));
const { shape } = altair;
console.log(altair.colour, altair.limbDarkening.toFixed(2), portraitLook(altair));
console.log((shape.polarRadius / shape.equatorialRadius).toFixed(3), shape.inclinationDegrees, shape.source);
```

このパッケージが出すのは数値と SVG で、3D の描画エンジンは入っていません。自分で立体の星を描くなら、球を軸の方向に `polarRadius / equatorialRadius` だけ縮め、視線から `inclinationDegrees` だけかたむけ、北から東へ `positionAngleDegrees` だけ回し、`colour` の色で `1 − u(1 − μ)` の明るさにします（μ は表面と視線の角度のコサイン）。必要なのはこれだけです。

## 自分のページに入れる

デモの星の埋め込みページは、アドレスの指定どおりに回る星を描きます。輝星星表での星の番号（`star=7557`）、`view=3d`、日本語なら `lang=ja` をつけます。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star in 3D in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/star.html?star=7557&view=3d"
      title="Altair in 3D"
      width="360"
      height="522"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

デモで星を選び、絵の上の **立体** を選んで、「この星の絵」で **埋め込み** を開くと、iframe は回る立体の星になります。自分のページ用のコード（HTML、モジュール、React、Vue、Angular、Svelte）は、立体の絵のもとになる星の姿を描きます。選んだものはデモのアドレスに `pview=3d` として残ります。
