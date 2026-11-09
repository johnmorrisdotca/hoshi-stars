---
title: 自分でサーバーを動かす
section: how-to
order: 30
description: 小さな検索サーバーを自分で動かします。
---

[English](../serve-it-yourself.md)


この例は、自分で動かして公開する小さな Node の HTTP サービスです。私たちは検索サービスを運営しません。初期設定では `127.0.0.1:8262` で待ち受けます。別のローカルポートを使うときは `PORT` を設定してください。

チェックアウトで開発用の依存関係を入れ、`pnpm build` を実行してから `node examples/serve/server.mjs` を実行します。別のターミナルから次のように呼べます。

```sh
curl 'http://127.0.0.1:8262/star?name=Sirius'
curl 'http://127.0.0.1:8262/constellation?abbr=Ori'
curl 'http://127.0.0.1:8262/near?ra=101.287&dec=-16.716&radius=1'
```

返事は JSON です。`/near` には J2000 の赤経、赤緯、半径を度で指定します。明るい星の表を検索します。不正な値や見つからない名前には 400、知らないパスには 404 を返します。停止は Ctrl-C です。他の人に公開するときは、設置先とアクセス制限を自分で選んで設定してください。
