/**
 * The reader's "Recent" list (Sprint 3): the last ten provisions visited in
 * this browser, kept in sessionStorage behind try/catch. Pure helpers from
 * reader-client.ts under a fake storage; the DOM wiring runs in the reader.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { RECENT_VISITS_KEY, RECENT_VISITS_MAX, readRecentVisits, recentListHtml, recordRecentVisit } from "../src/lib/reader-client";

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    store,
  };
}

const v = (n: number, reg = "7") => ({ id: `sec-${reg}-B-II-A-${n}`, reg, citation: `II.A.${n}.`, name: `Regulation ${reg}` });

test("records newest first, moves a repeat up, keeps ten", () => {
  const s = fakeStorage();
  for (let i = 1; i <= 12; i++) recordRecentVisit(v(i), s);
  let list = readRecentVisits(s);
  assert.equal(list.length, RECENT_VISITS_MAX);
  assert.equal(list[0].id, v(12).id);
  assert.equal(list[9].id, v(3).id);
  list = recordRecentVisit(v(5), s);
  assert.equal(list[0].id, v(5).id);
  assert.equal(list.filter((x) => x.id === v(5).id).length, 1);
  assert.equal(list.length, RECENT_VISITS_MAX);
});

test("missing, blocked or junk storage reads as an empty list and never throws", () => {
  assert.deepEqual(readRecentVisits(null), []);
  assert.deepEqual(readRecentVisits(fakeStorage({ [RECENT_VISITS_KEY]: "not json" })), []);
  assert.deepEqual(readRecentVisits(fakeStorage({ [RECENT_VISITS_KEY]: JSON.stringify([{ id: 1 }, null, "x"]) })), []);
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(readRecentVisits(blocked), []);
  assert.deepEqual(recordRecentVisit(v(1), blocked), [v(1)]);
  assert.deepEqual(recordRecentVisit(v(1), null), [v(1)]);
});

test("the list markup links each entry to its provision, citation then regulation name, escaped", () => {
  const html = recentListHtml([{ id: "sec-gp12-I-A", reg: "gp12", citation: 'I.A. <"x">', name: "APCD General Permit GP12" }]);
  assert.equal(
    html,
    `<li><a class="recent-link" href="/regulations/gp12#sec-gp12-I-A" data-id="sec-gp12-I-A">` +
      `<span class="recent-cite">I.A. &lt;"x"&gt;</span><span class="recent-reg">APCD General Permit GP12</span></a></li>`
  );
  assert.equal(recentListHtml([]), "");
});
