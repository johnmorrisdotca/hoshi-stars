// The data door of the stars (MODULES-831): the eight things every package's door is tested for, with the real UCAC4 tiles on disk and a fake source of four tiles. 1 no source draws what it always drew and credits only the package's own;
// 2 a source adds its stars and its credit, with its licence, in English and Japanese; 3 off, removing and `ownOnly` return the first picture, abort the loads and free the tiles; 4 bad input is refused or counted and never drawn;
// 5 at rest nothing is sent; 6 the byte budget holds; 7 the package's own sources are clear to pass on; 8 `src/data-door.ts` is kazoku-ui's template.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { PICTURE_SOURCES } from "../src/data/deep-sky-pictures.ts";
import { type DeepSkyObject } from "../src/deep-sky-core.ts";
import { messier } from "../src/deep-sky.ts";
import { createTileStore, MAX_RECORDS, TILE_BUDGET_BYTES } from "../src/data-door.ts";
import { creditLine, OWN_SOURCES, ownCredit, starSky, ucac4Source, validateSource, withObjects, type ObjectSource, type SkyPictureSource, type StarSource } from "../src/door.ts";
import { decodeFaintTile, faintSky, faintStarsIn, faintTilePath, faintTilesFor, FAINT_LIMIT, type FaintField, type FaintTile } from "../src/faint.ts";

const DIR = new URL("../faint-tiles/", import.meta.url);
const BASE = "https://tiles.example/";
const orion: FaintField = { rightAscension: 83.8, declination: -5.4, radius: 1 };

/** A fetch that reads the tiles from disk and counts what it was asked for. */
function disk() {
  const asked: string[] = [];
  const fetch = async (url: string) => {
    asked.push(url);
    const path = url.replace(BASE, "");
    if (!existsSync(new URL(path, DIR))) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    const bytes = readFileSync(new URL(path, DIR));
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
  };
  return { asked, fetch };
}

const info = (id: string, change: Record<string, unknown> = {}) => ({
  id,
  name: { en: `Stars of ${id}`, ja: `${id}の星` },
  credit: { en: `Stars: ${id}, A. Person (2026)`, ja: `星：${id}（A. Person、2026年）` },
  licence: { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", nonCommercial: true },
  url: `https://example.org/${id}`,
  retrieved: "2026-11-10",
  ...change,
});

/** A tile of `n` stars inside the Orion patch, magnitudes 9.0, 9.1 and so on. */
function tileOf(column: number, n = 3, change: (tile: FaintTile) => void = () => undefined): FaintTile {
  const make = (value: (i: number) => number) => Float64Array.from({ length: n }, (_, i) => value(i));
  const tile: FaintTile = {
    id: { level: 0, band: 0, column },
    count: n,
    rightAscension: make((i) => 83.5 + 0.1 * column + 0.01 * i),
    declination: make((i) => -5.6 + 0.05 * i),
    magnitude: make((i) => 9 + 0.1 * i),
    colourIndex: make(() => 0.5),
  };
  change(tile);
  return tile;
}

/** A source of four tiles (a fake, in memory), whose loads the test can see. */
function fake(id = "fake", change: (tile: FaintTile, column: number) => void = () => undefined) {
  const calls: string[] = [];
  const signals = new Map<string, AbortSignal>();
  const source: StarSource = {
    kind: "tiles",
    info: info(id),
    need: () => ["t0", "t1", "t2", "t3"],
    load: async (key, signal) => {
      calls.push(key);
      signals.set(key, signal);
      const column = Number(key.slice(1));
      const tile = tileOf(column);
      change(tile, column);
      return tile;
    },
    bytes: (tile) => tile.count * 32,
  };
  return { source, calls, signals };
}

async function baseline() {
  const { fetch, asked } = disk();
  const sky = starSky({ sources: [ucac4Source({ baseUrl: BASE, fetch })] });
  await sky.load(orion, FAINT_LIMIT);
  return { sky, asked, fetch, first: sky.stars(orion, FAINT_LIMIT) };
}

// ----- 1: no source -----
test("1. with only the package's own source, the door draws what faintSky draws and credits UCAC4 alone", async () => {
  const { sky, first } = await baseline();
  assert.equal(first.loaded, true);
  assert.ok(first.stars.length > 100);
  // the same stars as the old path: the tiles of the patch, decoded and cut by the same function
  const tiles = faintTilesFor(orion, FAINT_LIMIT).map((id) => decodeFaintTile(id, new Uint8Array(readFileSync(new URL(faintTilePath(id), DIR)))));
  const direct = faintStarsIn(tiles, orion, FAINT_LIMIT);
  assert.deepEqual(first, { ...direct, loaded: true });
  const wrapped = faintSky({ baseUrl: BASE, fetch: disk().fetch });
  await wrapped.load(orion, FAINT_LIMIT);
  assert.deepEqual(wrapped.stars(orion, FAINT_LIMIT), first, "faintSky is the door with the one source");
  assert.deepEqual(sky.credits().map((credit) => [credit.source.id, credit.own]), [["ucac4", true]]);
  assert.equal(creditLine(sky.credits(), "en"), "Faint stars: UCAC4, N. Zacharias et al. (2013), U.S. Naval Observatory, via NASA/IPAC IRSA; magnitudes and colours from APASS (UCAC4 terms of use).");
  assert.deepEqual(starSky().credits(), [], "a sky with no source and nothing drawn credits nothing");
});

// ----- 2: with a source -----
test("2. a source adds exactly its stars, and its credit is on the line in both languages, with its licence and the word non-commercial", async () => {
  const { sky, first } = await baseline();
  sky.addSource(fake().source);
  await sky.load(orion, FAINT_LIMIT);
  const more = sky.stars(orion, FAINT_LIMIT);
  assert.equal(more.loaded, true);
  assert.equal(more.stars.length, first.stars.length + 12, "four tiles of three stars");
  assert.deepEqual(
    sky.credits().map((credit) => [credit.source.id, credit.own, credit.used]),
    [["ucac4", true, first.stars.length], ["fake", false, 12]],
  );
  assert.match(creditLine(sky.credits(), "en"), /\(UCAC4 terms of use\); Stars: fake, A\. Person \(2026\) \(CC BY-NC 4\.0; non-commercial\)\.$/);
  assert.match(creditLine(sky.credits(), "ja"), /／星：fake（A\. Person、2026年）（CC BY-NC 4\.0、非営利のみ）$/);
});

test("2b. the credits-changed callback fires when the set of sources changes, not at each draw", async () => {
  const seen: string[][] = [];
  const { fetch } = disk();
  const sky = starSky({ sources: [ucac4Source({ baseUrl: BASE, fetch })], onCredits: (credits) => seen.push(credits.map((credit) => credit.source.id)) });
  await sky.load(orion, FAINT_LIMIT);
  for (let n = 0; n < 5; n++) sky.stars(orion, FAINT_LIMIT);
  assert.deepEqual(seen, [["ucac4"]]);
  const remove = sky.addSource(fake().source);
  await sky.load(orion, FAINT_LIMIT);
  sky.stars(orion, FAINT_LIMIT);
  sky.stars(orion, FAINT_LIMIT);
  assert.deepEqual(seen, [["ucac4"], ["ucac4", "fake"]]);
  remove();
  assert.deepEqual(seen.at(-1), ["ucac4"]);
});

// ----- 3: off -----
test("3. remove(), enable(false) and ownOnly() return the first picture, drop the source's tiles and its credit, and a source can come back", async () => {
  const { sky, first } = await baseline();
  const held = sky.size;
  for (const off of ["remove", "enable", "own"] as const) {
    const remove = sky.addSource(fake().source);
    await sky.load(orion, FAINT_LIMIT);
    assert.equal(sky.size, held + 4);
    if (off === "remove") remove();
    else if (off === "enable") sky.enable("fake", false);
    else sky.ownOnly(true);
    assert.equal(sky.size, held, `${off}: the tiles are freed`);
    assert.deepEqual(sky.stars(orion, FAINT_LIMIT), first, `${off}: the first picture`);
    assert.deepEqual(sky.credits().map((credit) => credit.source.id), ["ucac4"], `${off}: its credit is gone`);
    if (off !== "remove") {
      if (off === "enable") sky.enable("fake", true);
      else sky.ownOnly(false);
      await sky.load(orion, FAINT_LIMIT);
      assert.equal(sky.stars(orion, FAINT_LIMIT).stars.length, first.stars.length + 12, `${off}: back on, it draws again`);
      assert.equal(sky.removeSource("fake"), true);
    }
    assert.equal(sky.removeSource("fake"), false);
  }
});

test("3b. switching a source off aborts the loads still running, and an abort is not a failure", async () => {
  const { fetch } = disk();
  const aborted: string[] = [];
  const slow: StarSource = {
    kind: "tiles",
    info: info("slow"),
    need: () => ["a", "b"],
    load: (key, signal) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          aborted.push(key);
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
    bytes: () => 1,
  };
  const sky = starSky({ sources: [ucac4Source({ baseUrl: BASE, fetch }), slow] });
  const loading = sky.load(orion, FAINT_LIMIT).catch(() => "rejected");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(sky.stats().inFlight >= 2);
  sky.enable("slow", false);
  assert.deepEqual(aborted.sort(), ["a", "b"]);
  assert.equal(await loading, undefined, "the load of the others finishes");
  assert.equal(sky.stats().failed, 0);
  assert.equal(sky.stats().inFlight, 0);
});

// ----- 4: bad input -----
test("4. a source with an empty credit, no licence or a clashing id is refused at once and never kept", () => {
  const sky = starSky({ sources: [ucac4Source({ baseUrl: BASE })] });
  const base = fake().source;
  assert.throws(() => sky.addSource({ ...base, info: info("a", { credit: { en: "", ja: "x" } }) }), /credit is empty \(en\)/);
  assert.throws(() => sky.addSource({ ...base, info: info("a", { credit: { en: "x", ja: " " } }) }), /credit is empty \(ja\)/);
  assert.throws(() => sky.addSource({ ...base, info: info("a", { licence: undefined }) }), /there is no licence/);
  assert.throws(() => sky.addSource({ ...base, info: info("a", { licence: { name: "", url: "https://example.org" } }) }), /licence has no name/);
  assert.throws(() => sky.addSource({ ...base, info: info("a", { licence: { name: "CC0", url: "" } }) }), /licence has no link/);
  assert.throws(() => sky.addSource({ ...base, info: info("ucac4") }), /the id is already used in this view/);
  sky.addSource({ ...base, info: info("a") });
  assert.throws(() => sky.addSource({ ...base, info: info("a") }), /already used/);
  assert.throws(() => starSky({ sources: [{ ...base, info: info("b", { credit: { en: "", ja: "" } }) }] }), TypeError);
  assert.throws(() => sky.addSource({ kind: "records", info: info("rec"), records: () => [] } as never), /takes tile sources/);
  assert.deepEqual(sky.sources.map((source) => source.info.id), ["ucac4", "a"], "nothing refused was kept");
});

test("4b. a tile that throws, rejects, is not a tile or holds a NaN is counted and never drawn, and nothing is thrown at the page", async () => {
  const { fetch } = disk();
  const sky = starSky({ sources: [ucac4Source({ baseUrl: BASE, fetch })] });
  await sky.load(orion, FAINT_LIMIT);
  const first = sky.stars(orion, FAINT_LIMIT);
  const plan: Record<string, () => unknown> = {
    t0: () => {
      throw new Error("sync");
    },
    t1: () => Promise.reject(new Error("network")),
    t2: () => ({ count: 3 }),
    t3: () =>
      tileOf(3, 3, (tile) => {
        tile.magnitude[1] = Number.NaN;
        tile.rightAscension[2] = Infinity;
      }),
  };
  const odd: StarSource = { kind: "tiles", info: info("odd"), need: () => Object.keys(plan), load: async (key) => (await plan[key]!()) as FaintTile, bytes: (tile) => tile.count * 32 };
  sky.addSource(odd);
  await assert.rejects(sky.load(orion, FAINT_LIMIT), /sync|network|not a faint tile/);
  const got = sky.stars(orion, FAINT_LIMIT);
  assert.equal(sky.stats().failed, 3);
  assert.equal(sky.stats().skipped, 2, "the NaN star and the infinite one");
  assert.equal(got.stars.length, first.stars.length + 1, "only the one sound star of the one sound tile");
  assert.ok(got.stars.every((star) => Number.isFinite(star.rightAscension) && Number.isFinite(star.declination) && Number.isFinite(star.magnitude)));
  assert.equal(got.loaded, false);
  // a source whose need() throws is an error to load, and draws nothing
  const bad: StarSource = {
    kind: "tiles",
    info: info("bad"),
    need: () => {
      throw new Error("need failed");
    },
    load: async () => tileOf(0),
    bytes: () => 1,
  };
  sky.addSource(bad);
  await assert.rejects(sky.load(orion, FAINT_LIMIT));
  assert.doesNotThrow(() => sky.stars(orion, FAINT_LIMIT));
});

test("4c. a missing tile of the package's own rejects the load with the tile's name, and the others stay", async () => {
  const { fetch } = disk();
  const broken = starSky({ sources: [ucac4Source({ baseUrl: `${BASE}nothing-here/`, fetch })] });
  await assert.rejects(broken.load(orion, FAINT_LIMIT), /The faint tile L\d\/\d+-\d+\.bin could not be fetched \(404\)/);
  assert.equal(broken.stars(orion, FAINT_LIMIT).loaded, false);
  assert.ok(broken.stats().failed > 0);
});

test("4d. outside deep-sky objects: a bad record is counted, a clashing id and a position off the sky are left out, a failing source adds nothing", async () => {
  const object = (id: string, change: Partial<DeepSkyObject> = {}): DeepSkyObject => ({
    id,
    messier: undefined,
    ngc: undefined,
    ic: undefined,
    otherIds: [],
    name: undefined,
    type: "galaxy",
    constellation: undefined,
    rightAscension: 10,
    declination: 20,
    magnitude: 11,
    sizeArcmin: undefined,
    ...change,
  });
  const records = (id: string, list: DeepSkyObject[] | (() => never)): ObjectSource => ({ kind: "records", info: info(id), records: typeof list === "function" ? list : () => list });
  const own = messier();
  const read = await withObjects(
    [
      records("mine", [
        object("X1"),
        object("X2", { rightAscension: Number.NaN }),
        object("X3", { declination: 91 }),
        object("X4", { rightAscension: 360 }),
        object("M31"),
        object("X5", { type: "comet" as never }),
        object("X6", { magnitude: Infinity }),
        object(""),
        object("X1"),
        object("X7", { magnitude: undefined }),
      ]),
      records("offline", () => {
        throw new Error("offline");
      }),
    ],
    { own },
  );
  assert.deepEqual(read.objects.slice(own.length).map((one) => one.id), ["X1", "X7"]);
  assert.equal(read.skipped, 8);
  assert.deepEqual(read.failed, [{ id: "offline", reason: "offline" }]);
  assert.deepEqual(read.credits.map((credit) => [credit.source.id, credit.own, credit.used]), [["wikidata-deep-sky", true, own.length], ["mine", false, 2]]);
  assert.ok(Object.isFrozen(read.objects[own.length]));
  await assert.rejects(withObjects([records("dup", []), records("dup", [])]), /already used/);
  await assert.rejects(withObjects([{ ...records("e", []), info: info("e", { credit: { en: "", ja: "" } }) }]), TypeError);
  await assert.rejects(withObjects([fake().source as never]), /takes record sources/);
  const huge = await withObjects([{ kind: "records", info: info("huge"), records: () => new Array<DeepSkyObject>(MAX_RECORDS + 1).fill(object("H")) }]);
  assert.deepEqual([huge.objects.length, huge.failed.length], [0, 1]);
});

// ----- 5: at rest -----
test("5. at rest the door sends nothing: asking for the stars again, or for a load with everything here, is no request", async () => {
  const { sky, asked, first } = await baseline();
  const sent = asked.length;
  assert.equal(sent, faintTilesFor(orion, FAINT_LIMIT).length);
  for (let n = 0; n < 200; n++) assert.deepEqual(sky.stars(orion, FAINT_LIMIT), first);
  await sky.load(orion, FAINT_LIMIT);
  await sky.load(orion, FAINT_LIMIT);
  assert.equal(asked.length, sent);
  assert.equal(sky.stats().requested, sent);
  assert.equal(sky.stats().inFlight, 0);
  // a failed tile is asked for again by the next load, not by a timer and not by stars()
  const { fetch, asked: missing } = disk();
  const lost = starSky({ sources: [ucac4Source({ baseUrl: `${BASE}gone/`, fetch })] });
  await lost.load(orion, FAINT_LIMIT).catch(() => undefined);
  const once = missing.length;
  for (let n = 0; n < 20; n++) lost.stars(orion, FAINT_LIMIT);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(missing.length, once);
});

test("5b. at most six loads run at once for a source", async () => {
  let running = 0;
  let most = 0;
  const wide: StarSource = {
    kind: "tiles",
    info: info("wide"),
    need: () => Array.from({ length: 20 }, (_, n) => `t${n}`),
    load: async (key) => {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return tileOf(Number(key.slice(1)));
    },
    bytes: () => 1,
  };
  const sky = starSky({ sources: [wide] });
  await sky.load(orion, FAINT_LIMIT);
  assert.equal(most, 6);
  assert.equal(sky.size, 20);
});

// ----- 6: the budget -----
test("6. more tiles than the budget leaves the held bytes at or under it, and the page draws what it holds", async () => {
  const { fetch } = disk();
  const wide: FaintField = { rightAscension: 83.8, declination: -5.4, radius: 8 };
  const budget = 100_000;
  const sky = starSky({ sources: [ucac4Source({ baseUrl: BASE, fetch })], budgetBytes: budget });
  await sky.load(wide, 10);
  assert.ok(faintTilesFor(wide, 10).length > 4);
  const stats = sky.stats();
  assert.ok(stats.heldBytes <= budget, `held ${stats.heldBytes} of ${budget}`);
  assert.ok(stats.refused > 0, "the tiles that did not fit were counted");
  const got = sky.stars(wide, 10);
  assert.equal(got.loaded, false, "the page is told something is missing");
  assert.ok(got.stars.length > 0);
  assert.equal(TILE_BUDGET_BYTES, 48 * 1024 * 1024, "48 MB by default");
});

test("6b. the optional columns ride along: a tile with parallax and proper motion is counted by what the source says and its stars come out", async () => {
  const withColumns = (tile: FaintTile): void => {
    tile.parallaxMas = Float64Array.from({ length: tile.count }, () => 3.2);
    tile.properMotionRa = Float64Array.from({ length: tile.count }, () => Number.NaN);
    tile.properMotionDec = Float64Array.from({ length: tile.count }, () => -4);
  };
  const { source } = fake("columns", (tile) => withColumns(tile));
  const sky = starSky({ sources: [source] });
  await sky.load(orion, FAINT_LIMIT);
  assert.equal(sky.stars(orion, FAINT_LIMIT).stars.length, 12);
  assert.equal(sky.stats().heldBytes, 4 * 96);
  const own = ucac4Source();
  withColumns(tileOf(0));
  assert.equal(own.bytes(tileOf(0, 3, withColumns)), 3 * 8 * 7, "the optional columns are held bytes too");
});

// ----- 7: the package's own terms -----
test("7. the package's own sources are clear to pass on: none is non-commercial or share-alike, each is a valid source, and the pictures' licences say neither", () => {
  assert.deepEqual(OWN_SOURCES.map((one) => one.id), ["yale-bsc", "ucac4", "wikidata-deep-sky"]);
  for (const one of OWN_SOURCES) {
    assert.notEqual(one.licence.nonCommercial, true, `${one.id} is non-commercial`);
    assert.notEqual(one.licence.shareAlike, true, `${one.id} is share-alike`);
    assert.doesNotMatch(`${one.licence.name} ${one.licence.spdx ?? ""}`, /non-?commercial|share-?alike|\b(?:NC|SA)\b/i, one.id);
    validateSource({ kind: "records", info: one, records: () => [] });
    assert.ok(Object.isFrozen(one) && Object.isFrozen(one.licence), "a caller cannot change the package's own terms");
  }
  assert.equal(ucac4Source().info, OWN_SOURCES[1]);
  for (const picture of PICTURE_SOURCES) assert.doesNotMatch(`${picture.licence}`, /non-?commercial|share-?alike|\b(?:NC|SA)\b/i, picture.name);
  assert.equal(ownCredit("ucac4", 3).own, true);
  assert.throws(() => ownCredit("fake", 1), RangeError);
});

test("7b. a caller's source that gives itself the package's id is not the package's own", async () => {
  const sky = starSky({ sources: [fake("ucac4").source] });
  await sky.load(orion, FAINT_LIMIT);
  sky.stars(orion, FAINT_LIMIT);
  assert.equal(sky.credits()[0]?.own, false);
  assert.match(creditLine(sky.credits(), "en"), /non-commercial/);
  sky.ownOnly(true);
  assert.equal(sky.size, 0, "own-only ignores it, whatever it calls itself");
});

// ----- 8: the template -----
test("8. src/data-door.ts is kazoku-ui's templates/data-door.ts, byte for byte", () => {
  // The recorded hash of kazoku-ui's templates/data-door.ts (line ends as "\n"); kazoku-ui's check-standard.mjs records the same one. Change it only by copying the template again.
  const RECORDED = "e73fcb926ad317d008e707a9ac2af4bf5343e1801d767fe4a3b1d9f76200d801";
  const text = readFileSync(new URL("../src/data-door.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(text).digest("hex"), RECORDED);
});

test("a sky picture source is a map source that a tile store can hold", async () => {
  const picture: SkyPictureSource = {
    kind: "tiles",
    layer: "sky",
    info: info("survey", { licence: { name: "Public domain", url: "https://example.org/pd" }, credit: { en: "An all-sky survey", ja: "全天サーベイ" } }),
    need: (place, detail) => (place.lonMax - place.lonMin >= 360 ? [`w${detail}/0`] : [`w${detail}/1`]),
    load: async () => ({ width: 2, height: 1, image: { width: 2, height: 1 } }),
    bytes: (tile) => Math.ceil(tile.width * tile.height * 4 * (4 / 3)),
  };
  validateSource(picture);
  const store = createTileStore<{ width: number; height: number; image: { width: number; height: number } }>();
  const keys = picture.need({ lonMin: 0, lonMax: 360, latMin: -90, latMax: 90 }, 1024);
  store.want(picture, keys);
  await store.idle();
  assert.deepEqual([store.stats().held, store.stats().heldBytes], [1, 11]);
});
