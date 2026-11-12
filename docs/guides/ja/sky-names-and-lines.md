---
title: 星の名前とうすい星座の線
section: how-to
order: 12
description: いちばん明るい星の名前と、星座の形をとてもうすい線にして、自分で描く空に重ねる方法です。ポインターが乗っている星座だけを濃くする方法、空の一部をおおうものの扱い、見た目を設定だけで変える方法も説明します。
---

[English](../sky-names-and-lines.md)

`@johnmorrisdotca/hoshi-stars/sky-labels`は、ページが自分で描く空（3Dシーン、canvas、SVG）のためのものです。カメラの管理と描画はページが行います。ページは「この星は画面のどこにあるか」を伝えます。このパッケージは、どの星に名前を付けるか、名前をどこに置くか、88の星座の形を線としてどの濃さで描くかを決めます。どちらも**指定するまでオフ**です。そのため、空のほとんどは線も名前もない状態で表示されます。

## 属性とプロパティ

ページが要素の属性として設定できるようにしておけば（設定パネルから値を入れられます）、パッケージのパーサーで読めます。どのページでも同じ意味になります。

| 属性 | 意味 | オフになるとき |
|---|---|---|
| `star-names="12"` | 画面の中にあって、おおわれていない星のうち、いちばん明るい12個に名前を付けます。値を書かない`star-names`は10個として扱います。最大335個（名前のある星すべて）。 | 属性がない、`0`、数値ではない文字列 |
| `star-names-magnitude="1.5"` | 等級が1.5以下の、明るい星だけに名前を付けます（等級は小さいほど明るい。シリウスは-1.46等で、1.5なら明るい22個）。`star-names`も指定したときは、両方の条件に当てはまる星だけです。 | 属性がない、数値ではない |
| `constellation-lines="0.16"` | 88の星座の形を、この濃さ（0から1）で描きます。値を書かない`constellation-lines`は0.16として扱い、とてもうすい線になります。ポインターが乗っている星座（線の上でも、その星座の星の上でも）、またはタッチした星座は、濃さが1になり、名前も出ます。 | 属性がない、`0`、`off`、`false`、数値ではない文字列 |

`starNamesFromAttributes(count, magnitude)`と`lineStrengthFromAttribute(value)`が、これらの属性の値（文字列）を読み取ります（属性の名前は`STAR_NAMES_ATTRIBUTES`と`CONSTELLATION_LINES_ATTRIBUTE`にあります）。属性にできないものは、コードで渡します。

| 渡す場所 | 型 | 使いみち |
|---|---|---|
| `StarNames.update(project, view, covered)`の3番目の引数 | `CoverMask`。`(x, y) => boolean`で、空をおおうものがある場所なら`true` | 星の手前にある地球、惑星、パネルなど。うしろにある星の名前は出さず、次に明るい星に名前を付けます。 |
| `createStarNames`と`createFigureLines`の設定の`style`（`set`でも同じ） | `LabelStyle`の一部 | 見た目（下の「見た目は設定で決める」の節） |

空をおおうものが何かは、パッケージにはわかりません。ページが知っていて、丸いものなら`discCover(x, y, radius)`、それ以外は自分で書いた関数で伝えます。

## 使い方

```js
import { createFigureLines, createStarNames, discCover, labelStyleVars, lineStrengthFromAttribute, starNamesFromAttributes } from "@johnmorrisdotca/hoshi-stars/sky-labels";

// Your own sky: this one looks at Orion, 8 pixels to the degree, in a view 1280 by 720.
const project = (ra, dec, out) => {
  const across = ((ra - 84 + 540) % 360) - 180;
  out.x = 640 - across * 8;
  out.y = 360 - dec * 8;
  return Math.abs(across) < 80;
};
const view = { width: 1280, height: 720 };

// The names. The settings come from the page's attributes, star-names="5" here, and a look is a setting too.
const names = createStarNames({ ...starNamesFromAttributes("5", null), style: { case: "upper" } });
names.update(project, view);
console.log(names.labels.map((label) => label.text).join(", "));

// A body in front of the sky hides the stars behind it: here a disc over Sirius, and the next star is named instead.
const sirius = names.labels[0];
names.update(project, view, discCover(sirius.x, sirius.y, 30));
console.log(names.labels.map((label) => label.text).join(", "));

// The lines, from constellation-lines="0.3": every figure at that strength, the one under the pointer at full strength.
const lines = createFigureLines({ strength: lineStrengthFromAttribute("0.3") });
lines.update(project, view);
const orion = lines.figures.find((figure) => figure.abbreviation === "Ori");
lines.point(lines.segments[orion.start * 4], lines.segments[orion.start * 4 + 1]);
const other = lines.figures.find((figure) => figure !== lines.picked);
console.log(lines.picked.abbreviation, lines.name.text, lines.opacityOf(lines.picked), lines.opacityOf(other));

// The look as CSS custom properties, to set on the element that holds the labels.
console.log(labelStyleVars({ size: 14, case: "upper" })["--hoshi-label-size"]);

// SIRIUS, RIGEL, PROCYON, BETELGEUSE, ALDEBARAN
// RIGEL, PROCYON, BETELGEUSE, ALDEBARAN, POLLUX
// Ori Orion 1 0.3
// 14
```

`createStarNames(settings)`が返すオブジェクトの`update(project, view, covered)`を呼ぶと、描く名前（ラベル）が`labels`に入ります（明るい順。1件ごとに`StarNameLabel`で、星、文字列、枠、引き出し線（星と名前をつなぐ短い線）が入っています）。`createFigureLines(settings)`が返すオブジェクトの`update(project, view)`は、線を`segments`に並べます（1本につき数値4つ。`figures`の`FigureOnScreen`は、`start`から`end`の手前までの線を持ちます）。`opacityOf(figure)`は、その星座をどの濃さで描くかを返します。`point(x, y)`はポインターの場所を伝え、選ばれた星座が変わったときに`true`を返します。そのときは、描き直してください。引数なしの`point()`は、ポインターが出ていったことを伝えます。指の場合は、タッチのときに`point`を呼び、次にタッチするまで、選ばれた星座はそのままにします。選ばれた星座の`name`は`FigureName`で、文字列と置く場所が入っています。場所は星座のすぐ上で（星座がビューの上の端に届くときは下）、星の名前には重なりません。重ならないようにするには、`update`の3番目の引数に`names.labels`を渡します（`lines.update(project, view, names.labels)`）。邪魔になる星の名前があれば、星座の名前はその上へ移ります。星座の星にポインターが乗っているときも、線の上のときと同じように、星座全体が濃くなります。キーボードで選ぶときは、`step(1)`で見えている次の星座を、`step(-1)`で前の星座を選びます（カタログの順で、最後の次は最初に戻ります）。選ばれた星座が変わったときに`true`を返します。デモでは、この2つを`]`と`[`のキーに割り当て、Escキーで`point()`を呼びます。

`project`は`SkyProjector`です。星の赤経と赤緯（度）を受け取り、画面上の場所を`ScreenPoint`に書き込み、カメラの前にない星なら`false`を返します。`view`は`SkyView`で、使う範囲の大きさと、省略できる`margin`です。名前が残るのは、名前全体と引き出し線がビューに収まるときだけです。名前どうしが重なることはありません。名前は明るい星から順に置きます。1つの名前ごとに、星の右、左、上、下の順に試します（`LABEL_SIDES`の1つ1つが`LabelSide`です）。ほかの名前、ほかの名前のリング、星の点のどれにも重ならない、最初の場所に置きます。ここでいう星の点は、`dotMagnitude`（初期値3）より明るい星の点で、半径は`dotRadius`ピクセル（初期値3）です。ページが描く大きさに合わせて設定してください。空いている場所がなければ、その名前は出さずに、次の星を試します。`placeLabel`は、1つの側への置き方だけを取り出した関数です。名前は英語（IAUのつづり）で出ます。`lang: "ja"`（`NameLanguage`）なら、カタカナで出ます。カタカナがない星は英語で出ます。星座の名前も同じように、ラテン語か日本語です。

### ほかの文化の星座

`createFigureLines({ culture })`は、88星座の代わりに、ある文化の図を並べます。`@johnmorrisdotca/hoshi-stars/cultures/…`の`japanese`か`chinese`（または`defineCulture`で作った自分の文化）を渡します。図はその文化のもので、その文化の順に並び、各`FigureOnScreen`の`abbreviation`は図のid（星座なら`Ori`、ほかは`subaru`や`bei3-dou3`）です。`update`、`point`、`step`、`opacityOf`と名前の扱いは、88星座のときと同じです。星座の名前は88星座と同じです（ラテン語、`lang: "ja"`なら日本語）。星の並び（アステリズム）は英語の名前（`Subaru`）で、日本語ではかなの読み（`すばる`）で出ます。指定した言語の名前がない図は、その図自身の名前（`昴宿`）で出ます。`set`で別の文化を渡すと、その文化の図を一度だけ作り、選ばれていた図は選ばれなくなります。`culture`を省くと、また88星座を描きます。

```ts
import { createFigureLines } from "@johnmorrisdotca/hoshi-stars/sky-labels";
import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";

// the Japanese sky, its names in Japanese, the Pleiades in the middle of the view
const lines = createFigureLines({ culture: japanese, lang: "ja" });
const project = (ra: number, dec: number, out: { x: number; y: number }): boolean => {
  out.x = 640 - (ra - 56.9) * 40;
  out.y = 360 - (dec - 24.1) * 40;
  return Math.abs(ra - 56.9) < 15 && Math.abs(dec - 24.1) < 9;
};
lines.update(project, { width: 1280, height: 720 });
const subaru = lines.figures.find((figure) => figure.abbreviation === "subaru")!;
lines.point(lines.segments[subaru.start * 4]!, lines.segments[subaru.start * 4 + 1]!);
console.log(lines.figures.length, lines.picked?.abbreviation, lines.name?.text);
// 106 subaru すばる
```

## 止まっているときは描き直さず、動いているときもメモリを新しく使わない

`update`と`point`を呼ぶのは、何かが変わったときです。カメラが動いた、大きさが変わった、設定が変わった、というときです。止まっているときは、呼ぶものも描き直すものもありません。最初の呼び出しのあとは、メモリを新しく使いません（配列とオブジェクトを使い回し、`labels`と`figures`も毎回同じものです）。そのため、カメラが動いている間は、毎フレーム`update`を呼んでかまいません。選ばれた星座が変わらないままポインターが動くときは、`point`が`false`を返すので、ページは何も描きません。

## 初期の見た目とフォント

初期の見た目は、いくつかの案から選んだ「Display with catalogue letters」（見出し用の書体にカタログの記号をそえた案）です。名前は、Michromaというフォントの小さな大文字で、文字の間隔を広めにとります。星のまわりには細いリングを描き、名前の下には、星のカタログの記号を小さな等幅フォントで書きます（`α Ori`。バイエル符号もフラムスティード番号もない星には、書く記号がありません）。どの部分も、次の節の設定で変えられます。

このパッケージにフォントは入っていません。Michromaは、このパッケージ群で共通の「天体の名前用」フォントで、ページ側がkazoku-uiの`loadBodyLabelFont()`（`@johnmorrisdotca/kazoku-ui/body-label`、バージョン0.36以降）で読み込みます。この関数を呼んだときだけ、64 kBのファイルをダウンロードします。フォントが入るまでは、次の候補の`system-ui`で表示します。自分のフォントを使うページは、`font`にそのフォントを指定して、読み込んでおきます。埋め込みページは、名前か線がオンのときだけ、同じサイトに置いたコピー（`fonts/`。ライセンスはSIL Open Font License 1.1）からMichromaを読み込みます。

## 見た目は設定で決める

見た目は固定されていません。見た目は`LabelStyle`という1つのオブジェクトで、初期値（`DEFAULT_LABEL_STYLE`）があります。範囲外の値は、`labelStyle(part)`が範囲内に収めます。エラーにはなりません。

| 項目 | CSSカスタムプロパティ | 内容 | 初期値 |
|---|---|---|---|
| `font` | `--hoshi-label-font` | フォントファミリー | `Michroma, system-ui, sans-serif` |
| `size` | `--hoshi-label-size` | ピクセル（6から48） | 11 |
| `weight` | `--hoshi-label-weight` | 100から900 | 400 |
| `colour` | `--hoshi-label-colour` | CSSの色 | 目立たない白 |
| `halo` | `--hoshi-label-halo` | 星の上でも読めるように文字のまわりに付ける縁取りの色。`none`で縁なし | 暗い青 |
| `haloWidth` | `--hoshi-label-halo-width` | ピクセル（0から12） | 3 |
| `case` | `--hoshi-label-case` | `small-caps`（小さな大文字。CSSの`font-variant: small-caps`で描きます）、`as-written`（そのまま）、`upper`（大文字）、`lower`（小文字）。日本語は変わりません | `small-caps` |
| `letterSpacing` | `--hoshi-label-letter-spacing` | em（-0.1から1） | 0.14 |
| `leader` | `--hoshi-label-leader` | 星から名前までの短い線の長さ（ピクセル、0から80）。0なら線なしで、名前は星のそばに出ます | 0 |
| `leaderColour` | `--hoshi-label-leader-colour` | CSSの色 | 目立たない青みがかった白 |
| `offset` | `--hoshi-label-offset` | リング（リングがなければ星）から、名前（または引き出し線）までのすきま。ピクセル（0から40） | 4 |
| `ring` | `--hoshi-label-ring` | 名前を付けた星のまわりに描く細いリングの半径。ピクセル（0から30）。0ならリングなし | 6 |
| `ringColour` | `--hoshi-label-ring-colour` | CSSの色 | 目立たない青みがかった白 |
| `ringWidth` | `--hoshi-label-ring-width` | ピクセル（0.25から4） | 0.75 |
| `designation` | `--hoshi-label-designation` | `below`は、星のカタログの記号（`α Ori`）を名前の下に小さく書きます。`none`は書きません | `below` |
| `designationFont` | `--hoshi-label-designation-font` | その行のフォントファミリー | 小さな等幅フォント |
| `designationSize` | `--hoshi-label-designation-size` | ピクセル（6から24） | 9 |
| `designationColour` | `--hoshi-label-designation-colour` | CSSの色 | さらに目立たない白 |

`LABEL_STYLE_PROPERTIES`に、これらのプロパティ名があります。`labelStyleVars(style)`は、ラベルを入れる要素に設定するカスタムプロパティを返します。`labelStyleFrom(read)`は、カスタムプロパティから見た目を読み取ります（`(name) => getComputedStyle(element).getPropertyValue(name)`）。`labelText(name, style)`は大文字・小文字の設定を反映した文字列を返し、`labelWidth`、`designationWidth`、`labelHeight`は、名前とカタログの記号に必要な幅と高さを返します。これで、見た目を選ぶのは設定を変えるだけになり、コードを書き足す必要はありません。線の濃さも設定です（`strength`。0から1。初期値は`DEFAULT_LINE_STRENGTH`の0.16。`clampStrength`が範囲に収めます）。ポインターが線にどれくらい近ければ選ぶかも設定です（`reach`。初期値は14ピクセル。指なら大きめに）。平面の地図では、描く線の長さの上限も決められます（`maxLength`。地図の継ぎ目をまたぐ星座の線を、地図の端から端まで描かないためです）。

## 埋め込みページでは

iframe用のページも、同じ設定をURLのパラメーターから読みます。`star-names=12`、`star-names-magnitude=1.5`、`constellation-lines=0.16`、そして見た目は`label-`に項目名を付けたものです（`label-size=14`、`label-case=upper`、`label-leader=14`、`label-halo=none`。色の`#`は`%23`と書きます）。`constellation-lines`があるときは、`lines`レイヤーの代わりにその線を描き、`star-names`があるときは、チャート自身の星の名前の代わりにその名前を描きます。マウスポインターは、乗っている星座（線の上でも星の上でも）を選びます。外に出ると、選ばれなくなります。指は、タッチした星座を選び、次にタッチするまでそのままです。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hoshi Stars with names and faint lines</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/embed.html?ra=84&dec=0&zoom=1.5&layers=milky&star-names=10&constellation-lines=0.16&label-case=upper&label-leader=14"
      title="The sky around Orion with its brightest stars named and its constellations in faint lines"
      width="480"
      height="360"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

## データの出どころ

名前は、IAU（国際天文学連合）の恒星名ワーキンググループの一覧のものです。カタログの星のデータに、すでに入っています（名前は事実のデータです。カタカナは手作業で付けたもので、詳しくは`NOTICE.md`を見てください）。星座の形は、このパッケージ自身のもので、星の位置から決めました。ここでは、データもファイルも足していません。このエントリーポイントの大きさは、配布される形（コメントを含む）でgzipして約7 kBです。ページがすでに読み込んでいる星と線の表のほかに、増えるのはこの分だけです。
