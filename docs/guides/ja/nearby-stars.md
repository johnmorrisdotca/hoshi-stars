---
title: 近くの星
section: how-to
order: 7
description: 距離と誤差がわかっている星を、さらに5,565個。プロキシマ・ケンタウリ、バーナード星、ウォルフ359などです。明るい星の表を小さいままにするため、別のimportになっています。
---

[English](../nearby-stars.md)

明るい星5,080個には、太陽に本当に近い星のほとんどが入っていません。いちばん近い星は、暗い赤色矮星(せきしょくわいせい)だからです。`@johnmorrisdotca/hoshi-stars/nearby`は、イェール大学の「三角視差(さんかくしさ)星表 第4版」(van Altena、Lee、Hoffleit、1995年)にあって、明るい星の表にない**5,565個**の星を足します。1つの星は、どちらか一方の表にだけあります。この表は圧縮して約240 kBで、ほかのどこからもimportされません。明るい星のimportの大きさは、これまでと同じです。

## 星を調べる

`nearbyStarByName(text)`は、通称、星表がつけている名前、`GJ 551`や`Gliese 551`、`HD 95735`、`GCTP 2576`、2MASSの番号のどれでも受け付けます。`nearbyStars(options)`は、近い順の全部のリストです。

```js
import { nearbyStarByName, nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";

const proxima = nearbyStarByName("Proxima Centauri");
console.log(`${proxima.lightYears.toFixed(2)} ${proxima.lightYearsError.toFixed(2)}`); // 4.24 0.03
console.log(`${proxima.positionSource} ${proxima.twoMass}`); // 2MASS 2MASS J14294291-6240465
console.log(nearbyStars().length); // 5565
```

`NearbyStar`には、変わらない`id`、名前(`name`、`designation`、`aliases`、`gctp`、`hd`、`gliese`、`twoMass`)、J2000の位置とその出どころ(`positionSource`)と誤差(`positionErrorArcsec`)、視差とその誤差、光年とパーセクの距離とその誤差、固有運動とその出どころ、V等級とその種類と出どころ、スペクトル型、`flags`が入っています。`nearbyStars`のオプションは、`magnitude`(いちばん暗いV等級)、`maxRelativeError`、`withDistance`です。

## 宇宙で近い星(この星たちも入れて)

`/nearest`の`nearest`は、リストを渡さないかぎり、明るい星だけを見ます。2つの表をいっしょに渡します。

```js
import { stars } from "@johnmorrisdotca/hoshi-stars";
import { nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";
import { nearest } from "@johnmorrisdotca/hoshi-stars/nearest";

const among = [...stars(), ...nearbyStars()];
const close = nearest({ x: 0, y: 0, z: 0 }, { by: "space", among, count: 4 });
console.log(close.map((n) => `${n.thing.name} ${n.distance.toFixed(2)}`).join(", ")); // Proxima Centauri 4.24, Rigil Kentaurus 4.34, Toliman 4.34, Barnard's Star 5.98
console.log(close[0].error.toFixed(2)); // 0.03
```

`{ x: 0, y: 0, z: 0 }`は太陽です。いちばん近いのはプロキシマ・ケンタウリで、次がケンタウルス座アルファ星の明るい2つ、その次がバーナード星です。答えの`error`(光年)は、両方が近くの星のとき(または、ターゲットが点のとき)に、視差の誤差から計算します。明るい星が相手のときは`undefined`です。明るい星の表の視差には、誤差がないからです。視差が0以下の近くの星は、距離がないので`skipped`に数えます。近くの星をターゲットにすることもできます。`nearest(nearbyStarByName("Barnard's Star"), { by: "space", among: nearbyStars() })`

## 距離はどれくらい確かか

視差は星表の加重平均で、それぞれに標準誤差があります。距離は、相対誤差(視差の誤差を視差でわった値、`relativeError`)で段階をつけます。

| 段階 | 相対誤差 | 意味 | 星の数 |
|---|---|---|---|
| 良い(good) | 5%未満 | 距離を描いて、数字として伝えてよい | 329 |
| まあまあ(fair) | 5%から20% | 5分の1の範囲で正しい。地図にはよいが、順位づけには向かない | 1,188 |
| 粗い(rough) | 20%より大きい | だいたいの遠さがわかるだけ | 3,552 |
| なし(none) | 視差が0以下 | 距離なし。3Dからはのぞく | 496 |

```js
import { nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";

const good = nearbyStars({ maxRelativeError: 0.05 });
const fair = nearbyStars({ maxRelativeError: 0.2 });
const all = nearbyStars({ withDistance: true });
console.log(`${good.length} ${fair.length - good.length} ${all.length - fair.length}`); // 329 1188 3552
```

距離の誤差(`lightYearsError`、`parsecsError`)は、距離に相対誤差をかけた値です。1次近似なので、誤差が小さいうちは正しく、20%をこえると目安にすぎません。これらは1996年より前の地上での測定です。多くの星は、新しい宇宙からの測定のほうが良いのですが、そのデータはMITライセンスのまま渡せないので使っていません([データとライセンス](data-and-licences.md)を見てください)。

## 位置の出どころ

イェール星表の位置は1900年のもの(FK4系、B1900)で、1秒(時間)や1分(角度)までしかないものも多くあります。星表の固有運動で、J2000まで進めてあります。そのうえで、ビルドのときに2MASS(1997年から2001年の、米国政府が資金を出した全天サーベイ)から、合うものを1つさがしました。星表の位置と運動から予想した場所の近くにあり、J等級が星のV等級と色に合うものです。

- **`positionSource: "2MASS"`**: 位置は2MASSのもの(イェールの運動で2000年まで動かしたもの)で、誤差は1秒角より小さいものから数秒角までです。`twoMass`にその名前があります。4,352個。
- **`positionSource: "GCTP"`と`flags.coarsePosition`**: 合う2MASSの天体が1つにしぼれなかったので、イェールの位置のままです。誤差(`positionErrorArcsec`)は、よくて数秒角です。運動が大きく、位置の年代がわからない星では、1分角以上になることもあります。1,213個。
- **`flags.ambiguousMatch`**: 30秒角以内に明るい星がある、合う2MASSの天体が複数ある、または6.1等より明るいのに明るい星の表にない、のどれかです。使う前に確かめてください。1,029個。
- **`flags.excludedFromSpace`**: 視差が0以下です。496個。

`gctpOffsetArcsec`は、2MASSの天体が、イェールの位置と運動がのっている線から何秒角はなれているかを示します。半分は1秒角以内、10個のうち9個は22秒角以内です。

## 型

`NearbyStar`は星、`NearbyFlags`はそのフラグ、`NearbyPositionSource`は`"2MASS"`か`"GCTP"`、`NearbyMagnitudeKind`は`"photoelectric"`、`"visual"`、`"blue"`です。星表は、光電(こうでん)V等級だけを小数第2位まで書いていて、ほかはもっとあらい値です。どちらかは`magnitudeKind`でわかります。

2つの星表のクレジットとライセンスの扱いは、[NOTICE.md](https://github.com/johnmorrisdotca/hoshi-stars/blob/main/NOTICE.md)にあります。イェール星表にはライセンスの記載がなく、クレジットをつけて使い、求めがあれば取り下げます。2MASSは謝辞(しゃじ)を求めていて、NOTICE.mdに書いてあります。
