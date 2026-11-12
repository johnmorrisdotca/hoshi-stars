// The pictures' fetcher: a picture that can be had neither by fetch nor as an image is tried again after PICTURE_RETRY_MS, at most PICTURE_TRIES times in all, then given up for the page; between
// tries, a view that keeps wanting it asks the server nothing. The clock is the test's own.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeepFetcher, PICTURE_RETRY_MS, PICTURE_TRIES } from "../demo/deep.ts";
import { drawnPictures } from "../demo/picture-quality.ts";

/** A page with no network: every fetch and every image fails, unless `online` says otherwise. Counts what is asked for. */
function offline(online = () => false) {
  const asked = { fetched: 0, loaded: 0 };
  const before = { fetch: globalThis.fetch, Image: (globalThis as { Image?: unknown }).Image, createObjectURL: URL.createObjectURL };
  globalThis.fetch = (() => {
    asked.fetched += 1;
    return online() ? Promise.resolve(new Response(new Blob(["x"]))) : Promise.reject(new Error("offline"));
  }) as typeof fetch;
  URL.createObjectURL = () => "blob:picture";
  (globalThis as { Image?: unknown }).Image = class {
    decoding = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_url: string) {
      asked.loaded += 1;
      queueMicrotask(() => (online() ? this.onload?.() : this.onerror?.()));
    }
  };
  const restore = (): void => {
    globalThis.fetch = before.fetch;
    URL.createObjectURL = before.createObjectURL;
    (globalThis as { Image?: unknown }).Image = before.Image;
  };
  return { asked, restore };
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await new Promise((done) => setTimeout(done, 0));
};

test("a picture that fails is tried again after a minute, three times in all, then given up; redraws in between ask nothing", async () => {
  assert.equal(PICTURE_TRIES, 3);
  const id = drawnPictures()[0]!.id;
  const { asked, restore } = offline();
  let clock = 1_000_000;
  try {
    const fetcher = createDeepFetcher("./", () => assert.fail("nothing arrives"), () => clock);
    const tries = () => [asked.fetched, asked.loaded];
    fetcher.want([id]);
    await settle();
    assert.deepEqual(tries(), [1, 1], "the first try: a fetch, then the image");
    assert.ok(!fetcher.failed.has(id), "not given up after one failure: a phone may have lost its signal");
    // every draw wants it again: nothing is asked before the minute is up
    for (const later of [0, 1_000, PICTURE_RETRY_MS - 1]) {
      clock = 1_000_000 + later;
      fetcher.want([id]);
      await settle();
      assert.deepEqual(tries(), [1, 1], `nothing asked ${later} ms after the failure`);
    }
    clock = 1_000_000 + PICTURE_RETRY_MS;
    fetcher.want([id]);
    fetcher.want([id]);
    await settle();
    assert.deepEqual(tries(), [2, 2], "the second try, a minute on, once however many draws want it");
    clock += PICTURE_RETRY_MS - 1;
    fetcher.want([id]);
    await settle();
    assert.deepEqual(tries(), [2, 2]);
    clock += 1;
    fetcher.want([id]);
    await settle();
    assert.deepEqual(tries(), [3, 3], "the third try");
    assert.ok(fetcher.failed.has(id), "given up after the third");
    clock += 10 * PICTURE_RETRY_MS;
    fetcher.want([id]);
    await settle();
    assert.deepEqual(tries(), [3, 3], "never asked for again on the page");
  } finally {
    restore();
  }
});

test("a picture whose signal comes back arrives on its next try", async () => {
  const id = drawnPictures()[0]!.id;
  let online = false;
  const { asked, restore } = offline(() => online);
  let clock = 0;
  try {
    let changes = 0;
    const fetcher = createDeepFetcher("./", () => (changes += 1), () => clock);
    fetcher.want([id]);
    await settle();
    online = true;
    clock = PICTURE_RETRY_MS;
    fetcher.want([id]);
    await settle();
    assert.ok(fetcher.ready.has(id), "arrived on the second try");
    assert.equal(changes, 1, "the page is asked to draw it once");
    assert.equal(asked.fetched, 2);
    clock += 10 * PICTURE_RETRY_MS;
    fetcher.want([id]);
    await settle();
    assert.equal(asked.fetched, 2, "an arrived picture is not asked for again");
    assert.ok(!fetcher.failed.has(id));
  } finally {
    restore();
  }
});
