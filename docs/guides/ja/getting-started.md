---
title: はじめに
section: tutorial
order: 1
description: 星を1つ調べ、その星座を見つけ、星座の線つきの小さな星図を描くまでを、依存なしで数分で試します。
---

[English](../getting-started.md)

Hoshi Starsは、肉眼で見える星を、描けるデータとして使えるようにしたものです。5,080個の星の名前・位置・距離・色、88星座の線と境界、メシエ天体、そして7種類の図法が入っています。このパッケージ自身は何も描きません。数値を返すので、ページでも、キャンバスでも、SVGでも、印刷でも、好きな方法で描いてください。依存はなく、時計も読みません。時刻はいつも、呼び出す側が渡す引数です。

## インストール

```sh
npm install @johnmorrisdotca/hoshi-stars
```

Node 22以降か、新しいブラウザーで使えます。すべてESモジュールで、型も付いています。部品ごとに別々のimportなので、使うものだけが読み込まれます。

## 星を1つ調べる

```js
import { starByName, starColour, starDistanceLightYears } from "@johnmorrisdotca/hoshi-stars";

const sirius = starByName("Sirius");
console.log(sirius.designation, sirius.magnitude, starColour(sirius));
console.log(starDistanceLightYears(sirius).toFixed(1), "light-years");
// α CMa -1.46 #c9daff
// 8.5 light-years
```

等級は小さいほど明るい星です。いちばん明るいシリウスは-1.46等です。それぞれの項目の意味は[星のデータ](stars.md)にあります。

## 星座と星座の線

```js
import { constellationAt } from "@johnmorrisdotca/hoshi-stars/boundaries";
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";

const rigel = starByName("Rigel");
const orion = constellationAt(rigel);
console.log(orion.name, orion.japanese);
console.log(figureOf(orion.abbreviation).segments.length, "lines to draw");
// Orion オリオン座
// 8 lines to draw
```

星座は[英語と日本語](constellations-and-lines.md)で引けて、それぞれに専用の星座線の図があります。

## 星図を描く

星をページのどこに置くかは、図法で決まります。星図の中心を決めて、星ごとにどこに落ちるかを聞きます。

```js
import { stars } from "@johnmorrisdotca/hoshi-stars";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

const view = { centre: { rightAscension: 84, declination: 0 }, scale: 150 };
const seen = stars({ magnitude: 4 }).filter((star) => {
  const at = project("stereographic", star, view);
  return at !== undefined && Math.hypot(at.x, at.y) < 200;
});
console.log(seen.length, "stars within 200 units of Orion's belt");
```

[星図](sky-charts.md)では、これを絵にします。デモも星図です: https://johnmorrisdotca.github.io/hoshi-stars/ 。ページに星図を入れる方法は、[HTMLとCDN](html-and-cdn.md)、[バンドラー](bundlers.md)、[フレームワーク](frameworks.md)、[iframe](embed-in-an-iframe.md)にあります。
