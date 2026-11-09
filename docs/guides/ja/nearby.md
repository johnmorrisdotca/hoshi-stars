---
title: 近くにあるもの
section: how-to
order: 6
description: 星、メシエ天体、または空の1点に近い星や天体を、空の角度か宇宙での距離で調べます。となり合う星座も分かります。
---

[English](../nearby.md)

`@johnmorrisdotca/hoshi-stars/nearest`は、「これの近くに何がある?」に3つの関数で答えます。明るい星の表を読み、`kind: "deep-sky"`のときはメシエ天体の表も読みます。となり合う星座は星座の境界から求めます。

## 空で近いもの

`nearest(target, options)`は近い順に`{ thing, angle }`を返します。`angle`は度です。`target`には、星、天体、`starByName`か`deepSkyObject`が受け付ける名前、または度で表した`{ rightAscension, declination }`を渡せます。`target`自身は答えに入りません。

```js
import { nearest, within } from "@johnmorrisdotca/hoshi-stars/nearest";

const pair = nearest("Mizar", { count: 3 });
console.log(pair.map((n) => `${n.thing.name ?? n.thing.hr} ${n.angle.toFixed(2)}`));
console.log(within("Alcyone", 1, { magnitude: 5 }).map((n) => n.thing.name));
// [ '5055 0.00', 'Alcor 0.20', '5109 1.52' ]
// [ 'Merope', 'Atlas', 'Maia', 'Electra', 'Taygeta' ]
```

ミザールは二重星なので、いちばん近いのは相棒の星(HR 5055)で、アルコルは0.20度はなれています。`within(target, radius)`は、個数の上限なしの`nearest`です。オプション:

| オプション | はたらき |
|---|---|
| `count` | 何個返すか(`nearest`は10、`within`はすべて) |
| `within` | この範囲の中だけ。空なら度、宇宙なら光年 |
| `kind` | `"star"`(初期値)か`"deep-sky"`(メシエ天体) |
| `magnitude` | 入れる中でいちばん暗いもの。`stars({ magnitude })`と同じです(ちょうどその等級も入ります) |
| `date` | その日時まで固有運動で星を動かしてから測ります。歳差はすべての天体を同じ向きに回すので、角度は変わりません |
| `among` | 自分のリストから探します(たとえば`/deep-sky/ngc-ic`の`deepSky()`) |
| `by` | `"sky"`(初期値)か`"space"` |

角度は単位ベクトルの`atan2(|a x b|, a . b)`で測るので、0度や180度のそば、極のそば、赤経0と360をまたぐ場所でも正確です。5,080個すべてを調べても約1ミリ秒です。索引は作りません。

## 宇宙で近いもの

`by: "space"`にすると、各星を年周視差から3次元の位置に置き、`{ thing, distance, parsecs, error }`を返します。まっすぐな距離を光年とパーセクで出します。

```js
import { nearest } from "@johnmorrisdotca/hoshi-stars/nearest";

const close = nearest("Sirius", { by: "space", count: 2 });
console.log(close.map((n) => `${n.thing.name} ${n.distance.toFixed(1)}`));
console.log(close.skipped, close[0].error);
// [ 'Procyon 5.1', 'Ran 8.0' ]
// 2547 undefined
```

- **この表の星だけです。** 答えは、5,080個のうち年周視差がある2,533個が対象です。この表に入っていない、もっと暗くて近い星もあります。`among: [...stars(), ...nearbyStars()]`を渡すと、[近くの星](nearby-stars.md)の5,565個(プロキシマ・ケンタウリ、バーナード星、赤色矮星)も数えます。
- **`skipped`**は、使える距離がなくて外した個数です(視差が0以下の星と、メシエ天体など)。
- **`error`**は`undefined`です。イェール星表は視差を1ミリ秒角の単位でしか載せていなくて、誤差も載っていないので、計算できません。距離は100光年以内で数パーセント程度の精度で、暗くて遠い星ではあてになりません。
- `target`には距離が必要です。視差がある星、`{ rightAscension, declination, lightYears }`、または太陽を原点にしたJ2000赤道座標軸のパーセクの点`{ x, y, z }`です。

## となり合う星座

```js
import { neighbouringConstellations } from "@johnmorrisdotca/hoshi-stars/nearest";

console.log(neighbouringConstellations("Orion").map((c) => c.abbreviation));
// [ 'Eri', 'Gem', 'Lep', 'Mon', 'Tau' ]
```

境界の一部を共有している星座がとなり同士です。角で1点だけ触れているものは入りません。表はIAUの境界から最初に必要になったときに計算され(数ミリ秒)、そのあと使い回します。答えはラテン名のアルファベット順です。
