---
title: アップグレード
section: upgrading
order: 40
description: バージョン間の変更と、wakusei-planetsの星のコードをこのパッケージに移す方法です。
---

[English](../upgrading.md)

パッケージはセマンティックバージョニングに従います。1.0になるまでは、マイナーバージョンで名前が変わることがあり、`CHANGELOG.md`の**Changed**に書きます。パッチバージョンでは変わりません。

## 0.1と、これから

0.1が最初のバージョンです。エントリーポイントはそれぞれ別のimportです。`.`（星）、`/constellations`、`/lines`、`/boundaries`、`/deep-sky`、`/deep-sky/ngc-ic`、`/projection`、`/sky`です。あとのバージョンで天の川と星図の関数が、それぞれ別のエントリーポイントとして加わります。すでにあるものの結果は変えません。

## wakusei-planetsの`/stars`から

星はもともと[wakusei-planets](https://github.com/johnmorrisdotca/wakusei-planets)の一部でした。コードはそのまま移したので、関数の名前も結果も同じです。importを`@johnmorrisdotca/wakusei-planets/stars`から`@johnmorrisdotca/hoshi-stars`に変えてください。wakusei-planetsの`/stars`は、このパッケージを再エクスポートする予定で、このパッケージがwakusei-planetsをimportすることはありません。

## パッチで変わりうるもの

データです。位置の訂正、136個の名前への追加、見やすくするための線の変更などです。名前や型は変わらず、テストが数をすべて固定しています。線の形に頼る星図は、必要な線を自分のコードにコピーしてください。
