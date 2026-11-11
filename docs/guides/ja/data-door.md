---
title: データの入口：外部のデータを受け取る
section: how-to
order: 41
description: 自分で用意した星やディープスカイ天体を、ライセンスと出典つきのソースとしてパッケージに渡す方法、ソースをオフにする方法、いま画面にあるのは誰のデータかをページが示す方法を説明します。呼び出す側は、「非営利のみ」や「同一条件で共有」のソースも渡せます。その場合、出典の横にライセンスが表示されます。
---

[English](../data-door.md)

パッケージは描くだけで、データは使う側が用意します。`@johnmorrisdotca/hoshi-stars/door`は、星やディープスカイ天体を足すための唯一の入口です。同じ入口が、いま画面にあるのは誰のデータかも示します。ソースがなければ、パッケージはこれまでと同じものを、パッケージ自身のデータから描きます。そのデータは、イェール輝星カタログ、UCAC4、Wikidataのディープスカイ天体の一覧です（`OWN_SOURCES`。`NOTICE.md`の内容をもとに書いています）。パッケージに同梱するのは、そのまま再配布できるデータだけです。渡すソースは、「非営利のみ」でも「同一条件で共有」でもかまいません。その場合、出典の行には、ライセンスの横にその条件も表示されます。

型（`SourceInfo`、`Licence`、`RecordSource`、`TileSource`、`Credit`、`MapPlace`、`ImageTile`）と4つの小さな関数（`validateSource`、`creditLine`、`loadRecords`、`createTileStore`）は、ファミリー共通のデータの入口です。1つのファイルを、各パッケージにそのままコピーして使います（`src/data-door.ts`。kazoku-uiの`templates/data-door.ts`から）。入口はそれらを再エクスポートするので、`import`は1つで足ります。

## 星のソース

ソースは、`kind`と`info`と、いくつかの関数を持つオブジェクトです。`info`は、そのソースが何であるかを伝えます。`id`（小文字の英字、数字、ハイフン。ビューの中で重複しないもの）、日本語と英語の`name`と`credit`（空にはできません）、`licence`（名前とリンク。「非営利のみ」や「同一条件で共有」のときは、`nonCommercial`か`shareAlike`を付けます）、ソースのページ（`url`）、取得した日（`retrieved`）です。星のソースはタイルでできています。`need(field, magnitude)`は、空の円形の範囲に必要なタイルのキーを返します。`load(key, signal)`は、タイル1枚を`FaintTile`（赤経、赤緯、等級、B-Vそれぞれの配列）として取得します。`bytes(tile)`は、メモリの上限の計算のために、そのタイルがメモリ上で占める大きさを返します。

```js
import { creditLine, starSky } from "@johnmorrisdotca/hoshi-stars/door";

// A source of your own: here two stars in one tile, held in memory. A real one would fetch its tiles from a server, and says whose they are and under what licence.
const mine = {
  kind: "tiles",
  info: {
    id: "my-stars",
    name: { en: "My stars", ja: "私の星" },
    credit: { en: "My stars, A. Person (2026)", ja: "私の星（A. Person、2026年）" },
    licence: { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", nonCommercial: true },
    url: "https://example.org/my-stars",
    retrieved: "2026-11-10",
  },
  need: () => ["tile-0"],
  load: async () => {
    const column = (values) => Float64Array.from(values);
    return { id: { level: 0, band: 0, column: 0 }, count: 2, rightAscension: column([83.8, 83.9]), declination: column([-5.4, -5.3]), magnitude: column([9.1, 10.4]), colourIndex: column([0.6, NaN]) };
  },
  bytes: (tile) => tile.count * 32,
};

const sky = starSky({ sources: [mine] });
const orion = { rightAscension: 83.8, declination: -5.4, radius: 1 };
await sky.load(orion, 12);
const { stars } = sky.stars(orion, 12);
console.log(`${stars.length} stars, the brightest of magnitude ${stars[0].magnitude}`);
console.log(creditLine(sky.credits(), "en"));
console.log(creditLine(sky.credits(), "ja"));

sky.enable("my-stars", false);
console.log(`${sky.stars(orion, 12).stars.length} stars with the source off`);
```

`starSky`は、ソースが追加されるときに`validateSource`で検証します。出典が空、ライセンスがない、idが重複している、関数が足りない、のどれかがあると、すぐに`TypeError`を投げます。`load(field, magnitude)`は、範囲のタイルをすべてのソースから取得します。同時に取得するのは、ソース1つにつき6枚（`MAX_IN_FLIGHT`）までです。メモリの上限は全ソースで共通の1つです（`TILE_BUDGET_BYTES`で48MB。変えるには`budgetBytes`、枚数に上限をつけるには`maxTiles`）。`stars(field, magnitude, max)`は、手元にあるタイルだけで答え、通信はしません。だから静止中、入口は何もしません。失敗したタイルは、次の`load`でもう一度試します。失敗したタイル、`FaintTile`でないもの、位置か等級が有限の数でない星を含むタイルは、`stats()`で数えられ、描かれません。

## いま画面にあるのは誰のデータか

`credits()`は、直前の`stars`の呼び出しで、星を1つでも出したソースを、パッケージ自身のものを先にして返します。`creditLine(credits, "en" | "ja")`は、それらを、ライセンスを横に添えた1行にまとめます。日本語の例は「暗い星：UCAC4（…）（UCAC4の利用条件）／私の星（A. Person、2026年）（CC BY-NC 4.0、非営利のみ）」です。パッケージ自身の明るい星はメインのエントリーポイントから描かれるので、ページは先頭に`ownCredit("yale-bsc", count)`を置きます。`onCredits`は、ソースの組み合わせが変わったときに呼ばれ、描画のたびには呼ばれません。デモの全天の地図のページは、この行を地図の下に表示します。

## オフにする

`addSource`は`remove()`を返します。レイヤーパネルや「パッケージのデータだけ」の表示には、`removeSource(id)`、`enable(id, false)`、`ownOnly(true)`が同じことをします。オフにすると、そのソースの読み込みを中断し（`AbortSignal`）、タイルを解放し、出典を消して、表示は最初の状態に戻ります。

## ディープスカイ天体と画像

天体のソースは、メモリに収まるリスト（20万件、`MAX_RECORDS`まで）で、読み込みは1回だけです。`withObjects(sources, { own })`は、ページがすでに描いている天体（`own`。たとえば`messier()`）に、それらを足します。空の座標として正しくない位置、有限でない数、未知の種類、すでに使われているidを持つレコードは、除外して数えます。例外を投げるソースや、レコードが多すぎるソースは`failed`に報告され、何も追加しません。`SkyPictureSource`は、空の画像をタイルで渡す形です（赤経と赤緯の場所、赤経の全周のピクセル数で表す詳細度、`ImageTile`）。パッケージはまだ描きませんが、この形のソースは、すでに`createTileStore`で扱えます。

```ts no-check
import { messier } from "@johnmorrisdotca/hoshi-stars/deep-sky";
import { creditLine, withObjects, type ObjectSource } from "@johnmorrisdotca/hoshi-stars/door";

declare const mine: ObjectSource; // records of your own, with an info as above

const read = await withObjects([mine], { own: messier() });
console.log(read.objects.length, read.skipped, creditLine(read.credits, "en"));
```

## 変わらないもの

`faintSky`は、パッケージ自身の`ucac4Source`だけを持つ`starSky`なので、オプションも返り値もこれまでどおりです（`fetch`は、`{ signal }`も受け取るようになりました）。`FaintTile`には、省略できる列`parallaxMas`、`properMotionRa`、`properMotionDec`が増えました（単位はミリ秒角と、ミリ秒角/年。ないときは`NaN`）。型を追加しただけで、まだ何も読み込みません。
