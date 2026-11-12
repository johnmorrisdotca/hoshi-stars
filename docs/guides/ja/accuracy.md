---
title: 星の値の確かさ
section: how-to
order: 15
description: 星ごとに、位置・明るさ・色・視差・固有運動がどのカタログのものか、そのカタログが示す誤差、読んで確かめられるルールによる A・B・C の等級を調べます。
---

[English](../accuracy.md)

カタログは星の位置と距離を教えてくれますが、その値がどれだけ確かかまでは、いつも示してくれるわけではありません。`@johnmorrisdotca/hoshi-stars/accuracy` は、いま星を収めている2つの層、つまり明るい星5,080個と、`/nearby` の近くの星のすべてについて、それに答えます。自前の表は持たず、データも読み込まず、数キロバイトのルールだけです。

```js
import { starAccuracy } from "@johnmorrisdotca/hoshi-stars/accuracy";
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { nearbyStarByName } from "@johnmorrisdotca/hoshi-stars/nearby";

const sirius = starAccuracy(starByName("Sirius"));
console.log(`Sirius: grade ${sirius.grade}, distance ${sirius.distance.quality} (${(sirius.distance.relativeError * 100).toFixed(1)}%), parallax from ${sirius.parallax.source}`);
console.log(`position from ${sirius.position.source}, to ${sirius.position.resolution.toFixed(1)} ${sirius.position.unit}, stated error ${sirius.position.error}`);

const betelgeuse = starAccuracy(starByName("Betelgeuse"));
console.log(`Betelgeuse: grade ${betelgeuse.grade}, parallax from ${betelgeuse.parallax.source}, ${betelgeuse.distance.quality} distance`);

const proxima = starAccuracy(nearbyStarByName("Proxima Centauri"));
console.log(`Proxima Centauri: grade ${proxima.grade}, position from ${proxima.position.source} (+-${proxima.position.error} ${proxima.position.unit})`);
```

出力は次のとおりです。

```text
Sirius: grade A, distance good (0.6%), parallax from GCTP
position from BSC, to 1.4 arcsec, stated error undefined
Betelgeuse: grade B, parallax from literature, fair distance
Proxima Centauri: grade A, position from 2MASS (+-0.1 arcsec)
```

## `starAccuracy(star)` が返すもの

星がどの層のものか(`bright` または `nearby`)を示す `layer`、その星の `grade`(等級)、そして `position`・`magnitude`・`colour`・`parallax`・`properMotion` それぞれの `FieldAccuracy`、さらに `distance` をもつ記録です。

各項目には次のものがあります。

- `source`: その値がどのカタログのものか。`BSC`(イェール輝星カタログ)、`GCTP`(イェール三角視差総合カタログ)、`2MASS`(2ミクロン全天サーベイ)、`dynamical`(連星の軌道から求めた輝星カタログの視差)、`literature`(発表された論文から書き写した距離)のいずれかです。その星にその値がないときは `undefined` です。
- `error`: 標準誤差で、その項目の `unit`(`arcsec`・`mag`・`mas`・`mas/yr`)で表します。**出典が誤差を示しているときだけ**入ります(イェール視差カタログの星の視差、そして近くの星の位置で、こちらは 2MASS 自身の誤差と星の動きからこのパッケージが計算します)。それ以外は `undefined` です。誤差を推測で入れることはありません。
- `resolution`: 出典が表示している最後の桁の大きさです。誤差の下限であって、誤差の見積もりではありません。輝星カタログは位置を時刻の0.1秒、角度の1秒の桁まで表示し(赤道上で1.5秒角)、誤差は示していません。そのため輝星の位置には `resolution` があり、`error` はありません。
- `note`: 気をつける点があるときの短い一文(論文から書き写した距離、V ではなく写真青色の等級、など)。

`distance` には、`relativeError`(視差の誤差を視差で割った値。`0.05` は5%)と、`quality` の段階(`good`・`fair`・`rough`・`none`。`/constellation-3d` の `distanceQuality` と同じ)があります。

## 等級

等級は、示されている数値に当てはめるルールであって、その星の評価ではありません。数値は `GRADE_RULES` にあります。

| 等級 | ルール |
| --- | --- |
| A | 距離が5%未満の精度で分かっていて、**かつ**位置が新しい |
| B | 距離が20%以内の精度で分かっている(または、5%未満でも位置が粗い) |
| C | それ以外。位置はあるが距離が粗い、または距離がない |

位置は、誤差(誤差がないときは `resolution`)が2秒角以下のとき**新しい**とします。輝星カタログは位置の誤差を示していないので、輝星では測定された誤差ではなく、表示されている位置の桁(resolution)、最大でも1.5秒角を使います。これは2秒角以内なので、新しいものに数えます。近くの星は、2MASS の位置なら新しく、イェールカタログ自身の位置(1900年から移したもの)なら粗いとします。誤差が示されていない視差は粗いものとして扱うので、その星は等級 C です。ただし力学視差(dynamical)だけは、並(fair)とします。`STAR_GRADES` は等級を良い順に並べたもので、`gradeAtLeast(grade, "B")` で、等級が基準以上かどうかを調べられます。

## 数

| 層 | 星の数 | 等級 A | 等級 B | 等級 C | 数値の出典 | ライセンス |
| --- | --- | --- | --- | --- | --- | --- |
| 明るい星(メインのimport) | 5,080 | 68 | 461 | 4,551 | イェール輝星カタログと、一部の星はイェール視差 | イェール輝星カタログ: 非公式にパブリックドメイン、出典の明記つき。イェール視差: ライセンスの記載なし、出典を明記して使い、要請があれば除きます(`NOTICE.md`) |
| 近くの星(`/nearby`) | 5,565 | 235 | 1,282 | 4,048 | イェール三角視差総合カタログと 2MASS の位置 | イェール視差: 上と同じ。2MASS: 米国政府の著作物、出典を明記(`NOTICE.md`) |

明るい星の大半が等級 C なのは、輝星カタログに視差がある星が少なく、その視差にも誤差が示されていないからです。誤差が示されていない距離を、示されているかのように格付けすることはしません。新しいカタログがあれば多くが上がりますが、ここで使えるものは MIT ライセンスで再配布できません(`NOTICE.md` の「Deliberately not used」)。

## 信頼できる星だけを残す

`stars`・`nearbyStars`・`nearest` は `minGrade` を受け取ります。残す等級のうち一番低いものを指定するので、`"B"` なら等級 A と B が残ります。`starGrade(star)` は星の等級だけを返し、`starAccuracy(star).grade` より速く求められます。`checkGrade` は、正しくない `minGrade` を、そのオプション名を示す `RangeError` にする検査です。

空間での検索(`nearest(..., { by: "space" })`)は、各結果がどれだけ確かかも返します。`distance` と `error` のほかに、各結果には `range`(距離を `error` ぶん上下にずらした範囲。0 未満にはなりません)と `tied` があります。`tied` は、全体の並びで前後にある結果の範囲と重なっているとき `true` になり、データだけではどちらが近いか決められないことを表します。ケンタウルス座α星の明るい2つの星、リギル・ケンタウルスとトリマンがその例です。誤差が示されていない星には `range` がなく、`tied` にもなりません。誤差がないことは、誤差が小さいことではないからです。

```js
import { starByName, stars } from "@johnmorrisdotca/hoshi-stars";
import { nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";
import { nearest } from "@johnmorrisdotca/hoshi-stars/nearest";

console.log(`${stars({ minGrade: "A" }).length} of ${stars().length} bright stars are grade A; ${nearbyStars({ minGrade: "B" }).length} nearby stars are B or better`);

const found = nearest(starByName("Sirius"), { by: "space", count: 4, minGrade: "B" });
for (const one of found) {
  const range = one.range === undefined ? "no range" : `${one.range[0].toFixed(1)} to ${one.range[1].toFixed(1)} light-years`;
  console.log(`${one.thing.name ?? one.thing.designation}: ${one.distance.toFixed(1)}, ${range}${one.tied ? ", tied with a neighbour" : ""}`);
}
```

出力は次のとおりです。

```text
68 of 5080 bright stars are grade A; 1517 nearby stars are B or better
Procyon: 5.2, 5.2 to 5.3 light-years
Ran: 8.0, 7.9 to 8.0 light-years
Rigil Kentaurus: 9.5, 9.4 to 9.5 light-years, tied with a neighbour
Toliman: 9.5, 9.4 to 9.5 light-years, tied with a neighbour
```

星雲・星団などの深宇宙天体には等級がありません。`nearest("M31", { kind: "deep-sky", minGrade: "A" })` は `RangeError` になり、`among` に混ぜた場合は `minGrade` を指定すると深宇宙天体は除かれます。

## データファイルでは

`pnpm export:data` の `stars` と `nearby-stars` の表に、`grade` と `distanceQuality` の列があります。`stars` には `positionSource` と `positionResolutionArcsec` もあります(`nearby-stars` には、もともと `positionSource`・`positionErrorArcsec`・`relativeError` があります)。

## これから

等級は、いま2つの層のすべての星についていて、`minGrade` で絞り込めます。これからのものは、チャートで星を選んだときの等級と誤差の表示、そして層を統合して、同じ星を1つとして数え、項目ごとに最良の値をとる層です。
