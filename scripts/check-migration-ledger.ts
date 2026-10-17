/**
 * Migration ledger check: supabase/migrations/ against
 * supabase_migrations.schema_migrations, the "files = rows" rule of
 * supabase/migrations/README.md.
 *
 *   1. One timestamped file per row, same version, and the same name.
 *   2. Where the row stores its statements, the file's SQL equals them after
 *      normalising: comments out, whitespace collapsed, trailing semicolons
 *      dropped (normalizeSql). The connector stores whatever text it was given,
 *      so a file with longer notes than the applied text still matches.
 *   3. A row with no statements (recorded by hand, version only) and a file
 *      that is only a duplicate note for a twin row must be listed, with a
 *      reason, in scripts/migration-ledger-allowlist.json; so must a file whose
 *      SQL is known to differ from its row while the CEO chat decides. An
 *      allowlist entry that no longer applies is itself a mismatch.
 *
 * README.md and RUN_ME_*.sql in supabase/migrations/ are not ledger files
 * (RUN_ME_* are the data changes the standing rule in docs/CEO_PHASE_PLAN.md
 * applies with execute_sql and keeps for the record); anything else that is
 * not <14 digits>_<name>.sql is a mismatch. Prints every mismatch and exits 1
 * on any. Reads the database only.
 *
 *   npx tsx scripts/check-migration-ledger.ts                    # $SUPABASE_DB_URL, through psql
 *   npx tsx scripts/check-migration-ledger.ts --db-url <url>
 *   npx tsx scripts/check-migration-ledger.ts --rows rows.json   # [{version, name, statements}], no database
 *   ... --pending docs/imports/<day>/RUN_ME_<ts>_migration_ledger_record.sql
 *       (adds that file's schema_migrations inserts to the rows first: the
 *       ledger as it will be once the file has been run)
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export type LedgerRow = { version: string; name: string; statements: string[] | null };
export type MigrationFile = { file: string; version: string; name: string; sql: string };
export type Allowlist = {
  statement_less: { version: string; reason: string }[];
  duplicates: { version: string; twin_of: string; reason: string }[];
  known_differences: { version: string; reason: string }[];
};
export type LedgerReport = { problems: string[]; notes: string[] };

export const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");
export const ALLOWLIST_PATH = path.join(__dirname, "migration-ledger-allowlist.json");

const LEDGER_FILE = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const NOT_LEDGER = /^(README\.md|RUN_ME_.*\.sql)$/;

/** SQL with -- and /* *\/ comments removed. Quoted strings are kept as they are. */
export function stripComments(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'") {
      const end = sql.indexOf("'", i + 1);
      const stop = end === -1 ? sql.length : end + 1;
      out += sql.slice(i, stop);
      i = stop;
    } else if (c === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
    } else if (c === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** The form two SQL texts are compared in: comments out, whitespace collapsed, no trailing semicolons. */
export function normalizeSql(sql: string): string {
  return stripComments(sql)
    .replace(/[ \t\n\r\f\v]+/g, " ")
    .trim()
    .replace(/[ ;]+$/, "");
}

/** A row's statements as one text (the connector stores one element; the CLI one per statement). */
export function storedSql(statements: string[]): string {
  return statements.map((s) => s.replace(/[ \t\n\r\f\v;]+$/, "")).join(";\n");
}

export function readMigrationFiles(dir: string): { files: MigrationFile[]; ignored: string[]; unexpected: string[] } {
  const files: MigrationFile[] = [];
  const ignored: string[] = [];
  const unexpected: string[] = [];
  for (const file of readdirSync(dir).sort()) {
    const m = LEDGER_FILE.exec(file);
    if (m) files.push({ file, version: m[1], name: m[2], sql: readFileSync(path.join(dir, file), "utf8") });
    else if (NOT_LEDGER.test(file)) ignored.push(file);
    else unexpected.push(file);
  }
  return { files, ignored, unexpected };
}

/** The rows a RUN_ME_*_migration_ledger_record.sql file inserts into schema_migrations. */
export function parsePendingInserts(sql: string): LedgerRow[] {
  const re =
    /insert\s+into\s+supabase_migrations\.schema_migrations\s*\(\s*version\s*,\s*name\s*,\s*statements\s*\)\s*values\s*\(\s*'(\d{14})'\s*,\s*'([a-z0-9_]+)'\s*,\s*array\[\s*\$(\w*)\$([\s\S]*?)\$\3\$\s*\]\s*\)\s*on\s+conflict\s*\(\s*version\s*\)\s*do\s+nothing\s*;/gi;
  const rows: LedgerRow[] = [];
  for (const m of sql.matchAll(re)) rows.push({ version: m[1], name: m[2], statements: [m[4]] });
  return rows;
}

/** Rows plus pending inserts, as `on conflict (version) do nothing` would leave them. */
export function withPending(rows: LedgerRow[], pending: LedgerRow[]): LedgerRow[] {
  const have = new Set(rows.map((r) => r.version));
  return [...rows, ...pending.filter((p) => !have.has(p.version))].sort((a, b) => a.version.localeCompare(b.version));
}

export function checkLedger(
  scan: { files: MigrationFile[]; ignored: string[]; unexpected: string[] },
  rows: LedgerRow[],
  allow: Allowlist
): LedgerReport {
  const problems: string[] = [];
  const notes: string[] = [];
  const statementLess = new Map(allow.statement_less.map((e) => [e.version, e.reason]));
  const duplicates = new Map(allow.duplicates.map((e) => [e.version, e]));
  const knownDiff = new Map(allow.known_differences.map((e) => [e.version, e.reason]));

  for (const f of scan.unexpected) problems.push(`${f}: not a ledger file name (<14 digits>_<name>.sql), README.md or RUN_ME_*.sql`);
  if (scan.ignored.length) notes.push(`not ledger files, skipped: ${scan.ignored.join(", ")}`);

  const byVersion = new Map<string, MigrationFile>();
  for (const f of scan.files) {
    const prior = byVersion.get(f.version);
    if (prior) problems.push(`${f.version}: two files, ${prior.file} and ${f.file}`);
    else byVersion.set(f.version, f);
  }
  const rowByVersion = new Map(rows.map((r) => [r.version, r]));

  for (const f of byVersion.values()) {
    if (!rowByVersion.has(f.version)) problems.push(`${f.file}: file with no row in schema_migrations`);
  }
  for (const r of rows) {
    const f = byVersion.get(r.version);
    if (!f) {
      problems.push(`${r.version} ${r.name}: row with no file in supabase/migrations/`);
      continue;
    }
    if (f.name !== r.name) problems.push(`${f.file}: row ${r.version} is named ${r.name}`);
    const fileSql = normalizeSql(f.sql);
    const hasStatements = !!r.statements && r.statements.some((s) => s.trim() !== "");
    const dup = duplicates.get(r.version);

    if (dup) {
      const twin = rowByVersion.get(dup.twin_of);
      const twinFile = byVersion.get(dup.twin_of);
      if (fileSql !== "") problems.push(`${f.file}: listed as a duplicate of ${dup.twin_of} but the file has SQL (a replay would run the change twice)`);
      if (!twin || !twinFile || normalizeSql(twinFile.sql) === "") problems.push(`${f.file}: listed as a duplicate of ${dup.twin_of}, which has no row or no file with SQL`);
      if (hasStatements) problems.push(`${r.version}: listed as a duplicate record but the row stores statements`);
      continue;
    }
    if (!hasStatements) {
      if (!statementLess.has(r.version)) problems.push(`${f.file}: row stores no statements and is not in the allowlist's statement_less`);
      else if (fileSql === "") problems.push(`${f.file}: row stores no statements and the file has no SQL either`);
      continue;
    }
    if (statementLess.has(r.version)) problems.push(`${r.version}: in the allowlist's statement_less, but the row now stores statements`);
    const same = fileSql === normalizeSql(storedSql(r.statements!));
    if (!same && !knownDiff.has(r.version)) problems.push(`${f.file}: SQL differs from the row's stored statements`);
    if (same && knownDiff.has(r.version)) problems.push(`${r.version}: in the allowlist's known_differences, but file and row now match`);
    if (!same && knownDiff.has(r.version)) notes.push(`${f.file}: known difference (allowlist): ${knownDiff.get(r.version)}`);
  }
  for (const v of [...statementLess.keys(), ...duplicates.keys(), ...knownDiff.keys()]) {
    if (!rowByVersion.has(v)) problems.push(`${v}: in the allowlist, but there is no such row`);
  }
  return { problems, notes };
}

function readRowsFromDb(url: string): LedgerRow[] {
  const q =
    "select coalesce(json_agg(json_build_object('version', version, 'name', name, 'statements', statements) order by version), '[]') from supabase_migrations.schema_migrations";
  const out = execFileSync("psql", [url, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out) as LedgerRow[];
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** The command line, minus process.exit: returns the exit code. */
export function main(argv: string[], log: (line: string) => void = console.log): number {
  const dir = flag(argv, "--dir") ?? MIGRATIONS_DIR;
  const allow = JSON.parse(readFileSync(flag(argv, "--allowlist") ?? ALLOWLIST_PATH, "utf8")) as Allowlist;
  const rowsFile = flag(argv, "--rows");
  const url = flag(argv, "--db-url") ?? process.env.SUPABASE_DB_URL;
  let rows: LedgerRow[];
  if (rowsFile) rows = JSON.parse(readFileSync(rowsFile, "utf8")) as LedgerRow[];
  else if (url) rows = readRowsFromDb(url);
  else {
    log("check-migration-ledger: pass --rows <file> or --db-url <url>, or set SUPABASE_DB_URL");
    return 2;
  }
  const pendingFile = flag(argv, "--pending");
  const pending = pendingFile ? parsePendingInserts(readFileSync(pendingFile, "utf8")) : [];
  if (pendingFile && pending.length === 0) {
    log(`check-migration-ledger: no schema_migrations inserts found in ${pendingFile}`);
    return 2;
  }
  const allRows = withPending(rows, pending);
  const scan = readMigrationFiles(dir);
  const { problems, notes } = checkLedger(scan, allRows, allow);

  const lines = [
    `### Migration ledger: ${scan.files.length} files, ${allRows.length} rows` +
      (pending.length ? ` (${rows.length} in the database + ${pending.length} pending from ${path.basename(pendingFile!)})` : ""),
    "",
    ...notes.map((n) => `- ${n}`),
    "",
    problems.length === 0 ? "files = rows: no mismatches" : `${problems.length} mismatch${problems.length === 1 ? "" : "es"}:`,
    ...problems.map((p) => `- ${p}`),
  ];
  const text = lines.join("\n");
  log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
  return problems.length === 0 ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}
