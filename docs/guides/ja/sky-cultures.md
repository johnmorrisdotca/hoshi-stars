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

ほかの星官のうち42には英語の名前があり、41には`partOf`があります。`partOf`は、その星官が入っている垣か宿のidです(垣は`purple-forbidden` 紫微垣、`supreme-palace` 太微垣、`heavenly-market` 天市垣)。どちらもWikidataに書かれているときだけ入れます。書かれていないときは、こちらで考えて足すことはしません。

```js
import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";

const canopy = chinese.find("華蓋");
console.log(canopy.names.en, canopy.partOf);
console.log(chinese.asterisms().filter((a) => a.partOf === "heavenly-market").map((a) => a.name).slice(0, 4).join(" "));
// Canopy of the Emperor purple-forbidden
// 七公 列肆 天市左垣 天紀
```

### カタログにない星

中国の星官の多くには、6.0等より暗い星が入っています。ブライトスター・カタログにはその星がありません。また、出典にカタログ番号が書かれていない星が入っている星官もあります。図は手元にある星だけを描き、`missing`は「少なくともいくつ足りないか」を返します(星官で見つかった一番大きい番号から、手元の星の数を引いた数です)。足りない星がどちらなのかは分からないこともあるので、デモでは「データにない」と書きます。

中国の星官の星には、名前のとおりの番号もあります。`numbers`は、星のHR番号からその番号を引けます（角宿なら`{ 5056: 1, 5107: 2 }`で、スピカが角宿一です）。宿の1番の星はその宿の距星で、出典が28宿のうち24宿で名前を付けています。番号は出典のとおりで、重なりもそのままです。斗宿には1番の星が2つ、天園には4番の星が2つあり、三台の組はもともと番号を共有しています。固有の名前で知られる星（北斗の星や天狼）は、このパッケージの一覧での順番が番号です。西洋と日本の空には`numbers`がありません。

デモの星空の地図では、中国の空のときに**二十八宿**のスイッチがあります（アドレスでは`layers=mansions`）。二十八宿は空を時圏で分けます。地図は、各宿の距星（1番の星）を通る時圏（赤経、J2000）を、IAUの境界線のような暖色の破線で描きます。線を引くのは、手元の星に1番の星がちょうど1つある宿だけなので、今は28宿のうち23宿です。氐宿・牛宿・觜宿・參宿は出典に1番の星がなく、斗宿は1番の星が2つあるので、出版された一覧で分かるまで線はありません。推測では描きません。三垣の囲み（垣）はまだ描いていません。

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

## 図の絵

デモでは、どの文化も絵のカードで見られ、3つの空は1つの組になっています。どのカードも同じ作りで、絵、その文化の文字での名前、その下の小さな1行からできていて、高さも同じです。小さな1行は、読み(中国の図はピンイン、日本の図はひらがな)と、データに英語名があればその英語名です。西洋のカードでは、略号ともう一方の言語での名前です(`Ori · オリオン座`)。データにない星があるときは、その数(`データにない星が3個以上`)がカードのタイトル(ポインターを合わせると表示され、画面読み上げソフトが読み上げる文字)に入り、3行目にはなりません。いくつかある星のうち1個しか手元にない図には線がありません。カードの絵にはその星だけを輪で囲んで描き、小さな1行は`データにある星は1個、線なし`になります。星空の地図の上の帯、ギャラリー(`constellations.html?culture=chinese`)、一覧表(`constellation-list.html?culture=chinese`)は、どれも「星座の文化」に合わせて変わり、選んだ文化はアドレスに残ります。

| 空 | カード |
|---|---|
| 西洋 | 88枚(88星座)。 |
| 日本 | 106枚。昔からの18の図(昴、北斗七星、鼓星、織姫、彦星など)が先で、そのあとに日本語の名前の88星座。 |
| 中国 | 238枚。まず二十八宿の28枚、そのあとに三垣と二十八宿のそのほかの星官210枚。 |

カードをタップすると、その文化のままで、地図にその図が開きます(`?culture=chinese&pick=C:bei3-dou3`)。検索は、中国語の名前(繁体字でも簡体字でも)、声調記号やスペースのあるなしを問わないピンイン、日本語、かな(カタカナもひらがなも同じ)、ローマ字、英語で見つかります。ギャラリーの題と数は、どの空を見せているかを示します(`中国の空: 238の図`、`宿28と星官210`)。

絵は、88星座の絵と同じ描き方で、このパッケージの星と、私たちが星をつないだ線から描きます。そのため、中国や日本の図も西洋のカードと同じ見た目になります。絵は正方形で、図のまわりの余白は同じ広さです。うしろには、となりの星座の境界線とうすい星が見え、線の太さと星の大きさも同じです。図の星は大きく描き、星のあいだに私たちのつないだ線を引きます。星が2つ以上の図は、うすく色をつけたやわらかい点線の輪郭の中に入ります。西洋のカードの境界線と同じ描き方です。公式の境界線があるのは88星座だけで、この輪郭は、星をつつむ形に余白をつけたものです。描くための補助であり、境界ではありません。絵の幅は5度以上で、となりの星座の境界線が絵の中を1本通るまで広げます(最大24度)。そのため、どの絵にもうすい境界線が入ります。星が1つの図(源氏星はリゲル、天狼はシリウス)は、その星のある星座の絵の中に、その星をアクセント色の輪で囲んで描きます。点だけの絵にはしません。`figureThumbnail`が絵を1枚描き、`paddedOutline`がそのやわらかい輪郭です。

```js
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { figureThumbnail, paddedOutline } from "@johnmorrisdotca/hoshi-stars/thumbnails";
import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";

const dipper = figureOf("北斗", chinese);
const svg = figureThumbnail({ title: "北斗", stars: dipper.stars, segments: dipper.segments }, { theme: "dark" });
const sirius = figureOf("天狼", chinese);
const ringed = figureThumbnail({ title: "天狼", stars: sirius.stars, segments: sirius.segments }, { theme: "dark" });
console.log(svg.includes("stroke-dasharray"), svg.includes("data-hr"), ringed.includes("data-ring"), paddedOutline(dipper.stars).length > 8);
// true true true true
```

中国と日本の図の絵は、Pagesのサイトだけにあるファイルです(`thumbnails/chinese/png/<size>/<look>/<id>.png`、160と480ピクセル、明るい見た目と暗い見た目。256の図、PNG 1,024枚、合わせて15 MB)。`pnpm site`で作ります。npmのパッケージには入れません。npmに入るのは、これまでどおり88星座の絵です。何も表示していないときは何も取りに行きません。カードの絵は、そのカードが画面に入ったときにだけ読みこまれます。

## デモでは

デモの「星座の文化」(西洋・日本・中国)は、アドレスに`culture=`として残ります(西洋のときは何もつきません)。例: `?culture=chinese`。選ぶと、同じ星の上に、その文化の図と名前が描き直されます。図をタップするか、どれかの名前で検索すると、カードが出ます。名前と読み、どんなものか、空の方角、あるいは星座、明るい星、そしてデータにない星があるときは「手元の星だけを描いています」という注意です。Wikidataに書かれているときは、その星官が入っている垣か宿も出ます。埋めこみページも同じ`culture=`を使います。

漢字を習っているとちゅうの子どもや、日本語を学んでいる人のために、中国の空の日本語ページでは、三垣(さんえん)、二十八宿(にじゅうはっしゅく)、星官(せいかん)と、28の宿それぞれの名前の上に、小さなふりがなをつけることができます。地図の上のカードの列、ギャラリー、表のどれでも使えます。はじめはついていません。ほかの切りかえボタンのとなりにある「ふりがな」ボタンをおすか、アドレスに`readings=on`をつけると出ます。例: `constellations.html?culture=chinese&lang=ja&readings=on`。ボタンでえらんだオンかオフかは、そのブラウザに残り、アドレスにも入ります。アドレスに`readings=on`があると、そのページをひらいたときだけ、ふりがながつきます。ブラウザに残っているオンかオフかは、変わりません。プリントのページにある、ふりがなつきのギャラリーへのリンクも、このやり方です。英語のページにはこのボタンはありません。カードにピンインと英語がもうのっているからです。

## データのもと

中国の星官は、Wikidata(CC0)から読みました。どの星がどの昔の名前を持つか、という事実です。線、西洋の星の並び、日本の図は、私たちが星をつないだものです。Stellariumの星座文化ファイルはGPLとCC BY-SAなので使っていません。非営利や継承(share-alike)の条件がある資料も使っていません。[データとライセンス](data-and-licences.md)に表があり、`NOTICE.md`に、資料ごとのアドレスと読んだ日があります。
