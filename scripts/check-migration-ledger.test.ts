/**
 * scripts/check-migration-ledger.ts against the committed fixtures in
 * scripts/migration-ledger-fixtures/ (a small migrations folder, its rows,
 * allowlist and a pending ledger-record file), then against the real
 * allowlist and the real pending file. No database.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  ALLOWLIST_PATH,
  MIGRATIONS_DIR,
  checkLedger,
  main,
  normalizeSql,
  parsePendingInserts,
  readMigrationFiles,
  withPending,
  type Allowlist,
  type LedgerRow,
} from "./check-migration-ledger";

const FIX = path.join(__dirname, "migration-ledger-fixtures");
const dir = path.join(FIX, "migrations");
const rowsFile = path.join(FIX, "rows.json");
const allowFile = path.join(FIX, "allowlist.json");
const pendingFile = path.join(FIX, "pending.sql");
const rows = (): LedgerRow[] => JSON.parse(readFileSync(rowsFile, "utf8"));
const allow = (): Allowlist => JSON.parse(readFileSync(allowFile, "utf8"));
const pending = () => parsePendingInserts(readFileSync(pendingFile, "utf8"));

function run(args: string[]): { code: number; out: string } {
  const lines: string[] = [];
  const code = main(["--dir", dir, "--allowlist", allowFile, "--rows", rowsFile, ...args], (l) => lines.push(l));
  return { code, out: lines.join("\n") };
}

test("normalizeSql: comments, whitespace and trailing semicolons go; quoted text stays", () => {
  assert.equal(normalizeSql("-- note\nselect  1;\n\n-- end\n"), "select 1");
  assert.equal(normalizeSql("select '-- kept' as a; -- dropped\n"), "select '-- kept' as a");
  assert.equal(normalizeSql("select 'it''s' /* block */ ;;"), "select 'it''s'");
  assert.equal(normalizeSql("-- only a note\n"), "");
  assert.notEqual(normalizeSql("select 1"), normalizeSql("select 2"));
});

test("fixtures: the pending file's row is missing until the file is run, then files = rows", () => {
  const before = run([]);
  assert.equal(before.code, 1);
  assert.match(before.out, /20260104000000_pending_record\.sql: file with no row in schema_migrations/);
  assert.match(before.out, /1 mismatch:/);
  assert.match(before.out, /not ledger files, skipped: README\.md, RUN_ME_20260105_data_fix\.sql/);

  const after = run(["--pending", pendingFile]);
  assert.equal(after.code, 0, after.out);
  assert.match(after.out, /5 files, 5 rows \(4 in the database \+ 1 pending from pending\.sql\)/);
  assert.match(after.out, /files = rows: no mismatches/);
});

test("fixtures: each kind of mismatch is reported", () => {
  const scan = readMigrationFiles(dir);
  const base = withPending(rows(), pending());
  const check = (r: LedgerRow[], a: Allowlist = allow(), s = scan) => checkLedger(s, r, a).problems;
  assert.deepEqual(check(base), []);

  // a row with no file
  assert.deepEqual(check([...base, { version: "20260109000000", name: "ghost", statements: ["select 1"] }]), [
    "20260109000000 ghost: row with no file in supabase/migrations/",
  ]);
  // stored SQL differs from the file
  const changed = base.map((r) => (r.version === "20260102000100" ? { ...r, statements: ["create index things_label_idx on public.things (id)"] } : r));
  assert.deepEqual(check(changed), ["20260102000100_label_index.sql: SQL differs from the row's stored statements"]);
  // ... unless it is a known difference, which must still be one
  const known = { ...allow(), known_differences: [{ version: "20260102000100", reason: "test" }] };
  assert.deepEqual(check(changed, known), []);
  assert.deepEqual(check(base, known), ["20260102000100: in the allowlist's known_differences, but file and row now match"]);
  // a statement-less row that is not allowlisted
  assert.deepEqual(check(base, { ...allow(), statement_less: [] }), [
    "20260103000000_by_hand.sql: row stores no statements and is not in the allowlist's statement_less",
  ]);
  // a duplicate note that carries SQL would replay the change twice
  const dupWithSql = {
    ...scan,
    files: scan.files.map((f) => (f.version === "20260102000000" ? { ...f, sql: "create index things_label_idx on public.things (label);" } : f)),
  };
  assert.match(check(base, allow(), dupWithSql).join("\n"), /listed as a duplicate of 20260102000100 but the file has SQL/);
  // a name that is not the row's
  const renamed = base.map((r) => (r.version === "20260101000000" ? { ...r, name: "create_stuff" } : r));
  assert.deepEqual(check(renamed), ["20260101000000_create_things.sql: row 20260101000000 is named create_stuff"]);
  // a stray file name, and an allowlist entry for a row that does not exist
  assert.deepEqual(check(base, allow(), { ...scan, unexpected: ["003_search.sql"] }), [
    "003_search.sql: not a ledger file name (<14 digits>_<name>.sql), README.md or RUN_ME_*.sql",
  ]);
  const stale = { ...allow(), statement_less: [...allow().statement_less, { version: "20251231000000", reason: "test" }] };
  assert.deepEqual(check(base, stale), ["20251231000000: in the allowlist, but there is no such row"]);
});

test("the real allowlist: every entry has a reason and names a file in supabase/migrations/", () => {
  const real: Allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  const versions = new Set(readdirSync(MIGRATIONS_DIR).map((f) => f.slice(0, 14)));
  for (const e of [...real.statement_less, ...real.duplicates, ...real.known_differences]) {
    assert.ok(e.reason.length > 20, e.version);
    assert.ok(versions.has(e.version), e.version);
  }
  for (const d of real.duplicates) assert.ok(versions.has(d.twin_of), d.twin_of);
});

test("the real pending ledger-record files insert exactly their migration files' text", () => {
  const imports = path.join(__dirname, "..", "docs", "imports");
  const files = readdirSync(imports, { recursive: true, encoding: "utf8" }).filter((f) => /RUN_ME_\d{14}_migration_ledger_record\.sql$/.test(f));
  assert.ok(files.length >= 1);
  const migrations = readMigrationFiles(MIGRATIONS_DIR).files;
  for (const f of files) {
    const inserts = parsePendingInserts(readFileSync(path.join(imports, f), "utf8"));
    assert.ok(inserts.length >= 1, f);
    for (const r of inserts) {
      const m = migrations.find((x) => x.version === r.version);
      assert.ok(m, `${f}: ${r.version} has no file`);
      assert.equal(m.name, r.name, `${f}: ${r.version}`);
      assert.deepEqual(r.statements, [m.sql], `${f}: ${r.version} statements are not the file's text`);
    }
  }
});
