import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { once } from "node:events";
import { test } from "node:test";

test("the self-hosted example answers requests and rejects bad inputs", async () => {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => { probe.once("error", reject); probe.listen(8262, "127.0.0.1", resolve); });
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  if (!existsSync("dist/index.js")) execFileSync("pnpm", ["build"], { stdio: "pipe" });
  const server = spawn(process.execPath, ["examples/serve/server.mjs"], { env: { ...process.env, PORT: "8262" }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    await Promise.race([once(server.stdout, "data"), once(server, "exit").then(([code]) => { throw new Error(`server exited: ${String(code)}`); })]);
    const get = (path: string) => fetch(`http://127.0.0.1:8262${path}`);
    const star = await get("/star?name=Sirius");
    assert.equal(star.status, 200);
    assert.equal((await star.json() as { hr: number }).hr, 2491);
    const constellation = await get("/constellation?abbr=Ori");
    assert.equal(constellation.status, 200);
    assert.equal((await constellation.json() as { abbreviation: string }).abbreviation, "Ori");
    const nearby = await get("/near?ra=101.28708333333333&dec=-16.71611111111111&radius=1");
    assert.equal(nearby.status, 200);
    assert.ok((await nearby.json() as { thing: { hr: number } }[]).some((row) => row.thing.hr === 2491));
    for (const path of ["/star", "/constellation?abbr=bad", "/near?ra=nan&dec=0&radius=1", "/near?ra=1&dec=91&radius=1", "/near?ra=1&dec=0&radius=-1"]) assert.equal((await get(path)).status, 400, path);
  } finally {
    server.kill("SIGTERM");
    if (server.exitCode === null && server.signalCode === null) await once(server, "exit");
  }
});
