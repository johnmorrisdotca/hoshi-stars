---
title: 印刷するシート
section: how-to
order: 6
description: 星座の点つなぎ、国や地域の星座、緯度に合わせた切り抜きの星の回転盤、月ごとの星空の地図を、A4 と US レター、英語と日本語で印刷できます。できあがりの PDF もあります。
---

[English](../printable-sheets.md)

`/sheets` は、このパッケージ自身の星と星座の線から、印刷できるものを4種類かきます。どれも、ミリメートルが単位の SVG の文字列です (絵の1ミリは紙の1ミリ)。ブラウザも、ほかのパッケージもいりません。

- **点つなぎ** (`dotsSvg`, `dotsFigure`): 星座の線の星を、明るさに合わせた大きさの点にして、線をひく順に番号をつけます。こども向けです。答えのページには線があります (太さ1 mm)。点は、いちばん近い点までのきょりの3分の1より大きくなりません (大きさは `DOT_LIMITS` の下限と上限のあいだ。こども向けは1〜5 mm、ふつうは0.6〜2 mm)。ページの上で2つの星が、いちばん小さい点でも区別できないほど近いときは、2 mm までずらして離します (そこでは図は正確な縮尺ではありません。点をつなぐためのもので、長さをはかるためではありません)。番号は、点・線・ほかの番号にふれないところに置きます。すべての図、すべてのむずかしさ、すべての種類と用紙で、テストが確かめています。むずかしさは3つ。`easy` は明るい星5〜10個を1本の線で、`medium` は線の星をぜんぶ、`hard` は番号のない点だけで、星をさがします。線が何本かあるときは、新しい線のはじまりの点に「まる」がつきます (ペンをはなして、そこからかきはじめます)。線がもう一度通る星は、番号が2つ (`4·8`) つきます。
- **あなたの空** (`skyForLatitude`, `regionGuideSvg`): その緯度で、いつも見える星座、その月の夜 (太陽の時刻で21時ごろ、15日) に見やすい星座、一度も見えない星座です。ほとんどは緯度で決まります。シドニーではこぐま座は見えず、トロントではみなみじゅうじ座は見えず、きたしちせいは沈みません。
- **星の回転盤** (`starWheelDisc`, `starWheelPlate`, `starWheelPoster`): その緯度の星座早見盤を、切りぬいて作ります。まわりに日付がある星の盤と、地平線が窓になっていて、まわりに時刻がある板です。日付を見る時刻に合わせて盤をまわします。ポスター版は直径400 mm で、何ページかに分けて印刷します。緯度は北緯・南緯の20〜70度に対応しています。
- **月ごとの星空の地図** (`skyMapSvg`): ある緯度の夜空です。ふちが地平線、まんなかが天頂で、星座の線と、見えている有名な星座の名前がのっています。

```ts
import { DOT_LIMITS, dotsSvg, latitudeBand, monthName, skyForLatitude, skyMapSvg, starWheelPlate } from "@johnmorrisdotca/hoshi-stars/sheets";

const room = { widthMm: 184.6, heightMm: 190 };
console.log(dotsSvg("Ori", { ...room, level: "easy", lang: "ja" }).includes("1から"), DOT_LIMITS.kid.ceiling);

const sydney = skyForLatitude(-33.9);
console.log(sydney.find((one) => one.constellation.abbreviation === "UMi")?.standing, sydney.find((one) => one.constellation.abbreviation === "Cru")?.standing);
console.log(latitudeBand(-33.9, "ja"), monthName(7, "ja"));
console.log(starWheelPlate(-34, { ...room, lang: "ja" }).includes('data-cut="window"'), skyMapSvg(-34, 7, { ...room, lang: "ja" }).includes("きた"));
```

## 関数

| 関数 | 返すもの |
|---|---|
| `DOT_LEVELS`, `DOT_LIMITS`, `dotsFigure(name, { level, widthMm, heightMm, type })` | むずかしさ (`easy`, `medium`, `hard`)、種類ごとの点の最小と最大の半径 (mm)、点・番号・線にならべた図 |
| `dotsSvg(name, { level, widthMm, heightMm, lang, answer, type })`, `dotsSubtitle(constellation, lang)` | 問題か答えの1ページと、タイトルの下の意味の行 (`Orion: the Hunter`) |
| `skyForLatitude(latitude, month?)`, `latitudeBand(latitude, lang)`, `monthName(month, lang)`, `whyFamous(abbreviation, lang)` | ある場所から見た星座、10度の緯度の帯、月の名前、有名な星座のひとこと |
| `regionGuideSvg(latitude, month, options)` | 「すんでいる ところの ほしざ」のシート |
| `WHEEL_LATITUDES`, `starWheelDisc`, `starWheelPlate`, `starWheelPoster` | 回転盤の対応する緯度 (20〜70) と、その3つの絵 |
| `skyMapSvg(latitude, month, options)` | ある月の夜の空 |

## 絵のまわりのページ

絵はシートの本文です。ヘッダー (ブランド、パッケージ名、タイトル、「なまえ:」のらん)、地域・旗・緯度の帯の箱、フッター (クレジット、バージョン、日付、デモへの QR コード) は、[kazoku-ui の印刷パート](https://github.com/johnmorrisdotca/kazoku-ui/blob/main/docs/guides/print.md)のものです。このパッケージはそれに依存せず、デモが作ります。文字は `kid` (名前28 pt、本文18 pt、線1.2 mm) か `normal` です。ページの本文の本当の広さをはかって、`widthMm` と `heightMm` にわたします。

```ts no-run
import { buildSheet, printCss, printSheet } from "@johnmorrisdotca/kazoku-ui/print";
import { dotsSvg } from "@johnmorrisdotca/hoshi-stars/sheets";

const layout = { page: "a4", type: "kid", language: "ja" } as const;
const holder = document.createElement("div");
holder.style.cssText = "position:absolute;inset:0";
const sheet = buildSheet({ ...layout, brand: "Space Program X", packageName: "Hoshi Stars", title: "オリオン座", pages: [holder] });

// 見えないところに一度ならべて、本文の大きさをはかる
const style = document.createElement("style");
style.textContent = printCss(layout);
document.head.append(style);
sheet.style.cssText = "position:fixed;left:-10000px;visibility:hidden";
document.body.append(sheet);
const body = sheet.querySelector(".kazoku-body")!.getBoundingClientRect();
sheet.style.cssText = "";
holder.innerHTML = dotsSvg("Ori", { level: "medium", widthMm: body.width * 25.4 / 96, heightMm: body.height * 25.4 / 96, lang: "ja" });
document.body.append(sheet);
printSheet(sheet);
```

## 画面でてんをタップ

デモの[てんをタップ](https://johnmorrisdotca.github.io/hoshi-stars/tap-dots.html)ページでは、同じ図がゲームになります。むずかしさ (`easy`、`medium`、`hard`) と星座をボタンの列からえらび、1、2、3の順にタップすると、線が1本ずつのびます。まちがえると何も進まず、絵がやさしくゆれて、さがす番号を知らせます。さいごのタップで、星座の名前と意味と星の名前が出ます。番号と順番は `dotsFigure` のものです (順番は `lines` から読むので、番号を印刷しない hard にも順番があり、番号は星に着いたときに出ます)。タップは指のはば (24ピクセル) 以内でいちばん近い点にあたるので、小さな点もおしやすく、Tab で点に移って Enter か Space でおすこともできます。動きをへらす設定のときは、ゆれたりのびたりせず、かわりに言葉で知らせます。絵は変わったときだけ描き、止まっているあいだは何も描きません。星座とむずかしさはアドレスに残ります (`c` と `level`)。ルール (見る順番、どの点をタップしたか、タップで何が起こるか) は、デモの中の純粋な関数で、単体テストがあります。

## 場所

デモの場所のえらびかたは、ファミリーの `kuni` (国と地域、それぞれの点つき) と `hata` (旗) を、デモだけで使っています。このパッケージはどちらにも依存しません。国をえらぶと緯度がわかります。緯度が大きく変わる国 (カナダ、アメリカ、ロシア、ブラジル、オーストラリア、日本、中国、インド、チリ、アルゼンチン、メキシコ、ニュージーランド) は、地域もえらべます。スライダーで好きな緯度にもできます。「いまの ばしょを つかう」は、ブラウザに一度だけたずねて、答えをほぞんも送信もしません。シートには、地域、(ページにある国の) 旗、緯度の帯、月がのります。

## できあがりの PDF

Pages のビルドが、デモから PDF を作ります。有名な星座12個の点つなぎ (どのむずかしさも)、緯度の帯ごとの星の回転盤、4つの緯度の帯の1月・4月・7月・10月の「あなたの空」と星空の地図を、A4 と US レター、英語と日本語で。[英語の一覧](https://johnmorrisdotca.github.io/hoshi-stars/pdf/)と[日本語の一覧](https://johnmorrisdotca.github.io/hoshi-stars/pdf/ja.html)です。

## 確かめていること

ブラウザなしで: 図のあるすべての星座が、どのむずかしさでもシートになり、番号が1からNまで1回ずつで、線が番号をつぎの番号につないでいること。緯度の決まりを、知られている場所で。回転盤の窓が地平線の幾何と合っていること (半径が 1/sin(緯度) の円で、中心は極から cot(緯度) の距離)。星空の地図の星がぜんぶ地平線の内側にあること。A4、Letter、A3、Tabloid の2つの言語・2つの文字の大きさで、文字がぜんぶ広さの中にあること。Chromium と WebKit ではデモを動かし、Chromium では、すべてのシートを4つの紙の PDF にして、紙の大きさとページ数を調べます。
