---
title: 空を見上げる
section: how-to
order: 15
description: "外に立った人に見える空を表示する <hoshi-my-sky> 要素と、その裏側の計算(月の満ち欠け、月の出と月の入り、惑星、太陽、カメラ)。"
---

[English](../my-sky.md)

`<hoshi-my-sky>` は、ある場所にいる人が、ある時刻に空を見上げたときに見えるものを表示します。北・東・南・西を記した地平線、実際の位置にある星と星座、実際の満ち欠けの月とその月の出・月の入り、出ている惑星、昼間の太陽、そして地平線の下の暗い地面です。ドラッグすると、向きを変えたり、頭を上げ下げしたりできます。[デモの「空を見上げる」ページ](https://johnmorrisdotca.github.io/hoshi-stars/my-sky.html?lang=ja)は、この要素に、場所と時刻を選べるようにしたものです。

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/my-sky/define/+esm"></script>
<hoshi-my-sky latitude="49.28" longitude="-123.12" timezone="America/Vancouver" style="height: 80vh"></hoshi-my-sky>
```

表示枠いっぱいに広がるので、高さを指定してください。`time` を指定しなければ、時計に合わせて動き、ページが表示されている間は10秒ごとに描き直します(動きを減らす設定の人には1分ごと)。時刻を指定しているときは再描画しません。

## 属性

| 属性 | 働き |
|---|---|
| `latitude`、`longitude` | 場所を度で指定します(北と東が正)。両方必要です。ないときは、要素がその旨を表示します。 |
| `time` | 時刻をISO形式の文字列かミリ秒で指定します。省略すると、リアルタイムです。 |
| `lang` | `en` または `ja`。省略すると、親要素のうち最も近い `lang` に従い、その変更にも追従します。 |
| `heading` | 最初に向く方位。0が北、90が東です。省略すると、赤道の側を向きます(北半球なら南、南半球なら北)。 |
| `pitch` | 最初に見上げる角度(初期値35)。 |
| `fov` | 短い辺方向の視野角。20〜130(初期値90)。 |
| `timezone` | 月の出と月の入りの時刻に使うIANAタイムゾーン名(`America/Vancouver`)。省略すると、見ている人の端末の設定に従います。 |
| `info="none"` | 月と惑星の欄を隠します。 |
| `constellation-lines` | 0から1の強さ、または `off`。暗い空での初期値は控えめな0.32です。 |
| `star-names` | 星の名前の数、または `off`。初期値は表示の大きさに合わせて決まります。 |
| `daylight="show"` | 太陽が出ていても星を描きます。 |

プロパティは、`latitude`、`longitude`、`time`(`Date`、リアルタイムなら `null`)、`heading`、`pitch`、`fov`、`setView({ heading, pitch, fov })`、そして読み取り専用の `sky`(下の `skyReport` と同じ内容)です。要素は、向きが変わるたびに `hoshi-sky-view`(`MySkyViewDetail`: `heading`、`pitch`、`fov`、`final`)を、何かをタップしたときに `hoshi-sky-pick`(`MySkyPick`: `kind` は `sun`、`moon`、`planet`、`figure`、`none` のどれか、と `id`)を送ります。クラスは `HoshiMySkyElement`、タグは `MY_SKY_TAG`(`hoshi-my-sky`)で、`defineMySky()` が定義します。`@johnmorrisdotca/hoshi-stars/my-sky/define` はimportすると定義し、`/my-sky/element` はクラスをexportするだけです。

ドラッグ、2本指(ピンチ)、Ctrlとホイール、矢印キー(Shiftで大きく動く)、+ と -、Home は、シリーズ共通の表示操作で、`@johnmorrisdotca/kazoku-ui` が担います。空は、形を保ったまま視野130度まで広げられるステレオ投影で描くので、地平線は曲線になります。月と惑星は、どんな空の図とも同じように、実際より大きく描きます。太陽が昇るにつれて星は隠れます(見える星の限界等級は、暗いときの6等から昼間の-3等まで下がり、それより明るい星だけが見えます)。地平線の近くは大気で暗くなります。

## 裏側の計算

要素は描くだけです。描く数値はすべて、`@johnmorrisdotca/hoshi-stars/my-sky` の純粋な関数で求めます(DOMも時計も星の表も使いません)。公表されている値で検証してあります。

```js
import { moonPhase, moonRiseSet, skyReport } from "@johnmorrisdotca/hoshi-stars/my-sky";

const vancouver = { latitude: 49.28, longitude: -123.12 };
const evening = new Date("2026-11-17T04:00:00Z");
const report = skyReport(vancouver, evening);
console.log(Math.round(report.moon.phase.illuminated * 100), report.moon.phase.name, report.planets.filter((p) => p.up).map((p) => p.id).join()); // 47 first-quarter saturn

const next = moonRiseSet(vancouver, evening);
console.log(new Date(next.set).toISOString().slice(0, 16), next.rise > next.set); // 2026-11-17T06:58 true
console.log(moonPhase(new Date("2026-11-24T15:01:00Z")).name); // full
```

- `skyReport(observer, when)` は、太陽、月(`MoonInSky`: 高度、方位、`phase`、次の `rise` と `set`、大きさ、太陽の向き)、5つの惑星(`PlanetInSky`)を返し、その空で見える限界の明るさ(限界等級)として `limit`(`limitingMagnitude(sunAltitude)`)を付けます。型は `SkyReport` です。
- `moonPosition(when)`(`MoonPosition`)、`moonPhase(when)`(`MoonPhase`、`MoonPhaseName`)、`moonHorizontal(observer, when)`、`moonRiseSet(observer, when)` は、天文年鑑の低精度の月の式で、位置は約0.3度、月の出・月の入りは数分、光っている部分は0.3パーセントの精度です。テストでは、wakusei-planets のELP級数と比べますが、これは開発用の道具にすぎず、このパッケージはそれをimportしません。
- `planetPlaces(when)`(`PlanetPlace`、`NakedEyePlanet`、`NAKED_EYE_PLANETS`)は、水星から土星までを、1800年から2050年に使えるスタンディッシュの近似軌道要素(数分角の精度)と、天文年鑑の等級の式で求めます。
- `sunPlace(when)` は、その日の分点を基準にした太陽の位置と距離です。
- `localFrame(observer, when)`(`LocalFrame`、`Direction`)と `altitudeAzimuth(direction)` は、J2000の位置を東・北・上に変える1回の回転で、[星図](sky-charts.md)の `horizontal` と一致し、全カタログを扱えるほど速く動きます。
- カメラは、`SkyCamera`、`ScreenSpot`、`CameraAxes`、`cameraAxes`、`projectDirection`、`directionAt`、`viewScale`、`degreesPerPixel`、`clampView`、`openingHeading`、`PITCH_MIN`、`PITCH_MAX`、`FOV_MIN`、`FOV_MAX` です。
- 空と地面の色は、`skyColours(sunAltitude)` と `paintBackground` です。
- 表示文言は、`mySkyWords(language)`(`MySkyWords`、`MySkyLanguage`)、`say`、`compassPoint`、`COMPASS`(`CompassPoint`)です。

## ボタンから開く

場所(読む人の現在地や選んだ場所)がわかっているページでは、ダイアログや全画面のパネルに要素を入れて、緯度と経度を渡します。

```html
<dialog id="sky"><hoshi-my-sky id="my-sky" style="width: min(96vw, 900px); height: 85vh"></hoshi-my-sky></dialog>
<button id="see">See my sky</button>
<script type="module">
  import "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/my-sky/define/+esm";
  document.getElementById("see").addEventListener("click", () => {
    const sky = document.getElementById("my-sky");
    sky.latitude = 49.28;
    sky.longitude = -123.12;
    document.getElementById("sky").showModal();
  });
</script>
```
