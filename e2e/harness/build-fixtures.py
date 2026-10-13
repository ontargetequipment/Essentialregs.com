#!/usr/bin/env python3
"""
Fixture builder for the local production-build harness (e2e/harness/README.md).

Writes the in-memory database the mock Supabase (mock-supabase.mjs) serves:
e2e/harness/generated/db.json (git-ignored). Nothing here talks to a network.

Inputs (every path is an argument; the defaults are where this was first built
and the harness works after the files move, as long as the arguments say where):

  --gp05     GP05 rows as the importer now parses them
             (id, citation, title, parent_id, sort_order, full_text, kind)
  --reg7     Regulation 7, same shape
  --overlay  harness_overlay.json: production summary_status / ai_summary /
             reviewed_by / reviewed_at / source_url for the rows the walkthrough
             touches, the 13-id Regulation 7 public subtree, the two rows of
             its second hop (I.D and I.D.4, 13 Oct 2026) and the ids that
             were public before Sprint 7
  --docs-dir every other document, reg<key>_parsed.json (the importer's output
             directory). GP05 and Regulation 7 in it are replaced by --gp05 and
             --reg7. --only limits the corpus to some reg keys (the roots of
             the rest are kept so the indexes still list every document).

What it derives (the real database's columns, not invented ones):

  reg_key             the "<reg>" of "sec-<reg>-..." (a stored generated column)
  jurisdiction_level  pipeline/import_ccr.py REG_META, by reg key
  issuing_body        same
  source_url          the root row: REG_META's; GP05's rows carry the root's
                      (production does); the overlay wins where it speaks
  is_public           every GP05 row, the 13 Regulation 7 subtree ids, the two
                      second-hop rows (overlay: reg7_public_second_hop; migration
                      20261013014006, walkthrough v3) and the four older sample
                      rows (overlay: public_ids_outside_gp05_before_sprint7)
  summary_status      'pending' with no summary, unless the overlay says
                      otherwise (the invented exceptions are listed below)

Invented, and labelled as such in the data (README, "Limits"):

  * a placeholder approved summary on every document root the overlay does not cover (production
    has one on each) and on the four older sample rows, because the
    overlay carries none and the specs pin "AI-generated - automated check
    against source text" on /regs/sec-7-B-I-D-3-a-(i);
  * five provision_neighbors for those sample rows (lexical TF-IDF, not
    embeddings; GP12 VI.A.1 pinned at rank 3 as the spec says production has it);
  * a small changelog snapshot (counts only);
  * two accounts: a subscriber (profiles.access_granted = true) and a
    signed-in visitor with no access.
"""
import argparse
import glob
import json
import math
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))

SCRATCH = "/tmp/claude-0/-home-user-Essentialregs-com/d47fae76-4913-53dd-b507-373cb5321d93/scratchpad"
DEFAULT_GP05 = f"{SCRATCH}/shared/reggp05_parsed_new.json"
DEFAULT_REG7 = f"{SCRATCH}/shared/reg7_parsed.json"
DEFAULT_OVERLAY = f"{SCRATCH}/shared/harness_overlay.json"
DEFAULT_DOCS = f"{SCRATCH}/pr1/out_new"

SUBSCRIBER_EMAIL = os.environ.get("HARNESS_EMAIL", "harness-subscriber@essentialregs.test")
SUBSCRIBER_PASSWORD = os.environ.get("HARNESS_PASSWORD", "harness-password-1")
VISITOR_EMAIL = os.environ.get("HARNESS_VISITOR_EMAIL", "harness-visitor@essentialregs.test")
VISITOR_PASSWORD = os.environ.get("HARNESS_VISITOR_PASSWORD", SUBSCRIBER_PASSWORD)
SUBSCRIBER_ID = "00000000-0000-4000-8000-000000000001"
VISITOR_ID = "00000000-0000-4000-8000-000000000002"

# The pipeline's own reviewer string for an AI second pass (the badge reads this
# as "automated check", not as a person; see isHumanReviewer in regulation-pure.ts).
PIPELINE_REVIEWER = "Claude (AI second-pass review, automated pipeline, claude-sonnet-5-5, harness placeholder)"

PROVISION_COLUMNS = [
    "id", "citation", "title", "jurisdiction_level", "issuing_body", "parent_id", "full_text",
    "ai_summary", "summary_model", "summary_generated_at", "source_url", "last_verified_date",
    "is_public", "sort_order", "created_at", "updated_at", "reg_key", "summary_status",
    "reviewed_by", "reviewed_at",
]

SCHEMA = {
    "provisions": PROVISION_COLUMNS,
    "cross_references": ["id", "from_provision_id", "raw_text", "target_type", "target_provision_id", "target_url", "created_at"],
    "provision_neighbors": ["provision_id", "neighbor_id", "score", "rank", "created_at"],
    "profiles": ["id", "email", "access_granted", "created_at", "stripe_customer_id", "stripe_subscription_id",
                 "subscription_status", "current_period_end", "plan", "cancel_at_period_end"],
    "regulation_releases": ["reg_key", "status", "staged_at", "released_at", "note"],
    "tour_events": ["id", "event", "step", "session_id", "env", "created_at"],
    "search_queries": ["id", "user_id", "mode", "query", "reg_filter", "jurisdiction", "result_ids", "top_score", "latency_ms", "created_at"],
    "provision_changes": ["id", "provision_id", "change_type", "note", "created_at"],
    "provision_method_citations": ["provision_id", "method_slug", "raw_text", "created_at"],
}

# The four rows that were public before GP05 (the overlay lists them too; this is the fallback).
FALLBACK_SAMPLE_IDS = ["sec-7-B-I-D-3-a-(i)", "sec-cp-I-G-90", "sec-ecmc-604-a-(1)", "sec-gp02-II-A-2"]
FALLBACK_REG7_SUBTREE = [
    "sec-7-B-I-C-1", "sec-7-B-I-C-1-a", "sec-7-B-I-C-1-b", "sec-7-B-I-C-1-c", "sec-7-B-I-C-1-d",
    "sec-7-B-I-C-1-e", "sec-7-B-I-C-1-e-(i)", "sec-7-B-I-C-1-e-(ii)", "sec-7-B-I-C-1-e-(iii)",
    "sec-7-B-I-C-1-e-(iv)", "sec-7-B-I-C-1-f", "sec-7-B-I-C-1-f-(i)", "sec-7-B-I-C-1-f-(ii)",
]

# Regulation 7 I.D and I.D.4 (migration 20261013014006_reg7_id_and_id4_public_second_hop.sql,
# 13 Oct 2026): the walkthrough's second citation hop, from I.C.1.c's "Sections I.D." to the
# Storage Tank Emission Controls heading. I.D.1-3 and I.D.4's children stay locked, as in production.
FALLBACK_REG7_SECOND_HOP = ["sec-7-B-I-D", "sec-7-B-I-D-4"]

# Production has GP12 VI.A.1 as the rank-3 neighbour of Regulation 7 I.D.3.a.(i)
# (smoke-anonymous.spec.ts, "a related link on a public card page ...").
NEIGHBOUR_PINS = {"sec-7-B-I-D-3-a-(i)": {3: "sec-gp12-VI-A-1"}}

REG_KEY_RE = re.compile(r"^sec-([^-]+)-")
TAG_RE = re.compile(r"<[^>]*>")
WORD_RE = re.compile(r"[a-z]{3,}")
STOP = set("""the and for that with this are shall from not any all such which any may will has have been
its their they them than then into upon under over each other more must also but who whose when where while
can only per out one two use used using within without including include includes included provided
section subsection paragraph part owner operator operators owners""".split())


def die(msg):
    print(f"build-fixtures: {msg}", file=sys.stderr)
    sys.exit(1)


def load_json(path, what):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        die(f"{what} not found: {path} (pass --{what.split()[0].lower()} PATH)")


def reg_key_of(row_id):
    m = REG_KEY_RE.match(row_id)
    return m.group(1) if m else None


def import_reg_meta():
    """REG_META from pipeline/import_ccr.py (jurisdiction, issuing body, source URL), or {} if it will not import."""
    sys.path.insert(0, os.path.join(REPO, "pipeline"))
    try:
        import import_ccr  # noqa: WPS433

        return dict(import_ccr.REG_META), getattr(import_ccr, "SOURCE_URL_DEFAULT", None)
    except Exception as e:  # pragma: no cover - environment dependent
        print(f"build-fixtures: could not import pipeline/import_ccr.py ({e!r}); using key-pattern defaults", file=sys.stderr)
        return {}, None


def fallback_meta(key):
    if re.fullmatch(r"p19\d", key):
        return {"jurisdiction_level": "federal", "issuing_body": "PHMSA"}
    if re.fullmatch(r"oooo[abc]?|jjjj|iiii|zzzz", key):
        return {"jurisdiction_level": "federal", "issuing_body": "EPA"}
    if key == "ecmc":
        return {"jurisdiction_level": "state", "issuing_body": "ECMC"}
    return {"jurisdiction_level": "state", "issuing_body": "CDPHE-APCD"}


def plain(html):
    t = TAG_RE.sub(" ", html or "")
    t = t.replace("&nbsp;", " ").replace(" ", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", t).strip()


def tokens(text):
    return [w for w in WORD_RE.findall(text.lower()) if w not in STOP]


def build_neighbours(rows, by_id, anchors):
    """Top 5 lexical neighbours for each anchor (TF-IDF cosine), skipping its own family; pinned ranks honoured."""
    df = Counter()
    toks = {}
    for r in rows:
        if r["_kind"] not in ("item", "definition", "section", "entry"):
            continue
        t = Counter(tokens(plain(r["full_text"])[:4000]))
        if len(t) < 6:
            continue
        toks[r["id"]] = t
        df.update(t.keys())
    n = max(len(toks), 1)
    idf = {w: math.log(1 + n / c) for w, c in df.items()}

    def vec(t):
        v = {w: (1 + math.log(c)) * idf[w] for w, c in t.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {w: x / norm for w, x in v.items()}

    vecs = {i: vec(t) for i, t in toks.items()}

    def family(rid):
        out = {rid}
        cur = by_id.get(rid)
        while cur and cur["parent_id"]:
            out.add(cur["parent_id"])
            cur = by_id.get(cur["parent_id"])
        pid = by_id[rid]["parent_id"]
        out.update(r["id"] for r in rows if r["parent_id"] == pid or r["parent_id"] == rid)
        return out

    out = []
    for a in anchors:
        if a not in vecs:
            continue
        fam = family(a)
        va = vecs[a]
        scored = []
        for i, v in vecs.items():
            if i in fam:
                continue
            small, big = (va, v) if len(va) < len(v) else (v, va)
            s = sum(x * big.get(w, 0.0) for w, x in small.items())
            if s > 0:
                scored.append((s, i))
        scored.sort(key=lambda p: (-p[0], p[1]))
        pins = NEIGHBOUR_PINS.get(a, {})
        pinned_ids = set(pins.values())
        picks = [i for _, i in scored if i not in pinned_ids][: 5 - len(pins)]
        ranked = {}
        it = iter(picks)
        for rank in range(1, 6):
            nid = pins.get(rank) or next(it, None)
            if nid is None or nid not in by_id:
                continue
            ranked[rank] = nid
        for rank, nid in ranked.items():
            out.append({
                "provision_id": a,
                "neighbor_id": nid,
                "score": round(0.88 - 0.02 * rank, 4),
                "rank": rank,
                "created_at": "2026-10-09T00:00:00+00:00",
            })
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--gp05", default=DEFAULT_GP05)
    ap.add_argument("--reg7", default=DEFAULT_REG7)
    ap.add_argument("--overlay", default=DEFAULT_OVERLAY)
    ap.add_argument("--docs-dir", default=DEFAULT_DOCS, help="directory of reg*_parsed.json (every other document)")
    ap.add_argument("--only", default="", help="comma-separated reg keys to keep in full (roots of the rest are kept); default: all")
    ap.add_argument("--no-root-summaries", action="store_true", help="leave document roots without a summary (pending), as the overlay has them")
    ap.add_argument("--out", default=os.path.join(HERE, "generated", "db.json"))
    args = ap.parse_args()

    overlay = load_json(args.overlay, "overlay file")
    gp05_rows = load_json(args.gp05, "gp05 rows")
    reg7_rows = load_json(args.reg7, "reg7 rows")

    docs = {}  # reg_key -> parsed rows
    files = sorted(glob.glob(os.path.join(args.docs_dir, "reg*_parsed.json")))
    if not files:
        print(f"build-fixtures: no reg*_parsed.json in {args.docs_dir}; building GP05 + Regulation 7 only", file=sys.stderr)
    for f in files:
        rows = json.load(open(f, encoding="utf-8"))
        if rows:
            docs[reg_key_of(rows[0]["id"])] = rows
    docs["gp05"] = gp05_rows
    docs["7"] = reg7_rows

    only = {k.strip().lower() for k in args.only.split(",") if k.strip()}
    if only:
        only |= {"gp05", "7"}
        for k in list(docs):
            if k not in only:
                docs[k] = [r for r in docs[k] if r.get("kind") == "root"]

    reg_meta, default_source = import_reg_meta()

    sample_ids = overlay.get("public_ids_outside_gp05_before_sprint7") or FALLBACK_SAMPLE_IDS
    subtree_ids = overlay.get("reg7_public_subtree") or FALLBACK_REG7_SUBTREE
    second_hop_ids = overlay.get("reg7_public_second_hop") or FALLBACK_REG7_SECOND_HOP
    ov_rows = overlay.get("rows", {})
    public_ids = set(sample_ids) | set(subtree_ids) | set(second_hop_ids)

    provisions = []
    seen = set()
    root_source = {}
    for key, rows in sorted(docs.items(), key=lambda kv: kv[0]):
        meta = reg_meta.get(key) or fallback_meta(key)
        root = next((r for r in rows if r.get("kind") == "root"), rows[0])
        root_source[key] = (ov_rows.get(root["id"], {}).get("source_url")) or meta.get("source_url") or default_source
        for r in rows:
            if r["id"] in seen:
                continue
            seen.add(r["id"])
            is_root = r.get("kind") == "root"
            row = {c: None for c in PROVISION_COLUMNS}
            row.update({
                "id": r["id"],
                "citation": r["citation"],
                "title": r["title"],
                "jurisdiction_level": meta.get("jurisdiction_level", "state"),
                "issuing_body": meta.get("issuing_body", "CDPHE-APCD"),
                "parent_id": r.get("parent_id"),
                "full_text": r["full_text"],
                "sort_order": r.get("sort_order", 0),
                "reg_key": key,
                "summary_status": "pending",
                "is_public": key == "gp05" or r["id"] in public_ids,
                "created_at": "2026-09-02T00:00:00+00:00",
                "updated_at": "2026-10-10T00:00:00+00:00",
            })
            if is_root:
                row["source_url"] = root_source[key]
                row["last_verified_date"] = "2026-10-08"
            elif key == "gp05":
                row["source_url"] = root_source[key]  # production's GP05 rows each carry the permit's URL
            ov = ov_rows.get(r["id"])
            if ov:
                for k, v in ov.items():
                    if k in row:
                        row[k] = v
            row["_kind"] = r.get("kind")
            provisions.append(row)

    by_id = {r["id"]: r for r in provisions}
    missing = [i for i in list(ov_rows) + sample_ids + subtree_ids + second_hop_ids if i not in by_id]
    if missing and not only:
        die(f"overlay/sample ids not in the corpus: {missing}")

    # Placeholder approved summaries for the old sample rows (the overlay has none).
    for sid in sample_ids:
        r = by_id.get(sid)
        if r and not r["ai_summary"]:
            r["ai_summary"] = (
                "[Harness placeholder, not a production summary.] This provision is one of the four hand-picked "
                "sample rows that were public before GP05; the harness gives it an approved summary so the "
                "review badge has something to label."
            )
            r["summary_status"] = "approved"
            r["reviewed_by"] = PIPELINE_REVIEWER
            r["reviewed_at"] = "2026-09-15T12:00:00+00:00"

    # Every document root carries an approved summary in production (since 7 Oct 2026; the signed-in
    # spec's "citation of a whole document" test reads Regulation 8's). The overlay holds the two the
    # tour touches; the rest get a placeholder so the whole-document preview has an overview to show.
    if not args.no_root_summaries:
        for r in provisions:
            if r["parent_id"] is None and not r["ai_summary"] and r["id"].startswith("sec-") and "-top-REG-" in r["id"]:
                r["ai_summary"] = (
                    f"[Harness placeholder, not a production summary.] This stands in for the plain-English overview "
                    f"of {r['citation']}. It says nothing about the regulation itself."
                )
                r["summary_status"] = "approved"
                r["reviewed_by"] = PIPELINE_REVIEWER
                r["reviewed_at"] = "2026-10-07T12:00:00+00:00"

    # provision_method_citations: one row per (provision, method) from the importer's xref-method anchors.
    anchor_re = re.compile(r'<a class="xref-method" href="/test-methods/([a-z0-9-]+)"[^>]*>(.*?)</a>', re.S)
    citations = {}
    for r in provisions:
        for slug, text in anchor_re.findall(r["full_text"] or ""):
            citations.setdefault((r["id"], slug), plain(text))
    method_rows = [
        {"provision_id": pid, "method_slug": slug, "raw_text": text, "created_at": "2026-10-09T00:00:00+00:00"}
        for (pid, slug), text in sorted(citations.items())
    ]

    neighbours = build_neighbours(provisions, by_id, [i for i in sample_ids if i in by_id])

    for r in provisions:
        r.pop("_kind", None)

    # Seeded changelog snapshot: counts only, the shape changelog_snapshot_public() returns.
    changelog_rows = [
        {"day": "2026-10-05", "reg_key": "gp05", "change_type": "summary_approved", "provision_count": 4, "latest": "2026-10-05T04:46:13+00:00"},
        {"day": "2026-10-05", "reg_key": "7", "change_type": "summary_approved", "provision_count": 10, "latest": "2026-10-05T04:46:13+00:00"},
        {"day": "2026-10-07", "reg_key": "7", "change_type": "transcription_corrected", "provision_count": 12, "latest": "2026-10-07T19:00:00+00:00"},
        {"day": "2026-10-08", "reg_key": "gp05", "change_type": "links_updated", "provision_count": 6, "latest": "2026-10-08T15:30:00+00:00"},
    ]

    now = "2026-10-10T00:00:00+00:00"
    profile = lambda uid, email, granted: {  # noqa: E731
        "id": uid, "email": email, "access_granted": granted, "created_at": now, "stripe_customer_id": None,
        "stripe_subscription_id": None, "subscription_status": None, "current_period_end": None, "plan": None,
        "cancel_at_period_end": False,
    }
    db = {
        "meta": {
            "generated_by": "e2e/harness/build-fixtures.py",
            "sources": {"gp05": os.path.abspath(args.gp05), "reg7": os.path.abspath(args.reg7),
                        "overlay": os.path.abspath(args.overlay), "docs_dir": os.path.abspath(args.docs_dir)},
            "only": sorted(only),
            "counts": {"provisions": len(provisions), "public": sum(1 for r in provisions if r["is_public"])},
            "subscriber": {"email": SUBSCRIBER_EMAIL, "password": SUBSCRIBER_PASSWORD},
            "visitor": {"email": VISITOR_EMAIL, "password": VISITOR_PASSWORD},
        },
        "schema": SCHEMA,
        "tables": {
            "provisions": provisions,
            "cross_references": [],
            "provision_neighbors": neighbours,
            "profiles": [profile(SUBSCRIBER_ID, SUBSCRIBER_EMAIL, True), profile(VISITOR_ID, VISITOR_EMAIL, False)],
            "regulation_releases": [],
            "tour_events": [],
            "search_queries": [],
            "provision_changes": [],
            "provision_method_citations": method_rows,
        },
        "auth_users": [
            {"id": SUBSCRIBER_ID, "email": SUBSCRIBER_EMAIL, "password": SUBSCRIBER_PASSWORD, "confirmed": True, "created_at": now},
            {"id": VISITOR_ID, "email": VISITOR_EMAIL, "password": VISITOR_PASSWORD, "confirmed": True, "created_at": now},
        ],
        "changelog_snapshot": {"rows": changelog_rows, "computed_at": "2026-10-10T12:00:00+00:00"},
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, separators=(",", ":"))
    c = db["meta"]["counts"]
    print(f"build-fixtures: {c['provisions']} provisions ({c['public']} public), {len(method_rows)} method citations, "
          f"{len(neighbours)} neighbours -> {args.out}")


if __name__ == "__main__":
    main()
