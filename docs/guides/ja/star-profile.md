---
title: 星の大きさ・温度・姿
section: how-to
order: 4
description: 星がどれくらい熱く、大きく、明るいかを、各数値の不確かさとともに求め、その数値から太陽と並べた絵を描きます。
---

[English](../star-profile.md)

星の絵の多くは、画家が思い描いたものです。円盤として実際に分解して観測された星は、ほんのわずかしかありません。このパッケージは、もっと控えめで誠実な方法をとります。カタログにある情報から各星の大きさと温度を求め、どれくらい確かかを示し、その数値から「これは何の絵か」を明記した絵を描きます。エントリーポイントは2つで、数値は`/profile`、絵は`/portrait`です。

## 数値

`starProfile`は星を受け取り、`StarProfile`を返します。中身は、`temperature`（スペクトル型と光度階級に対する公表済みの温度の目盛りと、色から求めた表面温度）、`luminosity`と`radius`（明るさ・距離・温度から求めた、太陽を1とする値。`R = sqrt(L) / T²`）、円盤の視直径`angularDiameterMas`、そして`limbDarkening`（周縁減光）です。どの数値も`Estimate`で、`value`（値）、`error`（誤差）、標準誤差1つ分の`range`（範囲）を持ちます。

```js
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

for (const name of ["Sirius", "Arcturus", "Betelgeuse", "Deneb"]) {
  const profile = starProfile(starByName(name));
  const { temperature, radius, angularDiameterMas } = profile;
  console.log(`${name}: ${Math.round(temperature.value)} K, ${angularDiameterMas.value.toFixed(1)} mas across`);
  console.log(radius === undefined ? `  radius not known: ${profile.unknown.radius}` : `  radius ${radius.value.toFixed(1)} Suns, from ${radius.range[0].toFixed(1)} to ${radius.range[1].toFixed(1)} (${radius.basis})`);
}
// Sirius: 9506 K, 6.5 mas across
//   radius 1.8 Suns, from 1.7 to 2.0 (parallax)
// Arcturus: 4487 K, 18.4 mas across
//   radius 22.4 Suns, from 19.2 to 26.2 (parallax)
// Betelgeuse: 3710 K, 30.6 mas across
//   radius 336.0 Suns, from 148.5 to 986.9 (parallax)
// Deneb: 9125 K, 1.9 mas across
//   radius not known: no-parallax
```

5,080個の星すべてに、温度・視直径・周縁減光があります。ベテルギウスの半径が320〜990太陽半径と幅広いのは、論文から得た距離（548光年）の精度がまだ約15%にとどまり、そこに温度の目盛りの誤差が加わるためです。値が求められないときは`undefined`で、`unknown`が理由を示します（`Unknown`：`"no-parallax"`、`"poor-parallax"`、`"implausible-parallax"`、`"no-typical-radius"`、`"no-class"`、`"odd-type"`、`"no-colour-or-type"`）。ページは推測せずに、はっきりそう表示できます。半径が分かる星は、約4分の3です。

視直径は距離がなくても求められます。明るさと温度だけから決まり、干渉計が測るのもこれなので、半径が分からない星でも分かります。その`range`を見れば、この方法がどれだけ当たるかが正直に分かります。下の数字は、どれもこの方法が実際にその程度ずれた例です。

`temperature.basis`（`TemperatureBasis`）は温度の求め方を示します。星の`"spectral type"`（スペクトル型）から、`"colour"`（色）から、または`"spectral type and colour"`（両方）からです。`radius.basis`（`RadiusBasis`）は、`"parallax"`ならこの星自身の距離から求めたもの、`"type"`なら距離が分からないか不確かすぎるため、同じ型の星の典型的な半径で代えたものです。パネルと絵はそう表示します。星の代わりに、同じ項目を持つもの（`ProfileInput`）なら何でも渡せるので、太陽も自分で作れます。

```js
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

const sun = starProfile({ magnitude: -26.74, colourIndex: 0.65, spectralType: "G2V", luminosityClass: "V", parallaxMas: 206264806.2, parallaxErrorMas: 1, parallaxSource: "GCTP" });
console.log(sun.radius.value.toFixed(2), Math.round(sun.temperature.value), sun.limbDarkening.toFixed(2));
// 1.00 5770 0.65
```

## 数値はどれくらい確かか

CHARAアレイで円盤が分解された43個の星（A・F・G型の矮星と準巨星。Boyajian他 2012）と、干渉計で直径が測られている有名な星6個で確かめました（出典は`NOTICE.md`）。

- **円盤**：標準誤差1つ分の範囲が測定値を含んだのは43個中33個で、期待どおりおよそ3分の2です。ばらつきは標準誤差の0.94倍で、この方法は平均で4.7%小さめに出て、個々の星では典型的に7.5%ずれます。最も大きくずれたのは、りゅう座ψ星（F5IV-V、19%小さい）、ペガスス座θ星（A2Vp、16%小さい）、カシオペヤ座μ星（金属の少ないG5V、14%小さい）で、型と色が実際より高温に読める星です。
- **半径**：カタログ自身の年周視差で距離が決まる43個中37個について、31個が範囲内でした。（この論文のヒッパルコスの年周視差は使っていません。）
- **シリウスA**は7%大きく（型A1が星そのものよりやや低温）、**ポルックス**は8%大きく、**アルクトゥルス**は12%小さく（範囲内）、**アルデバラン**は2%小さく出ます。アルクトゥルスの半径は、測定値25.4太陽半径に対して22.4で、範囲内です。
- **ベテルギウス**は28%小さく、**アンタレス**は34%小さく出ますが、どちらも広い範囲の内側です。低温の赤色超巨星の光を全波長の放射量に換算するのは難しく（ボロメトリック補正は100Kごとに0.4等級変わります）、2つとも、ちりと分子に光が分けられるため、赤色超巨星の表より約0.7等級下に位置します。年周視差の精度が低いので、半径は大まかな推定です。アンタレスはカタログの年周視差だと距離が近すぎて半径が116太陽半径と出ますが、測定された37.4ミリ秒角の円盤は、よく引用される距離170パーセクだと約680太陽半径に相当します。
- **アルタイル・レグルス・ベガ**は速く自転してつぶれており、この方法の円盤は、測定された極方向と赤道方向の幅の間に入ります。

## 星の姿

`starPortrait`は、星のプロファイルからSVGの文字列で星を描きます。温度に応じた色の円盤を、周縁減光で縁に向かって暗くし、その型に合った種類の対流セルによる一般的な表面模様と、やわらかい光のにじみを加えます。`portraitLook`は選んだ見た目（`PortraitLook`）を答えます。少数の巨大な対流セルをもつ`"supergiant"`（超巨星）、`"giant"`（巨星）、細かい粒状斑の`"sun-like"`（太陽型）、`"red-dwarf"`（赤色矮星）、なめらかな`"hot"`（高温星）、下で述べる3つの星用の`"fast-rotator"`（高速自転）です。絵は、数値から描いたことと、模様が一般的なものであることを、絵自身の言葉で示します。私たちが自分で描いたもので、写真ではありません。

```js
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { portraitLook, starPortrait } from "@johnmorrisdotca/hoshi-stars/portrait";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

const profile = starProfile(starByName("Betelgeuse"));
const svg = starPortrait(profile, { name: "Betelgeuse", size: 320, lang: "ja" });
console.log(portraitLook(profile), svg.startsWith("<svg"), svg.includes("写真ではありません"));
// supergiant true true
```

オプション（`PortraitOptions`）は、ピクセル単位の`size`、`lang`（`"en"`か`"ja"`）、`name`、`background`（`"space"`、または透明にする`"none"`）、`captions`です。同じ星は、いつも同じ絵になります。模様は固定の乱数列で配置されるので、サーバーで描いてもブラウザーの結果と一致します。描く温度がない星には、`starPortrait`は`undefined`を返します。

`starComparison`は、星を太陽と同じ縮尺で並べます。超巨星なら絵いっぱいに描き、中心に太陽を点で置き、地球・火星・木星の軌道を、収まるものだけ上に重ねます。太陽系と見比べて大きさがつかめます。

```js
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starComparison } from "@johnmorrisdotca/hoshi-stars/portrait";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

const betelgeuse = starComparison(starProfile(starByName("Betelgeuse")));
const aldebaran = starComparison(starProfile(starByName("Aldebaran")));
console.log(betelgeuse.includes("Earth's orbit"), aldebaran.includes("Earth's orbit"), aldebaran.includes("times the Sun's radius"));
// true false true
```

## 形が測定された少数の星

アルタイルとレグルスは非常に速く自転してつぶれており、ベガはほぼ極の方向から見えています。3つとも干渉計で測定されていて、`starShape`が公表された数値（`StarShape`）を出典つきで返します。`starProfile`も同じ形を`shape`に持ちます。絵は、アルタイルとレグルスを、低温で暗い赤道をもつ楕円として、ベガを中心が熱い丸い円盤として描きます。ほかの星では、`starShape`は`undefined`を返します。

```js
import { starShape } from "@johnmorrisdotca/hoshi-stars/profile";

const altair = starShape(7557);
console.log(altair.kind, altair.equatorialRadius, altair.polarRadius, starShape(2491));
console.log(altair.source);
// oblate 2.029 1.634 undefined
// Monnier et al. 2007, Science 317, 342 (CHARA)
```

## 星の自転の速さ

輝星星表には、5,080 個のうち約 2,800 個の星について、見かけの自転の速さ v sin i があります。赤道の速さに、自転軸と視線のあいだの角度のサインをかけたものです。軸のかたむきはここからはわからないので、本当の速さはこの値か、それより速くなります。`starRotation` は、この値と星表の印（上限だけのときは `upperLimit`、不確かなときは `uncertain`）を返します。`starProfile` は同じものを `rotation` に入れます。値のない星では `undefined` です。

```js
import { starRotation } from "@johnmorrisdotca/hoshi-stars/profile";

const phecda = starRotation(4554);
console.log(phecda.vSinIKmS, phecda.upperLimit, starRotation(2061));
// 168 false undefined
```

## ページに入れる

サーバー（Node）では：

```js
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starComparison, starPortrait } from "@johnmorrisdotca/hoshi-stars/portrait";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

// A server draws the same picture a browser does: pure, no DOM, no clock. Here Betelgeuse's portrait and its size beside the Sun, to two files.
const profile = starProfile(starByName("Betelgeuse"));
writeFileSync(join(tmpdir(), "betelgeuse-portrait.svg"), starPortrait(profile, { name: "Betelgeuse", size: 320 }));
writeFileSync(join(tmpdir(), "betelgeuse-and-the-sun.svg"), starComparison(profile, { name: "Betelgeuse", size: 360 }));
console.log(`Betelgeuse ${Math.round(profile.radius.value)} Suns across, from ${Math.round(profile.radius.range[0])} to ${Math.round(profile.radius.range[1])}`);
```

CDNから読み込む普通のHTMLページでは：

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star from jsDelivr</title>
  </head>
  <body>
    <div id="star"></div>
    <script type="module">
      import { starByName } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/index.js";
      import { starProfile } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/profile.js";
      import { starPortrait } from "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/dist/portrait.js";

      const profile = starProfile(starByName("Arcturus"));
      document.querySelector("#star").innerHTML = starPortrait(profile, { name: "Arcturus", size: 320 });
    </script>
  </body>
</html>
```

Reactでは（絵は文字列なので、マークアップとして入れます。Vueでは`v-html`、Svelteでは`{@html}`、Angularでは`[innerHTML]`で同じ行が使え、デモの「埋め込むもの」は選んだ星用にそれぞれを書き出します）：

```tsx
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starPortrait } from "@johnmorrisdotca/hoshi-stars/portrait";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

const svg = starPortrait(starProfile(starByName("Sirius")!), { name: "Sirius", size: 320 }) ?? "";

export function Star() {
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

自分でスクリプトを書かなくても、iframeで使えます。星の埋め込みページは、星のイェール輝星カタログの番号（`star=2061`）、太陽と並べる`view=compare`（指定しなければ星の姿）、`lang=ja`を読みます：

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/star.html?star=2061&view=compare"
      title="Betelgeuse next to the Sun"
      width="360"
      height="310"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

## 数値の出どころ

温度の目盛りは公表されたものです。Mamajekの矮星の系列（Pecaut and Mamajek 2013）、van Belle他の巨星（2021）、Levesque他の赤色超巨星（2005）です。ボロメトリック補正はFlower（1996）の式にTorres（2010）の係数を使い、周縁減光はClaretとBloemen（2011）のモデル大気の表、形はCHARAの3つの論文によります。`NOTICE.md`に各表と条件を挙げています。写真、画家の絵、Wikipediaの文章は使っていません。年周視差が最も良くなるはずのESAのデータ（ヒッパルコス・ティコ・ガイア）は、まったく使っていません。
