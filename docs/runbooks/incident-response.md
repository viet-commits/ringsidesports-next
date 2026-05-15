# Incident Response Runbook

**Owner:** Viet Le (primary), OpenClaw automation (monitoring)
**Updated:** 2026-05-15

---

## Severity Levels

| Level | Criteria | Response Time | Escalation |
|-------|----------|---------------|------------|
| **P1** | Store unavailable — customers cannot browse or purchase | Immediate (5 min) | Viet Le — Telegram / +61 [phone] |
| **P2** | Orders failing — checkout broken but storefront loads | < 30 min | Viet Le — Telegram |
| **P3** | Supplier sync down — stock data stale but store functional | < 2 hours | Viet Le — Telegram |
| **P4** | Non-critical — cosmetic issues, minor bugs | Next business day | GitHub Issue |

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| **Primary on-call** | Viet Le | Telegram (direct) — primary channel |
| **Email (extended outage)** | Viet Le | viet@baracon.com.au |
| **Cloudflare** | Dashboard | https://dash.cloudflare.com |
| **Stripe** | Dashboard | https://dashboard.stripe.com |
| **Server (metalduet)** | Root SSH | `ssh root@45.124.55.87` (key: `~/.ssh/id_ed25519`) |

---

## P1: Store Unavailable

**Symptoms:** `ringsidesports.com.au` returns 5xx, timeout, or SSL error. Cloudflare shows origin down.

### Response Steps

```bash
# 1. Verify the outage
curl -sI https://ringsidesports.com.au
curl -sI https://api.ringsidesports.com.au/health

# 2. SSH to server
ssh root@45.124.55.87

# 3. Check Docker services
docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml ps

# 4. Check each service health
docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml exec postgres \
  pg_isready -U ringsidesports

docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml exec redis \
  redis-cli ping

curl -s http://localhost:7700/health  # MeiliSearch

curl -s http://localhost:9000/health  # Backend

# 5. Restart failing services
docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml restart backend

# 6. If all services are up but storefront unreachable:
#    Check Cloudflare Pages deployment status
#    Check Cloudflare DNS records

# 7. Check system resources
free -h
df -h
docker system df
```

### Escalation

If services cannot be restored within 5 minutes:
1. **Execute rollback** — see `docs/runbooks/rollback.md`
2. **Notify Viet Le** via Telegram with server state summary

---

## P2: Orders Failing

**Symptoms:** Checkout errors, Stripe webhook failures, orders not appearing in admin.

### Response Steps

```bash
# 1. Check Stripe dashboard for failed payments
#    → https://dashboard.stripe.com/payments
#    Look for recent failures with error codes

# 2. Verify Stripe API key is valid
curl -s https://api.stripe.com/v1/balance \
  -u "${STRIPE_API_KEY}:" | jq '.error'

# 3. Check Medusa webhook endpoints
ssh root@45.124.55.87
docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml logs backend \
  --since 30m | grep -i "stripe\|webhook\|error"

# 4. Verify webhook endpoint is accessible from Stripe
#    Stripe Dashboard → Developers → Webhooks → Endpoint
#    Expected URL: https://api.ringsidesports.com.au/hooks/payment/stripe

# 5. Check Postgres for stuck orders
docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml exec postgres \
  psql -U ringsidesports -c "SELECT id, status, created_at FROM \"order\" WHERE status = 'pending' AND created_at > NOW() - INTERVAL '1 hour';"

# 6. Restart backend if webhook processing queue appears stuck
docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml restart backend
```

### Workaround

If Stripe is processing payments but Medusa is not recording orders:
- Orders can be manually reconciled from Stripe dashboard
- Customers receive Stripe payment confirmation even if Medusa order is delayed

### Escalation

If not resolved within 30 min: notify Viet Le. Consider rollback if >50% of orders failing.

---

## P3: Supplier Sync Down

**Symptoms:** Product stock shows outdated values, new products missing, MeiliSearch index stale.

### Response Steps

```bash
# 1. Check if Extensionsell XML feed is available
curl -sI "https://www.extensionsell.com/datafeed_4222.xml"
# Expected: 200 with XML content-type

# 2. Check sync cron is running
ssh root@45.124.55.87
crontab -l | grep -i "sync\|catalog\|ringsidesports"

# 3. Run manual sync
cd /tmp/ringsidesports-next
node scripts/migrate-catalog-standalone.js 2>&1 | tee /tmp/sync-debug-$(date +%Y%m%d-%H%M).log

# 4. Check for errors in output:
#    - XML parse errors → Extensionsell feed may have changed format
#    - Network errors → Check server outbound connectivity
#    - Product count mismatch → Some products may have been removed/added by supplier

# 5. Re-index MeiliSearch if sync succeeded
MEILI_MASTER_KEY=ringsidesports-meili-key \
MEILI_HOST=http://45.124.55.87:7700 \
node scripts/index-meilisearch.mjs

# 6. Verify stock data freshness
node scripts/verify-catalog.ts
```

### Workaround

If Extensionsell feed is down for >2 hours:
- Contact supplier for alternative data feed URL
- Products will continue to show last-known stock levels (stale but not broken)

### Escalation

If not resolved within 2 hours: notify Viet Le via Telegram with sync log.

---

## P4: Non-Critical Issues

**Symptoms:** Minor UI bugs, typos, missing images, slow page loads (not outage-level).

### Response Steps

1. **Document the issue** — Create GitHub issue at `https://github.com/viet-commits/ringsidesports-next/issues`
2. **Include in ticket:**
   - URL where issue occurs
   - Screenshot (if applicable)
   - Browser/device info
   - Expected vs actual behavior
3. **Label:** `bug`, `p4-noncritical`
4. **Triage during next business day**

### No Escalation Required

P4 issues do not require immediate response. They are queued for the next work session.

---

## Monitoring Health Checks

Run periodically (automated via OpenClaw heartbeat or cron):

```bash
# Quick health check — all services
#!/bin/bash
echo "=== Ringside Sports Health Check ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# API
API=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://api.ringsidesports.com.au/health)
echo "API: $API"

# Storefront
WEB=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://ringsidesports.com.au)
echo "Storefront: $WEB"

# MeiliSearch
MEILI=$(curl -s --max-time 5 http://45.124.55.87:7700/health | jq -r '.status')
echo "MeiliSearch: $MEILI"

# Docker services (via SSH)
SERVICES=$(ssh -o ConnectTimeout=10 root@45.124.55.87 \
  "docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml ps --format '{{.Name}}: {{.Status}}'")
echo "Docker:"
echo "$SERVICES"

# Alert if anything is down
if [[ "$API" != "200" ]] || [[ "$WEB" != "200" ]]; then
  echo "⚠️ ALERT: Critical service down!"
fi
```

---

## Post-Incident

For all P1/P2 incidents:

1. **Create incident record** in `docs/incidents/YYYY-MM-DD-brief-description.md`
2. **Include:** timeline, root cause, resolution, prevention steps
3. **Update runbooks** if the incident revealed gaps in procedure

---

**Related docs:**
- Cutover: `docs/runbooks/cutover.md`
- Rollback: `docs/runbooks/rollback.md`
- SSL Setup: `docs/ssl-setup.md`
