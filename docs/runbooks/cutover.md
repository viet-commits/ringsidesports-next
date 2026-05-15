# Cutover Runbook

**Target completion:** Phase 8 (Go-Live Preparation)
**Estimated duration:** 45 minutes
**Rollback window:** Immediate — see `rollback.md`

---

## Pre-cutover Checklist

All items must be ✅ before starting cutover:

- [ ] **All products migrated** — 483 products indexed in MeiliSearch; catalog JSON exported from WP
- [ ] **Supplier sync running on 15-min interval** — Phase 3 pipeline: `scripts/migrate-catalog-standalone.js` → `scripts/index-meilisearch.mjs` on cron
- [ ] **Storefront parity verified** — Phase 5 static export passes build; 19 pages generated; all routes render
- [ ] **Redirect map generated and validated** — `scripts/generate-redirect-map.mjs` produces 1,033 entries; KV namespace provisioned; worker deployed and tested
- [ ] **Customer accounts migrated** — `scripts/migrate-customers.mjs` exported 1,496 customers; import scripts ready
- [ ] **Orders migrated** — `scripts/migrate-orders.mjs` exported 331 orders; verification passed
- [ ] **DNS TTL lowered to 60s** — Set TTL=60 on `ringsidesports.com.au`, `api.ringsidesports.com.au`, `admin.ringsidesports.com.au` at least 24h before cutover
- [ ] **SSL certs provisioned** — Let's Encrypt certs active on `api.ringsidesports.com.au` and `admin.ringsidesports.com.au` via Caddy (see `docs/ssl-setup.md`)
- [ ] **Backups verified** — PostgreSQL dump + R2 bucket sync confirmed restorable within last 24h
- [ ] **Rollback plan rehearsed** — At least one dry-run of `docs/runbooks/rollback.md` steps completed

---

## Cutover Procedure

### Step 1: Enable Maintenance Mode on Legacy WP

```bash
# SSH to server
ssh root@45.124.55.87

# Create maintenance mode flag via WP-CLI
cd /home/ringsidesports/public_html
wp maintenance-mode activate

# Verify — legacy site should show maintenance page
curl -sI https://ringsidesports.com.au | grep "503\|Retry-After"
```
**Expected:** `HTTP/2 503` or WordPress maintenance page with `Retry-After` header.
**Duration:** 2 min

---

### Step 2: Run Final Catalog Sync (Phase 3 Pipeline)

```bash
# From local repo
cd /tmp/ringsidesports-next

# Full catalog extraction from Extensionsell XML
node scripts/migrate-catalog-standalone.js

# Re-index MeiliSearch with fresh catalog
MEILI_MASTER_KEY=ringsidesports-meili-key \
MEILI_HOST=http://45.124.55.87:7700 \
node scripts/index-meilisearch.mjs

# Verify index count
curl -s -H "Authorization: Bearer ringsidesports-meili-key" \
  http://45.124.55.87:7700/indexes/products/stats | jq '.numberOfDocuments'
```
**Expected:** Document count matches or exceeds 483 products. No errors in sync output.
**Duration:** 5 min

---

### Step 3: Import Customers + Orders (Phase 7 Scripts)

```bash
# Ensure migration output files are available
ls -la /tmp/customers-export.json /tmp/orders-export.json

# Import customers into Medusa
# (Run via Medusa API or admin import — exact command depends on Medusa v2 import module)
# Refer to scripts/migrate-customers.mjs for the export format

# Import orders into Medusa
# Refer to scripts/migrate-orders.mjs for the export format

# Verify counts
curl -s https://api.ringsidesports.com.au/admin/customers/count \
  -H "Authorization: Bearer ${MEDUSA_ADMIN_TOKEN}" | jq '.count'
# Expected: ~1,496 customers
```
**Duration:** 5 min

---

### Step 4: Generate Fresh Redirect Map + Sitemap (Phase 6)

```bash
cd /tmp/ringsidesports-next

# Generate redirect map from WP DB
node scripts/generate-redirect-map.mjs

# Generate sitemap from catalog data
node scripts/generate-sitemap.mjs

# Verify outputs
echo "Redirect entries: $(jq 'length' /tmp/redirect-map.json)"
echo "Sitemap: $(head -5 /tmp/sitemap.xml)"
```
**Expected:** 1,033+ redirect entries, valid sitemap XML with 517+ URLs.
**Duration:** 2 min

---

### Step 5: Deploy Redirect Worker to Cloudflare

```bash
cd /tmp/ringsidesports-next/infra/workers/redirect-worker

# Bulk upload redirect map to KV
wrangler kv:bulk put REDIRECTS \
  --binding=REDIRECTS \
  --path=<(node -e "
    const data = require('/tmp/redirect-map.json');
    data.forEach(r => console.log(JSON.stringify({key: r.source, value: JSON.stringify(r)})));
  ")

# Deploy the worker
wrangler deploy

# Test a known redirect
curl -sI "https://ringsidesports.com.au/product/some-legacy-product/" | grep "Location\|301"
```
**Expected:** Worker deploys without errors. Test redirect returns `HTTP/2 301` with correct `Location` header.
**Duration:** 3 min

---

### Step 6: Switch DNS for Storefront to Cloudflare Pages

```bash
# In Cloudflare Dashboard → ringsidesports.com.au → DNS:
# Change CNAME record for @ (root) or ringsidesports.com.au
#   FROM: 45.124.55.87 (legacy server)
#   TO:   ringsidesports-next.pages.dev (Cloudflare Pages project)

# Or via Cloudflare API:
curl -X PUT "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${ROOT_RECORD_ID}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CNAME",
    "name": "ringsidesports.com.au",
    "content": "ringsidesports-next.pages.dev",
    "ttl": 60,
    "proxied": true
  }'

# Verify DNS propagation (may take 60s with TTL=60)
dig +short ringsidesports.com.au
# Expected: Cloudflare proxy IPs
```
**Expected:** `dig` returns Cloudflare IPs (proxied). Browsing `https://ringsidesports.com.au` loads the Next.js storefront.
**Duration:** 3 min

---

### Step 7: Point api.ringsidesports.com.au to Medusa Backend

```bash
# In Cloudflare Dashboard → ringsidesports.com.au → DNS:
# Ensure A record for api subdomain points to 45.124.55.87 (proxied)
# Caddy on server handles TLS termination and reverse proxy to :9000

# Verify API is reachable
curl -s https://api.ringsidesports.com.au/health
# Expected: {"status":"ok"}

# Verify admin is reachable
curl -s https://admin.ringsidesports.com.au/health
# Expected: {"status":"ok"}
```
**Expected:** Both health endpoints return `{"status":"ok"}`. Caddy serves valid HTTPS certs.
**Duration:** 2 min

---

### Step 8: Verify Core Functionality

| Check | Command / Method | Expected |
|-------|-----------------|----------|
| Homepage loads | `curl -sI https://ringsidesports.com.au` | `HTTP/2 200` |
| Search works | Visit `/search?q=gloves` | Returns product cards |
| Cart works | Add item to cart; refresh page | Cart persists (localStorage) |
| Checkout loads | Visit `/cart` → click Checkout | Checkout page renders |
| API health | `curl -s https://api.ringsidesports.com.au/health` | `{"status":"ok","postgres":"connected","redis":"connected","meilisearch":"connected"}` |

**Duration:** 5 min

---

### Step 9: Smoke Test 20 Random Product URLs

Run through the smoke test checklist in `docs/smoke-test.md`:

```bash
# Extract 20 random product URLs from redirect map
shuf -n 20 /tmp/redirect-map.json | jq -r '.destination' | while read url; do
  status=$(curl -sI -o /dev/null -w "%{http_code}" "https://ringsidesports.com.au$url")
  echo "$status $url"
done
```
**Expected:** All 20 URLs return `200`. 0 errors, 0 redirect loops.
**Duration:** 3 min

---

### Step 10: Monitor Error Rates (30 min)

```bash
# Watch Cloudflare Analytics dashboard for:
# - 5xx error rate < 1%
# - 404 rate (expected for unmatched legacy paths → handled by redirect worker)
# - Origin response time < 500ms

# Server-side monitoring via SSH:
ssh root@45.124.55.87

# Check Docker services
docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml ps

# Watch backend logs
docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml logs -f backend --tail=100

# Check Postgres connections
docker compose -f /opt/ringsidesports/infra/docker/docker-compose.yml exec postgres \
  psql -U ringsidesports -c "SELECT count(*) FROM pg_stat_activity;"

# Check MeiliSearch health
curl -s http://45.124.55.87:7700/health
```

**Duration:** 30 min

---

## Go/No-Go Criteria

### ✅ GO if ALL of:

- [ ] All 483+ products accessible via storefront
- [ ] Search returns results (MeiliSearch responding)
- [ ] Cart add/remove/persist works
- [ ] Checkout flow reaches payment step
- [ ] 20/20 smoke test product URLs return 200
- [ ] Redirect worker serving 301s for known legacy URLs
- [ ] API health endpoint returns all dependencies healthy
- [ ] 5xx error rate < 1% on Cloudflare dashboard
- [ ] No critical errors in backend logs after 5 min of traffic
- [ ] SSL valid on all 3 domains (ringsidesports.com.au, api., admin.)

### 🛑 NO-GO if ANY of:

- [ ] MeiliSearch not responding or index empty
- [ ] Checkout fails (payment gateway unreachable)
- [ ] >2/20 smoke test URLs return errors or redirect loops
- [ ] Backend health check reports any dependency as "disconnected"
- [ ] SSL certificate errors on any domain
- [ ] Postgres connection pool exhausted (connections > 50)

**If NO-GO:** Execute rollback immediately — see `docs/runbooks/rollback.md`.

---

## Post-Cutover

- [ ] Remove maintenance mode from legacy WP (or keep as failover backup on alternate port)
- [ ] Confirm Cloudflare Analytics showing traffic on new origin
- [ ] Verify Stripe webhook endpoints receive events from new storefront
- [ ] Notify stakeholders: "Ringside Sports is live on the new headless platform"
- [ ] Update DNS TTL back to 3600s (1h) after 24h of stable operation
- [ ] Tag release: `git tag v1.0.0 && git push origin v1.0.0`

---

**Related docs:**
- Rollback: `docs/runbooks/rollback.md`
- Incident Response: `docs/runbooks/incident-response.md`
- SSL Setup: `docs/ssl-setup.md`
- Smoke Tests: `docs/smoke-test.md`
