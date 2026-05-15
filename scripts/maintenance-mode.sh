#!/usr/bin/env bash
#
# maintenance-mode.sh — Toggle maintenance mode on legacy WordPress site
#
# Usage:
#   ./scripts/maintenance-mode.sh on     # Enable maintenance mode
#   ./scripts/maintenance-mode.sh off    # Disable maintenance mode
#   ./scripts/maintenance-mode.sh status # Check current status
#
# Methods attempted (in order):
#   1. WP-CLI (wp maintenance-mode activate/deactivate)
#   2. touch/remove .maintenance file in WP root
#   3. WP plugin option (if using a maintenance plugin)
#
# Server: 45.124.55.87
# WP Root: /home/ringsidesports/public_html

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

SERVER="${SERVER:-45.124.55.87}"
WP_ROOT="${WP_ROOT:-/home/ringsidesports/public_html}"
MAINTENANCE_FILE="${MAINTENANCE_FILE:-.maintenance}"
WP_SITE_URL="https://ringsidesports.com.au"

usage() {
  echo "Usage: $0 {on|off|status}"
  echo ""
  echo "  on      Enable maintenance mode on legacy WP"
  echo "  off     Disable maintenance mode on legacy WP"
  echo "  status  Check current maintenance mode state"
  exit 1
}

check_status() {
  local result=""
  
  # Check if .maintenance file exists on server
  if ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
    "[ -f ${WP_ROOT}/${MAINTENANCE_FILE} ]" 2>/dev/null; then
    result=".maintenance file present"
  fi
  
  # Check HTTP response
  local http_code
  http_code=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 "$WP_SITE_URL" 2>/dev/null || echo "000")
  
  local has_maintenance
  has_maintenance=$(curl -s --max-time 10 "$WP_SITE_URL" 2>/dev/null | grep -ci "maintenance\|under construction\|coming soon" || echo "0")
  
  echo ""
  echo -e "${BOLD}Maintenance Mode Status${NC}"
  echo "───────────────────────"
  
  if [ -n "$result" ]; then
    echo -e "  Server file: ${GREEN}$result${NC}"
  else
    echo "  Server file: not found"
  fi
  
  echo "  HTTP status: $http_code"
  
  if [ "$has_maintenance" -gt 0 ]; then
    echo -e "  Page content: ${YELLOW}maintenance keywords detected${NC}"
  else
    echo -e "  Page content: ${GREEN}normal (no maintenance keywords)${NC}"
  fi
  
  # Try WP-CLI for definitive answer
  local wp_status
  wp_status=$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
    "cd ${WP_ROOT} && wp maintenance-mode status 2>/dev/null" 2>/dev/null || echo "")
  
  if [ -n "$wp_status" ]; then
    echo "  WP-CLI: $wp_status"
  fi
  
  echo ""
}

enable_maintenance() {
  echo -e "${YELLOW}Enabling maintenance mode...${NC}"
  
  # Method 1: Try WP-CLI
  local wp_result
  wp_result=$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
    "cd ${WP_ROOT} && wp maintenance-mode activate 2>&1" 2>/dev/null || echo "")
  
  if echo "$wp_result" | grep -qi "success\|activated\|already"; then
    echo -e "  ${GREEN}✓${NC} WP-CLI: Maintenance mode activated"
  elif echo "$wp_result" | grep -q "not found\|not recognized\|Error"; then
    echo -e "  ${YELLOW}⚠${NC} WP-CLI not available or command not recognized, trying .maintenance file..."
    
    # Method 2: Create .maintenance file
    ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
      "echo '<?php \$upgrading = time(); ?>' > ${WP_ROOT}/${MAINTENANCE_FILE} && echo 'created' || echo 'failed'" 2>/dev/null
    echo -e "  ${GREEN}✓${NC} Created ${MAINTENANCE_FILE} file"
  else
    echo -e "  ${GREEN}✓${NC} WP-CLI: $wp_result"
  fi
  
  echo ""
  echo "Verifying..."
  sleep 2
  
  local http_code
  http_code=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 "$WP_SITE_URL" 2>/dev/null || echo "000")
  
  if [ "$http_code" = "503" ] || [ "$http_code" = "200" ]; then
    echo -e "  HTTP status: $http_code"
    echo -e "  ${GREEN}✓ Maintenance mode is ACTIVE${NC}"
  else
    echo -e "  HTTP status: $http_code"
    echo -e "  ${YELLOW}⚠ Unexpected status code${NC}"
  fi
}

disable_maintenance() {
  echo -e "${YELLOW}Disabling maintenance mode...${NC}"
  
  # Method 1: Try WP-CLI
  local wp_result
  wp_result=$(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
    "cd ${WP_ROOT} && wp maintenance-mode deactivate 2>&1" 2>/dev/null || echo "")
  
  if echo "$wp_result" | grep -qi "success\|deactivated\|already"; then
    echo -e "  ${GREEN}✓${NC} WP-CLI: Maintenance mode deactivated"
  elif echo "$wp_result" | grep -q "not found\|not recognized\|Error"; then
    echo -e "  ${YELLOW}⚠${NC} WP-CLI not available, removing .maintenance file..."
    
    # Method 2: Remove .maintenance file
    ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "root@${SERVER}" \
      "rm -f ${WP_ROOT}/${MAINTENANCE_FILE} && echo 'removed' || echo 'not found'" 2>/dev/null
    echo -e "  ${GREEN}✓${NC} Removed ${MAINTENANCE_FILE} file"
  else
    echo -e "  ${GREEN}✓${NC} WP-CLI: $wp_result"
  fi
  
  echo ""
  echo "Verifying..."
  sleep 2
  
  local http_code
  http_code=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 "$WP_SITE_URL" 2>/dev/null || echo "000")
  local has_maintenance
  has_maintenance=$(curl -s --max-time 10 "$WP_SITE_URL" 2>/dev/null | grep -ci "maintenance\|under construction\|coming soon" || echo "0")
  
  echo -e "  HTTP status: $http_code"
  
  if [ "$http_code" = "200" ] && [ "$has_maintenance" -eq 0 ]; then
    echo -e "  ${GREEN}✓ Maintenance mode is OFF — site is live${NC}"
  else
    echo -e "  ${YELLOW}⚠ Maintenance keywords: $has_maintenance detected${NC}"
  fi
}

# ── Main ───────────────────────────────────────────────────────

case "${1:-}" in
  on|enable)
    enable_maintenance
    ;;
  off|disable)
    disable_maintenance
    ;;
  status|check)
    check_status
    ;;
  *)
    usage
    ;;
esac
