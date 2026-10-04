/**
 * src/lib/source-dates.generated.ts is written by pipeline/source_dates.py
 * from pipeline/sources/manifest.json; the reader's version note ("GP01 was
 * issued 07/23/2025; shown is the current Regulation 7, effective
 * 07/15/2026") reads its dates from nothing else. This fails whenever the
 * two disagree -- a manifest entry changed or added without
 * `python pipeline/source_dates.py` being re-run (freshness.py
 * --update-manifest runs it) -- so a stale date cannot reach main.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { SOURCE_DATES } from "../src/lib/source-dates.generated";

type Manifest = {
  sources: Record<
    string,
    { kind: string; effective_date?: string; as_of?: string; permits?: Record<string, { date?: string }> }
  >;
};

/** The table the manifest gives, by the same rules source_dates.py applies. */
function fromManifest(manifest: Manifest): Record<string, { kind: string; date: string }> {
  const out: Record<string, { kind: string; date: string }> = {};
  for (const [key, entry] of Object.entries(manifest.sources)) {
    if (entry.kind === "sos" && entry.effective_date) out[key] = { kind: "effective", date: entry.effective_date };
    else if (entry.kind === "ecfr" && entry.as_of) out[key] = { kind: "as_of", date: entry.as_of };
    else if (entry.kind === "cdphe_gp") {
      for (const [gp, permit] of Object.entries(entry.permits ?? {})) {
        if (permit?.date) out[gp.toLowerCase()] = { kind: "issued", date: permit.date };
      }
    }
  }
  return out;
}

test("source-dates.generated.ts agrees with pipeline/sources/manifest.json", () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, "..", "pipeline", "sources", "manifest.json"), "utf8")) as Manifest;
  const expected = fromManifest(manifest);
  const generated: Record<string, { kind: string; date: string }> = {};
  for (const [k, v] of Object.entries(SOURCE_DATES)) generated[k] = { kind: v.kind, date: v.date };
  assert.deepEqual(
    generated,
    expected,
    "src/lib/source-dates.generated.ts is out of date: run `python pipeline/source_dates.py` and commit the result"
  );
  // Every entry is a real ISO date; the documents the reader links between are present.
  for (const [k, v] of Object.entries(SOURCE_DATES)) {
    assert.match(v.date, /^\d{4}-\d{2}-\d{2}$/, k);
    assert.ok(["effective", "issued", "as_of"].includes(v.kind), k);
  }
  for (const key of ["3", "7", "26", "gp01", "gp12", "oooob"]) assert.ok(SOURCE_DATES[key], `manifest has no date for ${key}`);
});
