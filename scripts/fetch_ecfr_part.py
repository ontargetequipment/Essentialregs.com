#!/usr/bin/env python3
"""
One whole CFR part, verbatim, from the eCFR versioner, into pipeline/sources/.

    python scripts/fetch_ecfr_part.py --title 43 --part 3160 --date 2026-10-16

downloads

    https://www.ecfr.gov/api/versioner/v1/full/<date>/title-<title>.xml?part=<part>

to pipeline/sources/P<part>.xml (the file the whole-part importer,
pipeline/import_ecfr.py's parse_ecfr_part(), reads) and records what it
served in pipeline/sources/manifest.json under "ecfr_fetches", keyed
"<title>-<part>":

    {"title": "43", "part": "3160", "date": "2026-10-14", "requested_date": "2026-10-16",
     "url": "...", "bytes": 123456, "sha256": "..."}

The record lives beside "sources", not in it: "sources" is what
freshness.py, source_dates.py and changelog_sources.py iterate, and a
document is added there when it is imported, not when its XML is fetched.

Like scripts/fetch_method_sections.py it asks for a gzip response (the
/full/ endpoint answers 406 to a request that does not allow one) and
decompresses it, and when the versioner refuses the requested date (the eCFR
is published a day or two behind) it falls back to the title's
`up_to_date_as_of` from /api/versioner/v1/titles.json, the latest published
date. The file is always re-fetched, even when it is already in the repo.

The body must parse as XML whose root is a <DIV5 TYPE="PART" N="<part>">;
anything else is a hard failure and nothing is written.

Run by .github/workflows/fetch-ecfr-part.yml (www.ecfr.gov is not reachable
from every environment this repo is worked on in).
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "pipeline" / "sources"
MANIFEST = SOURCES / "manifest.json"
USER_AGENT = "EssentialRegsPartFetch/1.0 (+https://essentialregs.com)"
TIMEOUT_SECONDS = 180
VERSIONER = "https://www.ecfr.gov/api/versioner/v1/full/{date}/title-{title}.xml"
TITLES_URL = "https://www.ecfr.gov/api/versioner/v1/titles.json"


class Failure(Exception):
    pass


def part_url(date: str, title: str, part: str) -> str:
    return VERSIONER.format(date=date, title=title) + "?" + urllib.parse.urlencode({"part": part})


def decode_body(data: bytes, content_encoding: str = "") -> bytes:
    """The response body, gunzipped when the server compressed it -- by its
    Content-Encoding header, or by the gzip magic number when a proxy drops
    the header."""
    if content_encoding.lower() == "gzip" or data[:2] == b"\x1f\x8b":
        return gzip.decompress(data)
    return data


def http_get(url: str) -> bytes:
    last: Exception | None = None
    for attempt in range(4):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as r:
                return decode_body(r.read(), r.headers.get("Content-Encoding", ""))
        except urllib.error.HTTPError as e:
            if 400 <= e.code < 500 and e.code != 429:
                raise
            last = e
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
        time.sleep(2 ** (attempt + 1))
    raise last  # type: ignore[misc]


def latest_date(titles_json: bytes, title: str) -> str:
    titles = json.loads(titles_json)
    for t in titles["titles"]:
        if str(t["number"]) == str(title):
            return t["up_to_date_as_of"]
    raise Failure(f"title {title} is not in {TITLES_URL}")


def check_part_xml(data: bytes, part: str) -> None:
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        raise Failure(f"the response is not XML ({e}); first bytes: {data[:120]!r}") from e
    if root.tag != "DIV5" or (root.get("TYPE") or "").upper() != "PART" or root.get("N") != str(part):
        raise Failure(
            f"expected a <DIV5 TYPE=\"PART\" N=\"{part}\"> root, got <{root.tag} "
            f"TYPE={root.get('TYPE')!r} N={root.get('N')!r}>"
        )


def fetch(title: str, part: str, requested: str, get=http_get) -> tuple[str, str, bytes]:
    """(date served, url, body). The requested date when the versioner serves
    it, else the title's latest published date."""
    url = part_url(requested, title, part)
    try:
        return requested, url, get(url)
    except urllib.error.HTTPError as e:
        refused = e
    date = latest_date(get(TITLES_URL), title)
    print(f"the versioner refused {requested} ({refused}); title {title} is up to date as of {date}, so {date} is used")
    url = part_url(date, title, part)
    return date, url, get(url)


def record(manifest_path: Path, title: str, part: str, requested: str, date: str, url: str, data: bytes) -> dict:
    """Writes the fetch record into the manifest, keeping the file's own
    formatting (1-space indent, non-ASCII escaped, trailing newline)."""
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entry = {
        "title": str(title),
        "part": str(part),
        "date": date,
        "requested_date": requested,
        "url": url,
        "file": f"pipeline/sources/P{part}.xml",
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }
    fetches = manifest.setdefault("ecfr_fetches", {})
    fetches[f"{title}-{part}"] = entry
    manifest["ecfr_fetches"] = dict(sorted(fetches.items()))
    manifest_path.write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    return entry


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--title", required=True)
    ap.add_argument("--part", required=True)
    ap.add_argument("--date", required=True, help="YYYY-MM-DD; falls back to the title's latest published date")
    ap.add_argument("--sources", default=str(SOURCES))
    ap.add_argument("--manifest", default=str(MANIFEST))
    args = ap.parse_args(argv)
    try:
        date, url, data = fetch(args.title, args.part, args.date)
        check_part_xml(data, args.part)
    except Failure as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    out = Path(args.sources) / f"P{args.part}.xml"
    out.write_bytes(data)
    entry = record(Path(args.manifest), args.title, args.part, args.date, date, url, data)
    print(f"{out}: {entry['bytes']} bytes, sha256 {entry['sha256']}, eCFR date {date}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
