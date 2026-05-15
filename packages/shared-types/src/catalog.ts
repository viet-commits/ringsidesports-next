import { z } from "zod";

/**
 * §7 Data Model Invariants — Ringside Sports
 *
 * - A Product has supplier_id = supplier's <id> field from Extensionsell XML
 * - A ProductVariant has supplier_identity = `${supplier_id}__${variant_sku}`
 * - supplier_identity is the upsert key for ALL writes. NEVER use SKU alone.
 */

export const CanonicalVariantSchema = z.object({
  /** Variant's own SKU from the supplier — must NOT be the parent MPN */
  supplierVariantSku: z.string(),
  /** Composite upsert key: `${supplierId}__${supplierVariantSku}` */
  supplierIdentity: z.string(),
  title: z.string(),
  /** Price in AUD cents, GST inclusive */
  price: z.number(),
  stockQuantity: z.number(),
  stockStatus: z.enum(["in_stock", "out_of_stock"]),
  /** Attribute options e.g. { size: "XL", colour: "Red" } */
  options: z.record(z.string()),
  /** External image URLs (Shopify CDN) */
  images: z.array(z.string()),
  /** Legacy WooCommerce variation post ID */
  wcVariationId: z.number(),
  weight: z.string().optional(),
  description: z.string().optional(),
  barcode: z.string().optional(),
});

export const CanonicalProductSchema = z.object({
  /** Supplier product <id> from Extensionsell XML */
  supplierId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  /** URL slug — use WC slug for SEO continuity */
  handle: z.string(),
  status: z.enum(["published", "draft"]),
  /** Category names (pipe-delimited in feed) */
  categories: z.array(z.string()),
  /** Comma-separated tag names */
  tags: z.array(z.string()),
  /** External image URLs */
  images: z.array(z.string()),
  variants: z.array(CanonicalVariantSchema),
  /** Legacy WooCommerce post ID for redirect map (phase 6) */
  wcPostId: z.number(),
  productType: z.enum(["simple", "variable"]),
  /** Supplier MPN (for reference only, NOT as identity key) */
  supplierMpn: z.string().optional(),
  /** Regular price in AUD cents, GST inclusive */
  price: z.number().optional(),
  stockQuantity: z.number().optional(),
  stockStatus: z.enum(["in_stock", "out_of_stock"]).optional(),
});

export type CanonicalVariant = z.infer<typeof CanonicalVariantSchema>;
export type CanonicalProduct = z.infer<typeof CanonicalProductSchema>;
