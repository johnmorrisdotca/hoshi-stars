---
title: 暗い星
section: how-to
order: 8
description: UCAC4の星を、さらに約250万個、12等まで。見ている空の部分のタイルだけを読み込みます。地図を拡大すると描かれます。UCAC4が自分で測った星だけで、ヒッパルコスやティコからコピーしたものは入っていません。
---

[English](../faint-stars.md)

明るい星の表は6.0等でおわりです。`@johnmorrisdotca/hoshi-stars/faint`は、UCAC4(アメリカ海軍天文台の第4版CCDアストログラフ星表)から、12等までの星を**2,462,539個**足します。コードでも、1つの大きな表でもありません。空を区切(くぎ)った小さなファイルで、ページは、いま見ている空の部分のタイルだけを読み込みます。メインのimportの大きさは変わらず、`/faint`をimportしないページには、まったく影響がありません。

## 数字の中身

- **位置**: UCAC4の、ICRS上のJ2000.0の位置で、誤差は1秒角(びょうかく)より小さい値です。固有運動(こゆううんどう)は入っていません。
- **等級**: 12等という限界は、UCAC4がその星の**APASSのV等級**(ティコなどから借りたものではない、APASS自身の値)を持っていればそれで、持っていなければ**UCAC4自身のモデル等級**で決まります。モデル等級はVとRのあいだ(579〜642 nm)の光で測ったもので、Vではありません。どちらも0.05きざみで入っています。コピーとして外した行を除く4,709,853行のうち、4,308,852行にAPASSのV、401,001行にモデル等級だけがありました。
- **色**: APASSのB-Vの色指数(しきしすう)で、0.0125きざみです。2,240,397個にあり、222,142個(100個に9個)にはありません。色の値がない星は、うすい色で描かれます。
- **ヒッパルコス、ティコ、ガイアの値は入っていません。** 欧州宇宙機関(ESA)は、これらを非商用のライセンスで配っていて、MITライセンスのパッケージはそのまま渡せません。UCAC4はこれらの値を一部コピーしているので、ビルドでは、UCAC4自身がそう印をつけた行をすべて外しました。天体種別6(FK6、ヒッパルコス、ティコ2から位置を置きかえたもの。34,472行)、種別7(それらから足した星で、CCDのデータがないもの。4,215行)、種別4(外部の高固有運動のデータ。出どころは書かれていません。4,932行)です。記録のVやBがティコのものである場合(出どころのフラグが立っていて、APASSの誤差が0)は、それを使わず、72,164個はモデル等級にしました。同じビルドで、明るい星5,080個にすでに入っている45個も外しています。
- **わざと残したもの**: 2,027,855個は、ティコ2への**クロスリファレンス**(UCAC4がその星をティコ2と照合したので、出どころのフラグが立っています)を持っていますが、位置と等級はUCAC4自身の測定です。これらは残しました。よりどころにした文は、[データとライセンス](data-and-licences.md)と`NOTICE.md`にあります。

## どれだけあるか、どこが少ないか

等級ごとの数です(星は、その星が入る0.5等の区間で数えます。`8.0`は、8.0以上8.5未満です。`12.0`は、ちょうど12.0の星です)。

| 等級 | 星の数 | 等級 | 星の数 |
|---|---:|---|---:|
| 6.0〜6.5 | 36 | 9.5〜10 | 161,934 |
| 6.5〜7 | 63 | 10〜10.5 | 239,640 |
| 7〜7.5 | 238 | 10.5〜11 | 358,936 |
| 7.5〜8 | 2,837 | 11〜11.5 | 562,027 |
| 8〜8.5 | 9,559 | 11.5〜12 | 882,821 |
| 8.5〜9 | 36,078 | ちょうど12.0 | 113,803 |
| 9〜9.5 | 94,559 | | |

**およそ9等より明るいところでは、この層は星が少なく、6等から8等のあいだはほとんど星がありません**(6.5〜8等は3,138個)。UCAC4がヒッパルコスとティコからコピーしただけの星は明るい星ばかりで、それがちょうど外した行だからです。地図は、どこまでそろっているかを示します(`ここでは9.5等の星まで見えています`)。その数字は、この層自身の数から出しています。

**帯が薄く見えるもう1つの理由は、UCAC4の明るい星の等級が暗すぎることです。** APASS DR10とSAO星表(この2つは互いによく合います)と比べると、本当は7.5〜8等の星は、この層では中央値で0.98等暗く、8〜8.5等の星は0.7等暗く、8.5〜9等の星は0.43等暗く出ます(7〜7.5等の星は1.2等暗く)。APASSはV等級で7〜10等のあたりで飽和し、UCAC4のモデル等級は明るい星に合わせて較正(こうせい)されていないためです。つまり、本当は8等の星の多くが、この層では9等で入っていて、7.5〜9等の帯は、星が実際より暗い等級で数えられているために薄く見えます。この層にある、およそ9.5等より明るい星は、たいてい、等級の数字より実際の空では明るく見えます。補正は別のチケットで扱います。

**この帯を埋める星は作ってあり、ファイルとして残してありますが、まだタイルには入れていません。** 2つの出どころからそれぞれ作って比べました(リポジトリの`docs/research/gap-6.5-8.md`)。SAO星表(この層にない星を、6.0〜9.0等で30,459個足せます。うち6.5〜8等が22,012個で、空全体をおおいます。利用条件は、NASAのHEASARCの返事待ちです)と、2MASSの位置を使ったAPASS(16,602個。条件ははっきりしていますが、APASSには赤緯+20度より北に明るい星がありません)です。ライセンスの文は`NOTICE.md`にあります。SAOの条件がはっきりしたら、`python3 scripts/make-faint-data.py build --gap sao`で、SAOをレベル0に取り込みます。

## タイル

タイルは空の長方形です。赤緯(せきい)の帯を、赤経(せっけい)の向きに区切(くぎ)ったものです。レベルは3つあって、広い範囲を見るときは少なくて粗(あら)いタイル、深く(暗い星まで)見るときは細かいタイルを読み込みます。

| レベル | 入っているもの | 帯 | タイル | 星 |
|---|---|---:|---:|---:|
| 0 | 10等まで | 18(高さ10°) | 442 | 326,134 |
| 1 | 10等から11等 | 30(高さ6°) | 1,192 | 624,249 |
| 2 | 11等から12等 | 36(高さ5°) | 1,704 | 1,512,156 |

ファイルは星1つにつき6バイトです(いちばん大きいタイルでも30 kB未満)。全部で14.8 MB、gzipで約12.6 MBです。`FAINT_LEVELS`と`faintGrid(level)`が区切りかたを、`faintTileBounds(tile)`がタイルのおおう空の範囲を、`faintTilePath(tile)`がファイルの場所(`L2/17-16.bin`)を返します。`faintTilesFor(field, limit)`は、ある等級までの星のために、円形の空の部分に必要なタイルを、明るいレベルから順に返します。限界が9なら、必要なのはレベル0だけです。

```js
import { faintTilePath, faintTilesFor } from "@johnmorrisdotca/hoshi-stars/faint";

const orion = { rightAscension: 83.8, declination: -5.4, radius: 1 };
console.log(faintTilesFor(orion, 12).map(faintTilePath).join(" ")); // L0/8-8.bin L1/13-13.bin L1/14-13.bin L1/14-14.bin L2/16-16.bin L2/17-16.bin
console.log(faintTilesFor(orion, 9).map(faintTilePath).join(" "));  // L0/8-8.bin
```

## タイルのある場所

タイルは**npmパッケージには入っていません**(12.6 MBだと、パッケージ本体の10倍の大きさになってしまいます)。リポジトリの`faint-tiles/`フォルダと、デモのGitHub Pagesのサイトにあり、リリースごとのPagesのビルドには、そのリリースのタイルが入っています。`FAINT_TILES_URL`(`https://johnmorrisdotca.github.io/hoshi-stars/faint-tiles/`)が、`faintSky`が初期設定で見にいく場所です。自分で用意したコピー(静的ファイルのフォルダ。[自分のサーバーで配る](serve-it-yourself.md))や、リポジトリのどのファイルでも配るjsDelivrから読みたいときは、`baseUrl`を渡します。

## 使う

`faintSky(options)`は小さな読み込み役です。空の部分に必要なタイルを、渡した`fetch`(なければ、グローバルの`fetch`)で取ってきて、デコードし、新しいほうから256個まで残します。`load(field, limit)`は足りないものを取ってきて、`stars(field, limit, max)`は、いまあるものから答えます。`max`を渡すと、明るいほうから`max`個を残し、`depth`は、その一覧がそろっている等級を示します。`loaded`は、その部分に必要なタイルがすべてあるかどうかを示します。

```js
import { readFile } from "node:fs/promises";
import { faintSky } from "@johnmorrisdotca/hoshi-stars/faint";

// In a page, `faintSky()` fetches from FAINT_TILES_URL. Here the tiles are read from a folder, so that the example runs offline.
const sky = faintSky({
  baseUrl: "faint-tiles/",
  fetch: async (path) => {
    const bytes = await readFile(path);
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  },
});
const orion = { rightAscension: 83.8, declination: -5.4, radius: 1 };
await sky.load(orion, 12);
const all = sky.stars(orion, 12);
const capped = sky.stars(orion, 12, 100);
console.log(all.loaded, all.stars.length, all.depth); // true 183 12
console.log(capped.stars.length, capped.depth);       // 100 10.9
console.log(all.stars[0].magnitude, all.stars[0].colourIndex);          // 7.15 -0.125
```

ブラウザーでは、渡す`fetch`がいらないだけで、あとは同じです。

```js no-run
import { faintSky } from "@johnmorrisdotca/hoshi-stars/faint";

const sky = faintSky();
await sky.load({ rightAscension: 299, declination: 40, radius: 2 }, 12);
```

自分でデータを取ってくるページのために、`faintSky`の部品は単独でも使えます。`decodeFaintTile(tile, bytes)`は、タイルのファイルを`FaintTile`(`rightAscension`、`declination`、`magnitude`、`colourIndex`(ない星は`NaN`)を、それぞれ同じ長さの配列にしたもので、赤緯の順に並びます)にします。`faintStarsIn(tiles, field, limit, max)`は、手元のタイルから、空の部分の星を選びます。星は`FaintStar`で、`rightAscension`、`declination`、`magnitude`、`colourIndex`(ない星は`undefined`)を持ちます。読み込み役の設定は`FaintSkyOptions`(`baseUrl`、`fetch`、`maxTiles`)で、返すものは`FaintSky`です。タイルのファイルは、星1つにつき1バイトずつの6つの面(プレーン)で、`decodeFaintTile`の説明にあります。中心の部分は純粋(じゅんすい)で、時計もDOMも使いません。入出力をするのは`faintSky`だけで、それも、渡された`fetch`を通してです。`FAINT_LIMIT`は12です。

## デモの地図で

デモの地図には**暗い星**の層があります。はじめから入っていて、ほかの層と同じようにアドレスに残ります(`layers=milky,lines,names,grid`なら、この層は消えます)。望遠鏡なら7等より暗い星が見えるあたりから始まります。深さは、「いちばん暗い星」のスライダーの値に、拡大が10倍になるごとに2.5等を足したもので、12等までです。UCAC4には6.5等から8等の星がとても少ないので、地図をおよそ3倍まで拡大すると、深さは8.5等にとび、そこから同じ割合で深くなり、およそ100倍で12等になります。操作の下の1行に`ここでは9.5等の星まで見えています`と、描いた暗い星の数が出ます。星は数本のパスで描き、1つずつのノードにはしません。1つの見かたで描くのは多くても6,000個で、明るいほうからです。6,000個で打ち切ったときは、深さが浅く出ます。止まっているときは、何も描かず、何も取ってきません。
