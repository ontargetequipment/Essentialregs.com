#!/usr/bin/env python3
"""What would a re-import change, link-wise?  (Sprint 2: cross-regulation deep links.)

The importer has no "link-only" mode: a re-import rewrites each changed row's
`full_text`.  This script produces the review document instead.  For each
regulation it takes the parse made by the OLD code (a directory of
`reg<key>_parsed.json` files produced by `import_ccr.py parse` at the parent
commit, or with `--no-corpus-ids`), re-parses the same source with the NEW
code and the corpus id index (in process, recording every cross-regulation
resolution), and reports

  * how many provisions' HTML changed,
  * per resolution kind: exact deep links, trimmed links (nearest existing
    ancestor), part-root fallbacks, regulation-root fallbacks (no link
    emitted; the regulation name already links there), unresolved,
  * proof that NOTHING but link markup changed (tags stripped, text compared),
  * representative before/after snippets and the full unresolved list.

It never touches the database.

    python pipeline/link_change_report.py --old-dir /tmp/old \\
        --regs gp01 gp02 3 7 26 --out pipeline/out/sprint2_link_changes.md
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_ccr as ic  # noqa: E402

SOURCES = Path(__file__).resolve().parent / "sources"
DEFAULT_REGS = ["gp01", "gp02", "gp03", "gp05", "gp06", "gp07", "gp08", "gp09", "gp10", "gp11", "gp12", "3", "7", "26"]
_TAG_RE = re.compile(r"<[^>]+>")
_SPAN_RE = re.compile(r'<span class="xref" data-target="([^"]*)">(.*?)</span>', re.S)
_ANCHOR_RE = re.compile(r'<a class="xref-external-reg"[^>]*href="(/regulations/[^"]*)"[^>]*>(.*?)</a>', re.S)
# The federal subparts in the corpus (acceptance item 2, 7 Oct 2026): links
# to their documents ("/regulations/zzzz") and sections ("/regulations/iiii#sec-iiii-60.4209-(a)").
FEDERAL_KEYS = ("iiii", "jjjj", "zzzz", "ooooa", "oooob", "ooooc")
_FED_HREF_RE = re.compile(r"^/regulations/(" + "|".join(FEDERAL_KEYS) + r")(#.*)?$")
# cfr-bucket entries that name one of the engine / oil-and-gas codes or a
# section in their ranges: "skipped" when the subpart is not in the corpus
# (the original OOOO, a Part 63 coating subpart), "unresolved" when it is
# but the cited section is not in the index.
_FED_BUCKET_RE = re.compile(r"\b(OOOO[abc]?|JJJJ|IIII|ZZZZ)\b|\b6[03]\.\d{4}[a-c]?\b")


def source_basename(reg: str) -> str:
    """Same mapping as .github/workflows/import.yml's "Map reg to source file basename"."""
    fixed = {"cp": "REG_CP", "aqs": "REG_AQS", "sip": "REG_SIP", "proc": "REG_PROC", "ecmc": "ECMC",
             "oooob": "OOOOb", "ooooa": "OOOOa", "ooooc": "OOOOc"}
    if reg in fixed:
        return fixed[reg]
    if reg.isdigit():
        return f"REG_{reg}"
    return reg.upper()


def parse_new(reg: str) -> tuple[list[dict], dict, list]:
    """Re-parse `reg` with the corpus id index active; returns (rows,
    unresolved buckets, cross-reg events)."""
    base = source_basename(reg)
    ic.XREG_EVENTS = []
    try:
        result = ic.parse_reg(reg, str(SOURCES / f"{base}.txt"), str(SOURCES / f"{base}.pdf"))
        # parse_reg may parse Common Provisions on the side (its ids are needed
        # to verify "Common Provisions ..., Section X" links); keep only this
        # regulation's own events.
        events = [e for e in ic.XREG_EVENTS if e[0].startswith(f"sec-{reg}-")]
    finally:
        ic.XREG_EVENTS = None
    return result[0], result[1], events


def visible(text: str) -> str:
    return _TAG_RE.sub("", text or "")


def snippet(old: str, new: str, context: int = 90) -> tuple[str, str]:
    """Both versions around the FIRST change: `context` characters before it,
    through the end of the first new anchor plus `context` after; the old
    window is cut to the same visible text."""
    n = min(len(old), len(new))
    i = 0
    while i < n and old[i] == new[i]:
        i += 1
    lo = max(0, i - context)
    close = new.find("</a>", i)
    new_hi = min(len(new), (close + 4 if close != -1 else i + 60) + context)
    want = visible(new[lo:new_hi])
    j = lo + len(want)
    while j < min(len(old), lo + len(want) + 600) and visible(old[lo:j]) != want:
        j += 1
    return ("..." + old[lo:j] + "..."), ("..." + new[lo:new_hi] + "...")


def pattern_of(kind: str, cited: str) -> str:
    """Group fallbacks by what went wrong, which regulation, and which part."""
    reg = re.search(r"\bRegulation (?:Number |No\.? )?(\d+)", cited)
    part = re.search(r"\bPart ([A-Z])\b", cited)
    return f"{kind} | Regulation {reg.group(1) if reg else '?'} | " + (f"Part {part.group(1)}" if part else "no part named")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--old-dir", required=True, help="Directory of reg<key>_parsed.json made by the OLD code.")
    ap.add_argument("--regs", nargs="*", default=DEFAULT_REGS)
    ap.add_argument("--corpus-ids", default=str(ic.CORPUS_IDS_DEFAULT_PATH))
    ap.add_argument("--new-dir", default=None,
                    help="Optional directory of reg<key>_parsed.json made by the NEW code through the CLI; every "
                         "regulation found there that is not in --regs gets a compact row (changed HTML, deep links, "
                         "visible-text check) in an extra table.")
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    ic.set_corpus_ids(ic.load_corpus_ids(args.corpus_ids))
    # The definitions index beside it, when present: the same term check the
    # importer applies (verify_definition_target), so the report shows the
    # renumbered/mismatch outcomes a real parse would produce.
    defs_path = Path(args.corpus_ids).with_name("corpus_definitions.json")
    ic.set_corpus_definitions(ic.load_corpus_definitions(defs_path) if defs_path.exists() else None)
    old_dir = Path(args.old_dir)

    per_reg: dict[str, dict] = {}
    fed_rows: list[dict] = []  # per-regulation federal subpart link counts (acceptance item 2)
    all_examples: list[tuple[str, str, str, str, str]] = []  # (reg, id, kind, old, new)
    unresolved_all: list[tuple[str, str, str, str, str, int]] = []  # (reg, source id, cited, kind, target, count)
    text_mismatch: list[tuple[str, str]] = []
    pattern_counter: Counter = Counter()
    local_removed: list[tuple[str, str, str, str]] = []  # (reg, provision, target, text): same-document links the new code drops
    local_added: list[tuple[str, str, str, str]] = []

    for reg in args.regs:
        old_rows = {r["id"]: r for r in json.loads((old_dir / f"reg{reg}_parsed.json").read_text(encoding="utf-8"))}
        new_rows_list, _buckets, events = parse_new(reg)
        new_rows = {r["id"]: r for r in new_rows_list}
        assert set(old_rows) == set(new_rows), f"reg {reg}: id sets differ between old and new parse"

        changed = [i for i in new_rows if (old_rows[i]["full_text"] or "") != (new_rows[i]["full_text"] or "")]
        mism = [i for i in changed if visible(old_rows[i]["full_text"]) != visible(new_rows[i]["full_text"])]
        text_mismatch.extend((reg, i) for i in mism)
        other_fields = [i for i in new_rows
                        if any(old_rows[i].get(k) != new_rows[i].get(k) for k in new_rows[i] if k != "full_text")]

        for pid in changed:
            o_sp = Counter(_SPAN_RE.findall(old_rows[pid]["full_text"] or ""))
            n_sp = Counter(_SPAN_RE.findall(new_rows[pid]["full_text"] or ""))
            local_removed.extend((reg, pid, t, x) for (t, x), c in (o_sp - n_sp).items() for _ in range(c))
            local_added.extend((reg, pid, t, x) for (t, x), c in (n_sp - o_sp).items() for _ in range(c))
        kinds = Counter(k for _, _, k, _ in events)
        old_anchors = sum(len(_ANCHOR_RE.findall(r["full_text"] or "")) for r in old_rows.values())
        new_anchors = sum(len(_ANCHOR_RE.findall(r["full_text"] or "")) for r in new_rows.values())
        deep = sum(1 for r in new_rows.values() for m in _ANCHOR_RE.finditer(r["full_text"] or "") if "#" in m.group(1))
        cp_deep = sum(1 for r in new_rows.values() for m in _ANCHOR_RE.finditer(r["full_text"] or "")
                      if m.group(1).startswith("/regulations/cp#"))
        per_reg[reg] = dict(
            rows=len(new_rows), changed=len(changed), mismatch=len(mism), other_fields=len(other_fields),
            exact=kinds["exact"], trimmed=kinds["trimmed"], part_root=kinds["part_root"], part_cited=kinds["part_cited"],
            reg_root=kinds["reg_root"], unresolved=kinds["unresolved"],
            old_anchors=old_anchors, new_anchors=new_anchors, deep=deep, cp_deep=cp_deep,
        )

        # one example per (reg, kind-of-first-change) pool; chosen later
        by_kind: dict[str, list] = defaultdict(list)
        for pid in changed:
            ev = [e for e in events if e[0] == pid]
            kind = ev[0][2] if ev else "cp"
            by_kind[kind].append(pid)
        rng = random.Random(f"{args.seed}-{reg}")
        for kind, pids in by_kind.items():
            for pid in rng.sample(pids, min(3, len(pids))):
                all_examples.append((reg, pid, kind, old_rows[pid]["full_text"], new_rows[pid]["full_text"]))

        for key, cnt in _buckets[ic.BUCKET_CROSS_REG].items():
            src, cited, kind, target = key.split("\t")
            unresolved_all.append((reg, src, cited, kind, target, cnt))

        # Federal subpart links: documents and sections, old -> new, per target, plus
        # the cfr-bucket entries about those subparts (skipped / unresolved).
        def fed_counts(rows):
            docs, secs = Counter(), Counter()
            for r in rows.values():
                for m in _ANCHOR_RE.finditer(r["full_text"] or ""):
                    fm = _FED_HREF_RE.match(m.group(1))
                    if fm:
                        (secs if fm.group(2) else docs)[fm.group(1)] += 1
            return docs, secs
        o_docs, o_secs = fed_counts(old_rows)
        n_docs, n_secs = fed_counts(new_rows)
        fed_rows_changed = sum(
            1 for i in changed
            if any(_FED_HREF_RE.match(a) for a, _ in _ANCHOR_RE.findall(new_rows[i]["full_text"] or ""))
            or any(_FED_HREF_RE.match(a) for a, _ in _ANCHOR_RE.findall(old_rows[i]["full_text"] or "")))
        skipped, unresolved = Counter(), Counter()
        for key, cnt in _buckets[ic.BUCKET_CFR].items():
            if not _FED_BUCKET_RE.search(key):
                continue
            sm = re.search(r"\b(6[03])\.(\d{4})([a-c])?\b", key)
            if sm and ic.cfr_section_regkey(sm.group(1), sm.group(2), sm.group(3)) in ic.CORPUS_REGS:
                unresolved[key] += cnt
            else:
                skipped[key] += cnt
        fed_rows.append(dict(reg=reg, rows_changed=fed_rows_changed, o_docs=o_docs, n_docs=n_docs, o_secs=o_secs, n_secs=n_secs,
                             skipped=skipped, unresolved=unresolved))
        print(f"reg {reg}: {len(changed)}/{len(new_rows)} rows changed, kinds {dict(kinds)}, "
              f"federal links {sum(o_docs.values()) + sum(o_secs.values())} -> {sum(n_docs.values()) + sum(n_secs.values())}", file=sys.stderr)

    # ---- report ---------------------------------------------------------
    L: list[str] = []
    L.append("# Sprint 2 link changes: cross-regulation deep links\n")
    L.append("Generated by `pipeline/link_change_report.py` (no database access): OLD = the importer before this change "
             "(parse at the parent commit), NEW = this branch with `pipeline/out/corpus_ids.json`. Only the HTML "
             "of `full_text` can differ; ids, citations, titles, parents and sort order are compared too (column "
             "\"other fields\").\n")
    L.append("## Per regulation\n")
    L.append("| reg | rows | rows with changed HTML | exact deep links | trimmed | part-root fallback | part cited alone | reg-root fallback (no link) | unresolved (no link) | external anchors old -> new | text changed beyond link markup | other fields changed |")
    L.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
    tot = Counter()
    for reg, d in per_reg.items():
        L.append(f"| {reg} | {d['rows']} | {d['changed']} | {d['exact']} | {d['trimmed']} | {d['part_root']} | {d['part_cited']} | "
                 f"{d['reg_root']} | {d['unresolved']} | {d['old_anchors']} -> {d['new_anchors']} | {d['mismatch']} | {d['other_fields']} |")
        for k, v in d.items():
            tot[k] += v
    L.append(f"| **total** | {tot['rows']} | {tot['changed']} | {tot['exact']} | {tot['trimmed']} | {tot['part_root']} | {tot['part_cited']} | "
             f"{tot['reg_root']} | {tot['unresolved']} | {tot['old_anchors']} -> {tot['new_anchors']} | {tot['mismatch']} | {tot['other_fields']} |\n")
    L.append("Columns: *exact* = the cited provision exists and is linked as `/regulations/<key>#<id>`; *trimmed* = it "
             "does not exist, linked to its nearest existing ancestor; *part-root fallback* = linked to the cited part's root; "
             "*part cited alone* = text names only a part (\"Regulation Number 3, Part C\") and links to that part root; "
             "*reg-root fallback* = only the regulation root was left, so the section text is NOT linked (the "
             "regulation name already links there); *unresolved* = not even a root exists in the index.\n")
    cp_total = sum(d["cp_deep"] for d in per_reg.values())
    L.append(f"Common Provisions section links that gained a `#sec-cp-...` hash in these regulations: {cp_total}.\n")

    if args.new_dir:
        L.append("## Every other regulation (compact)\n")
        L.append("Parsed through the CLI by the new code with the committed index; same checks, no per-kind split.\n")
        L.append("| reg | rows | rows with changed HTML | deep-link anchors now | same-document links removed | same-document links added | text changed beyond link markup |")
        L.append("|---|---|---|---|---|---|---|")
        other_tot = Counter()
        for f in sorted(Path(args.new_dir).glob("reg*_parsed.json"), key=lambda p: p.name):
            reg = f.name[3:-len("_parsed.json")]
            if reg in args.regs or not (old_dir / f.name).exists():
                continue
            o = {r["id"]: r for r in json.loads((old_dir / f.name).read_text(encoding="utf-8"))}
            n = {r["id"]: r for r in json.loads(f.read_text(encoding="utf-8"))}
            assert set(o) == set(n), f"reg {reg}: id sets differ"
            ch = [i for i in n if (o[i]["full_text"] or "") != (n[i]["full_text"] or "")]
            mism = [i for i in ch if visible(o[i]["full_text"]) != visible(n[i]["full_text"])]
            deep_n = sum(1 for r in n.values() for m in _ANCHOR_RE.finditer(r["full_text"] or "") if "#" in m.group(1))
            text_mismatch.extend((reg, i) for i in mism)
            sidecar = f.with_name(f.name[:-len(".json")] + "_unresolved.json")
            if sidecar.exists():
                for key, cnt in json.loads(sidecar.read_text(encoding="utf-8")).get(ic.BUCKET_CROSS_REG, []):
                    src, cited, kind, target = key.split("\t")
                    unresolved_all.append((reg, src, cited, kind, target, cnt))
            rem = add = 0
            for i in ch:
                o_sp = Counter(_SPAN_RE.findall(o[i]["full_text"] or ""))
                n_sp = Counter(_SPAN_RE.findall(n[i]["full_text"] or ""))
                rem += sum((o_sp - n_sp).values())
                add += sum((n_sp - o_sp).values())
            L.append(f"| {reg} | {len(n)} | {len(ch)} | {deep_n} | {rem} | {add} | {len(mism)} |")
            other_tot.update(rows=len(n), changed=len(ch), deep=deep_n, mism=len(mism), rem=rem, add=add)
        L.append(f"| **total** | {other_tot['rows']} | {other_tot['changed']} | {other_tot['deep']} | {other_tot['rem']} | {other_tot['add']} | {other_tot['mism']} |\n")

    L.append("## Federal subpart links (acceptance item 2, 7 Oct 2026)\n")
    L.append("Links to the corpus's 40 CFR Part 60 / 63 subpart documents and their sections, per citing regulation, "
             "OLD -> NEW. *skipped* = citations of a subpart that is not in the corpus (the original Subpart OOOO; a Part "
             "63 subpart other than ZZZZ, including Regulation 8's coating-rule Subparts IIII / JJJJ / OOOO, which the old "
             "code linked to the Part 60 engine rules), counted in the cfr bucket and left as text; *unresolved* = a section "
             "number inside a corpus subpart's range that the corpus index does not hold (linked to nothing). Only regulations "
             "with at least one such link or count are listed.\n")
    L.append("| reg | rows whose federal links changed | document links old -> new | section links old -> new | new links by target | skipped (not in corpus) | unresolved |")
    L.append("|---|---|---|---|---|---|---|")
    ftot = Counter()
    for d in fed_rows:
        od, nd, os_, ns = sum(d["o_docs"].values()), sum(d["n_docs"].values()), sum(d["o_secs"].values()), sum(d["n_secs"].values())
        sk, un = sum(d["skipped"].values()), sum(d["unresolved"].values())
        if not (od or nd or os_ or ns or sk or un):
            continue
        by_target = ", ".join(f"{k} {d['n_docs'][k] + d['n_secs'][k]}" for k in FEDERAL_KEYS if d["n_docs"][k] + d["n_secs"][k])
        sk_s = "; ".join(f"{k} ×{c}" for k, c in d["skipped"].most_common(8)) + (" …" if len(d["skipped"]) > 8 else "")
        un_s = "; ".join(f"{k} ×{c}" for k, c in d["unresolved"].most_common(8)) + (" …" if len(d["unresolved"]) > 8 else "")
        L.append(f"| {d['reg']} | {d['rows_changed']} | {od} -> {nd} | {os_} -> {ns} | {by_target} | {sk} {('(' + sk_s + ')') if sk else ''} | {un} {('(' + un_s + ')') if un else ''} |")
        ftot.update(od=od, nd=nd, os=os_, ns=ns, sk=sk, un=un, rows=d["rows_changed"])
    L.append(f"| **total** | {ftot['rows']} | {ftot['od']} -> {ftot['nd']} | {ftot['os']} -> {ftot['ns']} |  | {ftot['sk']} | {ftot['un']} |\n")

    L.append("## Same-document links the new code removes (mis-bound tails)\n")
    L.append("A `<span class=\"xref\" data-target=...>` (a link to the CITING document's own provision) that the old parse "
             "emitted and the new parse does not: the tail of a cross-regulation citation (\"and Section II.C.\", or the "
             "\"Part B\" of \"Regulation 7 Part B, ...\") that the old code bound to the wrong document. Same-document "
             "links the new code ADDS: **" + str(len(local_added)) + "**.\n")
    L.append(f"Removed: **{len(local_removed)}**\n")
    if local_removed:
        L.append("| reg | provision | removed link text | pointed at (this document) |")
        L.append("|---|---|---|---|")
        for reg, pid, t, x in local_removed:
            L.append(f"| {reg} | `{pid}` | {re.sub(r'<[^>]+>', '', x)} | `{t}` |")
        L.append("")

    L.append("## Visible-text check\n")
    if text_mismatch:
        L.append(f"**{len(text_mismatch)} provision(s) differ in visible text (tags stripped) between old and new:**\n")
        for reg, pid in text_mismatch[:50]:
            L.append(f"- {reg} `{pid}`")
        L.append("")
    else:
        L.append("For every provision in these regulations whose HTML changed, the text with all tags stripped is "
                 "**identical** to the old parse (exact string comparison, whitespace included). The id set, citations, "
                 "titles, parents and sort order are also identical (column \"other fields\" is zero where shown).\n")

    L.append("## 15 representative before / after snippets\n")
    rng = random.Random(args.seed)
    # spread across kinds first, then fill
    pool = list(all_examples)
    rng.shuffle(pool)
    picked: list = []
    seen_kinds: Counter = Counter()
    for ex in pool:
        if seen_kinds[ex[2]] < 3 and len(picked) < 15:
            picked.append(ex)
            seen_kinds[ex[2]] += 1
    for ex in pool:
        if len(picked) >= 15:
            break
        if ex not in picked:
            picked.append(ex)
    for n, (reg, pid, kind, old, new) in enumerate(picked, 1):
        o, w = snippet(old, new)
        L.append(f"**{n}. {reg} `{pid}` ({kind})**\n")
        L.append("Before:\n```html\n" + o + "\n```\nAfter:\n```html\n" + w + "\n```\n")

    L.append("## Unresolved / fallback cross-regulation citations\n")
    for reg, src, cited, kind, target, cnt in unresolved_all:
        pattern_counter[pattern_of(kind, cited)] += cnt
    scope_n = sum(c for r, *_x, c in unresolved_all if r in args.regs)
    L.append(f"Total: **{sum(c for *_x, c in unresolved_all)}** mentions in **{len(unresolved_all)}** distinct (source provision, citation) "
             f"records across the whole corpus ({scope_n} mentions in the regulations tabled above). Every cite that was trimmed or fell "
             f"back to a part root or regulation root, or could not be resolved, is listed; the exact deep links are not.\n")
    L.append("### Most common patterns\n")
    L.append("| mentions | pattern (resolution : detail, cited regulation, cited part) |")
    L.append("|---|---|")
    for pat, cnt in pattern_counter.most_common(10):
        L.append(f"| {cnt} | `{pat}` |")
    L.append("")
    L.append("### Full list\n")
    L.append("| citing reg | source provision | citation as printed | resolution | resolved to | mentions |")
    L.append("|---|---|---|---|---|---|")
    for reg, src, cited, kind, target, cnt in sorted(unresolved_all):
        L.append(f"| {reg} | `{src}` | {cited} | {kind} | {('`' + target + '`') if target else '(no link)'} | {cnt} |")
    L.append("")
    Path(args.out).write_text("\n".join(L), encoding="utf-8")
    print(f"wrote {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
