#!/usr/bin/env node
/**
 * Phase 2: Extract WooCommerce catalog from WordPress database.
 *
 * Queries dnoIdU5_* tables directly (WC REST API blocked by cPanel PHP-FPM auth issue).
 * Outputs catalog-export.json containing CanonicalProduct[].
 *
 * Usage: node scripts/extract-catalog.mjs
 * Output: /tmp/catalog-export.json
 */

import { createConnection } from "mysql2/promise";
import { readFileSync, writeFileSync } from "fs";

/** Parse wp-config.php to extract DB credentials */
function parseWpConfig(configPath) {
  const content = readFileSync(configPath, "utf8");
  const get = (key) => {
    const m = content.match(new RegExp(`define\\(\\s*['"]${key}['"]\\s*,\\s*['"]([^'"]+)['"]`));
    return m ? m[1] : null;
  };
  return { user: get("DB_USER"), password: get("DB_PASSWORD"), name: get("DB_NAME"), host: "localhost" };
}

async function main() {
  const { user, password, name, host } = parseWpConfig(
    "/home/ringsidesportsco/public_html/wp-config.php"
  );
  const prefix = "dnoIdU5_";

  console.log(`Connecting to ${name} as ${user}@${host}...`);
  const conn = await createConnection({ host, user, password, database: name });

  // ── Get all published products ────────────────────────────────────────────
  const [products] = await conn.query(
    `SELECT ID, post_title, post_name, post_status, post_content, post_excerpt
       FROM ${prefix}posts
      WHERE post_type = 'product' AND post_status = 'publish'
      ORDER BY ID`
  );
  console.log(`Found ${products.length} published products`);

  // ── Bulk-load all product postmeta ────────────────────────────────────────
  const [allMeta] = await conn.query(
    `SELECT post_id, meta_key, meta_value FROM ${prefix}postmeta
      WHERE post_id IN (SELECT ID FROM ${prefix}posts WHERE post_type = 'product' AND post_status = 'publish')
      ORDER BY post_id`
  );

  // Index meta by post_id
  const metaByPost = {};
  for (const m of allMeta) {
    if (!metaByPost[m.post_id]) metaByPost[m.post_id] = {};
    metaByPost[m.post_id][m.meta_key] = m.meta_value;
  }

  // ── Bulk-load product categories ──────────────────────────────────────────
  const [prodTerms] = await conn.query(
    `SELECT tr.object_id as post_id, t.name, tt.taxonomy
       FROM ${prefix}term_relationships tr
       JOIN ${prefix}term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
       JOIN ${prefix}terms t ON tt.term_id = t.term_id
      WHERE tr.object_id IN (SELECT ID FROM ${prefix}posts WHERE post_type = 'product' AND post_status = 'publish')
        AND tt.taxonomy IN ('product_cat', 'product_tag')`
  );

  const catsByPost = {};
  const tagsByPost = {};
  for (const t of prodTerms) {
    if (t.taxonomy === "product_cat") {
      if (!catsByPost[t.post_id]) catsByPost[t.post_id] = [];
      catsByPost[t.post_id].push(t.name);
    } else {
      if (!tagsByPost[t.post_id]) tagsByPost[t.post_id] = [];
      tagsByPost[t.post_id].push(t.name);
    }
  }

  // ── Bulk-load variation postmeta ──────────────────────────────────────────
  const [varMeta] = await conn.query(
    `SELECT pm.post_id, pm.meta_key, pm.meta_value, p.post_parent, p.post_title, p.post_status
       FROM ${prefix}postmeta pm
       JOIN ${prefix}posts p ON pm.post_id = p.ID
      WHERE p.post_type = 'product_variation'
        AND p.post_status = 'publish'
        AND p.post_parent IN (SELECT ID FROM ${prefix}posts WHERE post_type = 'product' AND post_status = 'publish')
      ORDER BY p.post_parent, pm.post_id`
  );

  // Index variation meta by post_id
  const varMetaByPost = {};
  const varParents = {};
  const varTitles = {};
  for (const v of varMeta) {
    if (!varMetaByPost[v.post_id]) varMetaByPost[v.post_id] = {};
    varMetaByPost[v.post_id][v.meta_key] = v.meta_value;
    varParents[v.post_id] = v.post_parent;
    varTitles[v.post_id] = v.post_title;
  }

  // ── Build canonical products ──────────────────────────────────────────────
  const catalog = [];
  let skippedNoImportId = 0;
  let totalVariants = 0;
  let dedupedVariants = 0;

  for (const p of products) {
    const meta = metaByPost[p.ID] || {};
    const supplierId = meta["_import_id"];

    // Skip products without an _import_id (manually created, not from supplier)
    if (!supplierId) {
      skippedNoImportId++;
      continue;
    }

    const productType = meta["_product_type"] || "simple";
    const sku = meta["_sku"] || "";
    const price = parseFloat(meta["_regular_price"] || meta["_price"] || "0");
    const stockQty = parseInt(meta["_stock"] || "0", 10);
    const stockStatus = (meta["_stock_status"] === "instock" ? "in_stock" : "out_of_stock");

    // Images
    const images = [];
    const thumb = meta["_thumbnail_ext_url"];
    if (thumb) images.push(thumb);
    const gallery = meta["_product_image_gallery"];
    if (gallery) images.push(...gallery.split(",").filter(Boolean));

    const product = {
      supplierId,
      title: p.post_title,
      description: p.post_content || "",
      handle: p.post_name || p.ID.toString(),
      status: "published",
      categories: catsByPost[p.ID] || [],
      tags: tagsByPost[p.ID] || [],
      images,
      variants: [],
      wcPostId: p.ID,
      productType,
      supplierMpn: sku,
      price: Math.round(price * 100), // cents
      stockQuantity: stockQty,
      stockStatus,
    };

    // Build variants for variable products
    if (productType === "variable") {
      const [variations] = await conn.query(
        `SELECT ID FROM ${prefix}posts
          WHERE post_type = 'product_variation' AND post_parent = ? AND post_status = 'publish'`,
        [p.ID]
      );

      // Track variant identities to dedupe (bug fix for §2.1)
      const seenIdentities = new Set();

      for (const v of variations) {
        const vm = varMetaByPost[v.ID] || {};
        const varSku = vm["_sku"] || "";

        // ── Derive supplier identity ─────────────────────────────────────────
        // Prefer _import_id on variation (format: parentId__varSku)
        // Fall back: use variant's own SKU
        let supplierVariantSku = varSku;
        const varImportId = vm["_import_id"];
        if (varImportId && varImportId.includes("__")) {
          // Extract variant SKU from composite: "parentId__varSku"
          const parts = varImportId.split("__");
          if (parts[1]) supplierVariantSku = parts[1];
        }

        const supplierIdentity = `${supplierId}__${supplierVariantSku}`;

        // ── Skip duplicate identities (§2.1 fix) ─────────────────────────────
        if (seenIdentities.has(supplierIdentity)) {
          dedupedVariants++;
          continue;
        }
        seenIdentities.add(supplierIdentity);

        const varPrice = parseFloat(vm["_regular_price"] || vm["_price"] || product.price / 100 || "0");
        const varStockQty = parseInt(vm["_stock"] || "0", 10);
        const varStockStatus = (vm["_stock_status"] === "instock" ? "in_stock" : "out_of_stock");

        // Options (size, colour)
        const options = {};
        const size = vm["attribute_pa_size"];
        const colour = vm["attribute_pa_colour"] || vm["attribute_pa_color"];
        if (size) options.size = size;
        if (colour) options.colour = colour;

        // Variant images
        const varImages = [];
        const varThumb = vm["_thumbnail_ext_url"];
        if (varThumb) varImages.push(varThumb);

        product.variants.push({
          supplierVariantSku,
          supplierIdentity,
          title: varTitles[v.ID] || `${product.title} — ${Object.values(options).join(", ")}`,
          price: Math.round(varPrice * 100),
          stockQuantity: varStockQty,
          stockStatus: varStockStatus,
          options,
          images: varImages,
          wcVariationId: v.ID,
          weight: vm["_weight"],
          description: vm["_variation_description"],
        });
        totalVariants++;
      }
    } else if (productType === "simple") {
      // Simple products have one implicit variant
      const supplierIdentity = `${supplierId}__${sku || "default"}`;
      product.variants.push({
        supplierVariantSku: sku || "default",
        supplierIdentity,
        title: product.title,
        price: product.price || 0,
        stockQuantity: product.stockQuantity || 0,
        stockStatus: product.stockStatus || "in_stock",
        options: {},
        images: product.images,
        wcVariationId: 0,
      });
      totalVariants++;
    }

    catalog.push(product);
  }

  await conn.end();

  // ── Verify ────────────────────────────────────────────────────────────────
  const allIdentities = [];
  for (const p of catalog) {
    for (const v of p.variants) {
      allIdentities.push(v.supplierIdentity);
    }
  }

  // Check for duplicate supplier_identity
  const identityCounts = {};
  for (const id of allIdentities) {
    identityCounts[id] = (identityCounts[id] || 0) + 1;
  }
  const duplicates = Object.entries(identityCounts).filter(([, c]) => c > 1);

  // ── Output ────────────────────────────────────────────────────────────────
  const stats = {
    products: catalog.length,
    totalVariants,
    dedupedVariants,
    duplicateIdentities: duplicates.length,
    duplicateDetails: duplicates.slice(0, 10),
    skippedNoImportId,
    variableProducts: catalog.filter((p) => p.productType === "variable").length,
    simpleProducts: catalog.filter((p) => p.productType === "simple").length,
  };

  console.log("\n=== Migration Stats ===");
  console.log(JSON.stringify(stats, null, 2));

  // Write catalog
  writeFileSync("/tmp/catalog-export.json", JSON.stringify({ catalog, stats }, null, 2));
  console.log(`\n✅ Catalog written: ${catalog.length} products, ${totalVariants} variants → /tmp/catalog-export.json`);

  if (duplicates.length > 0) {
    console.log(`❌ ${duplicates.length} duplicate supplier identities found!`);
    duplicates.slice(0, 5).forEach(([id, count]) =>
      console.log(`   ${id}: ${count}x`)
    );
    process.exit(1);
  } else {
    console.log("✅ 0 duplicate supplier identities");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
