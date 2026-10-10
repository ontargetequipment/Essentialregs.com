/**
 * List completion for a limited Ask search (9 Oct 2026). The fixture is the
 * failing CI case: with the search limited to OOOO, retrieval's top ten held
 * 60.5416(b)(1), (b)(2), (b), a 60.5413 paragraph and (b)(3) first but not
 * (b)(4) or (b)(6). Pure layout part plus the database function with a fake client.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { completeList, completeListRows, familiesToComplete } from "../src/lib/list-completion";
import { askScope } from "../src/lib/ask-scope";
import { EVAL_QUESTIONS, evaluateQuestion } from "../src/lib/semantic-eval";
import { layoutAsk } from "../src/lib/question-maps";

const B = "sec-oooo-60.5416-(b)";
const kid = (n: number) => `${B}-(${n})`;
const printed = Array.from({ length: 13 }, (_, i) => kid(i + 1));
const hit = (id: string) => ({ id, reg_key: "oooo", jurisdiction_level: "federal" as const, title: id, path: null, citation: id, summary: null, score: 0.5 });

// Retrieval order of the failing run, then filler from other sections.
const retrieved = [kid(1), kid(2), B, "sec-oooo-60.5413-(d)-(9)-(ii)", kid(3), "sec-oooo-60.5416-(a)-(1)", "sec-oooo-60.5400", "sec-oooo-60.5401", "sec-oooo-60.5402", "sec-oooo-60.5410"].map(hit);

const parentOf = new Map<string, string | null>([
  [kid(1), B], [kid(2), B], [kid(3), B], [B, "sec-oooo-60.5416"],
  ["sec-oooo-60.5413-(d)-(9)-(ii)", "sec-oooo-60.5413-(d)-(9)"],
  ["sec-oooo-60.5416-(a)-(1)", "sec-oooo-60.5416-(a)"],
  ["sec-oooo-60.5400", "sec-oooo-top-REG-oooo"], ["sec-oooo-60.5401", "sec-oooo-top-REG-oooo"],
  ["sec-oooo-60.5402", "sec-oooo-top-REG-oooo"], ["sec-oooo-60.5410", "sec-oooo-top-REG-oooo"],
]);

test("a family needs two direct children among the hits", () => {
  assert.deepEqual(familiesToComplete(retrieved, parentOf), [B], "four hits under the document root are not a list");
  // One child and its parent is not enough; neither is a lone child.
  assert.deepEqual(familiesToComplete([hit(kid(1)), hit(B)], new Map([[kid(1), B], [B, "sec-oooo-60.5416"]])), []);
  assert.deepEqual(familiesToComplete([hit(kid(1))], new Map([[kid(1), B]])), []);
});

test("the failing case: the family sits at its best member's place, parent first, children in printed order, then the original window", () => {
  const rowById = new Map(printed.map((id) => [id, { ...hit(id), score: null, retrieved: false as const }]));
  const out = completeList<{ id: string }>(retrieved, parentOf, rowById, new Map([[B, printed]]), 10);
  assert.deepEqual(out.map((r) => r.id), [B, ...printed.slice(0, 9)]);
  // Rows retrieval returned keep their own object (and score); the others are list rows.
  assert.equal((out[1] as unknown as { score: number | null }).score, 0.5);
  assert.equal((out[5] as { retrieved?: boolean }).retrieved, false);
  assert.equal(out.length, 10);
});

test("a hit outside the family keeps its rank relative to the family; no duplicates; window cuts the tail", () => {
  const hits = [hit("sec-oooo-60.5400"), hit(kid(2)), hit(kid(5)), hit("sec-oooo-60.5401")];
  const p = new Map<string, string | null>([["sec-oooo-60.5400", "r"], ["sec-oooo-60.5401", "r"], [kid(2), B], [kid(5), B]]);
  const rowById = new Map(printed.concat(B).map((id) => [id, hit(id)]));
  const out = completeList(hits, p, rowById, new Map([[B, printed]]), 4);
  assert.deepEqual(out.map((r) => r.id), ["sec-oooo-60.5400", B, kid(1), kid(2)]);
  assert.equal(new Set(completeList(hits, p, rowById, new Map([[B, printed]]), 99).map((r) => r.id)).size, 1 + 1 + 13 + 1);
});

// A fake of the slice of the supabase client the function uses.
function fakeClient(rows: Record<string, unknown>[]) {
  const calls: string[] = [];
  const client = {
    from: (t: string) => {
      assert.equal(t, "provisions");
      return {
        select: (cols: string) => ({
          in: (col: string, values: string[]) => {
            calls.push(`${cols.split(",")[0]} ${col}`);
            const data = rows.filter((r) => values.includes(r[col] as string));
            const result = Promise.resolve({ data, error: null });
            return Object.assign(result, {
              order: () => Promise.resolve({ data: [...data].sort((a, b) => (a.sort_order as number) - (b.sort_order as number)), error: null }),
            });
          },
        }),
      };
    },
  };
  return { client, calls };
}
const dbRow = (id: string, parent: string | null, sort: number) => ({ id, parent_id: parent, citation: id, title: id, reg_key: "oooo", jurisdiction_level: "federal", ai_summary: `summary ${id}`, summary_status: "approved", context_path: null, sort_order: sort });
const dbRows = [
  dbRow(B, "sec-oooo-60.5416", 10),
  ...printed.map((id, i) => dbRow(id, B, 100 + i)),
  dbRow("sec-oooo-60.5413-(d)-(9)-(ii)", "sec-oooo-60.5413-(d)-(9)", 5),
  dbRow("sec-oooo-60.5416-(a)-(1)", "sec-oooo-60.5416-(a)", 9),
  ...["sec-oooo-60.5400", "sec-oooo-60.5401", "sec-oooo-60.5402", "sec-oooo-60.5410"].map((id, i) => dbRow(id, "sec-oooo-top-REG-oooo", i)),
];

test("completeListRows reads the children and returns them as list rows; unlimited, it is the identity and reads nothing", async () => {
  const { client, calls } = fakeClient(dbRows);
  assert.equal(await completeListRows(client, retrieved, null), retrieved);
  assert.deepEqual(calls, []);
  const out = await completeListRows(client, retrieved, "oooo");
  assert.deepEqual(out.map((r) => r.id).slice(0, 7), [B, ...printed.slice(0, 6)]);
  assert.equal(out.length, 10);
  const added = out.find((r) => r.id === kid(4)) as { retrieved: boolean; score: number | null; summary: string | null };
  assert.equal(added.retrieved, false);
  assert.equal(added.score, null);
  assert.equal(added.summary, `summary ${kid(4)}`);
  // A failed read leaves retrieval's order.
  const broken = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) };
  assert.equal(await completeListRows(broken, retrieved, "oooo", () => {}), retrieved);
});

test("the acceptance row passes on the completed list, and fails on the failing run's list", async () => {
  const row = EVAL_QUESTIONS.find((e) => e.q === "What test methods apply to a Method 21 inspection under Subpart OOOO?")!;
  const scope = askScope(row.q);
  const score = (hits: { id: string }[]) => {
    const layout = layoutAsk(row.q, hits as never[], undefined, false, scope.within);
    return evaluateQuestion(row, hits, layout.map?.key ?? null, { ids: layout.shownIds, noteKey: null, title: null, within: scope.within });
  };
  assert.equal(score(retrieved).pass, false);
  const { client } = fakeClient(dbRows);
  const completed = await completeListRows(client, retrieved, scope.within);
  assert.deepEqual(score(completed).failures, []);
});

test("a parent with a long run of children (a heading, not a printed list) is not completed", async () => {
  const many = Array.from({ length: 25 }, (_, i) => dbRow(`sec-oooo-60.54-(${i + 1})`, "sec-oooo-60.54", 200 + i));
  const { client } = fakeClient([...dbRows, dbRow("sec-oooo-60.54", "sec-oooo-top-REG-oooo", 1), ...many]);
  const hits = [hit("sec-oooo-60.54-(2)"), hit("sec-oooo-60.54-(7)"), hit("sec-oooo-60.5400")];
  const out = await completeListRows(client, hits, "oooo");
  assert.deepEqual(out.map((r) => r.id), hits.map((h) => h.id));
});
