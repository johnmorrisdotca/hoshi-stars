// The credit the CDS asked for (its answer of 2026-11-12, MODULES-777): wherever the package credits the Yale GCTP (I/238A), Roman's boundary table (VI/42) or RC3 (VII/155), it cites the VizieR service (Ochsenbein, Bauer and Marcout 2000, A&AS 143, 23) as well as the original authors, and NOTICE.md carries the CDS's answer where it used to say "confirmation requested".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const PLACES = ["NOTICE.md", "README.md", "docs/guides/data-and-licences.md", "docs/guides/ja/data-and-licences.md"];

test("every place that credits the three VizieR catalogues cites the VizieR service and its paper", () => {
  for (const path of PLACES) {
    const text = read(path);
    assert.match(text, /Ochsenbein, P\. Bauer and J\. Marcout \(2000\)/, `${path}: the VizieR paper's authors`);
    assert.match(text, /Astronomy and Astrophysics Supplement Series 143, 23/, `${path}: the paper's journal`);
    assert.match(text, /10\.26093\/cds\/vizier/, `${path}: the service's DOI`);
    assert.match(text, /VizieR/, path);
  }
});

test("NOTICE.md gives the CDS's answer of 2026-11-12 for each of the three catalogues, and keeps the removed-on-request lines", () => {
  const lines = read("NOTICE.md").split("\n");
  for (const key of ["I/238A", "VI/42", "VII/155"]) {
    const line = lines.find((one) => one.includes(`vizier.cfa.harvard.edu/viz-bin/ReadMe/${key}`));
    assert.ok(line, `${key}: a line that cites its ReadMe`);
    assert.match(line, /The CDS answered on 2026-11-12/, key);
    assert.doesNotMatch(line, /confirmation requested/i, `${key}: no pending confirmation is left`);
  }
  assert.match(lines.find((one) => one.includes("ReadMe/I/238A")) ?? "", /removed on request/);
  assert.match(lines.find((one) => one.includes("ReadMe/VI/42")) ?? "", /removed on request/);
  assert.match(lines.find((one) => one.includes("ReadMe/VII/155")) ?? "", /We ask that you acknowledge RC3 and its authors/);
});

test("the VizieR credit names the original authors beside the service", () => {
  const notice = read("NOTICE.md");
  for (const name of ["van Altena, Lee and Hoffleit 1995", "Roman 1987", "de Vaucouleurs et al. 1991"]) assert.ok(notice.includes(name), name);
  assert.match(notice, /SIMBAD[^\n]*ODbL/);
});
