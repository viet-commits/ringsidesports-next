#!/usr/bin/env bash
#
# cutover-check.sh — Pre-cutover health check for Ringside Sports
#
# Verifies all services are healthy before DNS cutover.
# Run: ./scripts/cutover-check.sh [--json]
#
# Output: Go/No-Go summary at the end.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
OUTPUT_JSON=false

SERVER="${SERVER:-45.124.55.87}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-ringsidesports-postgres}"

# ── Helpers ────────────────────────────────────────────────────

check_pass() { PASS=$((PASS + 1)); echo -e "  ${GREEN}✓${NC} $1"; }
check_fail() { FAIL=$((FAIL + 1)); echo -e "  ${RED}✗${NC} $1 — $2"; }
check_warn() { WARN=$((WARN + 1)); echo -e "  ${YELLOW}⚠${NC} $1 — $2"; }

section() { echo ""; echo -e "${BOLD}$1${NC}"; echo "─────────────────────────────────────────"; }

# ── Parse args ─────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) OUTPUT_JSON=true; shift ;;
    --server) SERVER="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo ""
echo -e "${BOLD}═══ Ringside Sports Cutover Health Check ═══${NC}"
echo "Server:  $SERVER"
echo "Time:    $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

# ── 1. Legacy WP is serving ────────────────────────────────────
section "1. Legacy WordPress (should be UP)"

LEGACY_STATUS=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 "https://ringsidesports.com.au" 2>/dev/null || echo "000")
if [ "$LEGACY_STATUS" = "200" ]; then
  check_pass "Legacy WP serving (HTTP $LEGACY_STATUS)"
else
  check_warn "Legacy WP returned HTTP $LEGACY_STATUS (expected 200)"
fi

# ── 2. Medusa Backend ──────────────────────────────────────────
section "2. Medusa Backend (port 9000)"

MEDUSA_HEALTH=$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
  'curl -s --max-time 5 http://localhost:9000/health' 2>/dev/null || echo '{"status":"down"}')

MEDUSA_STATUS=$(echo "$MEDUSA_HEALTH" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

if [ "$MEDUSA_STATUS" = "ok" ]; then
  check_pass "Medusa backend: ok"
elif [ "$MEDUSA_STATUS" = "degraded" ]; then
  check_warn "Medusa backend: degraded — $MEDUSA_HEALTH"
else
  check_fail "Medusa backend: $MEDUSA_STATUS" "Backend is down or unreachable"
fi

# ── 3. MeiliSearch ─────────────────────────────────────────────
section "3. MeiliSearch (port 7700)"

MEILI_HEALTH=$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
  'curl -s --max-time 5 http://localhost:7700/health' 2>/dev/null || echo '{"status":"down"}')

MEILI_STATUS=$(echo "$MEILI_HEALTH" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

if [ "$MEILI_STATUS" = "available" ]; then
  check_pass "MeiliSearch: available"
else
  check_fail "MeiliSearch: $MEILI_STATUS" "Search will not work"
fi

# Check product index
MEILI_INDEX=$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
  'curl -s -H "Authorization: Bearer ringsidesports-meili-key" http://localhost:7700/indexes/products/stats' 2>/dev/null || echo '{"numberOfDocuments":0}')

MEILI_DOCS=$(echo "$MEILI_INDEX" | grep -o '"numberOfDocuments":[0-9]*' | cut -d: -f2 || echo "0")
if [ "$MEILI_DOCS" -ge 400 ]; then
  check_pass "Product index: $MEILI_DOCS documents"
else
  check_fail "Product index: $MEILI_DOCS documents (expected ≥ 400)" "Re-index: node scripts/index-meilisearch.mjs"
fi

# ── 4. Docker Services ─────────────────────────────────────────
section "4. Docker Services"

DOCKER_PS=$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
  'docker ps --format "{{.Names}}|{{.Status}}"' 2>/dev/null || echo "")

REQUIRED_SERVICES=("ringsidesports-postgres" "ringsidesports-redis" "ringsidesports-meilisearch" "ringsidesports-medusa")

for svc in "${REQUIRED_SERVICES[@]}"; do
  STATUS=$(echo "$DOCKER_PS" | grep "^${svc}|" | cut -d'|' -f2 || echo "")
  if [ -z "$STATUS" ]; then
    check_fail "$svc: NOT RUNNING" "docker compose up -d"
  elif echo "$STATUS" | grep -q "Up"; then
    if echo "$STATUS" | grep -q "healthy"; then
      check_pass "$svc: $STATUS"
    elif echo "$STATUS" | grep -q "unhealthy"; then
      check_fail "$svc: $STATUS" "Container is unhealthy"
    else
      check_pass "$svc: $STATUS"
    fi
  else
    check_fail "$svc: $STATUS" "Container is down"
  fi
done

# ── 5. PostgreSQL ──────────────────────────────────────────────
section "5. PostgreSQL"

PG_READY=$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
  "docker exec ${POSTGRES_CONTAINER} pg_isready -q 2>/dev/null && echo 'ready' || echo 'not ready'" 2>/dev/null || echo "ssh failed")

if [ "$PG_READY" = "ready" ]; then
  check_pass "PostgreSQL: accepting connections"
else
  check_fail "PostgreSQL: $PG_READY" "Check: docker logs $POSTGRES_CONTAINER"
fi

# Connection pool check
PG_CONNS=$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
  "docker exec ${POSTGRES_CONTAINER} psql -U ringsidesports -t -c 'SELECT count(*) FROM pg_stat_activity;' 2>/dev/null" 2>/dev/null | tr -d ' ' || echo "0")
if [ -n "$PG_CONNS" ] && [ "$PG_CONNS" -lt 50 ]; then
  check_pass "Connection pool: $PG_CONNS connections"
elif [ -n "$PG_CONNS" ]; then
  check_warn "Connection pool: $PG_CONNS connections (≥ 50)" "Consider increasing pool size"
else
  check_warn "Connection pool: could not check"
fi

# ── 6. Redirect Map ────────────────────────────────────────────
section "6. Redirect Map"

if [ -f /tmp/redirect-map.json ]; then
  REDIRECT_COUNT=$(grep -c '"source"' /tmp/redirect-map.json || echo "0")
  if [ "$REDIRECT_COUNT" -ge 1000 ]; then
    check_pass "Redirect map: $REDIRECT_COUNT entries"
  else
    check_warn "Redirect map: only $REDIRECT_COUNT entries (expected ≥1000)"
  fi
else
  check_warn "Redirect map not found at /tmp/redirect-map.json" "Run: node scripts/generate-redirect-map.mjs"
fi

# ── 7. Cloudflare Pages Deployment ─────────────────────────────
section "7. Cloudflare Pages"

PAGES_URL="https://ringsidesports.pages.dev"
PAGES_STATUS=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 "$PAGES_URL" 2>/dev/null || echo "000")

if [ "$PAGES_STATUS" = "200" ] || [ "$PAGES_STATUS" = "308" ]; then
  check_pass "Cloudflare Pages: serving at $PAGES_URL"
else
  check_warn "Cloudflare Pages: HTTP $PAGES_STATUS (may not be deployed yet)"
fi

# ── 8. SSL Certificates (Caddy) ────────────────────────────────
section "8. SSL Certificates (Caddy)"

CADDY_STATUS=$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
  'systemctl is-active caddy 2>/dev/null || echo "inactive"' 2>/dev/null || echo "ssh failed")

if [ "$CADDY_STATUS" = "active" ]; then
  check_pass "Caddy: active"
else
  check_warn "Caddy: $CADDY_STATUS" "API/Admin TLS may not work"
fi

# ── Summary ────────────────────────────────────────────────────
section "SUMMARY"

TOTAL=$((PASS + FAIL + WARN))
echo "  Passed:  $PASS"
echo "  Failed:  $FAIL"
echo "  Warnings: $WARN"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}${BOLD}🛑 NO-GO${NC} — $FAIL critical check(s) failed."
  echo "  Fix failures before cutover. See docs/runbooks/rollback.md for rollback plan."
elif [ "$WARN" -gt 0 ]; then
  echo -e "${YELLOW}${BOLD}⚠️  GO WITH CAUTION${NC} — $WARN warning(s)."
  echo "  Review warnings. Most are non-blocking but should be investigated."
else
  echo -e "${GREEN}${BOLD}✅ ALL CLEAR — GO FOR CUTOVER${NC}"
  echo "  All $PASS checks passed. Proceed with docs/runbooks/cutover.md"
fi

echo ""

exit $FAIL
