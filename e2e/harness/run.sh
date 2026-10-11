#!/usr/bin/env bash
# Production-build test harness: mock Supabase + `next build` + `next start`.
#
#   bash e2e/harness/run.sh                 build and serve in the foreground (Ctrl-C stops everything)
#   bash e2e/harness/run.sh --detach        same, but return once it is serving; stop with --stop
#   bash e2e/harness/run.sh --stop          stop what --detach started
#   bash e2e/harness/run.sh --skip-build    serve the existing .next (the mock must be the same data)
#   bash e2e/harness/run.sh --gp05 F --reg7 F --overlay F --docs-dir D [--only 7,gp05]
#                                           regenerate the fixtures from these files first (any of them)
#   bash e2e/harness/run.sh --test [playwright args]
#                                           build, serve, run `playwright test <args>`, stop; exit code is Playwright's
#
# Environment (all optional):
#   HARNESS_APP_PORT=3100      the app            HARNESS_MOCK_PORT=54321   the mock Supabase
#   HARNESS_FIXTURE_ARGS=...   passed to build-fixtures.py (e.g. "--gp05 /x/gp05.json --reg7 /x/reg7.json")
#   HARNESS_REBUILD_FIXTURES=1 regenerate e2e/harness/generated/db.json even if it exists
#   HARNESS_FONTS=auto|mock|network   next/font/google at build time: auto (default) uses the network if
#                              fonts.googleapis.com answers and a placeholder-font module if not
#   HARNESS_EMAIL / HARNESS_PASSWORD  the subscriber account the fixtures create
#
# What it runs is a real production build: `next build` (Turbopack, prerendering against the mock) and
# `next start`. Nothing under src/ is touched or stubbed.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
GEN="$HERE/generated"
APP_PORT="${HARNESS_APP_PORT:-3100}"
MOCK_PORT="${HARNESS_MOCK_PORT:-54321}"
BASE_URL="http://127.0.0.1:${APP_PORT}"
PIDFILE="$GEN/run.pids"

DETACH=0 SKIP_BUILD=0 STOP=0 TEST=0 REBUILD_FIXTURES="${HARNESS_REBUILD_FIXTURES:-0}"
TEST_ARGS=()
FIXTURE_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --detach) DETACH=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --stop) STOP=1 ;;
    --gp05|--reg7|--overlay|--docs-dir|--only)
      [ $# -ge 2 ] || { echo "run.sh: $1 needs a value" >&2; exit 2; }
      FIXTURE_ARGS+=("$1" "$2"); REBUILD_FIXTURES=1; shift ;;
    --test) TEST=1; shift; TEST_ARGS=("$@"); break ;;
    -h|--help) awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "run.sh: unknown argument $1 (see --help)" >&2; exit 2 ;;
  esac
  shift
done

stop_pids() {
  [ -f "$PIDFILE" ] || return 0
  while read -r pid; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done < "$PIDFILE"
  rm -f "$PIDFILE"
}

if [ "$STOP" = 1 ]; then
  stop_pids
  echo "harness stopped"
  exit 0
fi

mkdir -p "$GEN"
cd "$ROOT"

# ---- preflight --------------------------------------------------------------
if [ -L node_modules ]; then
  echo "run.sh: node_modules is a symlink to $(readlink node_modules)." >&2
  echo "  Turbopack refuses a node_modules that points out of the project root" >&2
  echo "  (\"Symlink [project]/node_modules is invalid, it points out of the filesystem root\")." >&2
  echo "  Replace it with a real install:  rm node_modules && npm ci" >&2
  exit 1
fi
[ -d node_modules/next ] || { echo "run.sh: node_modules/next is missing; run npm ci" >&2; exit 1; }
command -v python3 >/dev/null || { echo "run.sh: python3 is needed for build-fixtures.py" >&2; exit 1; }
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
if [ -f "$PIDFILE" ]; then
  echo "run.sh: $PIDFILE exists; a harness may already be running (bash e2e/harness/run.sh --stop)" >&2
  exit 1
fi
for p in "$APP_PORT" "$MOCK_PORT"; do
  if port_busy "$p"; then echo "run.sh: port $p is already in use" >&2; exit 1; fi
done

# ---- fixtures ---------------------------------------------------------------
if [ ! -f "$GEN/db.json" ] || [ "$REBUILD_FIXTURES" = 1 ]; then
  # shellcheck disable=SC2086
  python3 "$HERE/build-fixtures.py" ${HARNESS_FIXTURE_ARGS:-} "${FIXTURE_ARGS[@]+"${FIXTURE_ARGS[@]}"}"
fi

# ---- processes --------------------------------------------------------------
: > "$PIDFILE"
cleanup() {
  stop_pids
}
if [ "$DETACH" = 0 ]; then trap cleanup EXIT INT TERM; fi

echo "== mock Supabase on :$MOCK_PORT"
HARNESS_MOCK_PORT="$MOCK_PORT" node "$HERE/mock-supabase.mjs" > "$GEN/mock.log" 2>&1 &
echo $! >> "$PIDFILE"
for _ in $(seq 1 100); do
  curl -fsS "http://127.0.0.1:$MOCK_PORT/__harness/health" >/dev/null 2>&1 && break
  sleep 0.2
done
curl -fsS "http://127.0.0.1:$MOCK_PORT/__harness/health" >/dev/null || { echo "run.sh: the mock did not start; see $GEN/mock.log" >&2; cat "$GEN/mock.log" >&2; stop_pids; exit 1; }

# The app's environment: the mock's URL, the two keys it distinguishes, the site origin.
eval "$(HARNESS_MOCK_PORT="$MOCK_PORT" node "$HERE/mock-supabase.mjs" --print-env)"
export NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
export NEXT_PUBLIC_SITE_URL="$BASE_URL"
# Stripe is never reached by the specs that run here (the checkout refuses an anonymous POST first);
# these only satisfy code that reads the variables.
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_harness_never_used}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_harness_never_used}"
export NEXT_TELEMETRY_DISABLED=1

# next/font/google downloads font CSS and files at build time. Use the network when it answers; else a
# module of placeholder fonts (NEXT_FONT_GOOGLE_MOCKED_RESPONSES, the hook Next's own tests use).
FONTS="${HARNESS_FONTS:-auto}"
if [ "$FONTS" = auto ]; then
  if curl -fsS -m 8 -o /dev/null "https://fonts.googleapis.com/css2?family=Inter" 2>/dev/null; then FONTS=network; else FONTS=mock; fi
fi
if [ "$FONTS" = mock ]; then
  node "$HERE/font-mocks.mjs" "$GEN/font-mocks.cjs" "http://127.0.0.1:$MOCK_PORT/__harness/font"
  export NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$GEN/font-mocks.cjs"
  echo "== fonts: placeholder stylesheets (fonts.googleapis.com unreachable or HARNESS_FONTS=mock)"
else
  echo "== fonts: network"
fi

if [ "$SKIP_BUILD" = 0 ]; then
  echo "== next build (production, prerendering against the mock)"
  rm -rf .next
  node node_modules/next/dist/bin/next build 2>&1 | tee "$GEN/build.log"
  if [ "${PIPESTATUS[0]}" != 0 ]; then
    echo "run.sh: next build failed; see $GEN/build.log" >&2
    stop_pids
    exit 1
  fi
else
  [ -f .next/BUILD_ID ] || { echo "run.sh: --skip-build but there is no .next/BUILD_ID" >&2; stop_pids; exit 1; }
fi

echo "== next start on :$APP_PORT"
node node_modules/next/dist/bin/next start -p "$APP_PORT" -H 127.0.0.1 > "$GEN/app.log" 2>&1 &
echo $! >> "$PIDFILE"
for _ in $(seq 1 150); do
  curl -fsS -o /dev/null "$BASE_URL/robots.txt" 2>/dev/null && break
  sleep 0.2
done
curl -fsS -o /dev/null "$BASE_URL/robots.txt" || { echo "run.sh: the app did not start; see $GEN/app.log" >&2; cat "$GEN/app.log" >&2; stop_pids; exit 1; }

# @playwright/test wants a specific Chromium build; link an older preinstalled one under that name if needed.
PW_PATH="$(bash "$HERE/pw-browsers.sh")"
[ "$PW_PATH" != "${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}" ] && export PLAYWRIGHT_BROWSERS_PATH="$PW_PATH"

SMOKE_EMAIL_V="$(python3 -c "import json;print(json.load(open('$GEN/db.json'))['meta']['subscriber']['email'])")"
SMOKE_PASSWORD_V="$(python3 -c "import json;print(json.load(open('$GEN/db.json'))['meta']['subscriber']['password'])")"
cat <<EOF

BASE_URL=$BASE_URL
mock Supabase:  http://127.0.0.1:$MOCK_PORT   (GET /__harness/tour-events, /__harness/unhandled, /__harness/requests)
subscriber:     SMOKE_EMAIL=$SMOKE_EMAIL_V SMOKE_PASSWORD=$SMOKE_PASSWORD_V
logs:           $GEN/{mock,app,build}.log

  export PLAYWRIGHT_BROWSERS_PATH="\$(bash e2e/harness/pw-browsers.sh)"
  BASE_URL=$BASE_URL npx playwright test e2e/smoke-tour.spec.ts
EOF

if [ "$TEST" = 1 ]; then
  set +e
  BASE_URL="$BASE_URL" SMOKE_EMAIL="$SMOKE_EMAIL_V" SMOKE_PASSWORD="$SMOKE_PASSWORD_V" npx playwright test ${TEST_ARGS[@]+"${TEST_ARGS[@]}"}
  code=$?
  set -e
  echo "== unhandled mock requests:"; curl -fsS "http://127.0.0.1:$MOCK_PORT/__harness/unhandled"; echo
  exit "$code"
fi

if [ "$DETACH" = 1 ]; then
  echo "(detached; stop with: bash e2e/harness/run.sh --stop)"
  exit 0
fi
echo "(serving; Ctrl-C to stop)"
wait
