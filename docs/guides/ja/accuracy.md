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

- `source`: その値がどのカタログのものか。`BSC`(イェール輝星カタログ)、`GCTP`(イェール三角視差総合カタログ)、`2MASS`(2ミクロン全天サーベイ)、`UCAC4`(米国海軍天文台の第4 CCD アストログラフカタログ)、`dynamical`(連星の軌道から求めた輝星カタログの視差)、`literature`(発表された論文から書き写した距離)のいずれかです。その星にその値がないときは `undefined` です。
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

位置は、誤差(誤差がないときは `resolution`)が2秒角以下のとき**新しい**とします。輝星カタログは位置の誤差を示していないので、輝星では測定された誤差ではなく、表示されている位置の桁(resolution)、最大でも1.5秒角を使います。これは2秒角以内なので、新しいものに数えます。近くの星は、2MASS の位置なら新しく、イェールカタログ自身の位置(1900年から移したもの)なら粗いとします。誤差が示されていない視差は粗いものとして扱うので、その星は等級 C です。ただし力学視差(`dynamical`)のうち2.5ミリ秒角以上のものだけは、まあまあ(fair)とします。力学視差は1ミリ秒角きざみで示されるので、四捨五入の幅である0.5ミリ秒角がそのまま誤差になり、視差が1か2ミリ秒角だと誤差が20%を超えて、粗い(rough)ものになります(アダーラの1ミリ秒角には、50%の誤差があります)。`STAR_GRADES` は等級を良い順に並べたもので、`gradeAtLeast(grade, "B")` で、等級が基準以上かどうかを調べられます。

## 数

層ごと、等級ごとの数です。「ふつうの誤差」は、出典が示している誤差の中央値です(誤差がある星だけで数えます)。どの出典も示していない数値は書きません。

| 層 | 星の数 | 等級 A | 等級 B | 等級 C | ふつうの誤差 | 数値の出典 | ライセンス |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 明るい星(メインのimport) | 5,080 | 68 | 452 | 4,560 | 視差 9.7ミリ秒角(誤差が示されている2,329個)。位置は1.5秒角きざみで、誤差は示されていません | イェール輝星カタログと、一部の星はイェール視差 | イェール輝星カタログ: 非公式にパブリックドメイン、出典の明記つき。イェール視差: ライセンスの記載なし、出典を明記して使い、要請があれば除きます(`NOTICE.md`) |
| 近くの星(`/nearby`) | 5,565 | 236 | 1,281 | 4,048 | 視差 10.6ミリ秒角。位置 0.1秒角(4,352個は 2MASS、133個は UCAC4 の位置) | イェール三角視差総合カタログと 2MASS・UCAC4 の位置 | イェール視差: 上と同じ。2MASS: 米国政府の著作物、出典を明記(`NOTICE.md`) |
| 暗い星(`/faint`) | 2,461,864 | 0 | 0 | 2,461,864 | 視差なし。タイルには位置の誤差を入れていません | UCAC4 と APASS の明るさ | UCAC4: 無料、論文を引用。APASS: 出典を明記(`NOTICE.md`) |
| **明るい星と近くの星(`/catalogue`)** | **10,645** | **304** | **1,733** | **8,608** | | | |

暗い星には視差がないので、ルールどおり等級 C です。暗い星のタイルは `/catalogue` には入っていません(下を見てください)。

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

## ひとつのカタログ: 層をまとめる

`@johnmorrisdotca/hoshi-stars/catalogue` は、明るい星と近くの星をひとつの一覧にします。どの星も1回だけで、変わらない ID がつきます。明るい星は `hr-` と輝星カタログの番号(`hr-2491` はシリウス)、近くの星は `gctp-` とイェール視差カタログの番号(`gctp-3278` はプロキシマ・ケンタウリ)です。`/distance`・`/names`・`/sky-from` がすでに使っている ID と同じです。2つの表を両方読み込む(gzip で約386 kB)ので、片方の層だけでよいページは、その層だけを import してください。

```js
import { catalogueCounts, catalogueStar, catalogueStars } from "@johnmorrisdotca/hoshi-stars/catalogue";

for (const count of catalogueCounts()) console.log(`${count.layer}: ${count.stars} stars, A ${count.grades.A}, B ${count.grades.B}, C ${count.grades.C}`);

const proxima = catalogueStar("gctp-3278");
const [near, far] = proxima.distance.lightYearsRange;
console.log(`${proxima.id} ${proxima.name}: ${proxima.layer} tier, grade ${proxima.grade}, ${near.toFixed(2)} to ${far.toFixed(2)} light-years`);

const sure = catalogueStars({ minGrade: "A", magnitude: 9 });
console.log(`${sure.length} grade A stars to magnitude 9, the faintest ${sure.at(-1).name ?? sure.at(-1).id}`);
```

出力は次のとおりです。

```text
bright: 5080 stars, A 68, B 452, C 4560
nearby: 5565 stars, A 236, B 1281, C 4048
gctp-3278 Proxima Centauri: nearby tier, grade A, 4.20 to 4.27 light-years
104 grade A stars to magnitude 9, the faintest gctp-2345
```

`catalogueStars(options)` は星を明るい順に返します(明るさがない近くの星7個は最後)。`layers`(`["bright"]`・`["nearby"]`・両方。`CATALOGUE_LAYERS`)、`magnitude`、`minGrade` を受け取ります。`CatalogueStar` には、`id`・`layer`・`name`・`designation`・`hd`・J2000 の位置・`magnitude`・`grade`・`distance`(`starDistance` と同じ、距離とその誤差と範囲)と、`star` にその層のもとの記録があります。`starAccuracy` などにはこれを渡します。`catalogueStar(id)` は ID から星を探し、`catalogueId(star)` は星の ID を返し、`catalogueCounts()` は上の表の数を返します。

同じ星を1回だけ数えるしくみ。2つの層は、どの星も両方に入らないように作られています。

- **イェール視差と明るい星**(`scripts/make-star-data.py`): HD 番号が同じで、V 等級の差が1.0以内の明るい星に、その視差をつけます。2,329個が一致し、2,325個はその視差を使い、4個は論文の距離を使います。
- **近くの星の層**(`scripts/make-nearby-data.py`): イェール視差カタログから明るい星を除いた残りです。まず HD 番号で、HD 番号がなければ位置(固有運動で動かしたあと15秒角以内)と V 等級(1.0以内)で除きます。新しい星は5,565個で、そのうち1,029個に `flags.ambiguousMatch` がついています(30秒角以内に明るい星がある、合う 2MASS の天体がいくつかある、または6.1等より明るいのに明るい星の中にない)。テストで、HD 番号が両方の層にないこと、フラグのない近くの星が明るい星から15秒角以内・1等以内にないことを確かめています。
- **同じ元期と座標系。** どちらの層も J2000、元期2000年です。明るい星は輝星カタログの位置、近くの星は固有運動で2000年に移した 2MASS の位置か、1900年から移したイェールの位置です。
- **連星。** イェールカタログは連星系にひとつの視差を示すので、ペアの明るい2つの星は同じ視差を持ちます(リギル・ケンタウルスとトリマンは同じ距離です)。明るい星の層に入るには暗く、イェールカタログが別の星として示していない伴星は、どちらの層にも入りません。はくちょう座61番星B(HR 8086、V 6.03)がその例です。
- **暗い星のタイル**は、明るい星をすでに除いています(20秒角以内・1.5等以内の45個。[暗い星](faint-stars.md))。近くの星はまだ除いていないので、`/catalogue` には入れていません。

## データファイルでは

`pnpm export:data` の `stars` と `nearby-stars` の表に、`grade` と `distanceQuality` の列があります。`stars` には `positionSource` と `positionResolutionArcsec` もあります(`nearby-stars` には、もともと `positionSource`・`positionErrorArcsec`・`relativeError` があります)。

## これから

等級は明るい星と近くの星のすべてについていて、`minGrade` で絞り込め、チャートで星を選ぶと表示され、`/catalogue` はそれらの星を1回ずつ数えます。これからのものは、近くの星を暗い星のタイルと照らし合わせて、両方にある星を1回だけ描いて数え、値ごとに一番よい出典をとることです。
