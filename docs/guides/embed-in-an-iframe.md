---
title: Embed a chart in an iframe
section: how-to
order: 14
description: Put a sky chart on a page you cannot run script on, by the address of the embed page, and what each part of the address does.
---

[日本語](ja/embed-in-an-iframe.md)

For a page that cannot run script of its own (a blog, a wiki, a CMS), the demo site has `embed.html`: a page that draws the chart its address asks for and nothing else.

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

The chart fills the frame and draws again when the frame is resized. It fetches nothing but its own files. Light and dark make no difference: the chart is always a night sky.

## The address

| Part | Means |
|---|---|
| `proj` | One of `stereographic`, `orthographic`, `gnomonic`, `equidistant`, `equirectangular`, `mollweide`, `hammer`. |
| `ra`, `dec`, `zoom` | Where it looks, in degrees, and how far in (0.6 to 60). Left out, it looks at Orion (`ra=84`, `dec=0`) about 90 degrees wide, or 60 when the frame is under 600 pixels wide. |
| `mag` | The faintest star, 2 to 6. |
| `layers` | A comma list of `milky` (the Milky Way), `lines`, `boundaries`, `names`, `deep` (Messier) and `grid`, or `none`. Left out, it is `milky,lines,names,grid`. |
| `lang` | `ja` for constellation names in Japanese. |
| `c` | A constellation (`Ori`) to draw brighter, with its boundary. |

The demo's "Put it in your page" panel writes this address for the chart you are looking at, with the iframe tag.

## When not to

An iframe cannot be styled from outside and costs a request. If you can run script, [draw the chart yourself](sky-charts.md); it is a few lines and one page less.
