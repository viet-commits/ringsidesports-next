/**
 * Products data module — loads from the extracted WooCommerce catalog.
 *
 * During static export, this imports catalog-data.json directly.
 * In production (SSR), this would fetch from the Medusa store API.
 */

import catalogRaw from "./catalog-data.json";

export interface ProductVariant {
  supplierVariantSku: string;
  supplierIdentity: string;
  /** Alias for supplierVariantSku — used by cart/storefront */
  sku: string;
  title: string;
  price: number; // cents AUD, GST inclusive
  stockQuantity: number;
  stockStatus: "in_stock" | "out_of_stock";
  options: Record<string, string>;
  images: string[];
}

export interface Product {
  /** Alias for supplierId — used by cart/storefront */
  id: string;
  supplierId: string;
  title: string;
  description: string;
  handle: string;
  status: "published" | "draft";
  categories: string[];
  tags: string[];
  images: string[];
  variants: ProductVariant[];
  productType: "simple" | "variable";
  price: number;
  stockStatus: "in_stock" | "out_of_stock";
  stockQuantity: number;
  wcPostId: number;
}

interface CatalogEntry {
  catalog: RawProduct[];
}

interface RawProduct {
  supplierId: string;
  title: string;
  description?: string;
  handle: string;
  status: string;
  categories: string[];
  tags: string[];
  images: string[];
  variants: RawVariant[];
  productType: string;
  price?: number;
  stockStatus?: string;
  stockQuantity?: number;
  wcPostId: number;
}

interface RawVariant {
  supplierVariantSku: string;
  supplierIdentity: string;
  title: string;
  price: number;
  stockQuantity: number;
  stockStatus: string;
  options: Record<string, string>;
  images: string[];
}

// Category name mapping (numeric term names → readable)
const CATEGORY_NAMES: Record<string, string> = {
  "1705": "Boxing",
  "1706": "Martial Arts",
  "1707": "MMA Gloves",
  "1708": "Mitts",
  "1709": "Martial Arts Training Equipment",
  "1641": "Uncategorized",
};

function mapCat(id: string): string {
  return CATEGORY_NAMES[id] || id;
}

const data = catalogRaw as unknown as CatalogEntry;

/** All published products */
export const products: Product[] = data.catalog
  .filter((p) => p.status === "published")
  .map((p) => ({
    ...p,
    id: p.supplierId,
    status: "published" as const,
    productType: (p.productType === "variable" ? "variable" : "simple") as "simple" | "variable",
    stockStatus: (p.stockStatus === "out_of_stock" ? "out_of_stock" : "in_stock") as "in_stock" | "out_of_stock",
    price: p.variants[0]?.price ?? p.price ?? 0,
    stockQuantity: p.stockQuantity ?? 0,
    description: p.description || "",
    categories: p.categories.map(mapCat),
    variants: p.variants.map((v) => ({
      ...v,
      sku: v.supplierVariantSku,
      stockStatus: (v.stockStatus === "out_of_stock" ? "out_of_stock" : "in_stock") as "in_stock" | "out_of_stock",
    })),
  }));

export interface Category {
  name: string;
  slug: string;
  count: number;
  image: string;
}

/** All unique categories */
export const categories: Category[] = (() => {
  const catMap = new Map<string, { name: string; slug: string; count: number; image: string }>();
  for (const p of products) {
    for (const cat of p.categories) {
      const slug = cat.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const existing = catMap.get(slug);
      if (existing) existing.count++;
      else catMap.set(slug, { name: cat, slug, count: 1, image: p.images[0] || "/placeholder.svg" });
    }
  }
  return Array.from(catMap.values()).sort((a, b) => b.count - a.count);
})();

/** Featured products — those with images, sorted by variant count */
export const featuredProducts = products
  .filter((p) => p.images.length > 0)
  .sort((a, b) => b.variants.length - a.variants.length)
  .slice(0, 12);

/** Product by handle — alias for getProduct */
export const getProductByHandle = (handle: string): Product | undefined =>
  products.find((p) => p.handle === handle);

/** All product handles for static generation */
export const getProductHandles = (): string[] =>
  products.map((p) => p.handle);

/** Product by handle */
export function getProduct(handle: string): Product | undefined {
  return products.find((p) => p.handle === handle);
}

/** Search products */
export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return products.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.categories.some((c) => c.toLowerCase().includes(q)),
  );
}
