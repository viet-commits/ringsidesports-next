#!/usr/bin/env node
/**
 * Ringside Sports — Supplier Sync
 * Pulls XML, extracts prices/stock, updates catalog-export.json
 * Cron: every 6 hours
 */

import { createHash } from "crypto";
import { readFileSync, writeFileSync, renameSync as mv, unlinkSync as rm, existsSync, mkdirSync } from "fs";
import { request } from "https";

const SUPPLIER_URL = "https://extensionsell.com/x/export3/eca6a9-2.xml";
const DATA_DIR = process.env.SYNC_DATA_DIR || "/opt/ringsidesports/data";
const TMP_XML = DATA_DIR + "/raw.xml.tmp";
const LIVE_XML = DATA_DIR + "/raw_product_inventory.xml";
const HASH_FILE = DATA_DIR + "/sync-hash.txt";
const CATALOG_JSON = process.env.CATALOG_PATH || "/tmp/catalog-export.json";
const MIN_SIZE = 100000;
const TIMEOUT = 120000;

function log(level, msg) {
  console.log(new Date().toISOString() + " [" + level + "] " + msg);
}

// ── 1. Fetch supplier XML ──────────────────────────────────────────────
async function fetchXml() {
  log("INFO", "Fetching supplier XML...");
  
  const buffer = await new Promise((resolve, reject) => {
    const chunks = [];
    const req = request(
      new URL(SUPPLIER_URL),
      { method: "GET", timeout: TIMEOUT, headers: { "User-Agent": "RingsideSports-Sync/2.0", Accept: "application/xml" } },
      (res) => {
        if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });

  if (buffer.length < MIN_SIZE) throw new Error("XML too small: " + buffer.length + " bytes");
  
  writeFileSync(TMP_XML, buffer);
  const hash = createHash("sha256").update(buffer).digest("hex");
  
  const prevHash = existsSync(HASH_FILE) ? readFileSync(HASH_FILE, "utf8").trim() : null;
  if (prevHash === hash) {
    log("INFO", "XML unchanged — skipping");
    rm(TMP_XML);
    return null;
  }
  
  mv(TMP_XML, LIVE_XML);
  writeFileSync(HASH_FILE, hash);
  log("INFO", "XML: " + buffer.length.toLocaleString() + " bytes, hash=" + hash.slice(0, 16));
  return LIVE_XML;
}

// ── 2. Extract prices/stock from XML ───────────────────────────────────
function extractPrices(xmlPath) {
  log("INFO", "Extracting prices...");
  const xml = readFileSync(xmlPath, "utf8");
  const map = new Map();
  
  const productRe = /<product>[\s\S]*?<\/product>/g;
  let match;
  while ((match = productRe.exec(xml)) !== null) {
    const block = match[0];
    const id = (block.match(/<id>([^<]+)<\/id>/) || [])[1];
    if (!id) continue;
    
    const priceMatch = block.match(/<regular_price>([^<]+)<\/regular_price>/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
    const stockStatus = (block.match(/<stock_status>([^<]+)<\/stock_status>/) || [])[1] || "instock";
    const qty = parseInt((block.match(/<quantity>([^<]+)<\/quantity>/) || [])[1] || "0", 10);
    
    map.set(id, { price, stockStatus, quantity: qty });
  }
  
  log("INFO", "Prices for " + map.size + " products");
  return map;
}

// ── 3. Merge into catalog ─────────────────────────────────────────────
function updateCatalog(prices) {
  log("INFO", "Updating catalog...");
  const catalog = JSON.parse(readFileSync(CATALOG_JSON, "utf8"));
  
  let updated = 0, skipped = 0;
  
  for (const p of catalog.catalog) {
    const entry = prices.get(p.supplierId);
    if (!entry) { skipped++; continue; }
    
    if (entry.price > 0) {
      p.price = Math.round(entry.price * 100);
      for (const v of p.variants) v.price = Math.round(entry.price * 100);
    }
    
    p.stockStatus = entry.stockStatus === "instock" ? "in_stock" : "out_of_stock";
    p.stockQuantity = entry.quantity;
    for (const v of p.variants) {
      v.stockStatus = entry.stockStatus === "instock" ? "in_stock" : "out_of_stock";
      v.stockQuantity = entry.quantity;
    }
    updated++;
  }
  
  writeFileSync(CATALOG_JSON, JSON.stringify(catalog, null, 2));
  log("INFO", "Updated " + updated + ", skipped " + skipped);
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  
  const xmlPath = await fetchXml();
  if (!xmlPath) { log("INFO", "Done — no changes"); return; }
  
  updateCatalog(extractPrices(xmlPath));
  log("INFO", "Sync complete");
}

main().catch(err => {
  log("ERROR", err.message || String(err));
  process.exit(1);
});
