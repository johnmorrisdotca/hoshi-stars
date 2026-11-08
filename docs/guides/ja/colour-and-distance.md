---
title: 色と距離
section: how-to
order: 3
description: 星の色指数から温度と描く色を求め、年周視差から光年にする方法です。
---

[English](../colour-and-distance.md)

## 色

カタログには星ごとにB-V色指数があります。高温の青い星は約-0.3、太陽は0.65、低温の赤い星は1.5より大きい値です。`starTemperatureK`は、バラステロスの式で色指数から表面温度（ケルビン）を求め、`blackBodyColour`は温度から描くための色を求めます。`starColour`はその両方をして、色指数がなければ白を返します。

```js
import { blackBodyColour, starByName, starColour, starTemperatureK } from "@johnmorrisdotca/hoshi-stars";

console.log(Math.round(starTemperatureK(0.65)), "K for a star like the Sun");
console.log(starColour(starByName("Rigel")), starColour(starByName("Betelgeuse")));
console.log(blackBodyColour(10000));
// 5778 K for a star like the Sun
// #c6d8ff #ffbc83
// #cadaff
```

これはカメラが写す色で、測った値ではありません。最も高温の星は低めに出ます。画面の色は画面しだいなので、白い星より少し大きめに描き、明るい背景は避けてください。

## 距離

`starDistanceLightYears`は、3,261.56を年周視差（ミリ秒角）で割ります。カタログに視差がなければ`undefined`を返すので、0と表示せず「不明」と表示してください。

```js
import { starByName, starDistanceLightYears } from "@johnmorrisdotca/hoshi-stars";

for (const name of ["Sirius", "Vega", "Betelgeuse"]) {
  const light = starDistanceLightYears(starByName(name));
  console.log(name, light === undefined ? "not known" : `${Math.round(light)} light-years`);
}
// Sirius 9 light-years
// Vega 27 light-years
// Betelgeuse 652 light-years
```

視差が数ミリ秒角の星は、数十パーセントの誤差があります。遠い星の距離は、おおよその値です。
