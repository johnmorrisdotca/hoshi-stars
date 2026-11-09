---
title: ブラックホール
section: how-to
order: 11
description: 空の位置がわかっている301個のブラックホール。質量と距離(範囲つき)、伴星、見つけた方法、各事実のもとになった論文も添えました。はくちょう座X-1、はくちょう座V404星、ガイアBH1、いて座A*、M87*など。
---

[English](../black-holes.md)

`@johnmorrisdotca/hoshi-stars/black-holes` は、出典が空の位置を示しているブラックホール301個です。3つの種類があります。独立したimport(gzipで約22kB)なので、ブラックホールを描かないページが余計なものを読みこむことはありません。

| 種類 | 数 | 内容 |
|---|---|---|
| `stellar` | 78 | X線連星の中にあり、落ちこむガスのX線で見つかったブラックホール。はくちょう座X-1、はくちょう座V404星、A0620-00、GRS 1915+105など。BlackCATの73天体と、ほかの5つ(はくちょう座X-1、LMC X-1、LMC X-3、M33 X-7、1E 1740.7-2942)です。 |
| `quiet` | 5 | ほとんど何も放射しないブラックホール。伴星の軌道や、星の光の曲がり方から見つかりました。ガイアBH1・BH2・BH3、VFTS 243、孤立したOGLE-2011-BLG-0462です。 |
| `supermassive` | 218 | 質量が測られている銀河の中心のブラックホール。いて座A*、M87*、M31のものなど、あわせて218個です。 |

```js
import { blackHole, blackHoles } from "@johnmorrisdotca/hoshi-stars/black-holes";

const counts = ["stellar", "quiet", "supermassive"].map((kind) => `${blackHoles({ kind }).length} ${kind}`);
console.log(`${blackHoles().length} black holes: ${counts.join(", ")}`);

const cygnus = blackHole("Cygnus X-1");
const lightYears = Math.round(cygnus.distanceParsecs.value * 3.26156);
console.log(`${cygnus.name}: ${cygnus.massSuns.value} Suns, ${lightYears} light-years, companion ${cygnus.companion}`);
console.log(`mass from ${cygnus.sources.mass[0].citation}`);
```

出力は次のとおりです。

```text
301 black holes: 78 stellar, 5 quiet, 218 supermassive
Cygnus X-1: 21.2 Suns, 7241 light-years, companion HDE 226868
mass from Miller-Jones 2021, Science 371, 1046
```

## ひとつのブラックホール

`blackHole(name)` は、どの名前からでも1つ見つけられます。大文字小文字、空白、記号、銀河の名前のあとのアスタリスクは無視します。`Cygnus X-1`、`cyg x-1`、`HDE 226868`、`V404 Cyg`、`GS 2023+338`、`Sgr A*`、`M87`、`NGC 4486` のどれでも通ります。超大質量ブラックホールには、いて座A*やM87*と同じように、銀河の名前のあとにアスタリスクをつけました。そのため `blackHole("M31")` は銀河ではなくブラックホール `M31*` です(銀河は `@johnmorrisdotca/hoshi-stars/deep-sky` の `deepSkyObject("M31")` です)。

```js
import { blackHole } from "@johnmorrisdotca/hoshi-stars/black-holes";

const gaia = blackHole("Gaia BH1");
console.log(gaia.kind, gaia.constellation, gaia.foundBy, gaia.year); // quiet Oph orbit 2023
console.log(gaia.massSuns.value, gaia.massSuns.low, gaia.massSuns.high); // 9.62 9.44 9.8
console.log(gaia.rightAscension, gaia.declination); // 262.1712 -0.581
console.log(gaia.companion, "|", gaia.companionType); // Gaia DR3 4373465352415301632 | G dwarf (Sun-like)
```

それぞれのブラックホールには次の項目があります:

- `id`、`name`、`otherNames`。
- `kind`(`stellar`、`quiet`、`supermassive`)と `status`(見えない天体の質量が中性子星の質量の上限より大きいと測られていれば `confirmed`、そうでなければ `candidate`)。
- J2000の赤経 `rightAscension` と赤緯 `declination`(度。0.0001度まで)、星座 `constellation`(`Cyg`)。
- `massSuns` と `distanceParsecs`: `{ value, low, high, limit }`。だれも測っていなければ `undefined`。`low` と `high` は論文の示す範囲(おおよそ1標準偏差、または最良値のない範囲の両端。その場合 `value` は `undefined`)です。`value` が限界値だけのときは `limit` が `"lower"` か `"upper"` になります(GX 339-4は5,000パーセク以上)。
- `companion`(伴星の符号)と `companionType`(スペクトル型など)。ないときは `undefined`。
- `foundBy`: `x-rays`、`orbit`(伴星の軌道)、`microlensing`(マイクロレンズ。星の光の曲がり)、`stars`(まわりを回る星)、`gas`、`masers`、`echoes`(反響マッピング)、`image`(イベント・ホライズン・テレスコープが撮ったM87*)。
- `year`: 恒星質量ブラックホールではX線源が見つかった年、休眠ブラックホールでは発見の論文の年、超大質量ブラックホールでは使った質量測定の年。
- `sources`: `position`、`mass`、`distance`、`companion`、`found` のそれぞれの事実のもとになった論文で、`{ key, citation, link }` の形です。`link` はNASA ADS、arXiv、Wikidataのいずれかの URL です。
- `note`: 事実に添える短い英語の注。質量に異論がある場合など。

## 一覧と絞りこみ

`blackHoles({ kind, status, foundBy, constellation })` で絞りこめます。恒星質量、休眠、超大質量の順で、それぞれ赤経の順に並びます。

```js
import { blackHoles } from "@johnmorrisdotca/hoshi-stars/black-holes";

const heaviest = blackHoles({ kind: "stellar", status: "confirmed" })
  .filter((b) => b.massSuns?.value !== undefined)
  .sort((a, b) => b.massSuns.value - a.massSuns.value)[0];
console.log(heaviest.name, heaviest.massSuns.value); // Cygnus X-1 21.2
console.log(blackHoles({ foundBy: "masers" }).length, blackHoles({ constellation: "Sgr" }).length); // 23 18
```

`BLACK_HOLE_KINDS` と `BLACK_HOLE_FOUND` は決まった2つの一覧で、型は `BlackHole`、`BlackHoleKind`、`BlackHoleFound`、`BlackHoleMeasure`、`BlackHoleSource`、`BlackHoleSources`、`BlackHoleOptions` です。

## 星図に描く

ブラックホールは星と同じJ2000の座標なので、`@johnmorrisdotca/hoshi-stars/projection` の `project` で、7つの図法のどれにも置けます。デモでは種類ごとに専用の記号を描きます。恒星質量は両側にジェットのある黒い円、休眠は破線の輪、超大質量は傾いた輪の中の黒い円で、拡大すると名前も表示します。

## ここにあるもの、ないもの

- **候補はまだブラックホールと決まったわけではありません。** `status` が `confirmed` なのは、見えない天体の質量が、伴星や、まわりの星・ガス・メーザーへの引力、または画像から測られているものだけです。恒星質量の78天体のうち54天体は候補で、その多くは質量が測られていません。
- **質量には範囲があります。** `massSuns.low` と `massSuns.high` を使い、`limit` も見てください。下限は最小値で、測定値ではありません。超大質量ブラックホールの範囲は、表の値を中心に、対数でみて対称です。
- **OGLE-2011-BLG-0462の質量には異論があります**(3つの論文で1.6〜4.4、5.8〜8.7、7.15±0.83太陽質量)。`note` に書いてあり、`massSuns` は最初に出た7.1±1.3です。
- **LMC X-1、LMC X-3、VFTS 243の距離は大マゼラン雲の距離です。** `note` に書いてあります。
- **ブラックホールのすべてがここにあるわけではありません。** 論文が位置と、質量またはその根拠を示したものだけで、出典は `NOTICE.md` にあります。ほかにも存在が推定されているものは数多くあります(大きな銀河のほとんどに1つあります)が、質量が測られたものはそれよりずっと少数です。LIGO・Virgo・KAGRAの重力波イベントは、点ではなく空の領域なので、ここには含まれておらず、後の版に回しています。超大質量の出典の表のうち、質量の上限値だけの行(278行のうち55行)は省きました。
- **出典とライセンス。** どの事実にも出典の論文を添えました。出典と条件は `NOTICE.md` にあります。BlackCAT(出典を明記するよう求められているので、このガイドに明記しました)、van den Boschの2016年のブラックホール質量の表、銀河の中心はNASA/IPAC NED、位置はWikidata(CC0)、そして発見の論文です。ESAのGaia・Hipparcos・Tychoのカタログは使っておらず、Wikipediaの文章も使っていません。

これらのデータを使うときは、恒星質量ブラックホールについてBlackCAT(Corral-Santana他 2016, A&A 587, A61)を、超大質量ブラックホールについてvan den Bosch(2016, ApJ 831, 134)を引用してください。
