#!/usr/bin/env python3
"""
changelog_sources.py -- what an executed import tells the public changelog.

/changelog's "Regulatory changes" section lists only changes that come from
the agency (owner decision, 7 Oct 2026): an import where the source
document's version or effective date changed, and the provisions it added
or removed. Every other text change is ours -- a correction of our copy of
the text to match the official source -- and belongs under "Links, sources
and transcription".

The database trigger logs every full_text change as `text_updated` (visible
letters or digits changed) or `links_updated` (markup only); the importer
logs `added` and `removed` rows itself. After the writes, the importer calls
finalize_import_changelog(), which:

  1. reads the version we now hold from pipeline/sources/manifest.json
     (source_version_of) and the version recorded in public.source_versions;
  2. when they differ, logs one `source_version_changed` row against the
     regulation root (note: old -> new) and records the new version; the
     run's text_updated / added / removed rows stay regulatory;
  3. otherwise re-labels the run's text_updated rows as
     `transcription_corrected` and its added / removed rows the same way,
     so the public page never calls our own fix an agency change;
  4. refreshes the changelog snapshot (refresh_changelog_snapshot(), see
     supabase/migrations/20261007121000_changelog_snapshot.sql).

A regulation with no manifest entry or no recorded version is treated as
"no version change" (the first record is written, nothing is logged): an
agency change is only ever claimed when both sides are known.

Pure parts (source_version_of, version_note) are tested without a database;
finalize_import_changelog() is tested with a fake client.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

HERE = Path(__file__).resolve().parent
DEFAULT_MANIFEST = HERE / "sources" / "manifest.json"

# The change types the trigger or the importer wrote during one run that are
# regulatory only when the source version changed.
RUN_REGULATORY_TYPES = ("text_updated", "added", "removed")


def load_manifest(path: Path = DEFAULT_MANIFEST) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def source_version_of(manifest: dict, reg: str) -> Optional[dict[str, Optional[str]]]:
    """The version of `reg` the manifest records, as {"version": str,
    "effective_date": "YYYY-MM-DD" | None}, or None when the manifest has
    no usable entry. The version string is what source_versions stores and
    what the source_version_changed note quotes:

        sos       "effective 2026-07-15 (SOS ruleVersionId 12621)"
        ecfr      "eCFR as of 2026-09-10"
        cdphe_gp  "issuance 6, 2025-07-23 (CDPHE docid 11306933)"
    """
    sources = (manifest or {}).get("sources") or {}
    key = (reg or "").lower()
    entry = sources.get(key)
    if entry:
        kind = entry.get("kind")
        if kind == "sos" and entry.get("effective_date"):
            return {
                "version": f"effective {entry['effective_date']} (SOS ruleVersionId {entry.get('ruleVersionId') or '?'})",
                "effective_date": entry["effective_date"],
            }
        if kind == "ecfr" and entry.get("as_of"):
            return {"version": f"eCFR as of {entry['as_of']}", "effective_date": entry["as_of"]}
        return None
    gp = sources.get("cdphe_gp") or {}
    permit = ((gp.get("permits") or {}).get(key)) or ((gp.get("permits") or {}).get(key.upper()))
    if permit and permit.get("date"):
        return {
            "version": f"issuance {permit.get('issuance') or '?'}, {permit['date']} (CDPHE docid {permit.get('docid') or '?'})",
            "effective_date": permit["date"],
        }
    return None


def version_note(reg: str, old: str, new: str) -> str:
    """The note on a source_version_changed row: human-readable, no ids."""
    return f"Source version changed for {reg}: {old} -> {new}"


def root_id_for(reg: str) -> str:
    return f"sec-{reg}-top-REG-{reg}"


def _rows(resp: Any) -> list:
    data = getattr(resp, "data", resp)
    return list(data or [])


def refresh_changelog_snapshot(client: Any) -> dict:
    """Recompute the stored changelog (refresh_changelog_snapshot()).
    Returns the function's {rows, computed_at, compute_ms}."""
    resp = client.rpc("refresh_changelog_snapshot", {}).execute()
    data = getattr(resp, "data", resp)
    return dict(data) if isinstance(data, dict) else {"result": data}


def finalize_import_changelog(
    client: Any,
    reg: str,
    started_at_iso: str,
    manifest: Optional[dict] = None,
    *,
    refresh: bool = True,
    now: Optional[datetime] = None,
) -> dict:
    """Steps 1-4 of the module docstring, after an executed import of `reg`
    whose writes began at `started_at_iso` (UTC ISO). Returns a summary:

        {"reg", "version_changed": bool, "old", "new",
         "relabelled": {"text_updated": n, "added": n, "removed": n},
         "snapshot": {...} | None}
    """
    manifest = load_manifest() if manifest is None else manifest
    current = source_version_of(manifest, reg)
    recorded = _rows(client.table("source_versions").select("version,effective_date").eq("reg_key", reg).execute())
    old_version = recorded[0].get("version") if recorded else None
    stamp = (now or datetime.now(timezone.utc)).isoformat()

    version_changed = False
    if current is None:
        print(f"  changelog: no manifest version for {reg}; treating the run as no agency change.")
    elif not recorded:
        client.table("source_versions").insert({
            "reg_key": reg, "version": current["version"], "effective_date": current["effective_date"], "recorded_at": stamp,
        }).execute()
        print(f"  changelog: first recorded version for {reg}: {current['version']}.")
    elif old_version != current["version"]:
        version_changed = True
        client.table("provision_changes").insert({
            "provision_id": root_id_for(reg),
            "change_type": "source_version_changed",
            "note": version_note(reg, old_version or "?", current["version"]),
        }).execute()
        client.table("source_versions").update({
            "version": current["version"], "effective_date": current["effective_date"], "recorded_at": stamp,
        }).eq("reg_key", reg).execute()
        print(f"  changelog: source version changed for {reg}: {old_version} -> {current['version']} (logged).")
    else:
        print(f"  changelog: source version unchanged for {reg} ({current['version']}).")

    relabelled = {t: 0 for t in RUN_REGULATORY_TYPES}
    if not version_changed:
        for change_type in RUN_REGULATORY_TYPES:
            resp = (
                client.table("provision_changes")
                .update({"change_type": "transcription_corrected"})
                .eq("change_type", change_type)
                .like("provision_id", f"sec-{reg}-%")
                .gte("created_at", started_at_iso)
                .execute()
            )
            relabelled[change_type] = len(_rows(resp))
        n = sum(relabelled.values())
        if n:
            print(f"  changelog: {n} row(s) this run logged as {'/'.join(RUN_REGULATORY_TYPES)} re-labelled "
                  "transcription_corrected (our copy corrected; no agency version change).")

    snapshot = None
    if refresh:
        snapshot = refresh_changelog_snapshot(client)
        print(f"  changelog: snapshot refreshed ({snapshot}).")

    return {
        "reg": reg,
        "version_changed": version_changed,
        "old": old_version,
        "new": current["version"] if current else None,
        "relabelled": relabelled,
        "snapshot": snapshot,
    }
