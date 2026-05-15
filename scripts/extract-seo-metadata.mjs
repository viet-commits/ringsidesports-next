#!/usr/bin/env node

/**
 * Extract Yoast SEO metadata from WordPress database.
 *
 * Queries:
 * 1. All published posts/pages with Yoast SEO meta fields
 * 2. Product/tag/category taxonomy term SEO metadata
 * 3. Site-wide Yoast settings
 *
 * Output: /tmp/seo-metadata.json
 *
 * Usage:
 *   node scripts/extract-seo-metadata.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const SERVER = "root@45.124.55.87";
const SSH_KEY = "~/.ssh/id_ed25519";
const WP_DB = "ringsidesportsco_wp";
const WP_PREFIX = "dnoIdU5_";

function ssh(cmd) {
  const fullCmd = `ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SERVER} ${JSON.stringify(cmd)}`;
  try {
    return execSync(fullCmd, { encoding: "utf-8", timeout: 60000 });
  } catch (err) {
    console.error(`SSH command failed: ${cmd}`);
    console.error(err.stderr || err.message);
    throw err;
  }
}

// Run multiple queries and parse tab-separated output
function mysqlQuery(query) {
  return ssh(`mysql -N -B --default-character-set=utf8mb4 ${WP_DB} -e "${query.replace(/"/g, '\\"')}"`);
}

console.log("Extracting Yoast SEO metadata from WordPress...\n");

const metadata = {
  exportedAt: new Date().toISOString(),
  posts: {},
  terms: { product_cat: {}, product_tag: {} },
  site: {},
};

// ------------------------------
// 1. Yoast SEO for ALL published posts (products, pages, posts)
//    Only grab rows where at least one SEO field is non-null
// ------------------------------
console.log("Querying post-level SEO metadata...");
const postRows = mysqlQuery(`
  SELECT
    p.ID,
    p.post_type,
    p.post_name,
    (SELECT pm.meta_value FROM ${WP_PREFIX}postmeta pm WHERE pm.post_id = p.ID AND pm.meta_key = '_yoast_wpseo_title' LIMIT 1) AS seo_title,
    (SELECT pm.meta_value FROM ${WP_PREFIX}postmeta pm WHERE pm.post_id = p.ID AND pm.meta_key = '_yoast_wpseo_metadesc' LIMIT 1) AS seo_desc,
    (SELECT pm.meta_value FROM ${WP_PREFIX}postmeta pm WHERE pm.post_id = p.ID AND pm.meta_key = '_yoast_wpseo_focuskw' LIMIT 1) AS seo_focuskw,
    (SELECT pm.meta_value FROM ${WP_PREFIX}postmeta pm WHERE pm.post_id = p.ID AND pm.meta_key = '_yoast_wpseo_canonical' LIMIT 1) AS seo_canonical
  FROM ${WP_PREFIX}posts p
  WHERE p.post_status = 'publish'
  HAVING seo_title IS NOT NULL OR seo_desc IS NOT NULL OR seo_focuskw IS NOT NULL OR seo_canonical IS NOT NULL
  ORDER BY p.ID
`);

const postLines = postRows.trim().split("\n").filter(Boolean);
let postCount = 0;

for (const line of postLines) {
  const cols = line.split("\t");
  const [postId, postType, postName, title, desc, focuskw, canonical] = cols;

  const entry = { postType, slug: postName };
  if (title && title !== "NULL") entry.title = title;
  if (desc && desc !== "NULL") entry.description = desc;
  if (focuskw && focuskw !== "NULL") entry.focusKeyword = focuskw;
  if (canonical && canonical !== "NULL") entry.canonical = canonical;

  metadata.posts[postId] = entry;
  postCount++;
}
console.log(`  Found SEO metadata for ${postCount} posts (all types)`);

// Break down by post type
const byType = {};
for (const [, entry] of Object.entries(metadata.posts)) {
  byType[entry.postType] = (byType[entry.postType] || 0) + 1;
}
for (const [type, count] of Object.entries(byType).sort()) {
  console.log(`    ${type}: ${count}`);
}

// ------------------------------
// 2. Taxonomy term SEO metadata
// ------------------------------
console.log("\nQuerying taxonomy term SEO metadata...");
const termRows = mysqlQuery(`
  SELECT
    t.term_id,
    tt.taxonomy,
    t.slug,
    t.name,
    (SELECT tm.meta_value FROM ${WP_PREFIX}termmeta tm WHERE tm.term_id = t.term_id AND tm.meta_key = '_yoast_wpseo_title' LIMIT 1) AS seo_title,
    (SELECT tm.meta_value FROM ${WP_PREFIX}termmeta tm WHERE tm.term_id = t.term_id AND tm.meta_key = '_yoast_wpseo_metadesc' LIMIT 1) AS seo_desc
  FROM ${WP_PREFIX}terms t
  INNER JOIN ${WP_PREFIX}term_taxonomy tt ON t.term_id = tt.term_id
    AND tt.taxonomy IN ('product_cat', 'product_tag')
  HAVING seo_title IS NOT NULL OR seo_desc IS NOT NULL
  ORDER BY tt.taxonomy, t.term_id
`);

const termLines = termRows.trim().split("\n").filter(Boolean);
let termCat = 0, termTag = 0;

for (const line of termLines) {
  const cols = line.split("\t");
  const [termId, taxonomy, slug, name, title, desc] = cols;

  const entry = { name };
  if (title && title !== "NULL") entry.title = title;
  if (desc && desc !== "NULL") entry.description = desc;

  if (taxonomy === "product_cat") {
    metadata.terms.product_cat[slug] = entry;
    termCat++;
  } else if (taxonomy === "product_tag") {
    metadata.terms.product_tag[slug] = entry;
    termTag++;
  }
}
console.log(`  Categories with SEO: ${termCat}`);
console.log(`  Tags with SEO: ${termTag}`);

// ------------------------------
// 3. Site-wide Yoast settings
// ------------------------------
console.log("\nQuerying site-wide SEO settings...");
const siteRows = mysqlQuery(`
  SELECT option_name, option_value
  FROM ${WP_PREFIX}options
  WHERE option_name IN ('wpseo_titles', 'wpseo_social', 'wpseo')
`);

const siteLines = siteRows.trim().split("\n").filter(Boolean);
for (const line of siteLines) {
  const idx = line.indexOf("\t");
  if (idx > 0) {
    metadata.site[line.substring(0, idx)] = line.substring(idx + 1);
  }
}
console.log(`  Site settings exported: ${Object.keys(metadata.site).join(", ")}`);

// ------------------------------
// Summary
// ------------------------------
const withTitle = Object.values(metadata.posts).filter((e) => e.title).length;
const withDesc = Object.values(metadata.posts).filter((e) => e.description).length;
const withFocusKw = Object.values(metadata.posts).filter((e) => e.focusKeyword).length;

console.log(`\n=== SEO Metadata Summary ===`);
console.log(`Posts with SEO metadata: ${postCount}`);
console.log(`  With Yoast title: ${withTitle}`);
console.log(`  With meta description: ${withDesc}`);
console.log(`  With focus keyword: ${withFocusKw}`);
console.log(`Category terms with SEO: ${termCat}`);
console.log(`Tag terms with SEO: ${termTag}`);

// ------------------------------
// Write output
// ------------------------------
const OUTPUT = "/tmp/seo-metadata.json";
writeFileSync(OUTPUT, JSON.stringify(metadata, null, 2));
console.log(`\nWrote SEO metadata to ${OUTPUT}`);
console.log(`File size: ${Buffer.byteLength(JSON.stringify(metadata)).toLocaleString()} bytes`);
