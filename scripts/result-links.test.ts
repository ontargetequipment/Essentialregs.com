/**
 * Every Ask and keyword result links to its provision (Sprint 3). Both
 * cards build their href the same way (readerHrefFor in provision-href.ts,
 * used by hrefForHit in semantic.ts and hrefFor on the search page): the gated reader at /regulations/<reg> with the
 * provision id as the hash, which the reader resolves on load (scroll,
 * flash, focus). This checks, over the Ask eval questions and the question
 * maps, that each id those surfaces can return has a reader anchor whose
 * regulation and id are real corpus rows (pipeline/out/corpus_ids.json, the
 * id index dumped from the database).
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { regKeyOf } from "../src/lib/regulation-names";
import { EVAL_QUESTIONS } from "../src/lib/semantic-eval";
import { readerHrefFor } from "../src/lib/provision-href";
import { QUESTION_MAPS } from "../src/lib/question-maps";

const corpus: Record<string, string[]> = JSON.parse(
  readFileSync(path.join(__dirname, "..", "pipeline", "out", "corpus_ids.json"), "utf8")
);
const ids = new Set(Object.values(corpus).flat());

/**
 * The eval's `expect` entries are id PREFIXES (evaluateQuestion matches with
 * startsWith: "sec-jjjj" means any row of the JJJJ document, "sec-26-A" any
 * row of Regulation 26 Part A), so each is resolved to the corpus ids it
 * covers; a prefix that covers nothing is itself a failure. Question-map
 * rows are exact ids.
 */
function expectedIds(): string[] {
  const out = new Set<string>();
  for (const q of EVAL_QUESTIONS) {
    for (const prefix of q.expect) {
      const covered = [...ids].filter((id) => id.startsWith(prefix));
      assert.ok(covered.length > 0, `eval prefix ${prefix} (question "${q.q}") matches no corpus row`);
      for (const id of covered) out.add(id);
    }
  }
  for (const map of QUESTION_MAPS) for (const row of map.provisions) out.add(row.id);
  return [...out];
}

test("every eval and question-map provision has a reader anchor into a real corpus row", () => {
  const checked = expectedIds();
  assert.ok(checked.length >= 60, `expected a few dozen ids, got ${checked.length}`);
  for (const id of checked) {
    const reg = regKeyOf(id);
    assert.ok(reg, `${id}: regulation key derivable from the id`);
    const href = readerHrefFor({ id, reg_key: reg });
    assert.equal(href, `/regulations/${reg}#${id}`, `${id}: reader anchor`);
    assert.ok(ids.has(id), `${id}: exists in the corpus id index`);
    assert.ok(corpus[reg]?.includes(id), `${id}: listed under its own regulation ${reg}`);
  }
});

test("a hit without a regulation key falls back to the standalone card page", () => {
  assert.equal(readerHrefFor({ id: "sample-1", reg_key: null }), "/regs/sample-1");
});
