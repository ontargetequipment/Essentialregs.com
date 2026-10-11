#!/usr/bin/env bash
# Prints the PLAYWRIGHT_BROWSERS_PATH to use for this checkout's @playwright/test.
#
#   export PLAYWRIGHT_BROWSERS_PATH="$(bash e2e/harness/pw-browsers.sh)"
#
# @playwright/test expects one exact Chromium build (browsers.json: chromium-headless-shell revision N), and
# `playwright install` is the only way it gets one. A machine whose browser directory holds an older build
# (this sandbox: /opt/pw-browsers has revision 1194, the lockfile's Playwright 1.63 wants 1243) fails every
# test with "Executable doesn't exist". Here the older build is linked under the new name, in
# e2e/harness/generated/pw-browsers (git-ignored); the old directory is not touched and nothing is
# downloaded. If the expected build is already installed, the original path is printed unchanged.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SRC="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
OUT="$HERE/generated/pw-browsers"
JSON="$ROOT/node_modules/playwright-core/browsers.json"

rev() { node -e "const b=require('$JSON').browsers.find(x=>x.name==='$1');process.stdout.write(b?String(b.revision):'')"; }
[ -f "$JSON" ] || { echo "$SRC"; exit 0; }
SHELL_REV="$(rev chromium-headless-shell)"
CHROME_REV="$(rev chromium)"

if [ -x "$SRC/chromium_headless_shell-$SHELL_REV/chrome-headless-shell-linux64/chrome-headless-shell" ]; then
  echo "$SRC"
  exit 0
fi
OLD_SHELL="$(ls -d "$SRC"/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -1 || true)"
OLD_CHROME="$(ls -d "$SRC"/chromium-*/chrome-linux/chrome 2>/dev/null | head -1 || true)"
if [ -z "$OLD_SHELL" ]; then
  echo "pw-browsers.sh: no chromium_headless_shell-$SHELL_REV and no older build under $SRC" >&2
  echo "$SRC"
  exit 0
fi

if [ -e "$OUT/chromium_headless_shell-$SHELL_REV/INSTALLATION_COMPLETE" ] && [ -x "$OUT/chromium_headless_shell-$SHELL_REV/chrome-headless-shell-linux64/chrome-headless-shell" ]; then
  echo "$OUT"
  exit 0
fi

rm -rf "$OUT"
mkdir -p "$OUT/chromium_headless_shell-$SHELL_REV/chrome-headless-shell-linux64"
ln -s "$OLD_SHELL" "$OUT/chromium_headless_shell-$SHELL_REV/chrome-headless-shell-linux64/chrome-headless-shell"
touch "$OUT/chromium_headless_shell-$SHELL_REV/INSTALLATION_COMPLETE"
if [ -n "$OLD_CHROME" ] && [ -n "$CHROME_REV" ]; then
  mkdir -p "$OUT/chromium-$CHROME_REV/chrome-linux64"
  ln -s "$OLD_CHROME" "$OUT/chromium-$CHROME_REV/chrome-linux64/chrome"
  touch "$OUT/chromium-$CHROME_REV/INSTALLATION_COMPLETE"
fi
for d in "$SRC"/ffmpeg-*; do [ -e "$d" ] && ln -sfn "$d" "$OUT/$(basename "$d")"; done
echo "pw-browsers.sh: linked $(basename "$(dirname "$(dirname "$OLD_SHELL")")") as chromium_headless_shell-$SHELL_REV" >&2
echo "$OUT"
