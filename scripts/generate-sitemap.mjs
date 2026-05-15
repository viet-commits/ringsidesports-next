#!/usr/bin/env node

/**
 * Sitemap generator for Ringside Sports.
 *
 * Reads catalog-export.json and generates:
 * 1. sitemap.xml (or sitemap index if >50,000 URLs)
 * 2. Multiple sitemap fragments if needed
 *
 * Output: /tmp/sitemap.xml (and /tmp/sitemap-*.xml if split)
 *
 * Usage:
 *   node scripts/generate-sitemap.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";

const CATALOG_PATH = "/tmp/catalog-export.json";
const SITE_URL = "https://ringsidesports.com.au";
const LAST_MOD = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
const MAX_URLS_PER_SITEMAP = 50000;

// ------------------------------
// Load catalog
// ------------------------------
console.log("Loading catalog data...");
const raw = readFileSync(CATALOG_PATH, "utf-8");
const catalog = JSON.parse(raw);
const products = catalog.products;

const publishedProducts = products.filter((p) => p.status === "published");
console.log(`Found ${publishedProducts.length} published products`);

// ------------------------------
// Collect all unique categories
// ------------------------------
const categoryMap = new Map(); // categoryId -> Set<productHandles>
for (const product of publishedProducts) {
  for (const catId of product.categories) {
    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, new Set());
    }
    categoryMap.get(catId).add(product.handle);
  }
}
console.log(`Found ${categoryMap.size} unique categories`);

// ------------------------------
// Static pages
// ------------------------------
const staticPages = [
  { url: "/", changefreq: "daily", priority: "1.0" },
  { url: "/products", changefreq: "daily", priority: "0.9" },
  { url: "/cart", changefreq: "weekly", priority: "0.3" },
  { url: "/search", changefreq: "weekly", priority: "0.4" },
];

// ------------------------------
// Build URL entries
// ------------------------------
const urlEntries = [];

function addEntry(loc, changefreq, priority) {
  urlEntries.push({ loc, changefreq, priority, lastmod: LAST_MOD });
}

// Static pages
for (const page of staticPages) {
  addEntry(`${SITE_URL}${page.url}`, page.changefreq, page.priority);
}

// Category pages
for (const [catId, handles] of categoryMap) {
  // We use the first product's handle to derive a category name
  // In the actual storefront, categories are referenced by name
  // For sitemap, we list category URLs
  addEntry(`${SITE_URL}/products?category=${encodeURIComponent(catId)}`, "weekly", "0.7");
}

// Product pages
for (const product of publishedProducts) {
  addEntry(`${SITE_URL}/products/${encodeURIComponent(product.handle)}`, "weekly", "0.6");
}

console.log(`Total URL entries: ${urlEntries.length}`);

// ------------------------------
// Generate XML
// ------------------------------
function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateSitemapXml(entries) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n`;
  xml += `        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"\n`;
  xml += `        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"\n`;
  xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  for (const entry of entries) {
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(entry.loc)}</loc>\n`;
    xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    xml += `    <priority>${entry.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}

function generateSitemapIndex(sitemapFiles) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const file of sitemapFiles) {
    xml += `  <sitemap>\n`;
    xml += `    <loc>${escapeXml(`${SITE_URL}/${file}`)}</loc>\n`;
    xml += `    <lastmod>${LAST_MOD}</lastmod>\n`;
    xml += `  </sitemap>\n`;
  }

  xml += `</sitemapindex>\n`;
  return xml;
}

// ------------------------------
// Write output
// ------------------------------
if (urlEntries.length <= MAX_URLS_PER_SITEMAP) {
  const xml = generateSitemapXml(urlEntries);
  const OUTPUT = "/tmp/sitemap.xml";
  writeFileSync(OUTPUT, xml);
  console.log(`\nWrote sitemap with ${urlEntries.length} URLs to ${OUTPUT}`);
  console.log(`File size: ${Buffer.byteLength(xml).toLocaleString()} bytes`);
} else {
  // Split into multiple sitemaps
  const numFiles = Math.ceil(urlEntries.length / MAX_URLS_PER_SITEMAP);
  const sitemapFiles = [];

  for (let i = 0; i < numFiles; i++) {
    const chunk = urlEntries.slice(i * MAX_URLS_PER_SITEMAP, (i + 1) * MAX_URLS_PER_SITEMAP);
    const xml = generateSitemapXml(chunk);
    const filename = `sitemap-${i + 1}.xml`;
    writeFileSync(`/tmp/${filename}`, xml);
    sitemapFiles.push(filename);
    console.log(`Wrote ${filename} with ${chunk.length} URLs`);
  }

  const indexXml = generateSitemapIndex(sitemapFiles);
  writeFileSync("/tmp/sitemap.xml", indexXml);
  console.log(`\nWrote sitemap index referencing ${numFiles} sitemaps to /tmp/sitemap.xml`);
}

console.log("\nSitemap generation complete!");
