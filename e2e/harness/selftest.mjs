#!/usr/bin/env node
/**
 * Checks the harness itself, not the app: that the mock Supabase enforces the
 * row-level security the specs rely on, and speaks PostgREST / GoTrue the way
 * supabase-js expects. Run it against a running harness:
 *
 *   node e2e/harness/selftest.mjs [--mock http://127.0.0.1:54321] [--app http://127.0.0.1:3100]
 *
 * (--app is optional; with it, three requests also go through the built app.)
 * Exits non-zero on any failure. If you change the mock, run this first.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const MOCK = arg("mock", "http://127.0.0.1:54321");
const APP = arg("app", "http://127.0.0.1:3100");
const DB_META = JSON.parse(fs.readFileSync(arg("data", path.join(HERE, "generated", "db.json")), "utf8")).meta;

const env = Object.fromEntries(
  spawnSync("node", [path.join(HERE, "mock-supabase.mjs"), "--print-env"], { encoding: "utf8", env: { ...process.env, HARNESS_MOCK_PORT: new URL(MOCK).port } })
    .stdout.split("\n")
    .map((l) => /^export (\w+)='(.*)'$/.exec(l))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

async function rest(pathAndQuery, { token = ANON, method = "GET", body, headers = {} } = {}) {
  const res = await fetch(MOCK + pathAndQuery, {
    method,
    headers: { apikey: ANON, authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not json */
  }
  return { status: res.status, json, headers: res.headers };
}
async function signIn(email, password) {
  const res = await fetch(`${MOCK}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, json: await res.json() };
}

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${String(e.message).split("\n")[0]}`);
  }
}
function eq(actual, expected, what = "") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
const ids = (r) => (r.json ?? []).map((x) => x.id);
/** Every row of a regulation, paging like the app does (1000 per request). */
async function allIds(reg, token) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await rest(`/rest/v1/provisions?select=id&reg_key=eq.${reg}&order=sort_order.asc&offset=${from}&limit=1000`, { token });
    out.push(...ids(r));
    if (r.json.length < 1000) return out;
  }
}

const sub = await signIn(DB_META.subscriber.email, DB_META.subscriber.password);
const visitor = await signIn(DB_META.visitor.email, DB_META.visitor.password);
const SUB = sub.json.access_token;
const VIS = visitor.json.access_token;

console.log("sign-in (GoTrue)");
await check("password sign-in returns a session for the subscriber", async () => {
  eq(sub.status, 200);
  if (!SUB || !sub.json.refresh_token || sub.json.user?.email !== DB_META.subscriber.email) throw new Error("no session");
});
await check("a wrong password is invalid_credentials (400)", async () => {
  const r = await signIn(DB_META.subscriber.email, "nope");
  eq([r.status, r.json.error_code], [400, "invalid_credentials"]);
});
await check("GET /auth/v1/user with the access token returns the user; with the anon key it does not", async () => {
  const ok = await fetch(`${MOCK}/auth/v1/user`, { headers: { apikey: ANON, authorization: `Bearer ${SUB}` } });
  eq((await ok.json()).email, DB_META.subscriber.email);
  const bad = await fetch(`${MOCK}/auth/v1/user`, { headers: { apikey: ANON, authorization: `Bearer ${ANON}` } });
  eq(bad.status, 403);
});
await check("a refresh token yields a new session", async () => {
  const r = await fetch(`${MOCK}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: sub.json.refresh_token }),
  });
  eq(r.status, 200);
});

console.log("row-level security: provisions");
await check("anon reads all 111 GP05 rows and exactly 14 of Regulation 7's (the 13-id subtree plus I.D.3.a.(i))", async () => {
  eq((await allIds("gp05", ANON)).length, 111);
  const reg7 = await allIds("7", ANON);
  eq(reg7.length, 14);
  eq(reg7.filter((i) => i === "sec-7-B-I-C-1" || i.startsWith("sec-7-B-I-C-1-")).length, 13);
  if (!reg7.includes("sec-7-B-I-D-3-a-(i)")) throw new Error("the older sample row is missing");
});
await check("anon reads nothing else: a locked row by id is not there, a locked regulation is empty", async () => {
  eq((await rest("/rest/v1/provisions?select=id&id=eq.sec-7-B-I-C-2")).json, []);
  eq((await rest("/rest/v1/provisions?select=id&reg_key=eq.3")).json, []);
  eq((await rest("/rest/v1/provisions?select=id&id=like.sec-%25-top-REG-%25")).json.map((r) => r.id), ["sec-gp05-top-REG-gp05"]);
});
await check("the four older sample rows are public; the parent sec-7-B-I-C is not", async () => {
  const r = await rest("/rest/v1/provisions?select=id&id=in.(%22sec-7-B-I-D-3-a-(i)%22,sec-cp-I-G-90,%22sec-ecmc-604-a-(1)%22,sec-gp02-II-A-2,sec-7-B-I-C)");
  eq(ids(r).sort(), ["sec-7-B-I-D-3-a-(i)", "sec-cp-I-G-90", "sec-ecmc-604-a-(1)", "sec-gp02-II-A-2"].sort());
});
await check("the service role reads every row of Regulation 7 (2182), count=exact on HEAD says so", async () => {
  eq((await allIds("7", SERVICE)).length, 2182);
  const h = await rest("/rest/v1/provisions?select=id&reg_key=eq.7", { token: SERVICE, method: "HEAD", headers: { prefer: "count=exact" } });
  eq(h.headers.get("content-range").split("/")[1], "2182");
});
await check("the subscriber reads all of Regulation 7; a signed-in visitor with no access reads only the public 14", async () => {
  eq((await allIds("7", SUB)).length, 2182);
  eq((await allIds("7", VIS)).length, 14);
});
await check("the PostgREST row cap is 1000 per request, and a ranged read returns the next page", async () => {
  const r = await rest("/rest/v1/provisions?select=id&reg_key=eq.7&order=sort_order.asc", { token: SERVICE });
  eq(r.json.length, 1000);
  eq((await rest("/rest/v1/provisions?select=id&reg_key=eq.7&order=sort_order.asc&offset=1000&limit=5", { token: SERVICE })).json.length, 5);
});
await check("Accept: application/vnd.pgrst.object+json gives one object, or 406 PGRST116 for none", async () => {
  const one = await rest("/rest/v1/provisions?select=id,citation&id=eq.sec-gp05-VI-D", { headers: { accept: "application/vnd.pgrst.object+json" } });
  eq(one.json, { id: "sec-gp05-VI-D", citation: "VI.D." });
  const none = await rest("/rest/v1/provisions?select=id&id=eq.sec-7-B-I-C-2", { headers: { accept: "application/vnd.pgrst.object+json" } });
  eq([none.status, none.json.code], [406, "PGRST116"]);
});
await check("a bad signature is a 401", async () => {
  eq((await rest("/rest/v1/provisions?select=id&limit=1", { token: ANON.slice(0, -2) + "xx" })).status, 401);
});

console.log("row-level security: breadcrumbs, neighbours, search");
await check("context_path / provision_path: a path for a public row, null for anon on a locked one, a path for the service role", async () => {
  const pub = await rest("/rest/v1/provisions?select=context_path&id=eq.sec-7-B-I-D-3-a-(i)");
  if (!pub.json[0].context_path?.includes("›")) throw new Error("no breadcrumb on a public row");
  eq((await rest("/rest/v1/rpc/provision_path", { method: "POST", body: { p_id: "sec-7-B-I-C-2" } })).json, null);
  if (!(await rest("/rest/v1/rpc/provision_path", { method: "POST", body: { p_id: "sec-7-B-I-C-2" }, token: SERVICE })).json) throw new Error("service role got no path");
  if (!(await rest("/rest/v1/rpc/provision_path", { method: "POST", body: { p_id: "sec-7-B-I-C-2" }, token: SUB })).json) throw new Error("subscriber got no path");
});
await check("provision_neighbors: a pair is visible to anon only when both ends are public", async () => {
  const q = "/rest/v1/provision_neighbors?select=rank,neighbor:provisions!provision_neighbors_neighbor_id_fkey(id)&provision_id=eq.sec-7-B-I-D-3-a-(i)&order=rank.asc";
  eq((await rest(q)).json, []);
  eq((await rest(q, { token: SERVICE })).json.length, 5);
  eq((await rest(q, { token: SUB })).json.length, 5);
  eq((await rest(q, { token: VIS })).json, []);
});
await check("search_provisions runs as the caller: anon finds only public rows, the subscriber finds locked ones too", async () => {
  const anon = await rest("/rest/v1/rpc/search_provisions", { method: "POST", body: { q: "flare", lim: 25 } });
  const pub = new Set((await allIds("gp05", ANON)).concat(await allIds("7", ANON), ["sec-cp-I-G-90", "sec-ecmc-604-a-(1)", "sec-gp02-II-A-2"]));
  for (const h of anon.json) if (!pub.has(h.id)) throw new Error(`anon search returned a locked row ${h.id}`);
  const subHits = await rest("/rest/v1/rpc/search_provisions", { method: "POST", body: { q: "flare", lim: 25 }, token: SUB });
  if (!subHits.json.some((h) => !pub.has(h.id))) throw new Error("subscriber search returned no locked rows");
  if (!anon.json.every((h) => h.headline === null || h.headline.includes("<mark>"))) throw new Error("headline lacks <mark>");
});

await check("count_provisions_matching: one bare integer over the whole library for anon, the visitor and the subscriber alike, 0 for nonsense, and a staged document is not counted", async () => {
  const count = async (q, token = ANON) => {
    const r = await rest("/rest/v1/rpc/count_provisions_matching", { method: "POST", body: { q }, token });
    eq(r.status, 200);
    if (!Number.isInteger(r.json)) throw new Error(`count of "${q}" was not a bare integer: ${JSON.stringify(r.json)}`);
    return r.json;
  };
  const n = await count("flare");
  eq([await count("flare", VIS), await count("flare", SUB), await count("flare", SERVICE)], [n, n, n]);
  const anonHits = (await rest("/rest/v1/rpc/search_provisions", { method: "POST", body: { q: "flare", lim: 50 } })).json.length;
  if (!(n > anonHits)) throw new Error(`the count (${n}) should exceed what anon can read (${anonHits}): it covers locked rows`);
  eq(await count("zzzqqqxxnotaword"), 0);
  eq(await count(""), 0);
  eq(await count("   "), 0);
  // A staged document leaves the count (service key writes the gate, then restores it).
  const subHits = (await rest("/rest/v1/rpc/search_provisions", { method: "POST", body: { q: "flare", lim: 50 }, token: SUB })).json;
  const reg = subHits.map((h) => h.reg_key).find((k) => k && k !== "gp05" && k !== "7");
  if (!reg) throw new Error("no locked document among the subscriber's flare hits");
  const post = await rest("/rest/v1/regulation_releases", { method: "POST", token: SERVICE, body: { reg_key: reg, status: "staged" } });
  eq(post.status, 201);
  try {
    const staged = await count("flare");
    if (!(staged < n)) throw new Error(`staging ${reg} did not lower the count (${staged} vs ${n})`);
  } finally {
    await rest(`/rest/v1/regulation_releases?reg_key=eq.${reg}`, { method: "DELETE", token: SERVICE });
  }
  eq(await count("flare"), n);
});

console.log("other tables");
await check("profiles: anon denied, a user reads only their own row, the service role reads all", async () => {
  eq((await rest("/rest/v1/profiles?select=id")).status, 403);
  eq((await rest("/rest/v1/profiles?select=id", { token: SUB })).json.length, 1);
  eq((await rest("/rest/v1/profiles?select=id", { token: SERVICE })).json.length, 2);
});
await check("tour_events: anon may insert (4 columns, valid values) and may not read; the harness endpoint shows it", async () => {
  await fetch(`${MOCK}/__harness/tour-events`, { method: "DELETE" });
  const good = await rest("/rest/v1/tour_events", { method: "POST", body: { event: "tour_start", step: 1, session_id: "selftest-0000-0000", env: "development" } });
  eq(good.status, 201);
  eq((await rest("/rest/v1/tour_events", { method: "POST", body: { event: "nope", step: 1, session_id: "selftest-0000-0000" } })).status, 400);
  eq((await rest("/rest/v1/tour_events?select=id")).status, 403);
  eq((await (await fetch(`${MOCK}/__harness/tour-events`)).json()).length, 1);
  await fetch(`${MOCK}/__harness/tour-events`, { method: "DELETE" });
});
await check("regulation_releases is service-role only; nothing is staged", async () => {
  eq((await rest("/rest/v1/regulation_releases?select=reg_key&status=eq.staged")).status, 403);
  eq((await rest("/rest/v1/regulation_releases?select=reg_key&status=eq.staged", { token: SERVICE })).json, []);
});
await check("provision_method_citations is readable by anon (Method 21 has citing provisions)", async () => {
  const r = await rest("/rest/v1/provision_method_citations?select=provision_id&method_slug=eq.method-21");
  if (r.json.length < 50) throw new Error(`only ${r.json.length} citations`);
});
await check("an unknown table or RPC is an honest error and is recorded as unhandled", async () => {
  await fetch(`${MOCK}/__harness/unhandled`, { method: "DELETE" });
  eq((await rest("/rest/v1/nope?select=id")).status, 404);
  eq((await rest("/rest/v1/rpc/no_such_fn", { method: "POST", body: {} })).status, 404);
  const u = await (await fetch(`${MOCK}/__harness/unhandled`)).json();
  eq(u.length, 2);
  await fetch(`${MOCK}/__harness/unhandled`, { method: "DELETE" });
});

const appUp = await fetch(APP + "/robots.txt").then((r) => r.ok, () => false);
if (appUp) {
  console.log("through the built app");
  await check("/regs/<locked row> is 404 for a visitor, /regs/<public subtree row> is 200", async () => {
    eq((await fetch(`${APP}/regs/sec-7-B-I-C-2`)).status, 404);
    eq((await fetch(`${APP}/regs/sec-7-B-I-C-1`)).status, 200);
  });
  await check("/api/provision/sec-7-B-I-C-1 answers a visitor with the locked label (Regulation 7's reader is not public)", async () => {
    const b = await (await fetch(`${APP}/api/provision/sec-7-B-I-C-1`)).json();
    eq(b.locked, true);
  });
  await check("POST /api/tour-event reaches the mock's tour_events (a browser that reports itself automated is not stored)", async () => {
    await fetch(`${MOCK}/__harness/tour-events`, { method: "DELETE" });
    const post = (headers = {}) =>
      fetch(`${APP}/api/tour-event`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ event: "tour_step", step: 2, sid: "selftest-0000-1111" }) });
    eq((await post({ "x-tour-automated": "1" })).status, 204);
    eq((await (await fetch(`${MOCK}/__harness/tour-events`)).json()).length, 0);
    eq((await post()).status, 204);
    const rows = await (await fetch(`${MOCK}/__harness/tour-events`)).json();
    eq(rows.map((r) => [r.event, r.step, r.session_id]), [["tour_step", 2, "selftest-0000-1111"]]);
    await fetch(`${MOCK}/__harness/tour-events`, { method: "DELETE" });
  });
} else {
  console.log(`(app at ${APP} not answering; skipping the through-the-app checks)`);
}

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
