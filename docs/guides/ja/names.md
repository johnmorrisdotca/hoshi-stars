---
title: 検索ボックス用の名前の一覧
section: how-to
order: 15
description: "明るい星とメシエ天体ごとの行と、NGC・IC 天体のかたまり。英語と日本語の名前、符号、星座、順位の重み、アドレスに使える ID、向ける先。ID と名前で引けます。"
---

[English](../names.md)

`@johnmorrisdotca/hoshi-stars/names` は検索ボックスに必要な一覧です。明るい 5,080 個の星と 110 個のメシエ天体が1行ずつあり、パッケージがすでに持つ表から作るので (新しいデータはありません)、検索するページだけが費用を払います。ほかの 11,788 個の NGC・IC 天体は、別のかたまり `@johnmorrisdotca/hoshi-stars/names/ngc-ic` です。

```js
import { findName, nameRowById, nameRows } from "@johnmorrisdotca/hoshi-stars/names";
import { findNgcIc } from "@johnmorrisdotca/hoshi-stars/names/ngc-ic";

const star = findName("alpha Ori");
console.log(star.id, star.name.en, star.name.ja, star.pick);

const galaxy = nameRowById("m31");
console.log(galaxy.id, galaxy.name.en, galaxy.kind, galaxy.pick);

const nebula = findNgcIc("North America Nebula");
console.log(nebula.id, nebula.name.en, nebula.kind);

const rows = nameRows();
console.log(`${rows.length} rows, first ${rows[0].id}`);
```

出力:

```text
betelgeuse Betelgeuse ベテルギウス S:2061
m31 Andromeda Galaxy galaxy D:M31
ngc7000 North America Nebula nebula
5190 rows, first sirius
```

## 1行の中身

| 項目 | 内容 |
|---|---|
| `id` | アドレスに使える、変わらない ID。`betelgeuse`、`alpha-orionis`、`58-orionis`、`hr-1234`、`m31`、`ngc7000`。名前のある星は名前、バイエル符号やフラムスティード番号のある星はそれと星座の属格、ほかは `hr-` と輝星カタログ番号です。同じ ID になる星どうしは、それぞれ `-hr` と番号がつきます。一覧の中で一意で、`nameRowById(id)` で戻れます。 |
| `kind` | `star`、`cluster` (散開・球状)、`nebula` (輝線・反射・惑星状・超新星残骸)、`galaxy`、`other`。二重星と変光星の印はパッケージにないので、その種類はありません。 |
| `detail` | 星雲星団なら天体の型 (`globular cluster`)、星ならスペクトル型。 |
| `name` | `en` は通称、なければ符号。`ja` は、持っている 335 個の星はカタカナの名前、バイエル符号の星は `オリオン座α星` の形、ほかはなし。星雲星団の日本語名はパッケージにありません。日本語は母語の方の確認待ちです。 |
| `otherNames`、`designations` | ほかに打ちそうな名前すべて。`α Ori`、`alpha Ori`、`alpha Orionis`、`Alp Ori`、`HR 2061`、`M31`、`Messier 31`、`NGC 224`、`Andromeda Nebula`。 |
| `constellation`、`constellationName` | 略号と、英語・日本語の星座名。 |
| `magnitude`、`weight` | 実視等級と、大きいほど先に出る順位の重み。8 から等級を引いたもの (0 から 14)、通称があれば +3、メシエ番号があれば +2。行はこの順に出ます。 |
| `rightAscension`、`declination`、`pick` | 空を向ける先 (J2000、度) と、デモのアドレスが地図で選ぶときのキー。星は `S:2061`、星雲星団は `D:M31`。 |
| `hr` | 星の輝星カタログ番号。 |

## 引く

`findName(text)` は、大文字小文字・空白・アクセント・ギリシャ文字の書き方 (`α`、`alpha`、`Alp`、`alf`)、上付き数字 (`π³`)、離して書いた番号 (`pi 3 Ori`) を区別せず、文字列がちょうど指す1行を返します。`Betelgeuse`、`alpha Ori`、`α Orionis`、`HR 2061`、`M 31`、`Messier 31`、`NGC 224`、`Andromeda Galaxy`、`ベテルギウス`。2行が共有する文字列 (`Alpha Centauri` は `α1 Cen` と `α2 Cen` の両方) は、どれも返しません。`searchNames(text, { limit, kinds })` は、先頭が合う行、続いて含む行を、それぞれ重みの順に返し、入力補完に使えます。NGC・IC のかたまりにも同じ3つがあります: `ngcIcRows`、`ngcIcRowById`、`findNgcIc`、`searchNgcIc`。

## 大きさ

行は、パッケージがすでに持つ表から、最初に求められたときに作るので、コードの増分は数キロバイトです。`/names` は gzip で 135 kB (星の表とメシエの表)、`/names/ngc-ic` は 226 kB (大きな星雲星団の表だけで、星の表は含みません)。どちらも 60 kB を超えるので2つのかたまりに分けてあり、星とメシエだけがほしいページは NGC・IC の表を読みません。JSON に書き出すと、名前の書き方をすべて並べるので元の表より大きくなります。`/names` の 5,190 行で gzip 約 300 kB (星 5,080 個で約 296 kB)、`/names/ngc-ic` の 11,788 行で約 332 kB (大半は銀河) です。自分のサイトで写しを送るなら、行ごとではなく、検索と表示に使う項目だけを送ってください。

## わかっている欠け

- **明るい星の HD 番号がありません。** `HD 39801` ではベテルギウスは見つかりません。ヘンリー・ドレイパー番号は `/nearby` の星にしかありません。輝星カタログにはその列があり、足すにはデータの作り直しが必要で、John の了承が要ります (チケット MODULES-1224)。
- **バイエル符号もある星のフラムスティード番号** (ベテルギウスの 58 Ori) は、パッケージが出しているデータにないので、入力できる名前になりません。フラムスティード番号だけの星にはあります。
- **近くの星 5,565 個は、まだ行になっていません。**
