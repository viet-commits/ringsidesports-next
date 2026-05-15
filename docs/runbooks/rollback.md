# Rollback Runbook

**Estimated duration:** 10 minutes
**Trigger:** Any NO-GO criterion from `cutover.md` go/no-go check, or on-call decision.

---

## Triggering Conditions

Execute rollback immediately if ANY of the following occur during or after cutover:

| Condition | Detection |
|-----------|-----------|
| Checkout success rate drops below 80% for >30 min | Stripe dashboard / Cloudflare Analytics |
| Critical bug prevents order fulfillment | Customer reports / internal testing |
| Supplier sync corruption detected | `scripts/verify-catalog.ts` reports mismatches |
| 5xx error rate exceeds 5% for >10 min | Cloudflare Analytics |
| Search not returning results | User reports / manual test at `/search?q=boxing` |
| API completely unreachable for >5 min | Uptime monitoring / `curl https://api.ringsidesports.com.au/health` |
| SSL certificate invalid or expired on any domain | Browser warnings / `curl -sI` check |
| Postgres connection exhaustion (connections > 80) | `SELECT count(*) FROM pg_stat_activity` |

**Key metric:** If the storefront is unable to accept orders for more than 15 minutes, roll back.

---

## Rollback Procedure

### Step 1: Point DNS Back to Legacy Server

```bash
# In Cloudflare Dashboard → ringsidesports.com.au → DNS:
# Revert CNAME record for ringsidesports.com.au root
#   FROM: ringsidesports-next.pages.dev
#   TO:   45.124.55.87

# Or via Cloudflare API:
CF_ZONE_ID="<zone_id_from_dashboard>"
ROOT_RECORD_ID="<dns_record_id>"

curl -X PUT "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${ROOT_RECORD_ID}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "A",
    "name": "ringsidesports.com.au",
    "content": "45.124.55.87",
    "ttl": 60,
    "proxied": true
  }'

echo "DNS reverted. Waiting for propagation (TTL=60s)..."
sleep 65
```
**Duration:** 2 min

---

### Step 2: Disable Redirect Worker

```bash
cd /tmp/ringsidesports-next/infra/workers/redirect-worker

# Option A: Delete the worker route (worker stays deployed but doesn't intercept)
wrangler delete

# Option B: Disable via Cloudflare Dashboard
# Workers & Pages → ringsidesports-redirect → Disable

# Verify redirect worker is no longer intercepting
curl -sI "https://ringsidesports.com.au/product/some-product/" | grep -i "cf-ray\|server"
# Expected: Response from legacy nginx/cPanel, not from worker
```
**Duration:** 1 min

---

### Step 3: Verify Legacy Site Is Serving Correctly

```bash
# Check homepage
HTTP_CODE=$(curl -sI -o /dev/null -w "%{http_code}" https://ringsidesports.com.au)
echo "Homepage status: $HTTP_CODE"
# Expected: 200

# Check a known product page
curl -sI "https://ringsidesports.com.au/product/boxing-gloves/" | head -5
# Expected: 200 with cache headers from WP/WooCommerce

# Check checkout page
curl -sI "https://ringsidesports.com.au/checkout/" | head -5
# Expected: 200 (or redirect to cart if empty)

# Verify legacy server is not in maintenance mode
ssh root@45.124.55.87 "wp maintenance-mode deactivate"
```

**If legacy site is also down:** Check cPanel/Apache on the server:
```bash
ssh root@45.124.55.87
systemctl status httpd.service
# or
systemctl status nginx
```
**Duration:** 2 min

---

### Step 4: Notify Stakeholders

Send notification via Telegram/email:

> **Ringside Sports — Rollback Executed**
>
> **Time:** [timestamp]
> **Reason:** [triggering condition]
> **Current status:** Legacy WordPress site restored at ringsidesports.com.au
> **Impact:** Store is operational on legacy stack
> **Next steps:** [debug plan / ETA for next attempt]
>
> — OpenClaw Automation

**Recipients:**
- Viet Le (Telegram: primary channel)
- If extended outage: email viet@baracon.com.au

**Duration:** 1 min

---

## Post-Rollback

### Immediate (within 30 min)

- [ ] Confirm Stripe is receiving payments from legacy checkout
- [ ] Check WP admin — verify no orders were lost (compare Stripe vs WC order IDs)
- [ ] Review backend logs to identify root cause:
  ```bash
  ssh root@45.124.55.87
  docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml logs backend --since 1h | tail -200
  ```
- [ ] Check if any new customer registrations or orders on the new stack need manual migration back to WP
  ```bash
  # Orders created during cutover window on Medusa
  curl -s https://api.ringsidesports.com.au/admin/orders \
    -H "Authorization: Bearer ${MEDUSA_ADMIN_TOKEN}" \
    | jq '.orders[] | select(.created_at > "CUTOVER_START_TIME")'
  ```

### Before Next Attempt

- [ ] Fix root cause identified from logs
- [ ] Re-verify all pre-cutover checklist items
- [ ] Rehearse rollback again with updated timings
- [ ] Create incident post-mortem in `docs/incidents/YYYY-MM-DD-rollback.md`

---

## Rollback Success Criteria

- [ ] `ringsidesports.com.au` serves WordPress/WooCommerce (verified via `curl -sI`)
- [ ] Checkout on legacy site processes a test payment successfully
- [ ] Redirect worker disabled (no interference with legacy URLs)
- [ ] All stakeholders notified
- [ ] Zero customer-facing errors observed for 10 minutes after rollback

---

**Related docs:**
- Cutover: `docs/runbooks/cutover.md`
- Incident Response: `docs/runbooks/incident-response.md`
