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
| `target` | 指定した対象に向きを合わせ、丸で囲みます。[自分の空で見る](#自分の空で見る)を参照してください。 |

プロパティは、`latitude`、`longitude`、`time`(`Date`、リアルタイムなら `null`)、`heading`、`pitch`、`fov`、`setView({ heading, pitch, fov })`、`target` と `marks`(次の節)、そして読み取り専用の `sky`(`MySkyReport`: 下の `skyReport` と同じ内容に `target` を加えたもの)です。要素は、向きが変わるたびに `hoshi-sky-view`(`MySkyViewDetail`: `heading`、`pitch`、`fov`、`final`)を、何かをタップしたときに `hoshi-sky-pick`(`MySkyPick`: `kind` は `sun`、`moon`、`planet`、`figure`、`none` のどれか、と `id`)を送ります。クラスは `HoshiMySkyElement`、タグは `MY_SKY_TAG`(`hoshi-my-sky`)で、`defineMySky()` が定義します。`@johnmorrisdotca/hoshi-stars/my-sky/define` はimportすると定義し、`/my-sky/element` はクラスをexportするだけです。

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

## 自分の空で見る

星、惑星、星座を紹介するページから、`<hoshi-my-sky>` を対象に向けて開けます。`target` を指定すると、視点が対象へなめらかに動き(動きを減らす設定の人には、すぐ切り替わります)、対象を丸で囲んで名前を添え、地平線の上にあるかどうかを示します。

```html
<hoshi-my-sky id="sky" latitude="49.28" longitude="-123.12" timezone="America/Vancouver" style="height: 80vh"></hoshi-my-sky>
<button id="mars">See Mars in my sky</button>
<script type="module">
  import "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/hoshi-stars/my-sky/define/+esm";
  const sky = document.getElementById("sky");
  document.getElementById("mars").addEventListener("click", () => {
    sky.target = "planet:mars";
  });
  sky.addEventListener("hoshi-sky-target", (event) => console.log(event.detail.label, event.detail.up, event.detail.reached));
</script>
```

`target` は属性にもプロパティにもでき、次のものを指定できます。

| 指定 | 向ける先 |
|---|---|
| 星のid(`betelgeuse`、`hr-2061`、`alpha-orionis` など) | その星。idは[名前の索引](names.md)の `nameRows` のもので、`m31` のようなメシエ天体も使えます。 |
| `planet:mars` | 明るい5つの惑星のどれか(`mercury`、`venus`、`mars`、`jupiter`、`saturn`)。 |
| `moon`、`sun` | 月、または太陽。 |
| `constellation:Ori` | 星座。略称か、`constellation` が受け付ける名前(`constellation:Orion`、`constellation:オリオン座`)で指定します。 |
| `{ azimuth, altitude, label }` | ページ独自の点(プロパティのみ)。北から東回りの方位と地平線からの高度を度で、そして横に添える名前を指定します。 |

指定したときの動きは次のとおりです。

- **視点が対象へ向きます。** 星、惑星、月、太陽、点は中央に置きます(視野角はそのままですが、90度より広いときは90度に狭めます)。星座は全体が収まるように、星々の中心を向き、いちばん遠い星まで入る視野角(20〜130度)にして、星座線を明るくします。動きは長くても1秒足らずで、一度に1フレームしか要求せず、着いたあとは何かが変わるまで何も描きません。ドラッグ、ホイール、キー操作をすると、その場で止まります。同じ `target` をもう一度指定すると、もう一度そこへ動き、`null` を指定すると丸が消えます。
- **丸で囲んで名前を添えます。** 欄には、位置を `土星: 地平線から40°、南東の方角` のように示し、沈む時刻も添えます。丸は、空が動いても対象に付いていきます。リアルタイムの空は10秒ごと(動きを減らす設定では1分ごと)に位置を求め直し、昇る時刻と沈む時刻は、その時刻を過ぎるまで求め直しません。
- **地平線の下にあるとき**は、欄がそれを知らせ、どちらの方角かも示します(`シリウスは地平線の下にあります。東の方角、地平線から25°下です`)。次に昇る時刻(`23:31に昇ります`)も出し、視点は地平線が見えるようにその方角を向き、地平線上のマーカーが昇ってくる場所を示します。その場所では昇らない星は `ここでは、一度も昇りません`、沈まない星は `ここでは、いつも地平線の上にあります` と表示します。この先24時間以内に昇らない惑星、月、太陽も、そのことを表示します。星座は、星々の中心が地平線の上にあるときに「出ている」と数えます。
- **ページに知らせます。** 視点が着くと、`reached` を true にして `hoshi-sky-target`(`MySkyTargetDetail`)を送ります。着く前にドラッグなどの操作や新しい `target` で止まったときは、`reached` を false にして送ります。内容は、指定された `target`、`kind`、表示中の言語での `label`、`altitude`、`azimuth`、`up` です。`sky.target`(`MySkyTargetReport`、`MySkyReport` の中)も同じ内容に、次の `rise` と `set`(1970年からのミリ秒、ないときは `null`)と `always`、`never` を加えたもので、`target` がないときや、idに当てはまるものがないときは `null` です(そのとき欄には `「…」は見つかりませんでした` と出ます)。
- **場所が決まるまで待ちます。** `target` を `latitude` と `longitude` より先に指定しても、2つが決まった時点でその対象を向きます。要素にまだ大きさがないとき(閉じたダイアログの中など)は、視点がすぐ切り替わるので、ダイアログを開いたときにはもう向いています。

星のidは、初めて必要になったときに名前の索引で調べます。そのため、惑星、月、太陽、星座、点だけを使うページでは、索引を読み込みません。星をカタログ番号(`hr-2061`)で指定するときも、索引は要りません。

### ページ独自のマーカー

`marks` は、ページ自身が空に描く点の一覧です。毎秒更新される人工衛星の位置、探査機、目印などに使います。それぞれ `{ id, azimuth, altitude, label, kind? }`(`SkyMark`)で、`kind` が `satellite` のものはひし形、それ以外は点で描き、横に名前を添えます。地平線の下にあるものは薄く描きます。

```html
<script type="module">
  const sky = document.getElementById("sky");
  sky.marks = [{ id: "iss", azimuth: 250, altitude: 42, label: "ISS", kind: "satellite" }];
  sky.addEventListener("hoshi-sky-mark", (event) => console.log(event.detail.id));
</script>
```

マーカーをタップするか、そのボタンでEnterを押すと、`hoshi-sky-mark`(`MySkyMarkDetail`: `id`、`label`、`kind`、`azimuth`、`altitude`)を送ります。マーカーはどれも、スクリーンリーダーやTabキーで届く一覧の中のボタンです。静止しているときは何も描かず、印か視点が変わったときだけ描き直します。そのため、ページが `marks` を毎秒設定しても構いませんし、前の一覧と(印ごとに)同じなら何も描きません。`id` がない項目、有限でない数値の項目、すでに一覧にある `id` の項目は取り除き、保持するのは500件までです(`cleanMarks`、`MARKS_MAX`、`sameMarks`)。

### 計算だけを使う

要素が使っているのと同じ純粋な関数が `@johnmorrisdotca/hoshi-stars/my-sky` にあるので、ページは要素なしでも、対象がどこにあるかを求められます。

```js
import { resolveStarId, resolveTarget, targetInSky, viewOfObject } from "@johnmorrisdotca/hoshi-stars/my-sky";

const vancouver = { latitude: 49.28, longitude: -123.12 };
const evening = new Date("2026-11-17T04:00:00Z");

const mars = targetInSky(resolveTarget("planet:mars").locator, vancouver, evening);
console.log(mars.up, Math.round(mars.altitude), new Date(mars.rise).toISOString().slice(0, 16)); // false -23 2026-11-17T07:09

const sirius = targetInSky((await resolveStarId("sirius")).locator, vancouver, evening);
console.log(sirius.up, Math.round(sirius.altitude), new Date(sirius.rise).toISOString().slice(0, 16)); // false -25 2026-11-17T06:31
console.log(viewOfObject(sirius.altitude, sirius.azimuth, 90).pitch); // 10
```

- `parseTarget(target)`(`ParsedTarget`、`SkyTarget`、`SkyPoint`)は、指定の文字列または点を読んで、どの種類かを返します。何も調べません。`resolveTarget(target)` は、何も読み込まずに決められるもの(惑星、月、太陽、星座、点、カタログ番号で指定した星)をその場で決め、名前の索引で調べる `resolveStarId(id)` が必要なidには `"later"` を返します(`ResolvedTarget`: `kind`、英語と日本語の `label`、`locator`、星座なら `figure`)。
- `locate(locator, observer, when)` は、対象がある位置(`altitude`、`azimuth`)です。`riseAndSet(locator, observer, when)`(`RiseAndSet`)は、次の `rise` と `set`、そして `always`(常に出ている)か `never`(決して出ない)かです。`targetInSky(locator, observer, when, times?)`(`TargetInSky`)は、その両方に `up` を加えたものです。`SkyLocator` は、惑星、月、太陽、星々の間の場所(星や星座の中心)、または点です。星と惑星は26時間を6分刻みでたどり、光が大気で曲がって見える高度(-34分角)での出入りを秒単位まで求めます。太陽は上の縁(-50分角)、月は `moonRiseSet` によります。地球が1回転する間に一度も地平線を越えない星は、`always` か `never` です。
- `viewOfObject(altitude, azimuth, fov)` は、対象を中央に置く視点です(地平線より8度を超えて下にあるものは、頭を10度上げて地平線の方角を向きます)。`viewOfGroup(directions)` は、方向の集まりが収まる視点で、広がりの1.3倍の視野角にします。`glideView(from, to, fraction)` は、なめらかな移動の途中の視点で、短いほうの回り方をし、始めと終わりはゆっくり動きます。
- 要素自身の型は `@johnmorrisdotca/hoshi-stars/my-sky/element` にあります。イベントの `MySkyTargetDetail` と `MySkyMarkDetail`、`sky` プロパティの `MySkyReport` と `MySkyTargetReport` です。

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
