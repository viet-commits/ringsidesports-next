# Smoke Test Checklist

**Purpose:** Post-cutover verification that the new storefront is functioning correctly.
**Run after:** DNS switch (Step 10 of `docs/runbooks/cutover.md`)
**Expected duration:** 15 minutes

---

## Pre-Flight

- [ ] DNS has propagated (verify: `dig +short ringsidesports.com.au` returns Cloudflare IPs)
- [ ] API health endpoint responds: `curl -s https://api.ringsidesports.com.au/health` → `{"status":"ok"}`
- [ ] Admin health endpoint responds: `curl -s https://admin.ringsidesports.com.au/health` → `{"status":"ok"}`
- [ ] SSL valid on all domains (no browser warnings)

---

## 1. Homepage

| Check | Steps | Expected |
|-------|-------|----------|
| Page loads | Visit `https://ringsidesports.com.au` | HTTP 200, renders within 3s |
| Hero section | Scroll to top | Hero banner visible |
| Category grid | Scroll down | Featured categories grid renders |
| Top sellers | Scroll down | Product cards visible with images |
| Header | Top of page | Dark header with logo, nav, search, cart icon |
| Footer | Bottom of page | Links, contact info, payment methods |
| Mobile responsive | Resize to < 768px or DevTools mobile view | Hamburger menu, single-column layout |

---

## 2. Product URLs (20 Random Checks)

Test 20 product pages from the redirect map. Products should load with images, price, variants.

```bash
# Generate 20 random product URLs and test them
cd /tmp/ringsidesports-next

# From the generated redirect map, extract product destinations:
jq -r '.[] | select(.source | startswith("/product/")) | .destination' /tmp/redirect-map.json \
  | shuf -n 20 | while read url; do
  code=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 "https://ringsidesports.com.au$url")
  echo "$code $url"
done
```

| # | Product URL | HTTP Status | Images Loaded | Price Displayed | Pass/Fail |
|---|------------|-------------|---------------|-----------------|-----------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |
| 11 | | | | | |
| 12 | | | | | |
| 13 | | | | | |
| 14 | | | | | |
| 15 | | | | | |
| 16 | | | | | |
| 17 | | | | | |
| 18 | | | | | |
| 19 | | | | | |
| 20 | | | | | |

**Pass criteria:** 20/20 return HTTP 200.

---

## 3. Search Functionality

| Check | Steps | Expected |
|-------|-------|----------|
| Search page loads | Visit `/search` | Search page renders |
| Text search | Enter "boxing gloves" in search bar, submit | Results display product cards |
| Search with typo | Enter "boxng glovs" | Typo-tolerant results (MeiliSearch) |
| Empty search | Enter "xyznonexistent" | "No results found" message |
| Facet filters | Click category/tag filters in sidebar | Results narrow correctly |
| Price display | Check any result card | AUD $ with GST note |

---

## 4. Category Pages

| Check | Steps | Expected |
|-------|-------|----------|
| Products listing | Visit `/products` | Grid of product cards, sidebar with filters |
| Category filter | Visit `/products?category=boxing` | Only boxing products shown |
| Sort | Click sort dropdown (if present) | Products reorder |
| Pagination | Scroll to bottom | "Load more" or page numbers (if >1 page) |
| Mobile filter drawer | Resize to mobile, click filter button | Filter drawer slides in |

---

## 5. Product Detail Page

| Check | Steps | Expected |
|-------|-------|----------|
| Page loads | Visit any product from URL list above | Product detail renders |
| Image gallery | Click/hover images (if multiple) | Images swap, no broken images |
| Variant selector | Click size/colour options | Updates price/stock indicator |
| Stock badge | Check stock indicator | Shows "In Stock" / "Low Stock" / "Out of Stock" |
| Add to cart | Select variant, click "Add to Cart" | Cart count updates in header |
| Price with GST | Check price display | Shows "inc GST" note |
| Product info | Check description, SKU, tags | All metadata fields render |

---

## 6. Cart Flow

| Check | Steps | Expected |
|-------|-------|----------|
| Add item | Add product to cart | Cart drawer slides in |
| Quantity change | Click +/- in cart | Quantity updates, total recalculates |
| Cart persist | Add item, refresh page | Item still in cart (localStorage) |
| Cart page | Visit `/cart` | Full cart page with order summary |
| GST breakdown | Check totals on cart page | Shows subtotal, GST, total |
| Remove item | Click remove/X on item | Item removed, cart updates |
| Empty cart | Remove all items | Empty cart message shown |
| Checkout button | Click checkout | Redirects to checkout or payment page |

---

## 7. Checkout Flow

| Check | Steps | Expected |
|-------|-------|----------|
| Checkout page | Proceed from cart | Checkout form renders |
| Shipping form | Fill in shipping details | Fields accept input |
| Payment | Enter test card: `4242 4242 4242 4242` | Stripe Elements loads |
| Place order | Submit order | Success/confirmation page |
| Order confirmation | Check page after order | Order number, items, total shown |

> **Note:** Use Stripe test mode for smoke test. Switch to live mode after verification.

---

## 8. Redirect Worker

| Check | Steps | Expected |
|-------|-------|----------|
| Product redirect | Visit a legacy URL from redirect map | 301 to new URL |
| Category redirect | Visit `/product-category/boxing/` | 301 to `/products?category=boxing` |
| Tag redirect | Visit `/product-tag/clearance/` | 301 to `/products?tag=clearance` |
| Query string preserved | Visit `/product/xyz/?utm_source=test` | 301 with `?utm_source=test` preserved |
| Static page | Visit `/about/` | 301 to `/` (or new about page) |
| WP content blocked | Visit `/wp-admin/` | 301 to `/` |
| Non-existent path | Visit `/nonexistent-page-123/` | 301 to `/` or 404 |

---

## 9. Mobile Rendering

Test on actual mobile device or Chrome DevTools mobile simulation (iPhone 14, Pixel 7):

| Check | Steps | Expected |
|-------|-------|----------|
| Homepage | Load on mobile viewport | Single column, hamburger nav |
| Product grid | Visit `/products` | 2-column grid |
| Product detail | Visit any product | Image full-width, variants stacked |
| Cart | Open cart drawer | Full-width drawer, touch-friendly buttons |
| Search | Open search from header | Search bar accessible |
| Scroll performance | Scroll product list | Smooth, no jank |
| Tap targets | Try tapping buttons/links | All targets > 44px, no mis-taps |
| Dark mode | Check appearance | Light theme enforced (no iOS dark mode bug) |

---

## 10. SSL Verification

| Domain | Test Command | Expected |
|--------|-------------|----------|
| Storefront | `curl -sI https://ringsidesports.com.au` | HTTP/2 200 |
| API | `curl -s https://api.ringsidesports.com.au/health` | `{"status":"ok"}` |
| Admin | `curl -s https://admin.ringsidesports.com.au/health` | `{"status":"ok"}` |

```bash
# Full SSL check for all domains
for domain in ringsidesports.com.au api.ringsidesports.com.au admin.ringsidesports.com.au; do
  echo "=== $domain ==="
  echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null \
    | openssl x509 -noout -dates -issuer -subject
  echo ""
done
```

**Expected:** All certs valid, issuer = Let's Encrypt (api/admin) or Cloudflare (root), not expired.

---

## 11. Performance (Optional)

| Check | Steps | Target |
|-------|-------|--------|
| Lighthouse desktop | Run in Chrome DevTools | Score > 90 |
| Lighthouse mobile | Run in Chrome DevTools | Score > 80 |
| TTFB | Check Network tab | < 500ms |
| Largest image | Check largest product image | < 500KB, WebP format if possible |

---

## Results Summary

| Section | Result | Notes |
|---------|--------|-------|
| 1. Homepage | ✅ / ❌ | |
| 2. Product URLs (20) | ✅ / ❌ | __/20 passed |
| 3. Search | ✅ / ❌ | |
| 4. Categories | ✅ / ❌ | |
| 5. Product Detail | ✅ / ❌ | |
| 6. Cart | ✅ / ❌ | |
| 7. Checkout | ✅ / ❌ | |
| 8. Redirects | ✅ / ❌ | |
| 9. Mobile | ✅ / ❌ | |
| 10. SSL | ✅ / ❌ | |
| 11. Performance | ✅ / ❌ | |

**Go/No-Go:**
- ✅ **GO** if sections 1-10 all pass
- 🛑 **NO-GO** if any of sections 1, 3, 7, 8, or 10 fail

---

**Related docs:**
- Cutover: `docs/runbooks/cutover.md`
- Rollback: `docs/runbooks/rollback.md`
