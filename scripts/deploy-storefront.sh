#!/usr/bin/env bash
#
# deploy-storefront.sh — Deploy Ringside Sports storefront to Cloudflare Pages
#
# Usage:
#   ./scripts/deploy-storefront.sh [--dry-run] [--branch main|staging]
#
# Prerequisites:
#   - Cloudflare API token with Pages:Edit permission (set as CLOUDFLARE_API_TOKEN)
#   - Built storefront: pnpm --filter storefront build (produces apps/storefront/out/)
#
# Cloudflare Pages project: ringsidesports (ID: 8af93a4f-0866-4ece-88c9-6028d63cc848)
# Subdomain: ringsidesports.pages.dev
#
# Options:
#   --dry-run    Show what would be deployed without actually deploying
#   --branch     Branch name to deploy to (default: main)
#   --project    Cloudflare Pages project name (default: ringsidesports)

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
PROJECT_NAME="${PROJECT_NAME:-ringsidesports}"
BRANCH="main"
DRY_RUN=false
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-13072282b181d7c44e8d7743c23a2c8c}"
OUT_DIR="$(cd "$(dirname "$0")/../apps/storefront/out" && pwd)"
STORE_DIR="$(cd "$(dirname "$0")/../apps/storefront" && pwd)"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ── Parse args ─────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --branch)  BRANCH="$2"; shift 2 ;;
    --project) PROJECT_NAME="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Pre-flight checks ──────────────────────────────────────────
echo -e "${YELLOW}═══ Ringside Sports Storefront Deploy ═══${NC}"
echo ""

if [ ! -d "$OUT_DIR" ]; then
  echo -e "${RED}✗ Build output not found at $OUT_DIR${NC}"
  echo "  Run: cd $STORE_DIR && pnpm build"
  exit 1
fi

FILE_COUNT=$(find "$OUT_DIR" -type f | wc -l)
echo -e "${GREEN}✓ Build output: $FILE_COUNT files in $OUT_DIR${NC}"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo -e "${RED}✗ CLOUDFLARE_API_TOKEN not set${NC}"
  echo "  Get a token at: https://dash.cloudflare.com/profile/api-tokens"
  echo "  Required permissions: Account.Workers Scripts:Edit"
  exit 1
fi

# ── Deploy ─────────────────────────────────────────────────────
echo ""
echo "Project:  $PROJECT_NAME"
echo "Branch:   $BRANCH"
echo "Account:  $CF_ACCOUNT_ID"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}[DRY RUN] Would deploy $FILE_COUNT files to $PROJECT_NAME ($BRANCH)${NC}"
  exit 0
fi

echo "Deploying to Cloudflare Pages..."
echo ""

npx wrangler pages deploy "$OUT_DIR" \
  --project-name="$PROJECT_NAME" \
  --branch="$BRANCH" \
  --commit-dirty=true

echo ""
echo -e "${GREEN}═══ Deploy complete! ═══${NC}"
echo ""
echo "Preview:  https://\$(git rev-parse --short HEAD).$PROJECT_NAME.pages.dev"
echo "Live:     https://$PROJECT_NAME.pages.dev"
echo ""
echo "Dashboard: https://dash.cloudflare.com/$CF_ACCOUNT_ID/pages/view/$PROJECT_NAME"
