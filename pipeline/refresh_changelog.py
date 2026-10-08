#!/usr/bin/env python3
"""
refresh_changelog.py -- recompute the stored /changelog counts.

/changelog reads changelog_snapshot (one row) instead of running the
changelog_public() aggregate on every request (which timed out under write
load on 7 Oct 2026). Every workflow that writes provision_changes runs this
after its writes; the import's execute path and the chained run call the
same function directly. Safe to run at any time: a failed recompute leaves
the previous snapshot in place and exits non-zero.

    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python refresh_changelog.py
"""

from __future__ import annotations

import os
import sys

from changelog_sources import refresh_changelog_snapshot
from dbclient import make_reconnecting_client


def main() -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("refresh_changelog.py needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.", file=sys.stderr)
        return 2
    client = make_reconnecting_client(url, key)
    result = refresh_changelog_snapshot(client)
    print(f"Changelog snapshot refreshed: {result}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
