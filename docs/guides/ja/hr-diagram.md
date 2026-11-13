---
title: 星の色と明るさ(ヘルツシュプルング・ラッセル図)
section: how-to
order: 15
description: "星を色と明るさ、または温度と光度で並べます。absoluteMagnitude、starProfile、デモの「星の一生」ページ。"
---

[English](../hr-diagram.md)

ヘルツシュプルング・ラッセル図は、星を「どれだけ高温か」(横軸、高温が左)と「本当はどれだけ明るいか」(縦軸)で並べた図です。多くの星は主系列という帯にならび、太陽のような星は一生の大半をそこで過ごします。巨星と超巨星は帯の上、白色矮星は下にあります。[デモの「星の一生」ページ](https://johnmorrisdotca.github.io/hoshi-stars/life.html?lang=ja)は、確かさの等級がAまたはBの星(5,080個のうち約530個。距離が信頼できるもの、[確かさ](accuracy.md)を参照)をこの図にし、同じ図で2通りの軸を選べます。

- **色と明るさ**: 横軸はカタログのB-V色指数、縦軸は**絶対等級**(10パーセクから見たときの明るさ。小さいほど明るい)です。`absoluteMagnitude(star)` が、等級と年周視差から求めます。
- **温度と光度**: 横軸は温度(ケルビン)、縦軸は光度(太陽を1とする)で、[`starProfile`](star-profile.md)(スペクトル型の温度尺度と放射補正)から、不確かさつきで求めます。

```js
import { absoluteMagnitude, starByName } from "@johnmorrisdotca/hoshi-stars";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

for (const name of ["Sirius", "Aldebaran", "Betelgeuse"]) {
  const star = starByName(name);
  const profile = starProfile(star);
  console.log(`${name}: B-V ${star.colourIndex}, absolute magnitude ${absoluteMagnitude(star).toFixed(1)}, ${Math.round(profile.temperature.value / 100) * 100} K, ${Math.round(profile.luminosity.value)} suns`);
}
```

出力は次のとおりです。

```text
Sirius: B-V 0, absolute magnitude 1.4, 9500 K, 24 suns
Aldebaran: B-V 1.54, absolute magnitude -0.7, 3900 K, 403 suns
Betelgeuse: B-V 1.85, absolute magnitude -5.6, 3700 K, 52266 suns
```

## ページでできること

- **点をクリック(または Enter)すると星を選べます。** カードに、型・色・明るさ・温度・光度・等級・距離が出て、星空の地図でその星を開くリンクがあります。Tab で図に入り、矢印キーで高温から低温の順に点をたどれます。「名前で星を探す」でも選べます。
- **星**の欄で、等級のついた星(AとB)、A等級のみ、名前のある星のみを選べます。カタログに色や使える距離がない星は図に位置がなく、カードにその理由が出ます。
- **太陽**はひし形で描きます。カタログの星ではないので、太陽自身の数値による目安の点です。
- **アドレス**に、軸(`axes=physical`)、絞り込み(`show=a` または `show=named`)、選んだ星(`star=2491`、太陽は `star=sun`)が残り、リンクで同じ表示を開けます。
- **ふたつの一生**は、太陽のような星(星雲、若いおうし座T型星、主系列、準巨星、赤色巨星、惑星状星雲、白色矮星)と重い星(赤色超巨星、超新星の残骸、中性子星)の段階ごとに、データにある例(ケンタウルス座アルファ星Aまたは太陽、アルデバラン、ベテルギウス、M57、M1)を示します。星はカードが開き、天体は星空の地図で開きます。おうし座T星とシリウスBは単独ではデータにないため、ページにそう書いてあります。

## まだできないこと

星が図の上をたどる道すじや、各段階の時間は描いていません。このパッケージにあるのは今の星の姿で、ひとつの星の変化ではなく、ほかから得た数値も使わないためです(ヒッパルコス、ガイア、恒星進化の軌道は、MITのパッケージが引き継げない条件のもとにあるか、写して使えるものではありません)。道すじとそれにそった動きは、配布できるデータが得られてからです。
