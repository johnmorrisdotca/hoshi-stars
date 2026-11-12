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
// Vega 25 light-years
// Betelgeuse 548 light-years
```

視差が数ミリ秒角の星は、数十パーセントの誤差があります。遠い星の距離は、おおよその値です。`starDistance`は、どのくらいおおよそなのかを返します。距離と誤差、いちばん近い場合といちばん遠い場合です。

```js
import { starByName, starDistance } from "@johnmorrisdotca/hoshi-stars";

for (const name of ["Sirius", "Vega", "Betelgeuse"]) {
  const star = starByName(name);
  const distance = starDistance(star);
  const [near, far] = distance.lightYearsRange;
  console.log(`${name} ${star.spectralType} (${star.luminosityClass}): ${distance.lightYears.toFixed(1)} light-years, from ${near.toFixed(1)} to ${far.toFixed(1)}`);
}
// Sirius A1Vm (V): 8.5 light-years, from 8.5 to 8.6
// Vega A0Va (V): 25.1 light-years, from 24.8 to 25.5
// Betelgeuse M1-2Ia-Iab (Ia): 548.2 light-years, from 479.6 to 639.5
```

範囲は、視差の標準誤差1つぶんを足し引きしたものです。シリウスは100分の数光年の精度ですが、ベテルギウスは480光年から640光年のどこかです。輝星表だけの視差（`parallaxSource`が`"BSC"`か`"dynamical"`）には誤差がないので、`lightYearsError`と`lightYearsRange`は`undefined`です。誤差が視差と同じ大きさのときは、いちばん遠い距離は`Infinity`になります。

超巨星のいくつかは、星表の視差の精度が低すぎて、そのままでは表示できません。そこでこのパッケージは別の扱いをし、その内容を`parallaxNote`に書きます。ベテルギウス、リゲル、北極星は、発表された論文から書き写した距離を使います（`parallaxSource`は`"literature"`）。ベテルギウスは168（+27/−15）パーセク（Joyce ほか 2020）、リゲルは0.26キロパーセクで、範囲は0.45キロパーセクまで届きます（de Almeida ほか 2022）、北極星は伴星をハッブル宇宙望遠鏡で測った視差です（Bond ほか 2018）。アンタレス、カノープス、ケフェウス座μ星はイェールの視差をそのまま使いますが、誤差を少なくとも視差と同じ大きさまで広げているので、距離は`rough`（粗い）で、いちばん遠い距離の上限もありません。`distanceQuality`が`"rough"`の距離は、最良値だけを表示せず、必ず範囲を表示してください。出典は`NOTICE.md`にあります。

スペクトル型の全体（`spectralType`、ベテルギウスは`M1-2Ia-Iab`）と、その中の光度階級（`luminosityClass`）で、同じ色の巨星と矮星を見分けられます。`Ia`・`Iab`・`Ib`・`I`は超巨星、`II`は輝巨星、`III`は巨星、`IV`は準巨星、`V`は矮星（主系列星）、`VI`は準矮星、`D`は白色矮星です。`luminosityClass(type)`は、どのスペクトル型の文字列からでも光度階級を読み取ります。
