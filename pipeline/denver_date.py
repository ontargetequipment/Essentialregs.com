#!/usr/bin/env python3
"""
denver_date.py -- the calendar day in Colorado, as "YYYY-MM-DD".

Every calendar DAY the pipeline stamps for people to read ("source checked",
"verified", "as of", a changelog day, a report folder) is a day in America/
Denver, the same convention as todayDenver() in src/lib/changelog.ts. The
GitHub runner's clock is UTC, which is already tomorrow after 6 pm MDT /
5 pm MST, so `date.today()`, `datetime.utcnow()` and `date -u +%F` print the
wrong day for the people reading it.

    from denver_date import today_denver
    today_denver()                                   # "2026-10-10"
    today_denver(datetime(2026, 10, 11, 3, 30, tzinfo=timezone.utc))  # "2026-10-10"

In a workflow step:  python pipeline/denver_date.py   (prints the day)

Not for instants. A timestamptz column (reviewed_at, released_at, ...) keeps
datetime.now(timezone.utc).isoformat(): an instant is the same everywhere and
the reader converts it to the Denver calendar when it prints it (src/lib/
dates.ts). This module is only for values that name a day.

There is no fallback to UTC. If the zone database is missing (no system tz
data and no `tzdata` package), ZoneInfoNotFoundError propagates: a wrong day
printed quietly is worse than a failed run. GitHub's ubuntu runners have
system tz data, so the pipeline does not depend on the `tzdata` package.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

DENVER_TZ_NAME = "America/Denver"


def today_denver(now: Optional[datetime] = None) -> str:
    """The calendar day in America/Denver as "YYYY-MM-DD".

    `now` is an instant for tests and replays: any timezone-aware datetime
    (it is converted to Denver, so 2026-10-11T03:30Z is "2026-10-10"). A
    naive datetime is refused: it names no instant, and guessing UTC is the
    very mistake this module exists to remove. Omitted, it is the current
    instant.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("today_denver(now=...) needs a timezone-aware datetime, not a naive one")
    return now.astimezone(ZoneInfo(DENVER_TZ_NAME)).date().isoformat()


if __name__ == "__main__":
    print(today_denver())
