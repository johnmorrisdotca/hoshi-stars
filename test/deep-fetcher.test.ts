// The pictures' fetcher: a picture that can be had neither by fetch nor as an image is remembered as failed and not asked for again, so a view that keeps wanting it does not ask the server at every draw.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeepFetcher } from "../demo/deep.ts";
import { drawnPictures } from "../demo/picture-quality.ts";

test("a picture whose fetch and image both fail is asked for once, remembered as failed, and not asked for again", async () => {
  const id = drawnPictures()[0]!.id;
  const fetched: string[] = [];
  const loaded: string[] = [];
  const before = { fetch: globalThis.fetch, Image: (globalThis as { Image?: unknown }).Image };
  globalThis.fetch = ((url: string) => {
    fetched.push(String(url));
    return Promise.reject(new Error("offline"));
  }) as typeof fetch;
  (globalThis as { Image?: unknown }).Image = class {
    decoding = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(url: string) {
      loaded.push(url);
      queueMicrotask(() => this.onerror?.());
    }
  };
  try {
    let changes = 0;
    const fetcher = createDeepFetcher("./", () => (changes += 1));
    fetcher.want([id]);
    // the fetch fails, then the image fails: let both settle
    for (let i = 0; i < 5; i += 1) await new Promise((done) => setTimeout(done, 0));
    assert.deepEqual([fetched.length, loaded.length], [1, 1], "asked once each way");
    assert.ok(fetcher.failed.has(id), "remembered as failed");
    assert.ok(!fetcher.ready.has(id));
    // every later draw wants it again: nothing more is asked
    fetcher.want([id]);
    fetcher.want([id]);
    for (let i = 0; i < 5; i += 1) await new Promise((done) => setTimeout(done, 0));
    assert.deepEqual([fetched.length, loaded.length], [1, 1], "not asked for again");
    assert.equal(changes, 0, "nothing arrived, so the page is not asked to draw again");
  } finally {
    globalThis.fetch = before.fetch;
    (globalThis as { Image?: unknown }).Image = before.Image;
  }
});
