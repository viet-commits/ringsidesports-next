#!/usr/bin/env node
/**
 * migrate-catalog-standalone.js — Phase 2 catalog extraction (v2)
 *
 * Fixes:
 * - _import_id uses single-underscore separator: supplierId_variantSku
 * - Fallback: use variation WC post ID when both _import_id and _sku are empty
 */
const mysql = require("mysql2/promise");
const fs = require("node:fs");

const WP_DB = {
  host: "localhost",
  user: "ringsidesportsco_wp",
  password: "*37mN7ux.{Tt",
  database: "ringsidesportsco_wp",
};
const TABLE_PREFIX = "dnoIdU5_";

function normalizeMeta(rows) {
  const map = {};
  for (const row of rows) {
    if (row.meta_value !== null && row.meta_value !== undefined) {
      map[row.meta_key] = row.meta_value;
    }
  }
  return map;
}

function parsePrice(raw) {
  if (!raw) return 0;
  const num = parseFloat(raw);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

function parseIntSafe(raw) {
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : n;
}

function extractSupplierId(importId) {
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
 * If both are empty, use the variation's WC post ID as a synthetic SKU
 * to guarantee uniqueness.
 */
function extractSupplierVariantSku(variantImportId, variantSku, variationPostId) {
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

function buildSupplierIdentity(supplierId, supplierVariantSku) {
  return `${supplierId}__${supplierVariantSku}`;
}

async function main() {
  console.log("Connecting to WordPress MySQL...");
  const conn = await mysql.createConnection(WP_DB);

  try {
    const [productRows] = await conn.query(
      `SELECT ID, post_title, post_name, post_content, post_status
       FROM ${TABLE_PREFIX}posts
       WHERE post_type = 'product' AND post_status = 'publish'
       ORDER BY ID`
    );

    const products = productRows;
    console.log(`Found ${products.length} published products`);

    if (products.length === 0) {
      console.log("No products. Exiting.");
      return;
    }

    const chunkSize = 200;
    const canonicalProducts = [];
    let totalVariants = 0;
    let duplicatesSkipped = 0;

    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const idList = chunk.map((p) => p.ID).join(",");

      const [metaRows] = await conn.query(
        `SELECT post_id, meta_key, meta_value
         FROM ${TABLE_PREFIX}postmeta
         WHERE post_id IN (${idList})
           AND meta_key IN (
             '_import_id','_sku','_price','_regular_price','_sale_price',
             '_stock','_stock_status','_thumbnail_ext_url',
             '_product_image_gallery','_product_type','_product_attributes'
           )`
      );

      const metaByPost = {};
      for (const row of metaRows) {
        if (!metaByPost[row.post_id]) metaByPost[row.post_id] = [];
        metaByPost[row.post_id].push(row);
      }

      const [termRows] = await conn.query(
        `SELECT tr.object_id, t.name, tt.taxonomy
         FROM ${TABLE_PREFIX}term_relationships tr
         JOIN ${TABLE_PREFIX}term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
         JOIN ${TABLE_PREFIX}terms t ON tt.term_id = t.term_id
         WHERE tr.object_id IN (${idList})
           AND tt.taxonomy IN ('product_cat','product_tag')`
      );

      const categoriesByPost = {};
      const tagsByPost = {};
      for (const row of termRows) {
        if (row.taxonomy === "product_cat") {
          if (!categoriesByPost[row.object_id]) categoriesByPost[row.object_id] = [];
          categoriesByPost[row.object_id].push(row.name);
        } else if (row.taxonomy === "product_tag") {
          if (!tagsByPost[row.object_id]) tagsByPost[row.object_id] = [];
          tagsByPost[row.object_id].push(row.name);
        }
      }

      const [variationRows] = await conn.query(
        `SELECT ID, post_parent, post_title, post_status
         FROM ${TABLE_PREFIX}posts
         WHERE post_type = 'product_variation' AND post_parent IN (${idList})`
      );

      const variationsByParent = {};
      const allVarIds = [];
      for (const row of variationRows) {
        if (!variationsByParent[row.post_parent]) variationsByParent[row.post_parent] = [];
        variationsByParent[row.post_parent].push(row);
        allVarIds.push(row.ID);
      }

      const varMetaByPost = {};
      if (allVarIds.length > 0) {
        for (let v = 0; v < allVarIds.length; v += 500) {
          const varChunk = allVarIds.slice(v, v + 500).join(",");
          const [vmRows] = await conn.query(
            `SELECT post_id, meta_key, meta_value
             FROM ${TABLE_PREFIX}postmeta
             WHERE post_id IN (${varChunk})
               AND meta_key IN (
                 '_sku','_price','_regular_price','_sale_price',
                 '_stock','_stock_status','_thumbnail_ext_url',
                 '_import_id','attribute_pa_size','attribute_pa_colour',
                 'attribute_pa_color','attribute_pa_style','attribute_pa_width'
               )`
          );
          for (const row of vmRows) {
            if (!varMetaByPost[row.post_id]) varMetaByPost[row.post_id] = {};
            varMetaByPost[row.post_id][row.meta_key] = row.meta_value;
          }
        }
      }

      // Build canonical products
      for (const prod of chunk) {
        const meta = normalizeMeta(metaByPost[prod.ID] || []);
        const supplierId = extractSupplierId(meta["_import_id"]);
        const productType = meta["_product_type"] || "simple";

        const images = [];
        const thumb = meta["_thumbnail_ext_url"];
        if (thumb) images.push(thumb);
        const gallery = meta["_product_image_gallery"];
        if (gallery) {
          const items = gallery.split(",").map((s) => s.trim()).filter(Boolean);
          for (const item of items) {
            if (item.startsWith("http")) images.push(item);
          }
        }

        const priceRaw = meta["_price"] || meta["_regular_price"];
        const stockQty = parseIntSafe(meta["_stock"]);
        const stockStatus = meta["_stock_status"] === "instock" ? "in_stock" :
                           meta["_stock_status"] === "outofstock" ? "out_of_stock" : "in_stock";

        const rawVariations = variationsByParent[prod.ID] || [];
        const variants = [];

        if (productType === "variable" && rawVariations.length > 0) {
          const seenIdentities = new Set();
          for (const v of rawVariations) {
            const vMeta = varMetaByPost[v.ID] || {};
            const varSku = vMeta["_sku"] || "";
            const varImportId = vMeta["_import_id"];

            const supplierVariantSku = extractSupplierVariantSku(varImportId, varSku, v.ID);
            const supplierIdentity = buildSupplierIdentity(supplierId, supplierVariantSku);

            // Deduplicate: skip variants with the same supplier_identity within the same product
            if (seenIdentities.has(supplierIdentity)) {
              duplicatesSkipped++;
              continue;
            }
            seenIdentities.add(supplierIdentity);

            const options = {};
            for (const key of Object.keys(vMeta)) {
              if (key.startsWith("attribute_pa_")) {
                const attrName = key.replace("attribute_pa_", "");
                if (vMeta[key]) options[attrName] = vMeta[key];
              }
            }

            const varImages = [];
            const varThumb = vMeta["_thumbnail_ext_url"];
            if (varThumb) varImages.push(varThumb);

            const varPriceRaw = vMeta["_price"] || vMeta["_regular_price"];
            const varPrice = parsePrice(varPriceRaw);
            const varStockQty = parseIntSafe(vMeta["_stock"]);
            const varStockStatus = vMeta["_stock_status"] === "instock" ? "in_stock" :
                                   vMeta["_stock_status"] === "outofstock" ? "out_of_stock" : "in_stock";

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
          // Simple product or variable with no variations found
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
            wcVariationId: 0,
          });
        }

        totalVariants += variants.length;

        canonicalProducts.push({
          supplierId,
          title: prod.post_title,
          description: prod.post_content || "",
          handle: prod.post_name,
          status: "published",
          categories: categoriesByPost[prod.ID] || [],
          tags: tagsByPost[prod.ID] || [],
          images,
          variants,
          wcPostId: prod.ID,
          productType: productType === "variable" ? "variable" : "simple",
        });
      }

      const progress = Math.min(i + chunkSize, products.length);
      console.log(`  Processed ${progress}/${products.length} products...`);
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalProducts: canonicalProducts.length,
      totalVariants,
      products: canonicalProducts,
    };

    const outputPath = "/tmp/catalog-export.json";
    fs.writeFileSync(outputPath, JSON.stringify(exportData), "utf-8");
    const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    console.log(`\nExport complete: ${outputPath}`);
    console.log(`Products: ${exportData.totalProducts}`);
    console.log(`Variants: ${exportData.totalVariants}`);
    console.log(`Duplicates skipped: ${duplicatesSkipped}`);
    console.log(`File size: ${sizeMB} MB`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
