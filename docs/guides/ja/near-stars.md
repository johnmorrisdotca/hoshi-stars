---
title: 近くの星と、その惑星
section: how-to
order: 12
description: 20光年以内の73の星系と、確認された惑星をもつ近くの有名な星。英語と日本語の名前、空の位置、距離、そして値ごとの出典つきです。
---

[English](../near-stars.md)

訪ねてみたい星を集めた、2つのimportがあります。`@johnmorrisdotca/hoshi-stars/near-stars` は**20光年以内の73の星系**で、プロキシマをふくむケンタウルス座α星(アルファ・ケンタウリ)、バーナード星、ウォルフ359、シリウスなどです。`@johnmorrisdotca/hoshi-stars/exoplanet-hosts` は、訪れる人にとって大切な、**確認された惑星をもつ80個の主星**で、惑星ごとの名前と公転周期がついています。それぞれ独立したimport(gzipで約6kBと約9kB)なので、使わないページが余計なものを読みこむことはありません。どちらも純粋なデータで、DOMも時計も読みません。

```js
import { exoplanetHostByName } from "@johnmorrisdotca/hoshi-stars/exoplanet-hosts";
import { nearStarByName, nearStars } from "@johnmorrisdotca/hoshi-stars/near-stars";

const near = nearStars();
console.log(`${near.length} systems within 20 light-years, the nearest ${near[0].name}`);

const barnard = nearStarByName("Barnard's Star");
console.log(`${barnard.name} (${barnard.nameJa}): ${barnard.lightYears.toFixed(2)} light-years, ${barnard.spectralType}`);
console.log(`position from ${barnard.sources.position}, distance from ${barnard.sources.distance}, ${barnard.constellation}`);

const trappist = exoplanetHostByName("TRAPPIST-1");
console.log(`${trappist.name}: ${trappist.planetCount} planets, periods ${trappist.planets.map((p) => p.periodDays.toFixed(2)).join(", ")} days`);
```

出力は次のとおりです。

```text
73 systems within 20 light-years, the nearest Alpha Centauri
Barnard's Star (バーナード星): 5.98 light-years, M5 V
position from 2MASS, distance from GCTP, Oph
TRAPPIST-1: 7 planets, periods 1.51, 2.42, 4.05, 6.10, 9.21, 12.35, 18.77 days
```

## 20光年以内の星

`nearStars({ maxLightYears })` は、近い順に星系を返します。`nearStarByName(text)` は、名前、日本語の名前、星表での名称、またはその星系のどの星の名前からでも1つ見つけます。大文字小文字と空白は無視します。`Proxima Centauri`、`Rigil Kentaurus`、`Sirius B`、`GJ 699`、`ウォルフ359` のどれでも見つかります。

星系は、1つの星か星のグループです。星系の値は**主星**(いちばん明るい星、または表で名前がついている星)の値です。伴星のある星系は、主星を先頭に `members` に並べます。ケンタウルス座α星には、リギル・ケンタウルス、トリマン、プロキシマ・ケンタウリがあり、それぞれ固有の位置と距離をもちます。`starsAtLeast` は、少なくとも何個の星があるかを表します。よく知られた多重星では、発表されている数です(アルファ・ケンタウリは3、シリウスとはくちょう座61番星は2)。伴星が知られていない星は1です。イェール大学の2つの表にない伴星(シリウスB、プロキオンB、インディアン座ε星の褐色矮星)は、スペクトル型と `note` だけをもつメンバーで、固有の位置や距離はなく、`source: "typed"` となります。

`NearStar` には次のものがあります。

- `id`、`name`、`nameJa`、`designation`、`aliases`、`constellation`(`Cen`)。
- J2000の度で表した `rightAscension` と `declination`。わかっているときは `positionErrorArcsec` もあります。
- `parallaxMas` と `parallaxErrorMas`、距離の `lightYears` とその誤差 `lightYearsError`。どの星系も、距離は10%以内の誤差でわかっています。
- `spectralType` と `luminosityClass`(矮星は `V`)、V等級の `magnitude`、固有運動の `properMotionRaMas` と `properMotionDecMas`。
- `members`、`starsAtLeast`、`flags`(`coarsePosition` は位置がイェール大学の星表そのもので、よくても秒角単位の精度であること、`ambiguousMatch` は出典との照合がはっきりしないこと)。
- `sources`:値ごとの出典で、`BSC`(イェール輝星カタログ)、`GCTP`(イェール視差星表)、`2MASS`(2ミクロン全天サーベイ)、`typed`(発表された値をこのパッケージに入力したもの)のどれかです。距離は `GCTP`、`BSC`、`dynamical`(連星の軌道から)のどれかです。

**入っていないもの。** このリストにあるのは、このパッケージが引き継げる2つの出典が距離を示している星です。つまり、1995年までに測られた近くの星に、現代の位置を合わせたものです。それ以後に見つかり、その表にない星(ティーガーデン星、ルーマン16、WISE 0855)は入っていません。その距離をもつ星表がESAのもの(ヒッパルコス、ティコ、ガイア)で、その非営利ライセンスをMITライセンスのパッケージは再配布できないからです。そのため距離は現代の値より少し粗くなります(プロキシマはここでは4.24光年、文献では4.25光年。バーナード星は、ここでは5.98光年、文献では5.96光年)。誤差はすべて示してあります。

## 惑星をもつ星

`exoplanetHosts({ maxLightYears, minPlanets })` は、近い順に主星を返します。`exoplanetHostByName(text)` は、名前、日本語の名前、NASA系外惑星アーカイブでの名前(`Proxima Cen`)、または惑星の名前(`TRAPPIST-1 e`)から1つ見つけます。

**主星の選び方。** 距離が10%以内の誤差でわかっていて、次のどれかにあてはまる星を入れています。

- 50光年以内(75個)。いちばん近いのは4.2光年のプロキシマ・ケンタウリで、いちばん遠いのは49光年のG型矮星です。
- それより遠くて、IAUの固有名がある星(4個:エライ、ヘルウェティオス、ティタウィン、ハマル)。
- トラピスト1。地球ほどの大きさの惑星を7つもつ星で、距離は発見の論文から入力しています。

`ExoplanetHost` には、`name`、`nameJa`、`designation`(アーカイブでの名前)、`constellation`、`rightAscension`、`declination`、`lightYears` と `lightYearsError`、`spectralType`、`magnitude`、`selection`(`near`、`named`、`typed`)、`nearStarId`(20光年以内にある場合の、`/near-stars` での星系のid)、`planetCount`、`planets`、`sources` があります。惑星ごとに、`name`、`letter`、`periodDays`、`periodReference`(公転周期の出典の論文)、`discoveryYear`、`discoveryMethod` があります。確認された惑星は全部で134個です。確認が文献で疑問視されている惑星は入れていません。

**値の出どころ。** 惑星はNASA系外惑星アーカイブのものです。惑星を表示するページでは、アーカイブが求める文を `EXOPLANET_ARCHIVE_ACKNOWLEDGEMENT` として表示します。星の位置、距離、スペクトル型、等級はアーカイブのものでは**ありません**。アーカイブの位置と距離の列は、ガイアを土台にしたTESS入力カタログと、非営利ライセンスのヒッパルコスから取られているからです。星の値は、近い星と同じ2つのイェール大学の表と2MASSから取り、値ごとに出典をつけています。それらの表にない主星(LHS 1140など)は、このパッケージで再配布できる出典が距離を示すまで、入れていません。出典ごとに根拠にした文は[NOTICE.md](../../../NOTICE.md)にあります。
