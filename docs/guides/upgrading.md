---
title: Upgrading
section: upgrading
order: 40
description: What changes between versions, and how a script written for the stars in wakusei-planets moves to this package.
---

[日本語](ja/upgrading.md)

The package follows semantic versioning. Until 1.0 a minor version may change a name, and `CHANGELOG.md` lists it under **Changed**; a patch version never does.

## 0.1 and what comes next

0.1 is the first version. Each entry point is its own import: `.` (stars), `/constellations`, `/lines`, `/boundaries`, `/deep-sky`, `/deep-sky/ngc-ic`, `/projection` and `/sky`. Later versions add a Milky Way and a star-chart function, each as its own entry point; none will change what an existing one gives.

## From wakusei-planets' `/stars`

The stars were first part of [wakusei-planets](https://github.com/johnmorrisdotca/wakusei-planets). The code moved unchanged, so the functions have the same names and give the same answers: change the import from `@johnmorrisdotca/wakusei-planets/stars` to `@johnmorrisdotca/hoshi-stars`. wakusei-planets' `/stars` will re-export this package, and this package never imports wakusei-planets.

## What a patch may change

The data. A corrected position, a name added to the list of 136, a figure changed to look better: none changes a name or a type, and a test holds every count. If a chart of yours depends on a figure's exact lines, copy the lines you want into your code.
