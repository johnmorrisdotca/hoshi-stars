---
title: Serve it yourself
section: how-to
order: 30
description: Run your own small HTTP query service.
---

[日本語](ja/serve-it-yourself.md)


The example is a small Node HTTP service that you run and host yourself. We do not host a query service. It listens on `127.0.0.1:8262` by default; set `PORT` to choose another local port.

From a checkout, install the package's development dependencies, run `pnpm build`, then run `node examples/serve/server.mjs`. From another terminal:

```sh
curl 'http://127.0.0.1:8262/star?name=Sirius'
curl 'http://127.0.0.1:8262/constellation?abbr=Ori'
curl 'http://127.0.0.1:8262/near?ra=101.287&dec=-16.716&radius=1'
```

Responses are JSON. `/near` takes J2000 right ascension, declination and radius in degrees and searches the bright-star catalogue. Invalid values and unknown names return status 400; an unknown route returns 404. Stop the server with Ctrl-C. If you expose a service to other people, choose and configure your own hosting and access controls.
