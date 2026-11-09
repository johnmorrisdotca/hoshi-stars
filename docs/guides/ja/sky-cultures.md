---
title: 星座の文化
section: how-to
order: 9
description: 同じ星を、西洋・日本の伝統・中国の伝統の図と名前で見ます。88星座と星の並び、昴と北斗七星、二十八宿を、英語・日本語・簡体字・繁体字で引けます。
---

[English](../sky-cultures.md)

星座は、人びとが星をつないだ形です。つなぎ方は文化によってちがいます。ここでいう「文化」は、同じブライトスター・カタログの星でできた、名前と読みのついた図のまとまりです。IAU(国際天文学連合)の88星座がふつうの設定で、それは何も変わりません。文化は3つあり、それぞれ別のimportなので、使うものの分だけ読みこめば足ります。

| import | 入っているもの |
|---|---|
| `@johnmorrisdotca/hoshi-stars/cultures/western` | 88星座の名前(ラテン語・英語・日本語・中国語の簡体字と繁体字、ピンインつき)と、北斗七星・夏の大三角・秋の四辺形など17の星の並び。 |
| `@johnmorrisdotca/hoshi-stars/cultures/japanese` | 日本語の名前の88星座と、日本で昔から使われた18の星の名前と図。昴(すばる)・北斗七星・鼓星(つづみぼし)・織姫・彦星など、読みつきです。 |
| `@johnmorrisdotca/hoshi-stars/cultures/chinese` | 中国の伝統の空、三垣二十八宿(さんえんにじゅうはっしゅく)。238の星官を、繁体字・簡体字・ピンインの名前で引けます。 |
| `@johnmorrisdotca/hoshi-stars/culture` | 型と、自分の文化を作る`defineCulture`。 |

文化は、いつも使っている関数に追加の引数として渡します。`constellations(culture)`、`constellation(text, culture)`、`starsIn(text, culture)`、`figures(culture)`、`figureOf(text, culture)`です。渡さなければ、これまでどおりIAUの88星座です。

## 中国の伝統の空

```js
import { constellation, constellations, starsIn } from "@johnmorrisdotca/hoshi-stars/constellations";
import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";

const dipper = constellation("北斗", chinese);
console.log(dipper.name, dipper.readings.zh, dipper.kind);
console.log(starsIn("beidou", chinese).map((star) => star.name).join(", "));
console.log(constellations(chinese).length, constellations(chinese).filter((a) => a.kind === "mansion").length);
// 北斗 běi dǒu asterism
// Alioth, Dubhe, Alkaid, Mizar, Merak, Phecda, Megrez
// 238 28
```

`constellation`と`figureOf`は、どの名前でも図を見つけます(繁体字でも簡体字でも、ピンインは声調記号があってもなくても、idでも。大文字小文字は区別しません)。28の宿(しゅく)が最初に並び、それぞれ英語の名前と、空のどの方角にあるか(青龍`azure-dragon`・玄武・白虎・朱雀)を持ちます。

```js
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";

const horn = figureOf("角宿", chinese);
console.log(horn.asterism.names.en, horn.asterism.group, horn.asterism.readings.zh, horn.stars.map((star) => star.name).join(", "));
// Horn azure-dragon jiǎo xiù Spica, Heze
```

スピカは角宿一(かくしゅくいち)、つまり角宿の1番目の星です。中国の星の名前は「星官の名前 + その中の番号」なので、星の名前がデータの第一歩です。

### カタログにない星

中国の星官の多くには、6.0等より暗い星が入っています。ブライトスター・カタログにはその星がありません。図は手元にある星だけを描き、`missing`は「少なくともいくつ足りないか」を返します(星官で見つかった一番大きい番号から、手元の星の数を引いた数です)。

```js
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";

const guard = figureOf("羽林軍", chinese);
console.log(guard.stars.length, guard.asterism.missing);
// 7 32
```

羽林軍(うりんぐん)は、昔の表では45個ほどの星からなりますが、カタログにあるのは7個です。線は私たちがつないだものです。ある星官の星を、すべてに届く一番短い線の組み合わせでつないだもので、昔の絵そのままではありません。238の星官のうち195は、つなぐ星が2つ以上あります。残りは星1つです。

昔の表で名前が重なる星官があります(柱・天田・杵・五諸侯)。それぞれ、近くにある星どうしの組に分け、`tian1-tian2`、`tian1-tian2-2`のようなidをつけています。名前だけで引くとどちらも見つからないので、idを使ってください。

## 日本の伝統の空

```js
import { constellation, starsIn } from "@johnmorrisdotca/hoshi-stars/constellations";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";

const subaru = figureOf("すばる", japanese);
console.log(subaru.asterism.name, subaru.asterism.readings.ja, subaru.asterism.names.en, subaru.stars.map((star) => star.name).join(", "));
console.log(constellation("六連星", japanese).id, constellation("Hokuto Shichisei", japanese).aka.join(" "));
console.log(starsIn("鼓星", japanese).length);
// 昴 すばる Subaru Taygeta, Maia, Electra, Merope, Alcyone, Atlas
// subaru 七つ星 ななつぼし 四三の星 しそうのほし
// 7
```

どの図も、自分の文字での`name`、ひらがなの`readings.ja`、ローマ字の`names.en`、ほかの呼び名の`aka`(昴の六連星、北斗七星の七つ星など)、短い英語の説明`about`(`the Pleiades`)を持ちます。名前と読み、それが指す星は`NOTICE.md`にあげたページから読みました。日本語は、日本語を母語とする方の確認を待っています。線は私たちがつないだものです。

## 西洋の空と、いろいろな言語の名前

```js
import { constellation, starsIn } from "@johnmorrisdotca/hoshi-stars/constellations";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { western } from "@johnmorrisdotca/hoshi-stars/cultures/western";

for (const text of ["天龍座", "天龙座", "tiān lóng zuò", "りゅう座", "Draco", "Dragon"]) console.log(text, constellation(text, western).id);
const dra = constellation("Dra", western);
console.log(dra.names["zh-Hans"], dra.names["zh-Hant"], dra.readings.zh, dra.names.ja);
const triangle = figureOf("Summer Triangle", western);
console.log(triangle.stars.map((star) => star.name).join(", "), triangle.segments.length);
console.log(starsIn("夏の大三角", western).length);
// 天龍座 Dra
// 天龙座 Dra
// tiān lóng zuò Dra
// りゅう座 Dra
// Draco Dra
// Dragon Dra
// 天龙座 天龍座 tiān lóng zuò りゅう座
// Vega, Altair, Deneb 3
// 3
```

88星座の中国語の名前は、西洋の文化に入っています。繁体字は台湾の国家教育研究院の天文学用語、簡体字はその名前を大陸の字で書いたものです。どちらも、中国語を母語とする方の確認を待っています。

## 自分の文化

`defineCulture`は、図を並べる関数から文化を作ります。図の星は、ブライトスター・カタログ(HR)番号の鎖(くさり)です。

```js
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { defineCulture } from "@johnmorrisdotca/hoshi-stars/culture";

const mine = defineCulture("mine", { en: "Mine", ja: "私の" }, () => [
  { id: "w", name: "W", names: { en: "The W" }, readings: {}, aka: [], about: "", kind: "asterism", group: undefined, missing: 0, chains: [[21, 168, 264, 403, 542]] },
]);
console.log(figureOf("the w", mine).stars.map((star) => star.name).join(", "));
// Caph, Schedar, Navi, Ruchbah, Segin
```

## デモでは

デモの「星座の文化」(西洋・日本・中国)は、アドレスに`culture=`として残ります(西洋のときは何もつきません)。例: `?culture=chinese`。選ぶと、同じ星の上に、その文化の図と名前が描き直されます。図をタップするか、どれかの名前で検索すると、カードが出ます。名前と読み、どんなものか、空の方角、あるいは星座、明るい星、そしてカタログにない星があるときは「手元の星だけを描いています」という注意です。埋めこみページも同じ`culture=`を使います。

## データのもと

中国の星官は、Wikidata(CC0)から読みました。どの星がどの昔の名前を持つか、という事実です。線、西洋の星の並び、日本の図は、私たちが星をつないだものです。Stellariumの星座文化ファイルはGPLとCC BY-SAなので使っていません。非営利や継承(share-alike)の条件がある資料も使っていません。[データとライセンス](data-and-licences.md)に表があり、`NOTICE.md`に、資料ごとのアドレスと読んだ日があります。
