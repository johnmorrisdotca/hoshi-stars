---
title: iframeで星図を埋め込む
section: how-to
order: 14
description: 自分のスクリプトを動かせないページに、埋め込みページのアドレスで星図を入れる方法と、アドレスの各部分の意味です。
---

[English](../embed-in-an-iframe.md)

ブログ、Wiki、CMSなど、自分のスクリプトを動かせないページのために、デモサイトに`embed.html`があります。アドレスが求める星図だけを描くページです。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hoshi Stars in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/hoshi-stars/embed.html?proj=stereographic&ra=84&dec=0&zoom=1.5&mag=5&layers=lines,names&c=Ori"
      title="A chart of the sky around Orion"
      width="480"
      height="360"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

星図は枠いっぱいに広がり、枠の大きさが変わると描き直します。自分のファイル以外は何も読み込みません。星図はいつも夜空の色なので、ライトとダークの違いはありません。

## アドレス

| 部分 | 意味 |
|---|---|
| `proj` | `stereographic`、`orthographic`、`gnomonic`、`equidistant`、`equirectangular`、`mollweide`、`hammer`のどれか |
| `ra`, `dec`, `zoom` | 見る方向（度）と、拡大の度合い（0.6〜60）。省略するとオリオン座（`ra=84`、`dec=0`）を中心に、幅およそ90度（フレームの幅が600px未満なら60度）で表示 |
| `mag` | いちばん暗い星（2〜6） |
| `layers` | `milky`（天の川）、`lines`、`boundaries`、`names`、`deep`（メシエ）、`grid`をコンマでつないだもの、または`none`。省略すると`milky,lines,names,grid`です。 |
| `lang` | `ja`にすると星座名が日本語になります |
| `c` | 明るく描く星座（`Ori`）。境界線も描きます。 |

デモの「ページに入れる」のパネルは、いま見ている星図のアドレスとiframeタグを書き出します。

## 使わないほうがよいとき

iframeは外からスタイルを変えられず、リクエストも1つ増えます。スクリプトを動かせるなら、[自分で星図を描く](sky-charts.md)ほうが簡単です。数行で、ページも1つ少なくなります。
