---
title: データファイル
section: how-to
order: 30
description: CSV と Parquet をダウンロードして、ほかの言語で使います。
---

[English](../data-files.md)


GitHub Release から `hoshi-stars-data-v<version>.zip` または個別のファイルをダウンロードします。各表に UTF-8 の CSV、Parquet、`<table>.schema.json` があります。`SHA256SUMS` はファイルの SHA-256、`LICENCE-DATA.md` は出典と利用条件の一覧です。コードは MIT ですが、データにはそれぞれの出典の条件が残ります。Yale GCTP と Roman の境界表には、ライセンスの記載がありません。明示的な許可があるとは限らないので、再配布前に `LICENCE-DATA.md` を確認してください。

| 表 | 内容 |
| --- | --- |
| `stars` | HR 番号、英語名と日本語名、呼び名、星座、J2000 の位置、等級、色、スペクトル型の記号、スペクトル型の全体、光度階級、固有運動、年周視差と誤差と出どころ。 |
| `nearby-stars` | GCTP などの番号、名前、J2000 の位置と出典、位置の誤差、視差と誤差、距離と誤差、固有運動、等級、スペクトル型、光度階級、注意点。 |
| `constellations` | IAU 略号、ラテン語名と属格、英語名、日本語名と読み。 |
| `constellation-facts` | 星座の略号、名前の意味 (英語と日本語)、半球、見ごろの月、由来・作った人・年、見つけやすさ、アステリズム、流星群。 |
| `constellation-lines` | 星座の略号、線の番号、線の中の順番、HR 番号。番号は 1 からです。 |
| `boundaries` | Roman の表の順番、赤経の下限と上限（時）、赤緯の下限（度）、星座の略号。基準は B1875 です。 |
| `messier`、`ngc-ic` | 番号と別番号、名前、種類、星座、J2000 の位置、等級、見かけの大きさ。 |
| `star-names` | HR 番号と英語名、日本語名。 |

zip には、88星座の絵 (SVG) も `thumbnails/svg/light/` と `thumbnails/svg/dark/` に略号の名前で入っています ([絵のガイド](constellation-pictures.md))。

各 schema に、すべての列の型、単位、意味、出典があります。位置は別の記載がなければ度、固有運動はミリ秒角毎年です。CSV の `\N` は値なしです。`aliases` と `otherIds` は JSON 配列を文字列にしたものです。値なしを 0 として扱わないでください。近い星の距離を使うときは誤差と注意点も確認してください。

以下の JavaScript 以外の例は**未テスト**です。ダウンロードしたファイルのあるフォルダーで実行してください。

Python と pandas:

```text
import pandas as pd
stars = pd.read_csv("stars.csv", na_values=[r"\N"])
nearby = pd.read_parquet("nearby-stars.parquet")
```

Python と polars:

```text
import polars as pl
stars = pl.read_csv("stars.csv", null_values=r"\N")
nearby = pl.read_parquet("nearby-stars.parquet")
```

R と arrow:

```text
library(arrow)
stars <- read_parquet("stars.parquet")
```

Rust は Apache Arrow の `parquet` クレートと `arrow` 機能を使います。

```text
use std::fs::File;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
let file = File::open("stars.parquet").unwrap();
let batches = ParquetRecordBatchReaderBuilder::try_new(file).unwrap().build().unwrap();
for batch in batches { println!("{}", batch.unwrap().num_rows()); }
```
