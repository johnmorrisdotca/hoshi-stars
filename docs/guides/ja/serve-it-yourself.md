---
title: 自分でサーバーを動かす
section: how-to
order: 30
description: 小さな検索サーバーを自分で動かします。
---

[English](../serve-it-yourself.md)


この例は、自分で動かして公開する小さな Node の HTTP サービスです。私たちは検索サービスを運営しません。初期設定では `127.0.0.1:8262` で待ち受けます。別のローカルポートを使うときは `PORT` を設定してください。

```js
import { createServer } from "node:http";
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { constellation } from "@johnmorrisdotca/hoshi-stars/constellations";
import { within } from "@johnmorrisdotca/hoshi-stars/nearest";

const port = Number(process.env.PORT ?? 8262);
createServer((request, response) => {
  const send = (status, body) => {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(body));
  };
  if (request.method !== "GET") return send(400, { error: "GET only" });
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/star") {
    const name = url.searchParams.get("name")?.trim();
    const found = name && starByName(name);
    return found ? send(200, found) : send(400, { error: "Unknown or missing star name" });
  }
  if (url.pathname === "/constellation") {
    const abbr = url.searchParams.get("abbr")?.trim();
    const found = abbr && constellation(abbr);
    return found ? send(200, found) : send(400, { error: "Unknown or missing constellation" });
  }
  if (url.pathname === "/near") {
    const values = ["ra", "dec", "radius"].map((key) => url.searchParams.get(key));
    if (values.some((value) => value === null || value.trim() === "")) return send(400, { error: "ra, dec and radius are required" });
    const [ra, dec, radius] = values.map(Number);
    if (![ra, dec, radius].every(Number.isFinite) || ra < 0 || ra >= 360 || dec < -90 || dec > 90 || radius < 0 || radius > 180) return send(400, { error: "Invalid coordinates or radius" });
    return send(200, within({ rightAscension: ra, declination: dec }, radius));
  }
  return send(404, { error: "Unknown route" });
}).listen(port, "127.0.0.1", () => console.log(`Listening on http://127.0.0.1:${port}`));
```

チェックアウトで開発用の依存関係を入れ、`pnpm build` を実行してから `node examples/serve/server.mjs` を実行します。別のターミナルから次のように呼べます。

```sh
curl 'http://127.0.0.1:8262/star?name=Sirius'
curl 'http://127.0.0.1:8262/constellation?abbr=Ori'
curl 'http://127.0.0.1:8262/near?ra=101.287&dec=-16.716&radius=1'
```

返事は JSON です。`/near` には J2000 の赤経、赤緯、半径を度で指定します。明るい星の表を検索します。不正な値や見つからない名前には 400、知らないパスには 404 を返します。停止は Ctrl-C です。他の人に公開するときは、設置先とアクセス制限を自分で選んで設定してください。
