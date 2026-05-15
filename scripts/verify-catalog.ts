#!/usr/bin/env -S npx tsx
/**
 * verify-catalog.ts — Phase 2 verification
 *
 * Loads /tmp/catalog-export.json and runs integrity checks:
 * 1. 0 duplicate supplier_identity values across all variants
 * 2. Every variant has a non-empty supplierIdentity
 * 3. Every product has at least one variant
 * 4. Spot-check summary
 *
 * Usage: npx tsx scripts/verify-catalog.ts
 */

import fs from "node:fs";
import type { CatalogExport } from "@ringsidesports/shared-types";

function main() {
  const path = "/tmp/catalog-export.json";
  if (!fs.existsSync(path)) {
    console.error(`❌ File not found: ${path}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(path, "utf-8");
  const data: CatalogExport = JSON.parse(raw);

  console.log("📦 Catalog Verification Report");
  console.log("═══════════════════════════════");
  console.log(`Exported at:     ${data.exportedAt}`);
  console.log(`Total products:  ${data.totalProducts}`);
  console.log(`Total variants:  ${data.totalVariants}`);
  console.log(`Actual products: ${data.products.length}`);
  console.log("");

  // ── Check 1: Duplicate supplier_identity ─────────────────────────────────
  const identityMap = new Map<string, { productTitle: string; variantTitle: string }[]>();
  let totalVariantCount = 0;
  let emptySkuCount = 0;
  let productsWithoutVariants = 0;

  for (const product of data.products) {
    if (product.variants.length === 0) {
      productsWithoutVariants++;
    }
    for (const variant of product.variants) {
      totalVariantCount++;
      if (!variant.supplierVariantSku || variant.supplierVariantSku.trim() === "") {
        emptySkuCount++;
      }
      const key = variant.supplierIdentity;
      if (!identityMap.has(key)) {
        identityMap.set(key, []);
      }
      identityMap.get(key)!.push({
        productTitle: product.title,
        variantTitle: variant.title,
      });
    }
  }

  // Find duplicates
  const duplicates = Array.from(identityMap.entries()).filter(
    ([, entries]) => entries.length > 1,
  );

  if (duplicates.length === 0) {
    console.log("✅ DUPLICATE CHECK: 0 duplicate supplier_identity values found");
  } else {
    console.log(`❌ DUPLICATE CHECK: ${duplicates.length} duplicate supplier_identity values!`);
    for (const [identity, entries] of duplicates.slice(0, 10)) {
      console.log(`   ${identity}:`);
      for (const e of entries) {
        console.log(`     - "${e.productTitle}" / "${e.variantTitle}"`);
      }
    }
    if (duplicates.length > 10) {
      console.log(`   ... and ${duplicates.length - 10} more`);
    }
  }
  console.log("");

  // ── Check 2: Total counts ────────────────────────────────────────────────
  const expectedVariants = data.totalVariants;
  if (totalVariantCount === expectedVariants) {
    console.log(`✅ COUNT CHECK: ${totalVariantCount} variants counted matches ${expectedVariants} declared`);
  } else {
    console.log(`❌ COUNT CHECK: ${totalVariantCount} counted vs ${expectedVariants} declared`);
  }
  console.log("");

  // ── Check 3: Empty supplierVariantSku ────────────────────────────────────
  if (emptySkuCount === 0) {
    console.log("✅ SKU CHECK: All variants have non-empty supplierVariantSku");
  } else {
    console.log(`⚠️  SKU CHECK: ${emptySkuCount} variants have empty supplierVariantSku`);
  }
  console.log("");

  // ── Check 4: Products without variants ───────────────────────────────────
  if (productsWithoutVariants === 0) {
    console.log("✅ VARIANT CHECK: All products have at least 1 variant");
  } else {
    console.log(`⚠️  VARIANT CHECK: ${productsWithoutVariants} products have 0 variants`);
  }
  console.log("");

  // ── Product type breakdown ───────────────────────────────────────────────
  const typeCounts: Record<string, number> = {};
  for (const p of data.products) {
    typeCounts[p.productType] = (typeCounts[p.productType] || 0) + 1;
  }
  console.log("📊 PRODUCT TYPE BREAKDOWN:");
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`   ${type}: ${count}`);
  }
  console.log("");

  // ── Top categories ───────────────────────────────────────────────────────
  const catCounts: Record<string, number> = {};
  for (const p of data.products) {
    for (const cat of p.categories) {
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
  }
  const topCats = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);
  console.log("📊 TOP CATEGORIES:");
  for (const [cat, count] of topCats) {
    console.log(`   ${cat}: ${count} products`);
  }
  console.log("");

  // ── Spot-check: 20 random products ───────────────────────────────────────
  console.log("🔍 SPOT-CHECK (first 20 products):");
  for (let i = 0; i < Math.min(20, data.products.length); i++) {
    const p = data.products[i];
    const variants = p.variants;
    const prices = variants.map((v) => `$${(v.price / 100).toFixed(2)}`);
    console.log(`   [${p.wcPostId}] "${p.title}" — ${p.productType} — ${variants.length} variants`);
    console.log(`       Categories: ${p.categories.join(", ") || "(none)"}`);
    console.log(`       Prices: ${prices.slice(0, 3).join(", ")}${prices.length > 3 ? " ..." : ""}`);
    if (variants.length > 0) {
      console.log(`       Stock: ${variants[0].stockStatus} (${variants[0].stockQuantity})`);
      console.log(`       supplierId: ${p.supplierId}`);
      console.log(`       First variant identity: ${variants[0].supplierIdentity}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("");
  console.log("═══════════════════════════════");
  if (duplicates.length === 0 && emptySkuCount === 0) {
    console.log("✅ VERDICT: Catalog passes integrity checks");
  } else {
    console.log("⚠️  VERDICT: Catalog has warnings — review above");
  }
}

main();
