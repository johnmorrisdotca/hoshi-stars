---
title: The constellation quiz
section: how-to
order: 7
description: The demo's quiz page. A chart centred on one constellation with no names on it, six names to choose from, three styles and three levels, a streak and the ones you missed, all kept in the address.
---

[日本語](ja/constellation-quiz.md)

The demo's `quiz.html` shows a chart of the stars around one constellation with no name written on it, and six names in a row under it. Choose one: the right one turns green; a wrong one shakes (not with reduced motion) and the page says what it was. **Next question** asks another. The page keeps the score, the streak and, under the question, each constellation you missed with its picture and a link to its page, for as long as it is open.

- **Style** makes it easier or harder: *Plain* (the stars and nothing else, the hardest), *Stars and lines* (the constellation's figure as well) or *Annotated* (the figure, the IAU boundary, and the names of the neighbouring constellations, never the one asked).
- **Level** is which constellations it asks: *Bright 12* (the twelve whose figure stars give the most light), *Bright 30*, or *All 88*. The five wrong names are drawn from the same level.
- The address keeps `style` (`lines` or `annotated`; plain is the default), `level` (`30` or `88`; the bright 12 is the default) and `c`, the constellation asked (`quiz.html?c=Ori&level=88`), so a reload or a shared link asks the same question. The answer is in the address on purpose: it is a quiz for the classroom and the family, not a test.

The chart is the package's own `chart()` drawn once for each question, centred on `centreOfConstellation` and zoomed to fit the figure. Nothing moves and nothing is drawn while you think. It works on a phone, the six names in two or three columns, and the names are in Japanese on the Japanese page.
