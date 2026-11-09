---
title: Sky cultures
section: how-to
order: 9
description: The same stars under Western, traditional Japanese and traditional Chinese figures and names: the 88 constellations and asterisms, 昴 and 北斗七星, the Twenty-Eight Mansions, in English, Japanese, Simplified and Traditional Chinese.
---

[日本語](ja/sky-cultures.md)

A constellation is a way people joined the stars, and not every people joined them the same way. A sky culture here is a named set of figures made of the same Bright Star Catalogue stars, each with its names and its reading. The 88 constellations of the IAU are the default and nothing about them changes. Three cultures are each their own import, so a page pays only for the one it uses:

| Import | What it holds |
|---|---|
| `@johnmorrisdotca/hoshi-stars/cultures/western` | The 88 constellations with their names in Latin, English, Japanese and Chinese (Simplified and Traditional, with pinyin), and 17 asterisms: the Big Dipper, the Summer Triangle, the Great Square of Pegasus and more. |
| `@johnmorrisdotca/hoshi-stars/cultures/japanese` | The 88 constellations under their Japanese names, and 18 traditional Japanese names and figures: 昴 (Subaru), 北斗七星 (Hokuto Shichisei), 鼓星 (Tsuzumi-boshi), 織姫 (Orihime) and 彦星 (Hikoboshi), each with its reading. |
| `@johnmorrisdotca/hoshi-stars/cultures/chinese` | The traditional Chinese sky, 三垣二十八宿 (the Three Enclosures and the Twenty-Eight Mansions): 238 asterisms, with their names in Traditional and Simplified characters and in pinyin. |
| `@johnmorrisdotca/hoshi-stars/culture` | The types, and `defineCulture` to make a culture of your own. |

A culture goes in as an extra argument to the functions you already use: `constellations(culture)`, `constellation(text, culture)`, `starsIn(text, culture)`, `figures(culture)` and `figureOf(text, culture)`. Leave it out and you get the 88 of the IAU, as before.

## The traditional Chinese sky

```js
import { constellation, constellations, starsIn } from "@johnmorrisdotca/hoshi-stars/constellations";
import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";

const dipper = constellation("北斗", chinese);
console.log(dipper.name, dipper.readings.zh, dipper.kind);
console.log(starsIn("beidou", chinese).map((star) => star.name).join(", "));
console.log(constellations(chinese).length, constellations(chinese).filter((a) => a.kind === "mansion").length);
// 北斗 běi dǒu asterism
// Alioth, Dubhe, Alkaid, Mizar, Merak, Phecda, Megrez
// 238 28
```

`constellation` and `figureOf` find a figure by any of its names (Traditional or Simplified characters, pinyin with or without tone marks, the id), ignoring case. The 28 mansions come first, each with its English name and the quarter of the sky it belongs to, the Azure Dragon (`azure-dragon`), the Black Tortoise, the White Tiger or the Vermilion Bird:

```js
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";

const horn = figureOf("角宿", chinese);
console.log(horn.asterism.names.en, horn.asterism.group, horn.asterism.readings.zh, horn.stars.map((star) => star.name).join(", "));
// Horn azure-dragon jiǎo xiù Spica, Heze
```

Spica is 角宿一, the first star of 角宿. The names of the stars are the first part of the work: a Chinese star name is its asterism and its number in it.

### What the catalogue does not hold

Most Chinese asterisms have stars fainter than magnitude 6.0, which the Bright Star Catalogue does not hold. A figure draws only the stars we have, and `missing` says at least how many it lacks: the largest star number found in the asterism, less the stars held.

```js
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";

const guard = figureOf("羽林軍", chinese);
console.log(guard.stars.length, guard.asterism.missing);
// 7 32
```

The Palace Guard has about forty-five stars in the traditional lists; the catalogue holds 7 of them. The lines are our own: the stars of an asterism joined by the shortest set of lines that reaches them all, not the traditional drawing. 195 of the 238 asterisms have two stars or more to join; the rest are one star.

Two names are used by more than one asterism in the old lists (柱, 天田, 杵 and 五諸侯). Each is split into the groups of stars that lie together, with ids such as `tian1-tian2` and `tian1-tian2-2`, and a lookup by the bare name finds neither: use the id.

## The traditional Japanese sky

```js
import { constellation, starsIn } from "@johnmorrisdotca/hoshi-stars/constellations";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";

const subaru = figureOf("すばる", japanese);
console.log(subaru.asterism.name, subaru.asterism.readings.ja, subaru.asterism.names.en, subaru.stars.map((star) => star.name).join(", "));
console.log(constellation("六連星", japanese).id, constellation("Hokuto Shichisei", japanese).aka.join(" "));
console.log(starsIn("鼓星", japanese).length);
// 昴 すばる Subaru Taygeta, Maia, Electra, Merope, Alcyone, Atlas
// subaru 七つ星 ななつぼし 四三の星 しそうのほし
// 7
```

Each figure has `name` in its own writing, `readings.ja` in hiragana, `names.en` in romaji, `aka` for the other names it goes by (六連星 for 昴, 七つ星 for 北斗七星), and `about`, a few English words (`the Pleiades`). Names, readings and the stars they name come from the pages credited in `NOTICE.md`; the Japanese awaits a native reader. The lines are our own joins.

## The Western sky and the names in every language

```js
import { constellation, starsIn } from "@johnmorrisdotca/hoshi-stars/constellations";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { western } from "@johnmorrisdotca/hoshi-stars/cultures/western";

for (const text of ["天龍座", "天龙座", "tiān lóng zuò", "りゅう座", "Draco", "Dragon"]) console.log(text, constellation(text, western).id);
const dra = constellation("Dra", western);
console.log(dra.names["zh-Hans"], dra.names["zh-Hant"], dra.readings.zh, dra.names.ja);
const triangle = figureOf("Summer Triangle", western);
console.log(triangle.stars.map((star) => star.name).join(", "), triangle.segments.length);
console.log(starsIn("夏の大三角", western).length);
// 天龍座 Dra
// 天龙座 Dra
// tiān lóng zuò Dra
// りゅう座 Dra
// Draco Dra
// Dragon Dra
// 天龙座 天龍座 tiān lóng zuò りゅう座
// Vega, Altair, Deneb 3
// 3
```

The Chinese names of the 88 are in the Western culture: the Traditional ones are the National Academy for Educational Research's (Taiwan) astronomy terms, the Simplified ones are those names in the mainland's characters. Both await a native reader.

## Your own culture

`defineCulture` makes a culture from a function that lists its figures. A figure's stars are chains of Bright Star Catalogue (HR) numbers.

```js
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { defineCulture } from "@johnmorrisdotca/hoshi-stars/culture";

const mine = defineCulture("mine", { en: "Mine", ja: "私の" }, () => [
  { id: "w", name: "W", names: { en: "The W" }, readings: {}, aka: [], about: "", kind: "asterism", group: undefined, missing: 0, chains: [[21, 168, 264, 403, 542]] },
]);
console.log(figureOf("the w", mine).stars.map((star) => star.name).join(", "));
// Caph, Schedar, Navi, Ruchbah, Segin
```

## In the demo

The demo's Sky culture choice (Western, Japanese, Chinese) is kept in the address as `culture=` (nothing for the Western sky): `?culture=chinese`. Picking one redraws the figures and the names on the same stars. Tap a figure, or search for it by any of its names, for its card: its names and reading, what it is, the quarter of the sky, the constellations it lies in, its bright stars, and, where stars are fainter than the catalogue goes, a note that only the stars we have are drawn. The embed page takes the same `culture=`.

## Where the data comes from

The Chinese asterisms are read from Wikidata (CC0): which star carries which traditional name. The lines, the Western asterisms and the Japanese figures are our own joins of stars. Stellarium's sky-culture files are GPL and CC BY-SA and are not used, nor is any source with non-commercial or share-alike terms. [Data and licences](data-and-licences.md) has the table, and `NOTICE.md` names each source with its address and the day it was read.
