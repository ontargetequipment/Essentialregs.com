#!/usr/bin/env node
/**
 * A zero-dependency stand-in for the slice of Supabase (PostgREST + GoTrue)
 * that EssentialRegs talks to, so a production build of the app and its
 * Playwright specs can run where Supabase and the live site are unreachable.
 * See e2e/harness/README.md for what it emulates and where it differs.
 *
 *   node e2e/harness/mock-supabase.mjs [--port 54321] [--data generated/db.json]
 *   node e2e/harness/mock-supabase.mjs --print-env     (the keys the app must be built with)
 *
 * Data comes from build-fixtures.py (generated/db.json). Everything is held in
 * memory; tour_events and search_queries are the only tables the app writes.
 *
 * ROW-LEVEL SECURITY is emulated per request, because the specs are about it:
 *   anon key / signed-in visitor with no access  -> provisions with is_public = true only;
 *                                                   neighbours and cross-references only when
 *                                                   both ends are public
 *   authenticated subscriber (access_granted, or subscription_status active/trialing)
 *                                                -> every provision of a released document
 *   service-role key                             -> everything, staged documents included
 * The role comes from the JWT in Authorization (a user's access token, or the anon / service key
 * passed as the bearer by supabase-js), else from the apikey header.
 *
 * Every request the mock does not understand is answered with an honest error
 * AND recorded: stderr, generated/unhandled.log, and GET /__harness/unhandled.
 *
 * Harness endpoints (not part of Supabase):
 *   GET    /__harness/health
 *   GET    /__harness/font/*          placeholder font bytes (offline builds, run.sh)
 *   GET    /__harness/tour-events     DELETE clears them
 *   GET    /__harness/search-queries
 *   GET    /__harness/unhandled       DELETE clears the list
 *   GET    /__harness/requests        request counts by route, for finding gaps
 *   POST   /__harness/reset           empties tour_events / search_queries / unhandled
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const PORT = Number(arg("port", process.env.HARNESS_MOCK_PORT ?? 54321));
const HOST = arg("host", process.env.HARNESS_MOCK_HOST ?? "127.0.0.1");
const DATA = arg("data", process.env.HARNESS_DATA ?? path.join(HERE, "generated", "db.json"));
const UNHANDLED_LOG = arg("unhandled-log", path.join(HERE, "generated", "unhandled.log"));
const VERBOSE = flag("verbose") || process.env.HARNESS_VERBOSE === "1";
/**
 * HARNESS_RLS=off makes every caller see what a subscriber sees: a deliberately broken database, to prove
 * the specs notice a leak (README, "Does it have teeth?"). Never set it for a real run.
 */
const RLS_OFF = process.env.HARNESS_RLS === "off";
/** Hosted Supabase's PostgREST caps a response at 1000 rows (db-max-rows); the app paginates for it. */
const MAX_ROWS = Number(process.env.HARNESS_MAX_ROWS ?? 1000);

// ---------------------------------------------------------------------------
// JWTs: HS256 with a fixed harness secret. The anon and service keys are real
// (signed) JWTs so anything that decodes them is satisfied; the mock verifies
// the signature and reads `role` / `sub`.
// ---------------------------------------------------------------------------
const SECRET = process.env.HARNESS_JWT_SECRET ?? "essentialregs-harness-jwt-secret-not-a-real-secret";
const b64u = (buf) => Buffer.from(buf).toString("base64url");
function signJwt(payload) {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;
  const sig = crypto.createHmac("sha256", SECRET).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
const FAR_FUTURE = 4102444800; // 2100-01-01
const ANON_KEY = signJwt({ iss: "supabase-harness", ref: "harness", role: "anon", iat: 1700000000, exp: FAR_FUTURE });
const SERVICE_KEY = signJwt({ iss: "supabase-harness", ref: "harness", role: "service_role", iat: 1700000000, exp: FAR_FUTURE });

if (flag("print-env")) {
  process.stdout.write(
    [
      `export NEXT_PUBLIC_SUPABASE_URL='http://${HOST}:${PORT}'`,
      `export NEXT_PUBLIC_SUPABASE_ANON_KEY='${ANON_KEY}'`,
      `export SUPABASE_SERVICE_ROLE_KEY='${SERVICE_KEY}'`,
      "",
    ].join("\n"),
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
if (!fs.existsSync(DATA)) {
  console.error(`mock-supabase: ${DATA} not found. Run: python3 e2e/harness/build-fixtures.py`);
  process.exit(1);
}
const DB = JSON.parse(fs.readFileSync(DATA, "utf8"));
const T = DB.tables;
const SCHEMA = DB.schema;
for (const name of Object.keys(SCHEMA)) T[name] ??= [];

const provById = new Map();
const provByReg = new Map();
const provByParent = new Map();
for (const p of T.provisions) {
  provById.set(p.id, p);
  (provByReg.get(p.reg_key) ?? provByReg.set(p.reg_key, []).get(p.reg_key)).push(p);
  if (p.parent_id) (provByParent.get(p.parent_id) ?? provByParent.set(p.parent_id, []).get(p.parent_id)).push(p);
}
const neighboursOf = new Map();
for (const n of T.provision_neighbors) (neighboursOf.get(n.provision_id) ?? neighboursOf.set(n.provision_id, []).get(n.provision_id)).push(n);
const citationsBySlug = new Map();
for (const c of T.provision_method_citations) (citationsBySlug.get(c.method_slug) ?? citationsBySlug.set(c.method_slug, []).get(c.method_slug)).push(c);
const profileById = new Map(T.profiles.map((p) => [p.id, p]));
const INDEX = {
  provisions: { id: provById, reg_key: provByReg, parent_id: provByParent },
  provision_neighbors: { provision_id: neighboursOf },
  provision_method_citations: { method_slug: citationsBySlug },
};

let nextId = 1;
const stagedRegs = () => new Set(T.regulation_releases.filter((r) => r.status === "staged").map((r) => r.reg_key));

// ---------------------------------------------------------------------------
// Bookkeeping: request counts and the unhandled list
// ---------------------------------------------------------------------------
const counts = new Map();
const unhandled = [];
function tally(key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
function noteUnhandled(req, why, ctx) {
  const entry = { at: new Date().toISOString(), method: req.method, url: req.url, why, role: ctx?.role ?? null };
  unhandled.push(entry);
  console.error(`[mock-supabase] UNHANDLED ${req.method} ${req.url} -- ${why}`);
  try {
    fs.mkdirSync(path.dirname(UNHANDLED_LOG), { recursive: true });
    fs.appendFileSync(UNHANDLED_LOG, JSON.stringify(entry) + "\n");
  } catch {
    /* the in-memory list still has it */
  }
}

// ---------------------------------------------------------------------------
// Errors (PostgREST / GoTrue shapes)
// ---------------------------------------------------------------------------
class HttpError extends Error {
  constructor(status, body, headers = {}) {
    super(body?.message ?? body?.msg ?? String(status));
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}
const pgError = (status, code, message, details = null, hint = null) => new HttpError(status, { code, details, hint, message });

// ---------------------------------------------------------------------------
// Who is asking
// ---------------------------------------------------------------------------
function bearerOf(req) {
  const a = req.headers.authorization;
  if (a && /^bearer /i.test(a)) return a.slice(7).trim();
  return null;
}
function ctxOf(req) {
  const token = bearerOf(req) ?? req.headers.apikey ?? null;
  if (!token) throw pgError(401, "PGRST301", "No API key found in request", null, "No `apikey` request header or url param was found.");
  const claims = verifyJwt(token);
  if (!claims) throw pgError(401, "PGRST301", "JWSError JWSInvalidSignature");
  if (claims.exp && claims.exp < Date.now() / 1000) throw pgError(401, "PGRST303", "JWT expired");
  const role = claims.role === "service_role" ? "service_role" : claims.role === "authenticated" ? "authenticated" : "anon";
  const ctx = { role, sub: claims.sub ?? null, email: claims.email ?? null, entitled: false };
  if (role === "service_role") ctx.entitled = true;
  else if (role === "authenticated") ctx.entitled = isEntitled(ctx.sub);
  if (RLS_OFF && role !== "service_role") ctx.entitled = true;
  return ctx;
}
/** The has_full_access() predicate: profiles.access_granted, or subscription_status active / trialing. */
function isEntitled(sub) {
  const p = sub ? profileById.get(sub) : null;
  return !!p && (p.access_granted === true || ["active", "trialing"].includes(p.subscription_status));
}

// ---------------------------------------------------------------------------
// Row-level security. Each policy returns a predicate over a row.
// ---------------------------------------------------------------------------
const regOfId = (id) => (/^sec-([^-]+)-/.exec(id ?? "") ?? [])[1] ?? null; // split_part(id, '-', 2)

function provisionVisible(p, ctx, staged) {
  if (ctx.role === "service_role") return true;
  if (p.is_public === true) return true; // "public can read public provisions"
  return ctx.entitled && !staged.has(p.reg_key); // "subscribers can read all provisions"
}

function policyFor(table, ctx) {
  const staged = stagedRegs();
  const denied = () => {
    throw pgError(403, "42501", `permission denied for table ${table}`);
  };
  switch (table) {
    case "provisions":
      return (p) => provisionVisible(p, ctx, staged);
    case "cross_references": {
      if (ctx.role === "service_role" || ctx.entitled) return () => true;
      // Both ends public (the target may be absent: an external link).
      return (x) => {
        const from = provById.get(x.from_provision_id);
        const to = x.target_provision_id ? provById.get(x.target_provision_id) : null;
        return !!from?.is_public && (!x.target_provision_id || !!to?.is_public);
      };
    }
    case "provision_neighbors": {
      if (ctx.role === "service_role") return () => true;
      if (ctx.entitled) return (n) => !staged.has(regOfId(n.provision_id)) && !staged.has(regOfId(n.neighbor_id));
      return (n) => !!provById.get(n.provision_id)?.is_public && !!provById.get(n.neighbor_id)?.is_public;
    }
    case "profiles":
      if (ctx.role === "service_role") return () => true;
      if (ctx.role === "authenticated") return (p) => p.id === ctx.sub; // "users can read own profile"
      return denied();
    case "provision_method_citations":
      return (c) => ctx.role === "service_role" || !staged.has(regOfId(c.provision_id));
    case "tour_events": // insert-only for anon/authenticated: no select grant
    case "search_queries":
    case "regulation_releases":
    case "provision_changes":
      if (ctx.role === "service_role") return () => true;
      return denied();
    default:
      throw new HttpError(404, { code: "PGRST205", details: null, hint: null, message: `Could not find the table 'public.${table}' in the schema cache` });
  }
}

// ---------------------------------------------------------------------------
// Computed column provisions.context_path = provision_path(id)
// ---------------------------------------------------------------------------
const pathCache = new Map();
function ancestorPath(id) {
  if (pathCache.has(id)) return pathCache.get(id);
  // string_agg(coalesce(nullif(btrim(title), ''), citation), ' › ' order by depth desc)
  //   over the ancestors, skipping the row itself and the regulation's top row
  //   (parent_id null) and any whose title is just its citation.
  const parts = [];
  let cur = provById.get(id);
  let depth = 0;
  const seen = new Set();
  while (cur && depth < 12 && !seen.has(cur.id)) {
    seen.add(cur.id);
    depth += 1;
    const parent = cur.parent_id ? provById.get(cur.parent_id) : null;
    if (depth > 1 && cur.parent_id != null && String(cur.title ?? "").trim() !== String(cur.citation ?? "").trim()) {
      parts.push(String(cur.title ?? "").trim() || cur.citation);
    }
    cur = parent;
  }
  const out = parts.length ? parts.reverse().join(" › ") : null;
  pathCache.set(id, out);
  return out;
}
/** provision_path(): the breadcrumb for an entitled caller, service role, or an is_public row; else null. */
function provisionPath(id, ctx) {
  const row = provById.get(id);
  if (!row) return null;
  if (ctx.role === "service_role" || ctx.entitled || row.is_public === true) return ancestorPath(id);
  return null;
}
const COMPUTED = { provisions: { context_path: (row, ctx) => provisionPath(row.id, ctx) } };

// ---------------------------------------------------------------------------
// Relationships for resource embedding
// ---------------------------------------------------------------------------
const RELATIONS = {
  provisions: {
    cross_references: [
      { name: "cross_references_from_provision_id_fkey", table: "cross_references", many: true, local: "id", remote: "from_provision_id" },
      { name: "cross_references_target_provision_id_fkey", table: "cross_references", many: true, local: "id", remote: "target_provision_id" },
    ],
    provision_neighbors: [
      { name: "provision_neighbors_provision_id_fkey", table: "provision_neighbors", many: true, local: "id", remote: "provision_id" },
      { name: "provision_neighbors_neighbor_id_fkey", table: "provision_neighbors", many: true, local: "id", remote: "neighbor_id" },
    ],
  },
  provision_neighbors: {
    provisions: [
      { name: "provision_neighbors_neighbor_id_fkey", table: "provisions", many: false, local: "neighbor_id", remote: "id" },
      { name: "provision_neighbors_provision_id_fkey", table: "provisions", many: false, local: "provision_id", remote: "id" },
    ],
  },
  cross_references: {
    provisions: [
      { name: "cross_references_from_provision_id_fkey", table: "provisions", many: false, local: "from_provision_id", remote: "id" },
      { name: "cross_references_target_provision_id_fkey", table: "provisions", many: false, local: "target_provision_id", remote: "id" },
    ],
  },
  provision_method_citations: {
    provisions: [{ name: "provision_method_citations_provision_id_fkey", table: "provisions", many: false, local: "provision_id", remote: "id" }],
  },
};

// ---------------------------------------------------------------------------
// Query-string parsing: select trees, filters, order
// ---------------------------------------------------------------------------
/** Split on commas at depth 0 (outside parentheses and double quotes). */
function splitTop(s) {
  const out = [];
  let depth = 0;
  let quoted = false;
  let cur = "";
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      cur += ch;
      if (ch === "\\" && i + 1 < s.length) cur += s[++i];
      else if (ch === '"') quoted = false;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur !== "") out.push(cur);
  return out;
}
function unquote(v) {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\(.)/g, "$1");
  return v;
}

function parseSelect(str) {
  const items = [];
  for (let raw of splitTop(str ?? "*")) {
    raw = raw.trim();
    if (!raw) continue;
    if (raw === "*") {
      items.push({ kind: "star" });
      continue;
    }
    let sub = null;
    const open = raw.indexOf("(");
    if (open >= 0 && raw.endsWith(")")) {
      sub = parseSelect(raw.slice(open + 1, -1));
      raw = raw.slice(0, open);
    }
    let alias = null;
    const colon = raw.indexOf(":");
    if (colon >= 0 && raw[colon + 1] !== ":") {
      alias = raw.slice(0, colon);
      raw = raw.slice(colon + 1);
    }
    raw = raw.replace(/::[a-z]+$/i, ""); // a cast: ignored
    const bits = raw.split("!");
    const name = bits[0];
    if (sub) {
      items.push({ kind: "rel", name, alias: alias ?? name, hint: bits.slice(1).find((b) => b !== "inner" && b !== "left") ?? null, inner: bits.includes("inner"), sub });
    } else {
      items.push({ kind: "col", name, alias: alias ?? name });
    }
  }
  return items;
}

function columnKnown(table, col) {
  return SCHEMA[table]?.includes(col) || !!COMPUTED[table]?.[col];
}

function likeToRegex(pattern, flags) {
  let out = "^";
  for (const ch of pattern) {
    if (ch === "%" || ch === "*") out += "[\\s\\S]*";
    else if (ch === "_") out += "[\\s\\S]";
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(out + "$", flags);
}

function coerceLike(rowVal, s) {
  if (typeof rowVal === "number") return Number(s);
  if (typeof rowVal === "boolean") return s === "true";
  return s;
}

/** A single `column.op.value` condition -> {fn, eq?}. `ctxForComputed` evaluates computed columns. */
function parseCondition(table, text, ctx) {
  let m = /^([A-Za-z0-9_]+)\.(not\.)?([a-z]+)\.([\s\S]*)$/.exec(text);
  if (!m) throw pgError(400, "PGRST100", `"failed to parse filter (${text})"`, `unexpected condition`);
  const [, col, notPrefix, op, value] = m;
  return buildFilter(table, col, op, value, !!notPrefix, ctx);
}

function buildFilter(table, col, op, value, negate, ctx) {
  if (!columnKnown(table, col)) throw pgError(400, "42703", `column ${table}.${col} does not exist`);
  const get = (row) => (COMPUTED[table]?.[col] ? COMPUTED[table][col](row, ctx) : row[col] ?? null);
  let test;
  switch (op) {
    case "eq":
      test = (row) => {
        const v = get(row);
        return v !== null && v === coerceLike(v, value);
      };
      break;
    case "neq":
      test = (row) => {
        const v = get(row);
        return v === null || v !== coerceLike(v, value);
      };
      break;
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      test = (row) => {
        const v = get(row);
        if (v === null) return false;
        const c = coerceLike(v, value);
        return op === "gt" ? v > c : op === "gte" ? v >= c : op === "lt" ? v < c : v <= c;
      };
      break;
    case "like":
    case "ilike": {
      const re = likeToRegex(value, op === "ilike" ? "i" : "");
      test = (row) => {
        const v = get(row);
        return v !== null && re.test(String(v));
      };
      break;
    }
    case "in": {
      const inner = value.trim().replace(/^\(/, "").replace(/\)$/, "");
      const list = splitTop(inner).map((x) => unquote(x.trim()));
      const set = new Set(list);
      test = (row) => {
        const v = get(row);
        return v !== null && (set.has(String(v)) || list.some((l) => coerceLike(v, l) === v));
      };
      break;
    }
    case "is": {
      const want = value.toLowerCase();
      test = (row) => {
        const v = get(row);
        if (want === "null") return v === null;
        if (want === "true") return v === true;
        if (want === "false") return v === false;
        return false;
      };
      break;
    }
    default:
      throw pgError(400, "PGRST100", `unsupported filter operator "${op}"`, "the harness mock implements eq, neq, gt, gte, lt, lte, like, ilike, in, is, not, or, and");
  }
  const fn = negate ? (row) => !test(row) : test;
  return { fn, eq: op === "eq" && !negate ? { col, value } : null };
}

/** `or=(a.eq.1,b.like.x,and(c.eq.2,d.eq.3))` -> predicate. */
function parseLogical(table, text, ctx, mode) {
  const inner = text.trim().replace(/^\(/, "").replace(/\)$/, "");
  const parts = splitTop(inner).map((p) => p.trim());
  const preds = parts.map((p) => {
    const nested = /^(not\.)?(and|or)\(([\s\S]*)\)$/.exec(p);
    if (nested) {
      const fn = parseLogical(table, `(${nested[3]})`, ctx, nested[2]);
      return nested[1] ? (row) => !fn(row) : fn;
    }
    return parseCondition(table, p, ctx).fn;
  });
  return mode === "or" ? (row) => preds.some((f) => f(row)) : (row) => preds.every((f) => f(row));
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "returning"]);

function parseFilters(table, searchParams, ctx) {
  const filters = [];
  for (const [key, value] of searchParams) {
    if (RESERVED.has(key)) continue;
    if (key === "or" || key === "and") {
      filters.push({ fn: parseLogical(table, value, ctx, key), eq: null });
      continue;
    }
    if (key === "not.or" || key === "not.and") {
      const fn = parseLogical(table, value, ctx, key.slice(4));
      filters.push({ fn: (row) => !fn(row), eq: null });
      continue;
    }
    if (key.includes(".")) throw pgError(400, "PGRST100", `filters on embedded resources are not implemented in the harness mock (${key})`);
    const m = /^(not\.)?([a-z]+)\.([\s\S]*)$/.exec(value);
    if (!m) throw pgError(400, "PGRST100", `failed to parse filter (${key}=${value})`);
    filters.push(buildFilter(table, key, m[2], m[3], !!m[1], ctx));
  }
  return filters;
}

function parseOrder(table, str) {
  if (!str) return [];
  return splitTop(str).map((p) => {
    const bits = p.trim().split(".");
    const col = bits[0];
    if (!columnKnown(table, col)) throw pgError(400, "42703", `column ${table}.${col} does not exist`);
    return { col, desc: bits.includes("desc"), nullsFirst: bits.includes("nullsfirst") ? true : bits.includes("nullslast") ? false : bits.includes("desc") };
  });
}

function sortRows(table, rows, order, ctx) {
  if (!order.length) return rows;
  const get = (row, col) => (COMPUTED[table]?.[col] ? COMPUTED[table][col](row, ctx) : row[col] ?? null);
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      for (const o of order) {
        const x = get(a.row, o.col);
        const y = get(b.row, o.col);
        if (x === y) continue;
        if (x === null) return o.nullsFirst ? -1 : 1;
        if (y === null) return o.nullsFirst ? 1 : -1;
        const c = x < y ? -1 : 1;
        return o.desc ? -c : c;
      }
      return a.i - b.i;
    })
    .map((x) => x.row);
}

// ---------------------------------------------------------------------------
// SELECT
// ---------------------------------------------------------------------------
function baseRows(table, filters) {
  const idx = INDEX[table];
  if (idx) {
    for (const f of filters) {
      if (f.eq && idx[f.eq.col]) {
        const hit = idx[f.eq.col].get(f.eq.value);
        if (hit === undefined) return [];
        return Array.isArray(hit) ? hit : [hit];
      }
    }
  }
  if (!(table in T)) return [];
  return T[table];
}

function readTable(table, searchParams, ctx) {
  if (!SCHEMA[table]) throw new HttpError(404, { code: "PGRST205", details: null, hint: null, message: `Could not find the table 'public.${table}' in the schema cache` });
  const policy = policyFor(table, ctx);
  const filters = parseFilters(table, searchParams, ctx);
  const tree = parseSelect(searchParams.get("select") ?? "*");
  validateSelect(table, tree);
  const order = parseOrder(table, searchParams.get("order"));
  let rows = baseRows(table, filters).filter((r) => policy(r) && filters.every((f) => f.fn(r)));
  // !inner embeds drop parents with no visible child.
  const inner = tree.filter((it) => it.kind === "rel" && it.inner);
  if (inner.length) {
    rows = rows.filter((r) =>
      inner.every((it) => {
        const e = embed(table, r, it, ctx);
        return Array.isArray(e) ? e.length > 0 : e !== null;
      }),
    );
  }
  rows = sortRows(table, rows, order, ctx);
  return { rows, tree };
}

function validateSelect(table, tree) {
  for (const it of tree) {
    if (it.kind === "col" && !columnKnown(table, it.name)) throw pgError(400, "42703", `column ${table}.${it.name} does not exist`);
    if (it.kind === "rel") {
      const rels = RELATIONS[table]?.[it.name];
      if (!rels) throw pgError(400, "PGRST200", `Could not find a relationship between '${table}' and '${it.name}' in the schema cache`);
      const rel = pickRelation(rels, it.hint);
      validateSelect(rel.table, it.sub);
    }
  }
}
function pickRelation(rels, hint) {
  return (hint && rels.find((r) => r.name === hint || r.remote === hint || r.local === hint)) || rels[0];
}

function embed(table, row, item, ctx) {
  const rel = pickRelation(RELATIONS[table][item.name], item.hint);
  const policy = policyFor(rel.table, ctx);
  const idx = INDEX[rel.table]?.[rel.remote];
  const key = row[rel.local];
  let candidates;
  if (idx) {
    const hit = idx.get(key);
    candidates = hit === undefined ? [] : Array.isArray(hit) ? hit : [hit];
  } else candidates = (T[rel.table] ?? []).filter((r) => r[rel.remote] === key);
  const visible = candidates.filter((r) => policy(r));
  if (rel.many) return visible.map((r) => project(rel.table, r, item.sub, ctx));
  return visible.length ? project(rel.table, visible[0], item.sub, ctx) : null;
}

function project(table, row, tree, ctx) {
  const out = {};
  for (const it of tree) {
    if (it.kind === "star") {
      for (const c of SCHEMA[table]) out[c] = row[c] ?? null;
    } else if (it.kind === "col") {
      out[it.alias] = COMPUTED[table]?.[it.name] ? COMPUTED[table][it.name](row, ctx) : row[it.name] ?? null;
    } else {
      out[it.alias] = embed(table, row, it, ctx);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function send(res, status, body, headers = {}) {
  const payload = body === undefined || body === null ? "" : typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "Content-Range, Content-Location",
    ...headers,
  });
  res.end(payload);
}
const preferOf = (req) => String(req.headers.prefer ?? "").split(",").map((s) => s.trim());

function handleSelect(req, res, table, url, ctx) {
  const prefer = preferOf(req);
  const wantCount = prefer.some((p) => /^count=(exact|planned|estimated)$/.test(p));
  const { rows, tree } = readTable(table, url.searchParams, ctx);
  const total = rows.length;

  let offset = Number(url.searchParams.get("offset") ?? 0) || 0;
  let limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : Infinity;
  const range = req.headers.range;
  if (range && /^\d+-\d*$/.test(range)) {
    const [a, b] = range.split("-");
    offset = Number(a);
    if (b !== "") limit = Math.min(limit, Number(b) - offset + 1);
  }
  limit = Math.min(limit, MAX_ROWS);
  const slice = rows.slice(offset, offset + limit);

  const first = slice.length ? offset : null;
  const contentRange = slice.length ? `${first}-${first + slice.length - 1}/${wantCount ? total : "*"}` : `*/${wantCount ? total : "*"}`;
  const partial = slice.length < total;
  const status = wantCount && partial && slice.length > 0 ? 206 : 200;
  const headers = { "content-range": contentRange };

  if (req.method === "HEAD") return send(res, status === 206 ? 206 : 200, null, headers);

  const projected = slice.map((r) => project(table, r, tree, ctx));
  const accept = String(req.headers.accept ?? "");
  if (accept.includes("application/vnd.pgrst.object+json")) {
    if (projected.length !== 1) {
      throw new HttpError(406, { code: "PGRST116", details: `The result contains ${total} rows`, hint: null, message: "Cannot coerce the result to a single JSON object" }, headers);
    }
    return send(res, 200, projected[0], { ...headers, "content-type": "application/vnd.pgrst.object+json; charset=utf-8" });
  }
  return send(res, status, projected, headers);
}

// ---------------------------------------------------------------------------
// INSERT / UPDATE / DELETE
// ---------------------------------------------------------------------------
const TOUR_EVENTS = ["tour_start", "tour_step", "tour_complete", "tour_trial_click", "tour_skip"];
function checkInsert(table, row, ctx) {
  const service = ctx.role === "service_role";
  switch (table) {
    case "tour_events": {
      // grant insert (event, step, session_id, env) to anon, authenticated -- four columns, nothing else.
      const allowed = ["event", "step", "session_id", "env"];
      const extra = Object.keys(row).filter((k) => !allowed.includes(k));
      if (extra.length && !service) throw pgError(403, "42501", "permission denied for table tour_events");
      if (!TOUR_EVENTS.includes(row.event)) throw pgError(400, "23514", 'new row for relation "tour_events" violates check constraint "tour_events_event_check"');
      // This branch's migration allows 1-6; the Sprint 7 tour (seven steps) widens it to 1-7. The harness takes either.
      if (!Number.isInteger(row.step) || row.step < 1 || row.step > 7) throw pgError(400, "23514", 'new row for relation "tour_events" violates check constraint "tour_events_step_check"');
      if (!/^[A-Za-z0-9-]{8,64}$/.test(String(row.session_id ?? ""))) throw pgError(400, "23514", 'new row for relation "tour_events" violates check constraint "tour_events_session_id_check"');
      const env = row.env ?? "production";
      if (!["production", "preview", "development"].includes(env)) throw pgError(400, "23514", 'new row for relation "tour_events" violates check constraint "tour_events_env_check"');
      return { id: nextId++, event: row.event, step: row.step, session_id: row.session_id, env, created_at: new Date().toISOString() };
    }
    case "search_queries":
      if (!service) throw pgError(403, "42501", "permission denied for table search_queries");
      return { id: nextId++, created_at: new Date().toISOString(), ...row };
    case "provision_changes":
    case "regulation_releases":
    case "provisions":
    case "profiles":
    case "provision_method_citations":
    case "cross_references":
    case "provision_neighbors":
      if (!service) throw pgError(403, "42501", `permission denied for table ${table}`);
      return { created_at: new Date().toISOString(), ...row };
    default:
      throw new HttpError(404, { code: "PGRST205", details: null, hint: null, message: `Could not find the table 'public.${table}' in the schema cache` });
  }
}

async function handleWrite(req, res, table, url, ctx) {
  const prefer = preferOf(req);
  const wantRows = prefer.includes("return=representation");
  if (req.method === "POST") {
    const text = await readBody(req);
    let body;
    try {
      body = JSON.parse(text || "null");
    } catch {
      throw pgError(400, "PGRST102", "Empty or invalid json");
    }
    const list = Array.isArray(body) ? body : [body];
    const created = list.map((row) => checkInsert(table, row ?? {}, ctx));
    // Validate everything before keeping anything (one statement, all or nothing).
    for (const row of created) {
      T[table].push(row);
      if (table === "provisions") provById.set(row.id, row);
    }
    if (!wantRows) return send(res, 201, null);
    const tree = parseSelect(url.searchParams.get("select") ?? "*");
    return send(res, 201, created.map((r) => project(table, r, tree, ctx)), { "content-range": `*/*` });
  }
  // PATCH / DELETE: service role only, over the filtered rows.
  if (ctx.role !== "service_role") throw pgError(403, "42501", `permission denied for table ${table}`);
  const filters = parseFilters(table, url.searchParams, ctx);
  if (!filters.length) throw pgError(400, "21000", `${req.method} requires a WHERE clause`);
  const targets = baseRows(table, filters).filter((r) => filters.every((f) => f.fn(r)));
  if (req.method === "PATCH") {
    const patch = JSON.parse((await readBody(req)) || "{}");
    for (const r of targets) Object.assign(r, patch);
    pathCache.clear();
  } else {
    T[table] = T[table].filter((r) => !targets.includes(r));
  }
  if (!wantRows) return send(res, 204, null);
  const tree = parseSelect(url.searchParams.get("select") ?? "*");
  return send(res, 200, targets.map((r) => project(table, r, tree, ctx)));
}

// ---------------------------------------------------------------------------
// Text search: search_provisions
// ---------------------------------------------------------------------------
const STOP = new Set(
  "a about above after again against all am an and any are as at be because been before being below between both but by can did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its me more most my no nor not of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with you your".split(
    " ",
  ),
);
/** A very small English stemmer: enough that "emissions" matches "emission" and "storing" matches "stored". */
function stem(w) {
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "i";
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}
const WORD = /[A-Za-z0-9][A-Za-z0-9'’]*/g;
const decodeEntities = (s) => s.replace(/&nbsp;/g, " ").replace(/ /g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const plainText = (html) => decodeEntities(String(html ?? "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
function stems(text) {
  const out = [];
  for (const m of text.toLowerCase().matchAll(WORD)) {
    const w = m[0].replace(/['’]s$/, "");
    if (!STOP.has(w)) out.push(stem(w));
  }
  return out;
}

const searchIndex = new Map(); // id -> {text, textStems, citStems, titleStems, tf}
function indexOf(p) {
  let ix = searchIndex.get(p.id);
  if (!ix) {
    const text = plainText(p.full_text);
    const textStems = stems(text);
    const tf = new Map();
    for (const s of textStems) tf.set(s, (tf.get(s) ?? 0) + 1);
    ix = { text, textStems, tf, cit: new Set(stems(p.citation ?? "")), title: new Set(stems(p.title ?? "")) };
    searchIndex.set(p.id, ix);
  }
  return ix;
}

/** websearch_to_tsquery-ish: words ANDed, "or" ORs, -word negates, "quoted phrase" must be adjacent. */
function parseWebQuery(q) {
  const clauses = []; // OR of ANDs: [[{stem}|{phrase:[...]}|{not:stem}]]
  let cur = [];
  const re = /"([^"]*)"|(-?)([^\s"]+)/g;
  for (const m of String(q ?? "").matchAll(re)) {
    if (m[1] !== undefined) {
      const ph = stems(m[1]);
      if (ph.length) cur.push({ phrase: ph });
      continue;
    }
    const word = m[3];
    if (!m[2] && word.toLowerCase() === "or") {
      if (cur.length) clauses.push(cur);
      cur = [];
      continue;
    }
    const st = stems(word);
    for (const s of st) cur.push(m[2] ? { not: s } : { term: s });
  }
  if (cur.length) clauses.push(cur);
  return clauses.filter((c) => c.some((x) => !x.not));
}
function termsOf(clauses) {
  const set = new Set();
  for (const c of clauses) for (const x of c) {
    if (x.term) set.add(x.term);
    if (x.phrase) x.phrase.forEach((s) => set.add(s));
  }
  return set;
}
function clauseMatches(clause, ix) {
  return clause.every((x) => {
    if (x.term) return ix.tf.has(x.term) || ix.cit.has(x.term) || ix.title.has(x.term);
    if (x.not) return !(ix.tf.has(x.not) || ix.cit.has(x.not) || ix.title.has(x.not));
    if (x.phrase) {
      const t = ix.textStems;
      for (let i = 0; i + x.phrase.length <= t.length; i += 1) {
        if (x.phrase.every((s, j) => t[i + j] === s)) return true;
      }
      return false;
    }
    return true;
  });
}

function headlineOf(ix, termSet) {
  const words = [...ix.text.matchAll(/\S+/g)].map((m) => m[0]);
  const isHit = (w) => {
    const m = /[A-Za-z0-9][A-Za-z0-9'’]*/.exec(w);
    return !!m && termSet.has(stem(m[0].toLowerCase().replace(/['’]s$/, "")));
  };
  let at = words.findIndex(isHit);
  if (at < 0) at = 0;
  const start = Math.max(0, at - 8);
  const end = Math.min(words.length, start + 35);
  return words.slice(start, end).map((w) => (isHit(w) ? `<mark>${w}</mark>` : w)).join(" ");
}

function searchProvisions(args, ctx) {
  const q = String(args.q ?? "");
  const lim = Math.max(1, Number.isFinite(Number(args.lim)) ? Number(args.lim) : 25);
  const clauses = parseWebQuery(q);
  if (!clauses.length) return [];
  const terms = termsOf(clauses);
  const namedKey = q.trim().toLowerCase();
  const staged = stagedRegs();
  const hits = [];
  for (const p of T.provisions) {
    if (!provisionVisible(p, ctx, staged)) continue;
    const ix = indexOf(p);
    const ok = clauses.some((c) => clauseMatches(c, ix));
    if (!ok) continue;
    // A length-normalised, weighted tf (citation > title > text), standing in for ts_rank.
    let base = 0;
    for (const t of terms) {
      const tf = ix.tf.get(t) ?? 0;
      base += (ix.cit.has(t) ? 1.0 : 0) + (ix.title.has(t) ? 0.4 : 0) + 0.2 * Math.log1p(tf);
    }
    base = base / Math.log2(2 + ix.textStems.length / 25);
    let cit = false;
    for (const c of clauses) if (c.some((x) => x.term) && c.filter((x) => x.term).every((x) => ix.cit.has(x.term))) cit = true;
    const pth = provisionPath(p.id, ctx);
    let score = base * (cit ? 2 : 1);
    if (pth && /\bdefinitions?\b/i.test(pth)) score *= 0.8;
    if (/^gp\d\d$/.test(p.reg_key ?? "")) score *= 0.95;
    if (pth && /\b(applicability|am i subject|who must comply)\b/i.test(pth)) score *= 1.3;
    if (namedKey && p.id === `sec-${namedKey}-top-REG-${namedKey}`) score *= 2;
    hits.push({ p, ix, score, path: pth });
  }
  hits.sort((a, b) => b.score - a.score || a.p.sort_order - b.p.sort_order);
  return hits.slice(0, lim).map(({ p, ix, score, path: pth }) => {
    const normTitle = plainText(p.title);
    const normCit = plainText(p.citation);
    return {
      id: p.id,
      citation: p.citation,
      title: p.title,
      reg_key: regOfId(p.id),
      headline: ix.text === normTitle || ix.text === normCit ? null : headlineOf(ix, terms),
      rank: Math.round(score * 1e6) / 1e6,
      path: pth,
      is_basis: false,
    };
  });
}

// ---------------------------------------------------------------------------
// RPCs
// ---------------------------------------------------------------------------
function rpc(name, args, ctx, req) {
  switch (name) {
    case "search_provisions":
      return searchProvisions(args, ctx);
    case "provision_path":
      return provisionPath(String(args.p_id ?? ""), ctx);
    case "changelog_snapshot_public":
      return [{ rows: DB.changelog_snapshot?.rows ?? [], computed_at: DB.changelog_snapshot?.computed_at ?? null }];
    case "changelog_public":
      return DB.changelog_snapshot?.rows ?? [];
    case "refresh_changelog_snapshot":
      if (ctx.role !== "service_role") throw pgError(403, "42501", "permission denied for function refresh_changelog_snapshot");
      return null;
    case "search_queries_recent_count":
      if (ctx.role !== "service_role") throw pgError(403, "42501", "permission denied for function search_queries_recent_count");
      return T.search_queries.filter((r) => r.user_id === args.p_user && Date.now() - Date.parse(r.created_at) < (args.window_seconds ?? 60) * 1000).length;
    case "match_provisions":
    case "match_provisions_hybrid":
      // Ask: needs Voyage embeddings, out of scope. Revoked from anon in production.
      if (ctx.role === "anon") throw pgError(403, "42501", `permission denied for function ${name}`);
      noteUnhandled(req, `RPC ${name} (Ask / semantic search is not emulated; returned [])`, ctx);
      return [];
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// GoTrue
// ---------------------------------------------------------------------------
const ACCESS_TTL = 3600;
const authUsers = new Map(DB.auth_users.map((u) => [u.id, { ...u }]));
const userByEmail = (email) => [...authUsers.values()].find((u) => u.email.toLowerCase() === String(email ?? "").toLowerCase());
function userJson(u) {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.confirmed ? u.created_at : null,
    phone: "",
    confirmed_at: u.confirmed ? u.created_at : null,
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: u.user_metadata ?? {},
    identities: [],
    created_at: u.created_at,
    updated_at: u.created_at,
    is_anonymous: false,
  };
}
function sessionFor(u) {
  const now = Math.floor(Date.now() / 1000);
  const sessionId = crypto.randomUUID();
  const access = signJwt({
    iss: "supabase-harness/auth/v1",
    aud: "authenticated",
    exp: now + ACCESS_TTL,
    iat: now,
    sub: u.id,
    email: u.email,
    phone: "",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: u.user_metadata ?? {},
    role: "authenticated",
    aal: "aal1",
    amr: [{ method: "password", timestamp: now }],
    session_id: sessionId,
    is_anonymous: false,
  });
  const refresh = signJwt({ typ: "refresh", sub: u.id, jti: crypto.randomUUID(), exp: FAR_FUTURE });
  return { access_token: access, token_type: "bearer", expires_in: ACCESS_TTL, expires_at: now + ACCESS_TTL, refresh_token: refresh, user: userJson(u) };
}
const gotrueError = (status, code, msg) => new HttpError(status, { code: status, error_code: code, msg });

async function handleAuth(req, res, url) {
  const route = url.pathname.replace(/^\/auth\/v1/, "");
  tally(`${req.method} /auth/v1${route}`);
  const bodyText = req.method === "GET" || req.method === "HEAD" ? "" : await readBody(req);
  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    /* form-encoded or empty */
  }
  const ok = (data, status = 200) => send(res, status, data);

  if (route === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const u = userByEmail(body.email);
      if (!u || u.password !== body.password) throw gotrueError(400, "invalid_credentials", "Invalid login credentials");
      if (!u.confirmed) throw gotrueError(400, "email_not_confirmed", "Email not confirmed");
      return ok(sessionFor(u));
    }
    if (grant === "refresh_token") {
      const claims = verifyJwt(body.refresh_token);
      const u = claims?.typ === "refresh" ? authUsers.get(claims.sub) : null;
      if (!u) throw gotrueError(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
      return ok(sessionFor(u));
    }
    throw gotrueError(400, "validation_failed", `unsupported grant_type ${grant}`);
  }
  if (route === "/user" && req.method === "GET") {
    const token = bearerOf(req);
    const claims = token ? verifyJwt(token) : null;
    if (!claims) throw gotrueError(401, "bad_jwt", "invalid JWT: unable to parse or verify signature");
    if (claims.exp < Date.now() / 1000) throw gotrueError(403, "session_expired", "invalid JWT: token is expired");
    const u = claims.sub ? authUsers.get(claims.sub) : null;
    if (!u) throw gotrueError(403, "bad_jwt", "invalid claim: missing sub claim");
    return ok(userJson(u));
  }
  if (route === "/user" && req.method === "PUT") {
    const claims = verifyJwt(bearerOf(req));
    const u = claims?.sub ? authUsers.get(claims.sub) : null;
    if (!u) throw gotrueError(401, "bad_jwt", "invalid JWT");
    if (body.password) u.password = body.password;
    if (body.data) u.user_metadata = { ...(u.user_metadata ?? {}), ...body.data };
    return ok(userJson(u));
  }
  if (route === "/logout" && req.method === "POST") return send(res, 204, null);
  if (route === "/signup" && req.method === "POST") {
    if (userByEmail(body.email)) {
      // Real GoTrue answers an existing address with a fake user (no enumeration); the harness does the same.
      return ok({ ...userJson({ id: crypto.randomUUID(), email: body.email, confirmed: false, created_at: new Date().toISOString() }), identities: [] });
    }
    const u = { id: crypto.randomUUID(), email: body.email, password: body.password, confirmed: false, created_at: new Date().toISOString(), user_metadata: body.data ?? {} };
    authUsers.set(u.id, u);
    T.profiles.push({ id: u.id, email: u.email, access_granted: false, created_at: u.created_at, stripe_customer_id: null, stripe_subscription_id: null, subscription_status: null, current_period_end: null, plan: null, cancel_at_period_end: false });
    profileById.set(u.id, T.profiles.at(-1));
    return ok({ ...userJson(u), confirmation_sent_at: u.created_at, identities: [{ identity_id: crypto.randomUUID(), id: u.id, user_id: u.id, provider: "email" }] });
  }
  if ((route === "/resend" || route === "/recover" || route === "/otp") && req.method === "POST") return ok({});
  if (route === "/settings") return ok({ external: { email: true }, disable_signup: false, mailer_autoconfirm: false, phone_autoconfirm: false });
  if (route === "/health") return ok({ name: "GoTrue (harness)", version: "harness", description: "mock" });
  if (route === "/.well-known/jwks.json") return ok({ keys: [] });
  noteUnhandled(req, "unknown /auth/v1 route", null);
  throw gotrueError(404, "not_found", `harness mock has no ${req.method} /auth/v1${route}`);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  let ctx = null;
  try {
    if (req.method === "OPTIONS") return send(res, 204, null, { "access-control-allow-methods": "GET,POST,PATCH,DELETE,HEAD,PUT,OPTIONS" });

    // --- harness endpoints
    if (url.pathname.startsWith("/__harness/")) {
      const what = url.pathname.slice("/__harness/".length);
      if (what === "health") return send(res, 200, { ok: true, provisions: T.provisions.length, port: PORT });
      if (what.startsWith("font/")) {
        // Placeholder font bytes for a build with no route to Google Fonts (run.sh, font-mocks.mjs).
        return send(res, 200, "harness-placeholder-font", { "content-type": "font/woff2" });
      }
      if (what === "tour-events") {
        if (req.method === "DELETE") T.tour_events.length = 0;
        return send(res, 200, T.tour_events);
      }
      if (what === "search-queries") return send(res, 200, T.search_queries);
      if (what === "unhandled") {
        if (req.method === "DELETE") unhandled.length = 0;
        return send(res, 200, unhandled);
      }
      if (what === "requests") return send(res, 200, Object.fromEntries([...counts].sort((a, b) => b[1] - a[1])));
      if (what === "reset" && req.method === "POST") {
        T.tour_events.length = 0;
        T.search_queries.length = 0;
        unhandled.length = 0;
        counts.clear();
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: "unknown harness endpoint" });
    }

    if (url.pathname.startsWith("/auth/v1/")) {
      return await handleAuth(req, res, url);
    }

    const rpcMatch = /^\/rest\/v1\/rpc\/([A-Za-z0-9_]+)$/.exec(url.pathname);
    const rest = /^\/rest\/v1\/([A-Za-z0-9_]+)$/.exec(url.pathname);
    if (!rpcMatch && !rest) {
      noteUnhandled(req, "path is not /rest/v1/<table>, /rest/v1/rpc/<fn>, /auth/v1/* or /__harness/*", null);
      return send(res, 404, { message: `harness mock: no route for ${url.pathname}` });
    }
    ctx = ctxOf(req);

    if (rpcMatch) {
      tally(`${req.method} rpc/${rpcMatch[1]} [${ctx.role}]`);
      let args = {};
      if (req.method === "POST") args = JSON.parse((await readBody(req)) || "{}");
      else for (const [k, v] of url.searchParams) args[k] = v;
      const out = rpc(rpcMatch[1], args, ctx, req);
      if (out === undefined) {
        noteUnhandled(req, `RPC ${rpcMatch[1]} is not implemented`, ctx);
        return send(res, 404, { code: "PGRST202", details: null, hint: null, message: `Could not find the function public.${rpcMatch[1]} in the schema cache` });
      }
      return send(res, 200, JSON.stringify(out)); // a scalar (string, null) must still be JSON text
    }

    const name = rest[1];
    tally(`${req.method} ${name} [${ctx.role}]`);
    if (req.method === "GET" || req.method === "HEAD") return handleSelect(req, res, name, url, ctx);
    if (["POST", "PATCH", "DELETE"].includes(req.method)) return await handleWrite(req, res, name, url, ctx);
    noteUnhandled(req, "unsupported method", ctx);
    return send(res, 405, { message: "method not allowed" });
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.status === 404 && e.body?.code === "PGRST205") noteUnhandled(req, e.body.message, ctx);
      else if (e.body?.code === "PGRST100" || e.body?.code === "42703" || e.body?.code === "PGRST200") noteUnhandled(req, e.body.message, ctx);
      if (VERBOSE) console.error(`[mock-supabase] ${req.method} ${req.url} -> ${e.status} ${e.body?.message ?? ""}`);
      return send(res, e.status, e.body, e.headers);
    }
    console.error("[mock-supabase] internal error", e);
    noteUnhandled(req, `internal error: ${e?.message}`, ctx);
    return send(res, 500, { code: "PGRST000", message: `harness mock internal error: ${e?.message}` });
  } finally {
    if (VERBOSE) console.error(`[mock-supabase] ${req.method} ${req.url} (${ctx?.role ?? "-"})`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `mock-supabase listening on http://${HOST}:${PORT} (${T.provisions.length} provisions, ${T.provisions.filter((p) => p.is_public).length} public)` +
      (RLS_OFF ? "  *** HARNESS_RLS=off: row-level security is NOT enforced ***" : ""),
  );
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
