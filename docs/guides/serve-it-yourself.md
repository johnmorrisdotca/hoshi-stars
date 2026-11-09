---
title: Serve it yourself
section: how-to
order: 30
description: Run your own small HTTP query service.
---

[日本語](ja/serve-it-yourself.md)


The example is a small Node HTTP service that you run and host yourself. We do not host a query service. It listens on `127.0.0.1:8262` by default; set `PORT` to choose another local port.

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

From a checkout, install the package's development dependencies, run `pnpm build`, then run `node examples/serve/server.mjs`. From another terminal:

```sh
curl 'http://127.0.0.1:8262/star?name=Sirius'
curl 'http://127.0.0.1:8262/constellation?abbr=Ori'
curl 'http://127.0.0.1:8262/near?ra=101.287&dec=-16.716&radius=1'
```

Responses are JSON. `/near` takes J2000 right ascension, declination and radius in degrees and searches the bright-star catalogue. Invalid values and unknown names return status 400; an unknown route returns 404. Stop the server with Ctrl-C. If you expose a service to other people, choose and configure your own hosting and access controls.
