"""
Tests for denver_date.today_denver() and for the places that stamp a calendar
day on it (Sprint 5 leftover: the runner's UTC day is already tomorrow after
6 pm MDT / 5 pm MST).

    cd pipeline && python -m pytest test_denver_date.py -q
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import pytest

import denver_date
import import_ccr as ic
import review
from denver_date import today_denver

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
UTC = timezone.utc


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=UTC)


# --------------------------------------------------------------------------
# The helper
# --------------------------------------------------------------------------

def test_after_midnight_utc_but_before_midnight_denver_is_still_the_previous_day():
    # 03:30 UTC on 11 Oct is 21:30 MDT on 10 Oct -- the case this module exists for.
    assert today_denver(utc(2026, 10, 11, 3, 30)) == "2026-10-10"
    assert today_denver(datetime.fromisoformat("2026-10-11T03:30:00+00:00")) == "2026-10-10"


@pytest.mark.parametrize(
    "instant, expected",
    [
        # Summer (MDT, UTC-6): the day turns at 06:00 UTC.
        (utc(2026, 7, 1, 5, 59, 59), "2026-06-30"),
        (utc(2026, 7, 1, 6, 0, 0), "2026-07-01"),
        (utc(2026, 7, 1, 23, 59, 59), "2026-07-01"),
        # Winter (MST, UTC-7): the day turns at 07:00 UTC.
        (utc(2026, 12, 15, 6, 59, 59), "2026-12-14"),
        (utc(2026, 12, 15, 7, 0, 0), "2026-12-15"),
        (utc(2026, 12, 15, 12, 0, 0), "2026-12-15"),
    ],
)
def test_the_day_turns_at_denver_midnight_in_summer_and_winter(instant, expected):
    assert today_denver(instant) == expected


@pytest.mark.parametrize(
    "instant, expected",
    [
        # Spring forward, Sunday 8 Mar 2026: 02:00 MST -> 03:00 MDT at 09:00 UTC.
        (utc(2026, 3, 8, 6, 59, 59), "2026-03-07"),    # 23:59:59 MST on the 7th
        (utc(2026, 3, 8, 7, 0, 0), "2026-03-08"),      # 00:00 MST
        (utc(2026, 3, 8, 8, 59, 59), "2026-03-08"),    # 01:59:59 MST
        (utc(2026, 3, 8, 9, 0, 0), "2026-03-08"),      # 03:00 MDT
        (utc(2026, 3, 9, 5, 59, 59), "2026-03-08"),    # 23:59:59 MDT (the offset is now -6)
        (utc(2026, 3, 9, 6, 0, 0), "2026-03-09"),      # 00:00 MDT
        # Fall back, Sunday 1 Nov 2026: 02:00 MDT -> 01:00 MST at 08:00 UTC.
        (utc(2026, 11, 1, 5, 59, 59), "2026-10-31"),   # 23:59:59 MDT on the 31st
        (utc(2026, 11, 1, 6, 0, 0), "2026-11-01"),     # 00:00 MDT
        (utc(2026, 11, 1, 7, 59, 59), "2026-11-01"),   # 01:59:59 MDT (first 1 am)
        (utc(2026, 11, 1, 8, 0, 0), "2026-11-01"),     # 01:00 MST (second 1 am)
        (utc(2026, 11, 2, 6, 59, 59), "2026-11-01"),   # 23:59:59 MST (a 25-hour day ends an hour late)
        (utc(2026, 11, 2, 7, 0, 0), "2026-11-02"),     # 00:00 MST
    ],
)
def test_around_the_dst_changes(instant, expected):
    assert today_denver(instant) == expected


def test_any_aware_zone_is_accepted_and_read_as_the_instant_it_names():
    # 23:30 on 10 Oct in New York is 03:30 UTC on the 11th and 21:30 on the 10th in Denver.
    assert today_denver(datetime(2026, 10, 10, 23, 30, tzinfo=ZoneInfo("America/New_York"))) == "2026-10-10"
    # 09:00 on 11 Oct in Tokyo (UTC+9) is 00:00 UTC, 18:00 MDT on the 10th.
    assert today_denver(datetime(2026, 10, 11, 9, 0, tzinfo=timezone(timedelta(hours=9)))) == "2026-10-10"
    # Denver's own clock is returned as it reads.
    assert today_denver(datetime(2026, 10, 10, 21, 30, tzinfo=ZoneInfo("America/Denver"))) == "2026-10-10"


def test_a_naive_datetime_is_refused_not_read_as_utc():
    with pytest.raises(ValueError):
        today_denver(datetime(2026, 10, 11, 3, 30))


def test_default_is_the_current_instant_in_denver():
    before = today_denver(datetime.now(UTC))
    got = today_denver()
    after = today_denver(datetime.now(UTC))
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", got)
    assert got in {before, after}


def test_missing_zone_data_is_an_error_not_a_utc_fallback(monkeypatch):
    def no_zone(name):
        raise ZoneInfoNotFoundError(f"No time zone found with key {name}")

    monkeypatch.setattr(denver_date, "ZoneInfo", no_zone)
    with pytest.raises(ZoneInfoNotFoundError):
        today_denver(utc(2026, 10, 11, 3, 30))
    with pytest.raises(ZoneInfoNotFoundError):
        today_denver()


def test_command_line_prints_the_day_for_workflow_steps():
    out = subprocess.run([sys.executable, "-I", str(HERE / "denver_date.py")],
                         capture_output=True, text=True, check=True).stdout
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}\n", out)


# --------------------------------------------------------------------------
# The callers: every stamped day comes from the helper
# --------------------------------------------------------------------------

PART = "sec-t1-A"
ROOT_ID = "sec-t1-top-REG-t1"


def _prow(pid, parent_id, sort_order, full_text):
    return {"id": pid, "citation": pid, "title": pid, "parent_id": parent_id,
            "sort_order": sort_order, "full_text": full_text}


def _apply_args(tmp_path, execute=False):
    parsed = [_prow(PART, ROOT_ID, 10, "Part A"), _prow("sec-t1-A-I", PART, 20, "brand new provision")]
    db = [_prow(PART, ROOT_ID, 10, "Part A")]
    (tmp_path / "parsed.json").write_text(json.dumps(parsed), encoding="utf-8")
    (tmp_path / "db.json").write_text(json.dumps(db), encoding="utf-8")
    return argparse.Namespace(reg="t1", parsed=str(tmp_path / "parsed.json"), db=str(tmp_path / "db.json"),
                              out_dir=str(tmp_path / "out"), batch_bytes=150_000, execute=execute)


def test_apply_stamps_last_verified_date_with_the_denver_day(monkeypatch, tmp_path):
    monkeypatch.setattr(ic, "today_denver", lambda now=None: "2030-01-02")
    seen = {}
    monkeypatch.setattr(ic, "cmd_apply_execute", lambda args, c, ancestor_for, today: seen.update(today=today))

    ic.cmd_apply(_apply_args(tmp_path, execute=True))

    assert seen["today"] == "2030-01-02", "the --execute path (INSERT payloads, added/removed notes) gets the same day"
    sql = "".join(p.read_text(encoding="utf-8") for p in sorted((tmp_path / "out").glob("01_upsert_*.sql")))
    assert re.search(r"DATE \$pv\$2030-01-02\$pv\$", sql), "the SQL-file path stamps the same day"


def test_apply_uses_the_helper_not_the_utc_clock(monkeypatch, tmp_path):
    # 03:30 UTC on 11 Oct: the runner's UTC day is the 11th, Colorado's is the 10th.
    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            instant = datetime(2026, 10, 11, 3, 30, tzinfo=UTC)
            return instant.astimezone(tz) if tz else instant

    monkeypatch.setattr(denver_date, "datetime", FrozenDatetime)
    seen = {}
    monkeypatch.setattr(ic, "cmd_apply_execute", lambda args, c, ancestor_for, today: seen.update(today=today))

    ic.cmd_apply(_apply_args(tmp_path, execute=True))

    assert seen["today"] == "2026-10-10"


def test_release_note_names_the_denver_day_and_released_at_stays_an_instant(monkeypatch):
    monkeypatch.setattr(ic, "today_denver", lambda now=None: "2030-01-02")
    monkeypatch.setenv("SUPABASE_URL", "https://example.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "not-a-real-key")
    writes = []

    class Query:
        def __init__(self, op):
            self.op = op

        def select(self, *a, **k):
            return self

        def eq(self, *a, **k):
            return self

        def insert(self, payload):
            writes.append(("insert", payload))
            return self

        def update(self, payload):
            writes.append(("update", payload))
            return self

        def execute(self):
            return argparse.Namespace(data=[])

    class Client:
        def table(self, name):
            assert name == "regulation_releases"
            return Query(name)

    import supabase
    monkeypatch.setattr(supabase, "create_client", lambda url, key: Client())

    ic.cmd_release(argparse.Namespace(reg="T1", yes=True))

    (op, payload), = writes
    assert op == "insert"
    assert payload["note"] == "released by import_ccr.py release (2030-01-02)"
    released_at = datetime.fromisoformat(payload["released_at"])
    assert released_at.utcoffset() == timedelta(0), "released_at is an instant, kept UTC"


def test_reviewed_by_names_the_denver_day(monkeypatch):
    monkeypatch.setattr(review, "today_denver", lambda now=None: "2030-01-02")
    assert review.reviewed_by_for("pass", "model-x").endswith(", model-x, 2030-01-02)")
    assert review.reviewed_by_for("corrected", "model-x").endswith(", model-x, 2030-01-02)")
    # An explicit day (a replay, a test) is used as given.
    assert review.reviewed_by_for("pass", "model-x", "2026-10-05").endswith(", model-x, 2026-10-05)")


# --------------------------------------------------------------------------
# A guard: nothing that prints a day reads the UTC clock again
# --------------------------------------------------------------------------

UTC_DAY_PATTERNS = [
    (re.compile(r"\butcnow\s*\("), "datetime.utcnow()"),
    (re.compile(r"\bdate\.today\s*\("), "date.today()"),
    (re.compile(r"\bdatetime\.today\s*\("), "datetime.today()"),
    (re.compile(r"datetime\.now\(\s*\)\.date"), "datetime.now().date()"),
    (re.compile(r"datetime\.now\(timezone\.utc\)\s*\.(?:date\(\)|strftime\(\s*[\"']%Y-%m-%d)"), "the UTC clock formatted as a day"),
    (re.compile(r"now_iso\[:10\]|started\[:10\]"), "a UTC instant sliced into a day"),
]
# Not matched on purpose: run_chain.py seeds its sample from the UTC date as YYYYMMDD
# (a number to reproduce a draw, never printed as a day).


def test_no_pipeline_module_stamps_a_display_day_from_the_utc_clock():
    offenders = []
    sources = sorted(HERE.glob("*.py")) + [ROOT / "scripts" / "fetch_method_sections.py"]
    for path in sources:
        if path.name.startswith("test_") or path.name == "denver_date.py":
            continue
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for pattern, what in UTC_DAY_PATTERNS:
                if pattern.search(line):
                    offenders.append(f"{path.name}:{n}: {what}: {line.strip()}")
    assert not offenders, "stamp a day with denver_date.today_denver():\n" + "\n".join(offenders)


def test_no_workflow_step_computes_a_display_day_from_the_runner_clock():
    bad = re.compile(r"date -u \+%F|date -u \+%Y-%m-%d|date \+%F|date \+%Y-%m-%d|new Date\(\)\.toISOString\(\)\.slice")
    offenders = []
    for path in sorted((ROOT / ".github" / "workflows").glob("*.yml")):
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if bad.search(line):
                offenders.append(f"{path.name}:{n}: {line.strip()}")
    assert not offenders, "use `python denver_date.py` (or the Intl America/Denver idiom):\n" + "\n".join(offenders)
