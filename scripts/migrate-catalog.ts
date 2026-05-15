#!/usr/bin/env -S npx tsx
/**
 * migrate-catalog.ts — Phase 2 catalog extraction
 *
 * Queries the WordPress MySQL database directly (WC REST API is broken due
 * to PHP-FPM not forwarding Basic Auth on cPanel). Exports canonical product
 * data to /tmp/catalog-export.json.
 *
 * Usage: npx tsx scripts/migrate-catalog.ts
 */

import mysql from "mysql2/promise";
import fs from "node:fs";
import type {
  CanonicalProduct,
  CanonicalVariant,
  CatalogExport,
} from "@ringsidesports/shared-types";

// ─── WP DB config (from wp-config.php) ──────────────────────────────────────
const WP_DB = {
  host: "45.124.55.87",
  user: "ringsidesportsco_wp",
  password: "*37mN7ux.{Tt",
  database: "ringsidesportsco_wp",
  port: 3306,
};

const TABLE_PREFIX = "dnoIdU5_";

// Types for raw DB rows
interface PostMetaRow {
  meta_key: string;
  meta_value: string;
}

interface TermRow {
  term_id: number;
  name: string;
  slug: string;
  taxonomy: string;
}

interface VariationRow {
  ID: number;
  post_parent: number;
  post_title: string;
  post_status: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeMeta(rows: PostMetaRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.meta_value !== null && row.meta_value !== undefined) {
      map[row.meta_key] = row.meta_value;
    }
  }
  return map;
}

function parsePrice(raw: string | undefined): number {
  if (!raw) return 0;
  // WooCommerce stores prices as strings. Convert to cents (int).
  const num = parseFloat(raw);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

function parseIntSafe(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : n;
}

function extractSupplierId(importId: string | undefined): string {
  // _import_id is the legacy supplier <id> from XML import
  // It may be just a number or a compound key
  if (!importId) return "unknown";
  return importId.trim();
}

/**
 * Extract the variant-specific SKU from the variation's _import_id or _sku.
 *
 * _import_id format: {supplierId}_{variantSku}
 *   e.g. "51285302116648_PBG5TEAL12" → variantSku = "PBG5TEAL12"
 *   e.g. "51151535276328_"           → variantSku = "" (trailing underscore, no SKU)
 *
 * If _import_id doesn't yield a variant SKU, fall back to _sku.
 * If both are empty, use the variation's WC post ID as a synthetic SKU.
 */
function extractSupplierVariantSku(
  variantImportId: string | undefined,
  variantSku: string | undefined,
  variationPostId: number,
): string {
  // Try to extract from _import_id: split on "_" and take the last part
  if (variantImportId && variantImportId.length > 0) {
    const lastUnderscoreIdx = variantImportId.lastIndexOf("_");
    if (lastUnderscoreIdx >= 0 && lastUnderscoreIdx < variantImportId.length - 1) {
      const candidate = variantImportId.slice(lastUnderscoreIdx + 1);
      if (candidate.length > 0) return candidate;
    }
  }

  // Fallback to _sku
  if (variantSku && variantSku.length > 0) return variantSku;

  // Ultimate fallback: variation's WC post ID as string
  return String(variationPostId);
}

function buildSupplierIdentity(supplierId: string, supplierVariantSku: string): string {
  return `${supplierId}__${supplierVariantSku}`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("Connecting to WordPress MySQL...");
  const conn = await mysql.createConnection(WP_DB);

  try {
    // ── 1. Get all published products ──────────────────────────────────────
    const [productRows] = await conn.query(
      `SELECT ID, post_title, post_name, post_content, post_status, post_type
       FROM ${TABLE_PREFIX}posts
       WHERE post_type = 'product'
         AND post_status = 'publish'
       ORDER BY ID`,
    );

    const products = productRows as any[];
    console.log(`Found ${products.length} published products`);

    // ── 2. Get product metadata in bulk ────────────────────────────────────
    const productIds = products.map((p) => p.ID);
    if (productIds.length === 0) {
      console.log("No products found. Exiting.");
      return;
    }

    // Chunk to avoid huge IN clauses
    const chunkSize = 500;
    const canonicalProducts: CanonicalProduct[] = [];
    let totalVariants = 0;

    for (let i = 0; i < productIds.length; i += chunkSize) {
      const chunk = productIds.slice(i, i + chunkSize);
      const idList = chunk.join(",");

      // Get postmeta for this chunk
      const [metaRows] = await conn.query(
        `SELECT post_id, meta_key, meta_value
         FROM ${TABLE_PREFIX}postmeta
         WHERE post_id IN (${idList})
           AND meta_key IN (
             '_import_id', '_sku', '_price', '_regular_price', '_sale_price',
             '_stock', '_stock_status', '_thumbnail_ext_url',
             '_product_image_gallery', '_product_type', '_product_attributes'
           )`,
      );

      // Group meta by post_id
      const metaByPost: Record<number, PostMetaRow[]> = {};
      for (const row of metaRows as any[]) {
        if (!metaByPost[row.post_id]) metaByPost[row.post_id] = [];
        metaByPost[row.post_id].push(row);
      }

      // Get categories and tags for this chunk
      const [categoryRows] = await conn.query(
        `SELECT tr.object_id, t.name, tt.taxonomy
         FROM ${TABLE_PREFIX}term_relationships tr
         JOIN ${TABLE_PREFIX}term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
         JOIN ${TABLE_PREFIX}terms t ON tt.term_id = t.term_id
         WHERE tr.object_id IN (${idList})
           AND tt.taxonomy IN ('product_cat', 'product_tag')`,
      );

      const categoriesByPost: Record<number, string[]> = {};
      const tagsByPost: Record<number, string[]> = {};
      for (const row of categoryRows as any[]) {
        if (row.taxonomy === "product_cat") {
          if (!categoriesByPost[row.object_id]) categoriesByPost[row.object_id] = [];
          categoriesByPost[row.object_id].push(row.name);
        } else if (row.taxonomy === "product_tag") {
          if (!tagsByPost[row.object_id]) tagsByPost[row.object_id] = [];
          tagsByPost[row.object_id].push(row.name);
        }
      }

      // ── 3. Get variations for this chunk ────────────────────────────────
      const [variationRows] = await conn.query(
        `SELECT ID, post_parent, post_title, post_status
         FROM ${TABLE_PREFIX}posts
         WHERE post_type = 'product_variation'
           AND post_parent IN (${idList})`,
      );

      const variationsByParent: Record<number, VariationRow[]> = {};
      const allVariationIds: number[] = [];
      for (const row of variationRows as any[]) {
        if (!variationsByParent[row.post_parent]) variationsByParent[row.post_parent] = [];
        variationsByParent[row.post_parent].push(row);
        allVariationIds.push(row.ID);
      }

      // Get variation postmeta in bulk
      const variationMetaByPost: Record<number, Record<string, string>> = {};
      if (allVariationIds.length > 0) {
        // Chunk variation IDs too
        for (let v = 0; v < allVariationIds.length; v += 500) {
          const varChunk = allVariationIds.slice(v, v + 500).join(",");
          const [varMetaRows] = await conn.query(
            `SELECT post_id, meta_key, meta_value
             FROM ${TABLE_PREFIX}postmeta
             WHERE post_id IN (${varChunk})
               AND meta_key IN (
                 '_sku', '_price', '_regular_price', '_sale_price',
                 '_stock', '_stock_status', '_thumbnail_ext_url',
                 '_import_id', 'attribute_pa_size', 'attribute_pa_colour',
                 'attribute_pa_color', 'attribute_pa_style', 'attribute_pa_width'
               )`,
          );

          for (const row of varMetaRows as any[]) {
            if (!variationMetaByPost[row.post_id]) variationMetaByPost[row.post_id] = {};
            variationMetaByPost[row.post_id][row.meta_key] = row.meta_value;
          }
        }
      }

      // ── 4. Build canonical products ─────────────────────────────────────
      for (const prod of chunk) {
        const meta = normalizeMeta(metaByPost[prod.ID] || []);
        const supplierId = extractSupplierId(meta["_import_id"]);
        const productType = meta["_product_type"] || "simple";

        // Images
        const images: string[] = [];
        const thumb = meta["_thumbnail_ext_url"];
        if (thumb) images.push(thumb);
        const gallery = meta["_product_image_gallery"];
        if (gallery) {
          // Gallery can be comma-separated external URLs or attachment IDs
          const galleryItems = gallery.split(",").map((s) => s.trim()).filter(Boolean);
          for (const item of galleryItems) {
            if (item.startsWith("http")) {
              images.push(item);
            }
          }
        }

        // Parse price from product-level meta
        const priceRaw = meta["_price"] || meta["_regular_price"];
        const stockQty = parseIntSafe(meta["_stock"]);
        const stockStatus = meta["_stock_status"] === "instock" ? "in_stock" :
                           meta["_stock_status"] === "outofstock" ? "out_of_stock" :
                           "in_stock";

        // Build variants
        const rawVariations = variationsByParent[prod.ID] || [];
        const variants: CanonicalVariant[] = [];

        if (productType === "variable" && rawVariations.length > 0) {
          const seenIdentities = new Set<string>();
          for (const v of rawVariations) {
            const vMeta = variationMetaByPost[v.ID] || {};
            const varSku = vMeta["_sku"] || "";
            const varImportId = vMeta["_import_id"];

            const supplierVariantSku = extractSupplierVariantSku(
              varImportId,
              varSku,
              v.ID,
            );

            const supplierIdentity = buildSupplierIdentity(supplierId, supplierVariantSku);

            // Deduplicate: skip variants with same supplier_identity within the same product
            if (seenIdentities.has(supplierIdentity)) continue;
            seenIdentities.add(supplierIdentity);

            // Variant options
            const options: Record<string, string> = {};
            for (const key of Object.keys(vMeta)) {
              if (key.startsWith("attribute_pa_")) {
                const attrName = key.replace("attribute_pa_", "");
                const val = vMeta[key];
                if (val) options[attrName] = val;
              }
            }

            // Variant images
            const varImages: string[] = [];
            const varThumb = vMeta["_thumbnail_ext_url"];
            if (varThumb) varImages.push(varThumb);

            const varPriceRaw = vMeta["_price"] || vMeta["_regular_price"];
            const varPrice = parsePrice(varPriceRaw);
            const varStockQty = parseIntSafe(vMeta["_stock"]);
            const varStockStatus = vMeta["_stock_status"] === "instock" ? "in_stock" :
                                   vMeta["_stock_status"] === "outofstock" ? "out_of_stock" :
                                   "in_stock";

            variants.push({
              supplierVariantSku,
              supplierIdentity,
              title: v.post_title || prod.post_title,
              price: varPrice,
              stockQuantity: varStockQty,
              stockStatus: varStockStatus,
              options,
              images: varImages,
              wcVariationId: v.ID,
            });
          }
        } else {
          // Simple product — create a single variant representing the product itself
          const productSku = meta["_sku"] || "";
          const supplierVariantSku = productSku;
          const supplierIdentity = buildSupplierIdentity(supplierId, supplierVariantSku);

          variants.push({
            supplierVariantSku,
            supplierIdentity,
            title: prod.post_title,
            price: parsePrice(priceRaw),
            stockQuantity: stockQty,
            stockStatus,
            options: {},
            images: [],
            wcVariationId: 0, // simple products don't have variations
          });
        }

        totalVariants += variants.length;

        canonicalProducts.push({
          supplierId,
          title: prod.post_title,
          description: prod.post_content || undefined,
          handle: prod.post_name,
          status: prod.post_status === "publish" ? "published" : "draft",
          categories: categoriesByPost[prod.ID] || [],
          tags: tagsByPost[prod.ID] || [],
          images,
          variants,
          wcPostId: prod.ID,
          productType: productType === "variable" ? "variable" : "simple",
        });
      }

      const progress = Math.min(i + chunkSize, productIds.length);
      console.log(`  Processed ${progress}/${productIds.length} products...`);
    }

    // ── 5. Output ──────────────────────────────────────────────────────────
    const exportData: CatalogExport = {
      exportedAt: new Date().toISOString(),
      totalProducts: canonicalProducts.length,
      totalVariants,
      products: canonicalProducts,
    };

    const outputPath = "/tmp/catalog-export.json";
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), "utf-8");
    console.log(`\n✅ Export complete: ${outputPath}`);
    console.log(`   Products: ${exportData.totalProducts}`);
    console.log(`   Variants: ${exportData.totalVariants}`);
    console.log(`   File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
