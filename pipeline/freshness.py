#!/usr/bin/env python3
"""
freshness.py -- source-freshness watcher for the essentialregs.com corpus.

Checks each source document recorded in sources/manifest.json against its
live upstream (Colorado SOS CCR rules, eCFR subparts, CDPHE general air
permits) and reports whether the version we imported is still current.

Usage:
    python freshness.py check                       # fetch live, print report, exit 1 on change
    python freshness.py check --fixtures DIR         # read saved HTML/JSON from DIR instead of the network
    python freshness.py --update-manifest KEY        # record current upstream values for KEY
    python freshness.py --update-manifest KEY --fixtures DIR   # same, from fixtures (for tests)

Exit codes (for `check`):
    0  -- no changes detected (some sources may have errored -- see the report)
    1  -- at least one source changed (a real upstream update was found)

Never writes secrets. Makes exactly one HTTP request per source it needs
to reach live (one page load per SOS rule, one API call per eCFR subpart,
one page load for the whole CDPHE general-permits page).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

USER_AGENT = "EssentialRegsFreshnessBot/1.0 (+https://essentialregs.com; contact: brodykerr95@gmail.com)"
TIMEOUT_SECONDS = 10

HERE = Path(__file__).resolve().parent
DEFAULT_MANIFEST = HERE / "sources" / "manifest.json"

SOS_URL_TMPL = (
    "https://www.sos.state.co.us/CCR/DisplayRule.do"
    "?action=ruleinfo&ruleId={ruleId}&deptID={deptID}&agencyID={agencyID}"
)
ECFR_VERSIONS_URL_TMPL = (
    "https://www.ecfr.gov/api/versioner/v1/versions/title-{title}.json"
    "?part={part}&subpart={subpart}"
)
ECFR_FULL_URL_TMPL = (
    "https://www.ecfr.gov/api/versioner/v1/full/{today}/title-{title}.xml"
    "?part={part}&subpart={subpart}"
)

# Browser-like headers for the CDPHE general-permits page only -- the CDPHE
# site returns HTTP 403 to USER_AGENT (a plain bot UA) from the GitHub
# Actions runner. SOS and eCFR keep using USER_AGENT; this is deliberately
# separate so their fetches are byte-for-byte unaffected.
CDPHE_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def ecfr_versions_url(title: str, part: str, subpart: Optional[str] = None) -> str:
    """The eCFR versioner /versions/ URL for a title/part, with &subpart=
    included only when subpart is truthy -- a whole-PART reg (p191/p192,
    subpart null/absent) has no subpart to filter on and must not send an
    empty '&subpart=' query param."""
    url = f"https://www.ecfr.gov/api/versioner/v1/versions/title-{title}.json?part={part}"
    if subpart:
        url += f"&subpart={subpart}"
    return url


def ecfr_full_url(today: str, title: str, part: str, subpart: Optional[str] = None) -> str:
    """Same &subpart= rule as ecfr_versions_url, for the /full/ XML fallback."""
    url = f"https://www.ecfr.gov/api/versioner/v1/full/{today}/title-{title}.xml?part={part}"
    if subpart:
        url += f"&subpart={subpart}"
    return url


STATUS_OK = "✅"       # unchanged
STATUS_CHANGED = "\U0001F514"  # bell -- upstream update detected
STATUS_ERROR = "⚠️"  # warning -- couldn't check
STATUS_BLOCKED = "⛔"  # distinct from STATUS_ERROR -- upstream returned HTTP
                        # 403 to the runner (e.g. CDPHE); neither "unchanged"
                        # nor "couldn't parse/reach", so it gets its own
                        # bucket in the summary heading instead of inflating
                        # the error count on an otherwise-clean run.


@dataclass
class CheckResult:
    key: str
    source: str
    ours: str
    theirs: str
    status: str  # one of STATUS_OK / STATUS_CHANGED / STATUS_ERROR
    detail: str = ""


@dataclass
class Fetcher:
    """Wraps HTTP GETs so tests can substitute fixture files with no network."""

    fixtures_dir: Optional[Path] = None
    _fixture_map: dict = field(default_factory=dict)
    _error_map: dict = field(default_factory=dict)

    def register_fixture(self, url_or_label: str, path: Path) -> None:
        self._fixture_map[url_or_label] = path

    def register_error(self, url_or_label: str, exc: BaseException) -> None:
        """Test hook: make get_text(url_or_label) raise `exc` instead of
        reading a fixture or hitting the network -- e.g. a 403 HTTPError,
        to prove STATUS_BLOCKED handling without a live CDPHE fetch."""
        self._error_map[url_or_label] = exc

    def get_text(self, url: str, fixture_name: Optional[str] = None,
                 headers: Optional[dict] = None) -> str:
        if url in self._error_map:
            raise self._error_map[url]
        if self.fixtures_dir is not None:
            # A URL registered explicitly (register_fixture) wins over the
            # caller's default fixture_name, so tests can point a specific
            # source URL at a specific fixture file without changing the
            # production code path's default naming convention.
            name = self._fixture_map.get(url) or fixture_name
            if name is None:
                raise FileNotFoundError(
                    f"No fixture registered for {url!r} (fixtures mode, no network allowed)"
                )
            path = self.fixtures_dir / name if isinstance(name, str) else name
            return Path(path).read_text(encoding="utf-8")
        req = urllib.request.Request(url, headers=headers or {"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            return resp.read().decode("utf-8", errors="replace")


def load_manifest(path: Path = DEFAULT_MANIFEST) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_manifest(manifest: dict, path: Path = DEFAULT_MANIFEST) -> None:
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# SOS (Colorado Secretary of State CCR rules)
# ---------------------------------------------------------------------------

_OPEN_RULE_WINDOW_RE = re.compile(
    r"OpenRuleWindow\(\s*'(?P<rvid>[^']+)'\s*,\s*'(?P<name>[^']*)'\s*\)"
)
_DATE_RE = re.compile(r"\d{2}/\d{2}/\d{4}")


def parse_sos_page(html: str) -> tuple[Optional[str], Optional[str]]:
    """Return (ruleVersionId, effective_date MM/DD/YYYY) for the first
    OpenRuleWindow(...) occurrence and the first date after it."""
    m = _OPEN_RULE_WINDOW_RE.search(html)
    if not m:
        return None, None
    rvid = m.group("rvid")
    tail = html[m.end():]
    dm = _DATE_RE.search(tail)
    eff = dm.group(0) if dm else None
    return rvid, eff


def _mmddyyyy_to_iso(s: str) -> str:
    mm, dd, yyyy = s.split("/")
    return f"{yyyy}-{mm}-{dd}"


def check_sos(key: str, entry: dict, fetcher: Fetcher) -> CheckResult:
    rule_id = entry["ruleId"]
    dept_id = entry.get("deptID", "16")
    agency_id = entry.get("agencyID", "7")
    url = SOS_URL_TMPL.format(ruleId=rule_id, deptID=dept_id, agencyID=agency_id)
    source_label = f"SOS {entry.get('ccr', rule_id)}"
    ours = entry.get("ruleVersionId", "")

    try:
        html = fetcher.get_text(url, fixture_name=f"sos_{key}.html")
    except Exception as exc:  # noqa: BLE001 -- report, don't crash
        return CheckResult(key, source_label, ours, "?", STATUS_ERROR, f"fetch error: {exc}")

    rvid, eff = parse_sos_page(html)
    if rvid is None:
        return CheckResult(
            key, source_label, ours, "?", STATUS_ERROR,
            "could not find OpenRuleWindow(...) in page HTML",
        )

    theirs_label = rvid if eff is None else f"{rvid} (eff {eff})"
    if rvid == ours:
        return CheckResult(key, source_label, ours, theirs_label, STATUS_OK)
    return CheckResult(key, source_label, ours, theirs_label, STATUS_CHANGED)


# ---------------------------------------------------------------------------
# eCFR subparts
# ---------------------------------------------------------------------------


def check_ecfr(key: str, entry: dict, fetcher: Fetcher) -> CheckResult:
    title = entry["title"]
    part = entry["part"]
    subpart = entry.get("subpart")
    as_of = entry["as_of"]
    source_label = (
        f"eCFR {title} CFR {part} subpart {subpart}" if subpart
        else f"eCFR {title} CFR Part {part}"
    )
    url = ecfr_versions_url(title, part, subpart)

    try:
        raw = fetcher.get_text(url, fixture_name=f"ecfr_{key}.json")
    except Exception as exc:  # noqa: BLE001
        return CheckResult(key, source_label, as_of, "?", STATUS_ERROR, f"fetch error: {exc}")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        return CheckResult(key, source_label, as_of, "?", STATUS_ERROR, f"bad JSON: {exc}")

    versions = data.get("content_versions") or []
    if not versions:
        return CheckResult(
            key, source_label, as_of, "?", STATUS_ERROR,
            "versioner API returned no content_versions (fallback to /full/ XML hash not implemented in this run)",
        )

    latest = None
    for v in versions:
        d = v.get("amendment_date") or v.get("date")
        if d and (latest is None or d > latest):
            latest = d

    if latest is None:
        return CheckResult(
            key, source_label, as_of, "?", STATUS_ERROR,
            "no date/amendment_date field found on any content_version entry",
        )

    if latest > as_of:
        return CheckResult(key, source_label, as_of, latest, STATUS_CHANGED)
    return CheckResult(key, source_label, as_of, latest, STATUS_OK)


def ecfr_xml_sha256(xml_text: str) -> str:
    return hashlib.sha256(xml_text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# CDPHE general air permits
# ---------------------------------------------------------------------------


def parse_cdphe_page(html: str) -> dict[str, str]:
    """Return {GPnn (lowercase, e.g. 'gp01'): docid} for every GP row found
    on the general-air-permits page, by scanning for OnBase docid links near
    a 'GP##' label. Best-effort regex parse -- the page is not a clean API."""
    found: dict[str, str] = {}
    # Look for patterns like GP01 ... docid=11306933 (order/spacing between
    # the label and the docid is not guaranteed, so scan windows around each
    # GP label rather than requiring an exact adjacency).
    for m in re.finditer(r"GP\s*-?\s*0*?(\d{1,2})\b", html, re.IGNORECASE):
        num = int(m.group(1))
        gp_key = f"gp{num:02d}"
        if gp_key in found:
            continue
        window = html[m.start(): m.start() + 400]
        dm = re.search(r"docid=(\d+)", window, re.IGNORECASE)
        if dm:
            found[gp_key] = dm.group(1)
    return found


def check_cdphe_gp(key: str, entry: dict, fetcher: Fetcher) -> list[CheckResult]:
    url = entry["page_url"]
    permits = entry["permits"]
    source_label = "CDPHE general air permits page"

    try:
        html = fetcher.get_text(url, fixture_name="cdphe_gp.html", headers=CDPHE_BROWSER_HEADERS)
    except urllib.error.HTTPError as exc:
        if exc.code == 403:
            # One line for the whole page fetch, not one per permit -- a
            # blocked run should not read as 11 separate failures.
            return [
                CheckResult(key, source_label, f"{len(permits)} permits", "?", STATUS_BLOCKED,
                             "not checked (CDPHE blocked the runner, HTTP 403)")
            ]
        return [
            CheckResult(f"{key}:{gp}", source_label, p["docid"], "?", STATUS_ERROR, f"fetch error: {exc}")
            for gp, p in permits.items()
        ]
    except Exception as exc:  # noqa: BLE001
        return [
            CheckResult(f"{key}:{gp}", source_label, p["docid"], "?", STATUS_ERROR, f"fetch error: {exc}")
            for gp, p in permits.items()
        ]

    live = parse_cdphe_page(html)
    results: list[CheckResult] = []

    for gp, p in permits.items():
        ours = p["docid"]
        theirs = live.get(gp)
        if theirs is None:
            results.append(
                CheckResult(f"{key}:{gp}", source_label, ours, "missing", STATUS_CHANGED,
                             f"{gp.upper()} row/docid no longer found on the page")
            )
        elif theirs != ours:
            results.append(CheckResult(f"{key}:{gp}", source_label, ours, theirs, STATUS_CHANGED))
        else:
            results.append(CheckResult(f"{key}:{gp}", source_label, ours, theirs, STATUS_OK))

    new_gps = sorted(set(live) - set(permits))
    for gp in new_gps:
        results.append(
            CheckResult(f"{key}:{gp}", source_label, "(not in manifest)", live[gp], STATUS_CHANGED,
                         f"new permit {gp.upper()} found on the page, not yet imported")
        )

    return results


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def run_check(manifest: dict, fetcher: Fetcher, only_key: Optional[str] = None) -> list[CheckResult]:
    results: list[CheckResult] = []
    for key, entry in manifest.get("sources", {}).items():
        if key.startswith("_"):
            continue
        if only_key is not None and key != only_key:
            continue
        kind = entry.get("kind")
        if kind == "sos":
            results.append(check_sos(key, entry, fetcher))
        elif kind == "ecfr":
            results.append(check_ecfr(key, entry, fetcher))
        elif kind == "cdphe_gp":
            results.extend(check_cdphe_gp(key, entry, fetcher))
        else:
            results.append(CheckResult(key, "unknown", "?", "?", STATUS_ERROR, f"unknown kind {kind!r}"))
    return results


def render_report(results: list[CheckResult]) -> str:
    lines = [
        "# Source freshness report",
        "",
        "| key | source | ours | theirs | status |",
        "|---|---|---|---|---|",
    ]
    for r in results:
        detail = f" ({r.detail})" if r.detail else ""
        lines.append(f"| {r.key} | {r.source} | {r.ours} | {r.theirs}{detail} | {r.status} |")

    ok = [r for r in results if r.status == STATUS_OK]
    changed = [r for r in results if r.status == STATUS_CHANGED]
    errored = [r for r in results if r.status == STATUS_ERROR]
    blocked = [r for r in results if r.status == STATUS_BLOCKED]
    lines.append("")
    if changed:
        lines.append(f"**{len(changed)} source(s) changed:** " + ", ".join(r.key for r in changed))
    elif blocked:
        # Neither "changed" nor "error" -- a run that is otherwise clean
        # should read as clean, not as a failure, when the only thing to
        # report is a known, expected block (e.g. CDPHE's runner 403).
        lines.append(f"{len(ok)} unchanged · {len(blocked)} not checked (blocked).")
    else:
        lines.append("No changes detected.")
    if errored:
        lines.append(f"**{len(errored)} source(s) could not be checked:** " + ", ".join(r.key for r in errored))
    if blocked:
        lines.append(
            f"**{len(blocked)} source(s) not checked (blocked):** " + ", ".join(r.key for r in blocked)
        )
    return "\n".join(lines) + "\n"


def cmd_check(args: argparse.Namespace) -> int:
    manifest_path = Path(args.manifest)
    manifest = load_manifest(manifest_path)
    fetcher = Fetcher(fixtures_dir=Path(args.fixtures) if args.fixtures else None)

    results = run_check(manifest, fetcher)
    report = render_report(results)
    print(report)

    summary_path = args.step_summary
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write(report)

    return 1 if any(r.status == STATUS_CHANGED for r in results) else 0


def cmd_update_manifest(args: argparse.Namespace) -> int:
    manifest_path = Path(args.manifest)
    manifest = load_manifest(manifest_path)
    key = args.update_manifest
    sources = manifest.get("sources", {})
    if key not in sources:
        print(f"error: key {key!r} not found in manifest", file=sys.stderr)
        return 2

    entry = sources[key]
    fetcher = Fetcher(fixtures_dir=Path(args.fixtures) if args.fixtures else None)
    kind = entry.get("kind")

    if kind == "sos":
        url = SOS_URL_TMPL.format(
            ruleId=entry["ruleId"], deptID=entry.get("deptID", "16"), agencyID=entry.get("agencyID", "7")
        )
        html = fetcher.get_text(url, fixture_name=f"sos_{key}.html")
        rvid, eff = parse_sos_page(html)
        if rvid is None:
            print("error: could not find OpenRuleWindow(...) in the fetched page", file=sys.stderr)
            return 2
        entry["ruleVersionId"] = rvid
        if eff:
            entry["effective_date"] = _mmddyyyy_to_iso(eff)
        print(f"{key}: ruleVersionId -> {rvid}" + (f", effective_date -> {entry['effective_date']}" if eff else ""))

    elif kind == "ecfr":
        url = ecfr_versions_url(entry["title"], entry["part"], entry.get("subpart"))
        raw = fetcher.get_text(url, fixture_name=f"ecfr_{key}.json")
        data = json.loads(raw)
        versions = data.get("content_versions") or []
        latest = None
        for v in versions:
            d = v.get("amendment_date") or v.get("date")
            if d and (latest is None or d > latest):
                latest = d
        if latest is None:
            print("error: no content_versions with a usable date found", file=sys.stderr)
            return 2
        entry["as_of"] = latest
        print(f"{key}: as_of -> {latest}")

    elif kind == "cdphe_gp":
        html = fetcher.get_text(entry["page_url"], fixture_name="cdphe_gp.html")
        live = parse_cdphe_page(html)
        for gp, docid in live.items():
            entry["permits"].setdefault(gp, {})["docid"] = docid
        print(f"{key}: updated docids for {', '.join(sorted(live))}")

    else:
        print(f"error: unknown kind {kind!r} for key {key!r}", file=sys.stderr)
        return 2

    save_manifest(manifest, manifest_path)
    print(f"Wrote {manifest_path}")
    return 0


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("command", nargs="?", default="check", choices=["check"],
                   help="'check' (default) fetches and compares all sources")
    p.add_argument("--manifest", default=str(DEFAULT_MANIFEST), help="path to manifest.json")
    p.add_argument("--fixtures", default=None, help="directory of saved HTML/JSON fixtures instead of the network")
    p.add_argument("--update-manifest", metavar="KEY", default=None,
                   help="record current upstream values for one manifest key instead of running a full check")
    p.add_argument("--step-summary", default=None,
                   help="append the markdown report to this file (e.g. $GITHUB_STEP_SUMMARY)")
    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)
    if args.update_manifest:
        return cmd_update_manifest(args)
    return cmd_check(args)


if __name__ == "__main__":
    sys.exit(main())
