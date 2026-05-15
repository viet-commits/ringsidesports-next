#!/usr/bin/env node

/**
 * Generate 301 redirect map from WordPress product data.
 *
 * Queries the WP database for all products with _import_id,
 * cross-references with catalog-export.json to get new Shopify handles,
 * and outputs /tmp/redirect-map.json.
 *
 * Usage:
 *   node scripts/generate-redirect-map.mjs
 *
 * Requires SSH access to the server. Uses the WP DB credentials
 * found in wp-config.php on the server.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ------------------------------
// Config
// ------------------------------
const SERVER = "root@45.124.55.87";
const SSH_KEY = "~/.ssh/id_ed25519";
const CATALOG_PATH = "/tmp/catalog-export.json";

// WP DB credentials (from wp-config.php on server)
const WP_DB = "ringsidesportsco_wp";
const WP_PREFIX = "dnoIdU5_";

// ------------------------------
// Helpers
// ------------------------------
function ssh(cmd) {
  const fullCmd = `ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SERVER} ${JSON.stringify(cmd)}`;
  try {
    const result = execSync(fullCmd, { encoding: "utf-8", timeout: 60000 });
    return result;
  } catch (err) {
    console.error(`SSH command failed: ${cmd}`);
    console.error(err.stderr || err.message);
    throw err;
  }
}

function mysqlQuery(query) {
  const escaped = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return ssh(`mysql -N -B --default-character-set=utf8mb4 ${WP_DB} -e "${escaped}"`);
}

// ------------------------------
// Load catalog data
// ------------------------------
console.log("Loading catalog data...");
const raw = readFileSync(CATALOG_PATH, "utf-8");
const catalog = JSON.parse(raw);

// Build wcPostId -> handle map
const postIdToHandle = new Map();
for (const product of catalog.products) {
  if (product.wcPostId && product.handle) {
    postIdToHandle.set(product.wcPostId, product.handle);
  }
}
console.log(`Loaded ${postIdToHandle.size} WC product ID -> handle mappings`);

// ------------------------------
// Query WP product slugs
// ------------------------------
console.log("\nQuerying WordPress products with _import_id...");
const productRows = mysqlQuery(`
  SELECT p.ID, p.post_name, pm.meta_value AS import_id
  FROM ${WP_PREFIX}posts p
  INNER JOIN ${WP_PREFIX}postmeta pm ON p.ID = pm.post_id AND pm.meta_key = '_import_id'
  WHERE p.post_type = 'product'
    AND p.post_status = 'publish'
    AND p.post_name != ''
  ORDER BY p.ID
`);

const redirects = [];

// Parse product rows
const productLines = productRows.trim().split("\n").filter(Boolean);
console.log(`Found ${productLines.length} products with _import_id`);

let skippedProducts = 0;
for (const line of productLines) {
  const cols = line.split("\t");
  const postId = parseInt(cols[0], 10);
  const slug = cols[1];
  if (!postId || !slug || isNaN(postId)) {
    skippedProducts++;
    continue;
  }
  const newHandle = postIdToHandle.get(postId);

  if (newHandle) {
    redirects.push({
      source: `/product/${slug}/`,
      destination: `/products/${newHandle}`,
      code: 301,
    });
  } else {
    console.warn(`  No catalog handle found for WC post ID ${postId} (slug: ${slug})`);
  }
}
if (skippedProducts > 0) {
  console.log(`  Skipped ${skippedProducts} products with missing data`);
}

console.log(`Generated ${redirects.length} product redirects`);

// ------------------------------
// Query WP product categories
// ------------------------------
console.log("\nQuerying product categories...");
const catRows = mysqlQuery(`
  SELECT t.slug, t.name
  FROM ${WP_PREFIX}terms t
  INNER JOIN ${WP_PREFIX}term_taxonomy tt ON t.term_id = tt.term_id AND tt.taxonomy = 'product_cat'
  WHERE t.slug != ''
  ORDER BY t.term_id
`);

const catLines = catRows.trim().split("\n").filter(Boolean);
console.log(`Found ${catLines.length} product categories`);

// Build category name -> slug map (new categories from catalog)
const catalogCategories = new Set();
for (const product of catalog.products) {
  for (const catId of product.categories) {
    catalogCategories.add(catId);
  }
}

for (const line of catLines) {
  const [slug, name] = line.split("\t");
  if (slug && name) {
    redirects.push({
      source: `/product-category/${slug}/`,
      destination: `/products?category=${encodeURIComponent(slug)}`,
      code: 301,
    });
  }
}

console.log(`Added ${catLines.length} category redirects`);

// ------------------------------
// Query WP product tags
// ------------------------------
console.log("\nQuerying product tags...");
const tagRows = mysqlQuery(`
  SELECT t.slug, t.name
  FROM ${WP_PREFIX}terms t
  INNER JOIN ${WP_PREFIX}term_taxonomy tt ON t.term_id = tt.term_id AND tt.taxonomy = 'product_tag'
  WHERE t.slug != ''
  ORDER BY t.term_id
`);

const tagLines = tagRows.trim().split("\n").filter(Boolean);
console.log(`Found ${tagLines.length} product tags`);

for (const line of tagLines) {
  const [slug, name] = line.split("\t");
  if (slug && name) {
    redirects.push({
      source: `/product-tag/${slug}/`,
      destination: `/products?tag=${encodeURIComponent(slug)}`,
      code: 301,
    });
  }
}

console.log(`Added ${tagLines.length} tag redirects`);

// ------------------------------
// Static pages
// ------------------------------
console.log("\nQuerying static pages...");
const pageRows = mysqlQuery(`
  SELECT post_name FROM ${WP_PREFIX}posts
  WHERE post_type = 'page' AND post_status = 'publish' AND post_name != ''
  ORDER BY ID
`);

const pageLines = pageRows.trim().split("\n").filter(Boolean);

// Flatsome theme builder pages and other non-content pages to skip
const SKIP_PAGE_SLUGS = new Set([
  "accordion", "buttons", "countdown", "elements", "flip-book",
  "forms", "hotspot", "logo", "newsletter", "price-table",
  "search-box", "shop-demos", "left-sidebar", "instagram-feed",
  "home-old", "home-2", "pages", "test", "sample-page",
  "woocommerce-search", "evercompare",
]);

const KNOWN_PAGE_REDIRECTS = {
  "about": "/about",
  "contact": "/contact",
  "blog": "/blog",
  "faq": "/faq",
  "faqs": "/faq",
  "returns": "/returns",
  "privacy-policy": "/privacy-policy",
  "terms-conditions": "/terms-conditions",
  "warranty-information": "/warranty-information",
  "size-chart": "/size-chart",
  "gift-voucher": "/gift-voucher",
  "specials": "/specials",
  "sales": "/specials",
  "sitemap": "/sitemap",
};

let pageRedirects = 0;
for (const slug of pageLines) {
  if (!slug || slug === "home" || SKIP_PAGE_SLUGS.has(slug)) {
    continue;
  }
  if (slug === "shop") {
    redirects.push({ source: "/shop/", destination: "/products", code: 301 });
    pageRedirects++;
    continue;
  }
  const dest = KNOWN_PAGE_REDIRECTS[slug] || "/";
  redirects.push({ source: `/${slug}/`, destination: dest, code: 301 });
  pageRedirects++;
}

console.log(`Added ${pageRedirects} static page redirects`);

// ------------------------------
// General / high-value routes
// ------------------------------
const staticRedirects = [
  { source: "/shop/", destination: "/products", code: 301 },
  { source: "/my-account/", destination: "/cart", code: 301 },
  { source: "/checkout/", destination: "/cart", code: 301 },
  { source: "/cart/", destination: "/cart", code: 301 },
  // WP content paths
  { source: "/wp-content/*", destination: "/", code: 301 },
  { source: "/wp-admin/*", destination: "/", code: 301 },
  { source: "/wp-json/*", destination: "/", code: 301 },
  // Legacy feeds
  { source: "/feed/", destination: "/", code: 301 },
  { source: "/comments/feed/", destination: "/", code: 301 },
];

for (const r of staticRedirects) {
  redirects.push(r);
}

// ------------------------------
// Deduplicate (by source)
// ------------------------------
const seen = new Set();
const unique = [];
for (const r of redirects) {
  if (!seen.has(r.source)) {
    seen.add(r.source);
    unique.push(r);
  }
}

console.log(`\nTotal redirects before dedup: ${redirects.length}`);
console.log(`Total redirects after dedup: ${unique.length}`);

// ------------------------------
// Write output
// ------------------------------
const OUTPUT = "/tmp/redirect-map.json";
writeFileSync(OUTPUT, JSON.stringify(unique, null, 2));
console.log(`\nWrote ${unique.length} redirects to ${OUTPUT}`);

// Summary
const types = {};
for (const r of unique) {
  const type = r.source.split("/")[1] || "root";
  types[type] = (types[type] || 0) + 1;
}
console.log("\nRedirect map breakdown:");
for (const [type, count] of Object.entries(types).sort()) {
  console.log(`  /${type}/* : ${count}`);
}
