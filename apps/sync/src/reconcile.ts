/**
 * reconcile.ts — Upsert products/variants into Medusa Postgres
 *
 * §8 Spec:
 * - Bulk-load existing supplier_identity → medusa_product_id map
 * - For each item in feed: upsert
 * - For items NOT in feed but in DB: set stock_status = 'out_of_stock', stock = 0
 * - Never hard-delete
 * - Track with sync_run_marker timestamp
 */
import type { CanonicalProduct } from "@ringsidesports/shared-types";
import { identity } from "./identity.js";

function log(level: string, msg: string): void {
  const ts = new Date().toISOString();
  console.log(`${ts} [${level}] reconcile.ts: ${msg}`);
}

let pgPool: import("pg").Pool | null = null;

export function setPgPool(pool: import("pg").Pool): void {
  pgPool = pool;
}

function getPool(): import("pg").Pool {
  if (!pgPool) throw new Error("pg Pool not set — call setPgPool() first");
  return pgPool;
}

export interface ReconcileStats {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  productsOutOfStock: number;
  variantsOutOfStock: number;
  errors: number;
}

export async function reconcile(
  products: CanonicalProduct[],
): Promise<ReconcileStats> {
  log("INFO", "=== reconcile started ===");
  const pool = getPool();
  const runMarker = new Date().toISOString();

  const stats: ReconcileStats = {
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    productsOutOfStock: 0,
    variantsOutOfStock: 0,
    errors: 0,
  };

  // Track which entities were seen this run
  const seenProductIds = new Set<string>();
  const seenVariantIds = new Set<string>();

  for (let i = 0; i < products.length; i++) {
    const product = products[i]!;

    try {
      // ── Upsert product ──────────────────────────────────────────────────────
      const existingProduct = identity.findBySupplierId(product.supplierId);
      let productId: string;

      if (existingProduct) {
        // Update existing
        await pool.query(
          `UPDATE medusa_product
           SET title = $1,
               description = $2,
               status = $3,
               handle = $4,
               metadata = metadata || $5::jsonb,
               updated_at = now()
           WHERE id = $6`,
          [
            product.title,
            product.description ?? null,
            product.status,
            product.handle,
            JSON.stringify({
              supplier_id: product.supplierId,
              supplier_mpn: product.supplierMpn,
              categories: product.categories,
              tags: product.tags,
              product_type: product.productType,
              sync_run_marker: runMarker,
            }),
            existingProduct.medusa_entity_id,
          ],
        );
        productId = existingProduct.medusa_entity_id;
        stats.productsUpdated++;
      } else {
        // Create new
        const result = await pool.query(
          `INSERT INTO medusa_product (title, description, status, handle, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
           RETURNING id`,
          [
            product.title,
            product.description ?? null,
            product.status,
            product.handle,
            JSON.stringify({
              supplier_id: product.supplierId,
              supplier_mpn: product.supplierMpn,
              categories: product.categories,
              tags: product.tags,
              product_type: product.productType,
              sync_run_marker: runMarker,
            }),
          ],
        );
        productId = result.rows[0]!.id;
        stats.productsCreated++;

        // Record identity mapping
        identity.upsert({
          supplier_id: product.supplierId,
          supplier_identity: product.supplierId,
          medusa_entity_type: "product",
          medusa_entity_id: productId,
        });
      }

      seenProductIds.add(productId);

      // ── Upsert product stock/price ──────────────────────────────────────────
      await pool.query(
        `INSERT INTO medusa_product_stock (product_id, stock_status, stock_quantity, price, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (product_id) DO UPDATE
         SET stock_status = EXCLUDED.stock_status,
             stock_quantity = EXCLUDED.stock_quantity,
             price = EXCLUDED.price,
             updated_at = now()`,
        [
          productId,
          (product.stockStatus ?? "out_of_stock").replace(/_/g, ""), // in_stock → instock
          product.stockQuantity ?? 0,
          product.price ?? 0,
        ],
      );

      // ── Upsert images ───────────────────────────────────────────────────────
      if (product.images.length > 0) {
        // Clear existing then re-insert
        await pool.query(
          `DELETE FROM medusa_product_images WHERE product_id = $1`,
          [productId],
        );
        const imageValues = product.images.map((url, idx) => [
          productId,
          url,
          idx,
        ]);
        for (const [pid, url, rank] of imageValues) {
          await pool.query(
            `INSERT INTO medusa_product_images (product_id, url, rank)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [pid, url, rank],
          );
        }
      }

      // ── Upsert categories ───────────────────────────────────────────────────
      if (product.categories.length > 0) {
        await pool.query(
          `DELETE FROM medusa_product_categories WHERE product_id = $1`,
          [productId],
        );
        for (const cat of product.categories) {
          await pool.query(
            `INSERT INTO medusa_product_categories (product_id, category_name)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [productId, cat],
          );
        }
      }

      // ── Upsert variants ─────────────────────────────────────────────────────
      for (const variant of product.variants) {
        try {
          const existingVariant = identity.findBySupplierIdentity(
            variant.supplierIdentity,
          );
          let variantId: string;

          if (existingVariant) {
            await pool.query(
              `UPDATE medusa_product_variant
               SET title = $1,
                   metadata = metadata || $2::jsonb,
                   updated_at = now()
               WHERE id = $3`,
              [
                variant.title,
                JSON.stringify({
                  supplier_identity: variant.supplierIdentity,
                  supplier_variant_sku: variant.supplierVariantSku,
                  options: variant.options,
                  sync_run_marker: runMarker,
                }),
                existingVariant.medusa_entity_id,
              ],
            );
            variantId = existingVariant.medusa_entity_id;
            stats.variantsUpdated++;
          } else {
            const result = await pool.query(
              `INSERT INTO medusa_product_variant (product_id, title, metadata, created_at, updated_at)
               VALUES ($1, $2, $3::jsonb, now(), now())
               RETURNING id`,
              [
                productId,
                variant.title,
                JSON.stringify({
                  supplier_identity: variant.supplierIdentity,
                  supplier_variant_sku: variant.supplierVariantSku,
                  options: variant.options,
                  sync_run_marker: runMarker,
                }),
              ],
            );
            variantId = result.rows[0]!.id;
            stats.variantsCreated++;

            identity.upsert({
              supplier_id: product.supplierId,
              supplier_identity: variant.supplierIdentity,
              medusa_entity_type: "variant",
              medusa_entity_id: variantId,
            });
          }

          seenVariantIds.add(variantId);

          // Upsert variant stock/price
          await pool.query(
            `INSERT INTO medusa_product_variant_stock (variant_id, stock_status, stock_quantity, price, updated_at)
             VALUES ($1, $2, $3, $4, now())
             ON CONFLICT (variant_id) DO UPDATE
             SET stock_status = EXCLUDED.stock_status,
                 stock_quantity = EXCLUDED.stock_quantity,
                 price = EXCLUDED.price,
                 updated_at = now()`,
            [
              variantId,
              variant.stockStatus.replace(/_/g, ""),
              variant.stockQuantity,
              variant.price,
            ],
          );

          // Variant images
          if (variant.images.length > 0) {
            await pool.query(
              `DELETE FROM medusa_product_variant_images WHERE variant_id = $1`,
              [variantId],
            );
            for (const [idx, url] of variant.images.entries()) {
              await pool.query(
                `INSERT INTO medusa_product_variant_images (variant_id, url, rank)
                 VALUES ($1, $2, $3)
                 ON CONFLICT DO NOTHING`,
                [variantId, url, idx],
              );
            }
          }
        } catch (err) {
          log(
            "ERROR",
            `Failed to upsert variant ${variant.supplierIdentity}: ${err instanceof Error ? err.message : String(err)}`,
          );
          stats.errors++;
        }
      }

      if ((i + 1) % 100 === 0) {
        log(
          "INFO",
          `Progress: ${i + 1}/${products.length} | C:${stats.productsCreated} U:${stats.productsUpdated} VC:${stats.variantsCreated} VU:${stats.variantsUpdated}`,
        );
      }
    } catch (err) {
      log(
        "ERROR",
        `Failed to reconcile product ${product.supplierId} "${product.title}": ${err instanceof Error ? err.message : String(err)}`,
      );
      stats.errors++;
    }
  }

  // ── Reconcile removed items ─────────────────────────────────────────────────
  // Mark anything with an older sync_run_marker as outofstock
  log("INFO", "Reconciling stale items...");

  // Products not seen this run
  const staleProducts = await pool.query(
    `UPDATE medusa_product
     SET status = 'draft',
         metadata = jsonb_set(
           jsonb_set(metadata, '{stock_status}', '"out_of_stock"'),
           '{stock_quantity}', '0'
         ),
         updated_at = now()
     WHERE id IN (
       SELECT p.id FROM medusa_product p
       WHERE p.metadata->>'sync_run_marker' IS NOT NULL
         AND p.metadata->>'sync_run_marker' != $1
         AND p.status = 'published'
     )
     RETURNING id`,
    [runMarker],
  );
  stats.productsOutOfStock = staleProducts.rowCount ?? 0;

  // Also mark associated stock as 0
  await pool.query(
    `UPDATE medusa_product_stock
     SET stock_status = 'outofstock',
         stock_quantity = 0,
         updated_at = now()
     WHERE product_id IN (
       SELECT p.id FROM medusa_product p
       WHERE p.metadata->>'sync_run_marker' IS NOT NULL
         AND p.metadata->>'sync_run_marker' != $1
     )`,
    [runMarker],
  );

  // Variants not seen this run
  const staleVariants = await pool.query(
    `UPDATE medusa_product_variant
     SET metadata = jsonb_set(
           jsonb_set(metadata, '{stock_status}', '"out_of_stock"'),
           '{stock_quantity}', '0'
         ),
         updated_at = now()
     WHERE id IN (
       SELECT v.id FROM medusa_product_variant v
       WHERE v.metadata->>'sync_run_marker' IS NOT NULL
         AND v.metadata->>'sync_run_marker' != $1
     )
     RETURNING id`,
    [runMarker],
  );
  stats.variantsOutOfStock = staleVariants.rowCount ?? 0;

  // Mark stale variant stock
  await pool.query(
    `UPDATE medusa_product_variant_stock
     SET stock_status = 'outofstock',
         stock_quantity = 0,
         updated_at = now()
     WHERE variant_id IN (
       SELECT v.id FROM medusa_product_variant v
       WHERE v.metadata->>'sync_run_marker' IS NOT NULL
         AND v.metadata->>'sync_run_marker' != $1
     )`,
    [runMarker],
  );

  if (stats.productsOutOfStock > 0 || stats.variantsOutOfStock > 0) {
    log(
      "INFO",
      `Reconciled ${stats.productsOutOfStock} stale products + ${stats.variantsOutOfStock} stale variants → outofstock`,
    );
  }

  // ── Flush identity map ──────────────────────────────────────────────────────
  await identity.flush();

  log("INFO", "=== reconcile completed ===");
  return stats;
}
