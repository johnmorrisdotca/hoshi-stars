---
title: 出どころ
section: how-to
order: 16
description: "メシエ・NGC・IC 天体をだれがいつ見つけたか、IAU が星の名前を承認した日と名前の言語、各カタログの成り立ち。どの事実にも読み取った出典がつきます。"
---

[English](../provenance.md)

`@johnmorrisdotca/hoshi-stars/provenance` は、選んだ天体のカードで名前の次に知りたくなる問いに答えます。だれが見つけたか、いつか、番号はどのカタログのものか、星の名前はどこから来たか。どの答えにも読み取った出典がつき、出典が複数の答えを挙げるとき、またありえない値のときは、答えに注記がつきます。メシエ天体と名前のある 335 個の星は `/provenance` (gzip で 8.8 kB)、そのほかの 11,788 個の NGC・IC 天体は別のかたまり `@johnmorrisdotca/hoshi-stars/provenance/ngc-ic` (gzip で 40.3 kB。メシエ天体も含みます) です。

```js
import { objectDiscovery, starNameFacts, CATALOGUE_ORIGINS, PROVENANCE_SOURCES } from "@johnmorrisdotca/hoshi-stars/provenance";
import { objectDiscovery as anyDiscovery } from "@johnmorrisdotca/hoshi-stars/provenance/ngc-ic";

const crab = objectDiscovery("M1");
console.log(crab.discoverers.map((one) => one.name).join(", "), crab.date.value, crab.catalogue.compiler);

const nebula = anyDiscovery("NGC 7000");
console.log(nebula.id, nebula.discoverers[0].name, nebula.date.value, nebula.catalogue.years.join());

const star = starNameFacts("Betelgeuse");
console.log(star.name, star.approved, star.origin, PROVENANCE_SOURCES[star.sources.approved].address);

console.log(objectDiscovery("M31").notes[0]);
console.log(CATALOGUE_ORIGINS.ic.objects, "objects in the IC");
```

出力:

```text
John Bevis 1731 Charles Messier
NGC 7000 William Herschel 1786-10-24 1888
Betelgeuse 2016-06-30 Arabic https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt
The date is later than the catalogue the object is in, so it cannot be its discovery; it is shown as Wikidata gives it, and no other source was read to correct it.
5386 objects in the IC
```

## 天体の発見

`objectDiscovery(id)` は `deepSkyObject` が返す天体の ID (`M1`、`NGC 7000`、`IC 434`。大文字小文字、空白の有無は問いません) を受け取り、次を返します。

| 項目 | 内容 |
|---|---|
| `discoverers` | Wikidata が発見者または発明者として挙げる人。`{ name, wikidata }` の形で、名前は Wikidata の英語ラベルの綴り、`wikidata` はその項目 (`Q437582`) です。Wikidata の挙げる順。ひとりも挙がらない場合は空です。 |
| `date` | `{ value, grain, year }`。日付の文字列 (`1731`、`1779-01-31`、紀元前 259 年は `-0259`)、日付が示す最も細かい単位 (`year`、`month`、`day`)、数値としての年。Wikidata にない場合は `null` です。 |
| `catalogue` | その天体の番号が属するカタログ。編纂者、刊行年、天体の数、注記、それらの出典。 |
| `notes` | 出典の中で値が食い違うとき、またカタログと合わないときの注記 (下記)。たいていは空です。 |
| `source` | つねに `wikidata` (`PROVENANCE_SOURCES` のキー)。 |

Wikidata に発見者も日付もない天体と、読み込んだかたまりにない ID では、答えは `undefined` です。NGC 番号を持つメシエ天体は、`deepSkyObject` と同じくメシエの ID (`M1`。`NGC 1952` ではありません) で引きます。

### Wikidata が持っているもの

11,898 個の天体のうち 7,918 個に答えがあります。発見者があるのは 7,765 個、日付があるのは 7,646 個です。残りの 3,980 個は Wikidata にどちらもなく、パッケージはほかの出典から補いません。空欄は空欄のままです。発見者は、その天体のメシエ・NGC・IC のコード (P528) を持つ項目の「発見者又は発明者」(P61)、日付は「発見日又は発明日」(P575) で、人でない値 (機関など) は除きます。名前が挙がる人は全部で 106 人です。二つのクエリは読み取った日とともに `NOTICE.md` に一語一句そのまま載せてあり、`scripts/make-discovery-data.py` で再実行できます。

Wikidata はだれでも編集でき、発見の日付としてありえない値もあります。パッケージは、別の出典なしで見分けられるものに印をつけ、値はそのまま見せます。

- **カタログより後の日付** (メシエ天体で 1800 年より後、NGC・IC 天体で 1908 年より後): アンドロメダ銀河の `1964-01` がそうです (全部で 4 個)。Wikidata の値のまま、その旨の注記つきで返すので、ページは隠すことも注記つきで見せることもできます。
- **複数の日付**がある天体: いちばん早いものを見せ、複数あるという注記をつけます (17 個)。
- **年より粗い日付**: 年を見せ、注記をつけます。今のデータにそこまで粗い日付はなく、この注記は将来の読み取りのためのものです。

### カタログ

`CATALOGUE_ORIGINS` に三つのカタログがあります。`messier` (シャルル・メシエ。1774 年に予備版の 45 個、1781 年に最終版の 103 個)、`ngc` (ジョン・ルイ・エミール・ドレイヤー、1888 年、7,840 個)、`ic` (ドレイヤーの二つの補遺、1895 年と 1908 年、5,386 個)。英語版 Wikipedia の「Messier object」と「New General Catalogue」の記事から事実だけを読み取ったもので (文章は写していません)、`source` がその出典を示します。

## 星の名前

`starNameFacts(star)` は HR 番号または通称 (大文字小文字は問いません) を受け取り、`hr`、`name`、`approved` (IAU の恒星名ワーキンググループがその名前を承認した日。多くは `2016-06-30`)、`origin` (名前の由来の言語や文化。`Arabic`、`Latin`、`Greek`、`Chinese`、`Wardaman` など)、`notes`、`sources` を返します。承認日は IAU 恒星名カタログ (IAU Catalog of Star Names、2022-04-04 更新)、由来は Wikipedia「List of proper names of stars」の「Name origin」列からで、出典にない項目は `null` です。

- **335 個の名前のうち 332 個に承認日があります。** Navi、Men、Rutilicus はパッケージの一覧にはありますが IAU の一覧にはないので承認日がなく、注記でそう伝えます。由来もありません。Wikipedia の表に由来が書かれていないためです。
- **由来が `unknown` のものが少数あります**: Wikipedia の表記そのままで、手を加えずに返します。

`NAMED_STAR_FACT_IDS` は、事実のある 335 個の星の HR 番号の一覧です。

`/provenance/ngc-ic` の `DISCOVERY_OBJECT_COUNT` は、答えのある天体の数 (7,918) です。

## まだないもの

これらの事実は、データと関数として提供しています。デモのカードにはまだ表示しておらず、MODULES-656 のデータファイル書き出しにも入っていません。どちらもブラウザーでの確認と見せ方の決定が必要なので、それぞれ別のチケットで扱います。発見者の名前は英語だけです。
