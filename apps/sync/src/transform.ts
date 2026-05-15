/**
 * transform.ts — Stream-parse supplier XML into CanonicalProduct/Variant objects
 *
 * §8 Spec:
 * - Stream-parse XML using `sax`
 * - Emit CanonicalProduct/CanonicalVariant matching @ringsidesports/shared-types
 * - Clean phone snippets
 * - Validate image URLs (http/https + image extension)
 * - Replace invalid images with placeholder
 * - Product type: "variable" if >1 variant, else "simple"
 * - Variant identity: `${supplierId}__${variantSku}` (variant's OWN sku)
 * - Fall back to `${mpn}_${size}_${colour}` when supplier omits sku
 * - Deduplicate: merge same-title+categories products into single variable
 */
import { createReadStream } from "node:fs";
import sax from "sax";
import type {
  CanonicalProduct,
  CanonicalVariant,
} from "@ringsidesports/shared-types";

// ── Config ────────────────────────────────────────────────────────────────────
const PLACEHOLDER_IMAGE =
  "https://ringsidesports.com.au/wp-content/uploads/default-placeholder.jpg";

const IMAGE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg",
]);

// ── Phone snippet patterns (from legacy wc2_xml.py) ───────────────────────────
// Phone digits used in spam snippets
const PHONE_DIGITS_RE = /\b0400\s*919\s*454\b|\b0400919454\b/gi;
const TEL_LINK_RE = /tel:\s*0400919454/gi;

const BAD_SNIPPET_RAW =
  '<li>PHONE <a href="tel:0400919454">0400919454</a> FOR GREAT QTY BUY ON THIS ITEM !!</li>';

const BAD_SNIPPET_ESC =
  "&lt;li&gt;PHONE &lt;a href=&quot;tel:0400919454&quot;&gt;0400919454&lt;/a&gt; FOR GREAT QTY BUY ON THIS ITEM !!&lt;/li&gt;";

// ── Logging ───────────────────────────────────────────────────────────────────
function log(level: string, msg: string): void {
  const ts = new Date().toISOString();
  console.log(`${ts} [${level}] transform.ts: ${msg}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function cleanText(value: string): string {
  if (!value) return value;
  let v = value;
  v = v.replaceAll(BAD_SNIPPET_RAW, "");
  v = v.replaceAll(BAD_SNIPPET_ESC, "");
  // Also handle concatenated versions
  while (v.includes(BAD_SNIPPET_RAW)) {
    v = v.replace(BAD_SNIPPET_RAW, "");
  }
  while (v.includes(BAD_SNIPPET_ESC)) {
    v = v.replace(BAD_SNIPPET_ESC, "");
  }
  v = v.replace(TEL_LINK_RE, "tel:");
  v = v.replace(PHONE_DIGITS_RE, "");
  // Clean up multiple spaces / dangling HTML fragments
  v = v.replace(/\s{2,}/g, " ").trim();
  return v;
}

export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  const urlLower = url.split("?")[0]!.toLowerCase();
  if (!urlLower.startsWith("http://") && !urlLower.startsWith("https://")) {
    return false;
  }
  for (const ext of IMAGE_EXTENSIONS) {
    if (urlLower.endsWith(ext)) return true;
  }
  return false;
}

export function validateImage(url: string): string {
  if (!url) return PLACEHOLDER_IMAGE;
  if (isValidImageUrl(url)) return url;
  log("WARNING", `Invalid image URL replaced: ${url.slice(0, 80)}`);
  return PLACEHOLDER_IMAGE;
}

export function parsePrice(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) return 0;
  // Convert to AUD cents (GST inclusive)
  return Math.round(n * 100);
}

export function parseQuantity(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : n;
}

export function parseStockStatus(
  raw: string | null | undefined,
): "in_stock" | "out_of_stock" {
  if (!raw) return "out_of_stock";
  const lower = raw.toLowerCase().trim();
  return lower === "instock" || lower === "in_stock" ? "in_stock" : "out_of_stock";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

// ── Intermediate types for building during parse ──────────────────────────────

interface RawVariant {
  name: string;
  sku: string;
  price: string;
  instock: string;
  quantity: string;
  size: string;
  color: string;
  images: string[];
  description: string;
  weight: string;
  barcode: string;
}

interface RawProduct {
  id: string;
  mpn: string;
  name: string;
  description: string;
  price: string;
  instock: string;
  quantity: string;
  category: string;
  tags: string;
  image: string;
  additionalImages: string[];
  variants: RawVariant[];
  weight: string;
  barcode: string;
}

function emptyRawProduct(): RawProduct {
  return {
    id: "",
    mpn: "",
    name: "",
    description: "",
    price: "",
    instock: "",
    quantity: "",
    category: "",
    tags: "",
    image: "",
    additionalImages: [],
    variants: [],
    weight: "",
    barcode: "",
  };
}

function emptyRawVariant(): RawVariant {
  return {
    name: "",
    sku: "",
    price: "",
    instock: "",
    quantity: "",
    size: "",
    color: "",
    images: [],
    description: "",
    weight: "",
    barcode: "",
  };
}

// ── Convert RawProduct → CanonicalProduct ─────────────────────────────────────

function rawVariantToCanonical(
  raw: RawVariant,
  supplierId: string,
  productMpn: string,
  productTitle: string,
  index: number,
): CanonicalVariant {
  const variantSku = cleanText(raw.sku) || "";

  // Fall back to `${mpn}_${size}_${colour}` when supplier omits sku
  let supplierVariantSku = variantSku;
  if (!supplierVariantSku) {
    const sizePart = cleanText(raw.size) || "";
    const colorPart = cleanText(raw.color) || "";
    const suffix = [sizePart, colorPart].filter(Boolean).join("_") || String(index);
    supplierVariantSku = `${productMpn}_${suffix}`;
  }

  const supplierIdentity = `${supplierId}__${supplierVariantSku}`;

  const size = cleanText(raw.size);
  const color = cleanText(raw.color);
  const options: Record<string, string> = {};
  if (size && size !== "Default Title") options.size = size;
  if (color) options.colour = color;

  // Collect variant images (multiple variant_image elements)
  const variantImages: string[] = [];
  for (const img of raw.images) {
    const validated = validateImage(cleanText(img));
    if (validated !== PLACEHOLDER_IMAGE) variantImages.push(validated);
  }

  const variantTitle = cleanText(raw.name) || [
    productTitle,
    size && size !== "Default Title" ? size : "",
    color,
  ].filter(Boolean).join(" — ");

  return {
    supplierVariantSku,
    supplierIdentity,
    title: variantTitle,
    price: parsePrice(raw.price),
    stockQuantity: parseQuantity(raw.quantity),
    stockStatus: parseStockStatus(raw.instock),
    options,
    images: variantImages,
    wcVariationId: 0,
    weight: cleanText(raw.weight) || undefined,
    description: cleanText(raw.description) || undefined,
    barcode: cleanText(raw.barcode) || undefined,
  };
}

function rawProductToCanonical(raw: RawProduct): CanonicalProduct {
  const supplierId = cleanText(raw.id);
  const title = cleanText(raw.name);
  const supplierMpn = cleanText(raw.mpn) || undefined;

  // Build variants
  const variants: CanonicalVariant[] = raw.variants.map((v, i) =>
    rawVariantToCanonical(v, supplierId, supplierMpn ?? "UNKNOWN", title, i + 1),
  );

  // Product type: infer as variable if >1 variant, else simple
  const productType: "simple" | "variable" =
    variants.length > 1 ? "variable" : "simple";

  // Images
  const productImages: string[] = [];
  const mainImg = validateImage(cleanText(raw.image));
  if (mainImg !== PLACEHOLDER_IMAGE) productImages.push(mainImg);
  for (const ai of raw.additionalImages) {
    const validated = validateImage(cleanText(ai));
    if (validated !== PLACEHOLDER_IMAGE) productImages.push(validated);
  }

  // Categories — pipe-delimited
  const category = cleanText(raw.category);
  const categories = category
    ? category
        .replace(/&amp;/g, "&")
        .split(/\||&/)
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  // Tags — comma-separated
  const tagsRaw = cleanText(raw.tags);
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const description = cleanText(raw.description) || undefined;

  return {
    supplierId,
    title,
    description,
    handle: slugify(title + "-" + supplierId),
    status: "published",
    categories,
    tags,
    images: productImages,
    variants,
    wcPostId: 0,
    productType,
    supplierMpn,
    price: parsePrice(raw.price),
    stockQuantity: parseQuantity(raw.quantity),
    stockStatus: parseStockStatus(raw.instock),
  };
}

// ── Deduplication ─────────────────────────────────────────────────────────────
// Merge products with same title + categories into single variable products

export function deduplicate(
  products: CanonicalProduct[],
): CanonicalProduct[] {
  const groups = new Map<string, CanonicalProduct[]>();

  for (const p of products) {
    const key = `${p.title}||${p.categories.join("|")}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(p);
    } else {
      groups.set(key, [p]);
    }
  }

  const merged: CanonicalProduct[] = [];
  let mergedGroups = 0;
  let mergedVariants = 0;
  let simpleFixed = 0;

  for (const [, group] of groups) {
    if (group.length === 1) {
      const p = group[0]!;
      // Fix product type if needed
      if (p.variants.length > 1 && p.productType === "simple") {
        simpleFixed++;
      }
      merged.push({
        ...p,
        productType: p.variants.length > 1 ? "variable" : "simple",
      });
    } else {
      // Merge: first is keeper, absorb variants from rest
      const keeper = group[0]!;
      const allVariants = [...keeper.variants];
      // Collect images from all
      const allImages = new Set(keeper.images);

      for (let i = 1; i < group.length; i++) {
        const dup = group[i]!;
        allVariants.push(...dup.variants);
        for (const img of dup.images) allImages.add(img);
        mergedVariants += dup.variants.length;
      }

      merged.push({
        ...keeper,
        variants: allVariants,
        images: [...allImages],
        productType: "variable",
      });
      mergedGroups++;
    }
  }

  if (mergedGroups > 0 || mergedVariants > 0) {
    log(
      "INFO",
      `Dedup: merged ${mergedGroups} groups, ${mergedVariants} variants reparented, ${simpleFixed} type fixes`,
    );
  }

  return merged;
}

// ── SAX stream parser ─────────────────────────────────────────────────────────

export interface TransformResult {
  products: CanonicalProduct[];
  productCount: number;
  variantCount: number;
}

export function parseXmlStream(xmlPath: string): Promise<TransformResult> {
  return new Promise((resolve, reject) => {
    const products: CanonicalProduct[] = [];
    let currentProduct: RawProduct = emptyRawProduct();
    let currentVariant: RawVariant = emptyRawVariant();
    let inProduct = false;
    let inVariant = false;
    let inVariants = false;
    let currentTag = "";
    let tagPath: string[] = [];
    let textBuffer = "";
    let productCount = 0;
    let variantCount = 0;

    const strict = true;
    const saxStream = sax.createStream(strict, {
      lowercase: true,
      trim: false,
    });

    saxStream.on("opentag", (node) => {
      const tag = node.name.toLowerCase();
      tagPath.push(tag);
      textBuffer = "";

      if (tag === "id" && !inVariants) {
        // Previous product finished — emit it
        if (inProduct && currentProduct.id) {
          const cp = rawProductToCanonical(currentProduct);
          products.push(cp);
          productCount++;
          variantCount += cp.variants.length;
        }
        currentProduct = emptyRawProduct();
        inProduct = true;
        currentTag = "id";
      } else if (tag === "variants") {
        inVariants = true;
        currentTag = "variants";
      } else if (tag === "variant" && inVariants) {
        inVariant = true;
        currentVariant = emptyRawVariant();
        currentTag = "variant";
      } else {
        currentTag = tag;
      }
    });

    saxStream.on("closetag", (rawTag) => {
      const tag = rawTag.toLowerCase();
      const text = textBuffer;

      if (tag === "variants") {
        inVariants = false;
      } else if (tag === "variant") {
        if (inVariant && inProduct) {
          currentProduct.variants.push(currentVariant);
        }
        inVariant = false;
        currentVariant = emptyRawVariant();
      } else if (tag === "id" && !inVariants && inProduct) {
        // <id> text for current product
        currentProduct.id = text;
      } else if (inVariant) {
        // Variant fields
        switch (tag) {
          case "name":
            currentVariant.name = text;
            break;
          case "sku":
            currentVariant.sku = text;
            break;
          case "price":
            currentVariant.price = text;
            break;
          case "instock":
            currentVariant.instock = text;
            break;
          case "quantity":
            currentVariant.quantity = text;
            break;
          case "size":
            currentVariant.size = text;
            break;
          case "color":
          case "colour":
            currentVariant.color = text;
            break;
          case "image":
          case "variant_image":
            if (text) currentVariant.images.push(text);
            break;
          case "description":
            currentVariant.description = text;
            break;
          case "weight":
            currentVariant.weight = text;
            break;
          case "barcode":
            currentVariant.barcode = text;
            break;
        }
      } else if (inProduct && !inVariants) {
        // Product fields
        switch (tag) {
          case "mpn":
            currentProduct.mpn = text;
            break;
          case "name":
            currentProduct.name = text;
            break;
          case "description":
            currentProduct.description = text;
            break;
          case "price":
            currentProduct.price = text;
            break;
          case "instock":
            currentProduct.instock = text;
            break;
          case "quantity":
            currentProduct.quantity = text;
            break;
          case "category":
            currentProduct.category = text;
            break;
          case "tags":
            currentProduct.tags = text;
            break;
          case "image":
            currentProduct.image = text;
            break;
          case "additional_image":
            if (text) currentProduct.additionalImages.push(text);
            break;
          case "weight":
            currentProduct.weight = text;
            break;
          case "barcode":
            currentProduct.barcode = text;
            break;
          case "product_type":
            // Skip — we compute our own
            break;
        }
      }

      tagPath.pop();
      textBuffer = "";
    });

    saxStream.on("text", (text) => {
      textBuffer += text;
    });

    saxStream.on("error", (err: Error) => {
      reject(new Error(`XML parse error: ${err.message}`));
    });

    saxStream.on("end", () => {
      // Emit final product
      if (inProduct && currentProduct.id) {
        const cp = rawProductToCanonical(currentProduct);
        products.push(cp);
        productCount++;
        variantCount += cp.variants.length;
      }
      resolve({ products, productCount, variantCount });
    });

    // Start reading
    const readStream = createReadStream(xmlPath, { encoding: "utf-8" });
    readStream.on("error", reject);
    readStream.pipe(saxStream);
  });
}

export async function transformXml(
  xmlPath: string,
): Promise<TransformResult> {
  log("INFO", "=== transformXml started ===");
  log("INFO", `Parsing ${xmlPath}`);

  const { products, productCount, variantCount } = await parseXmlStream(xmlPath);

  log(
    "INFO",
    `Parsed ${productCount} products, ${variantCount} variants (raw)`,
  );

  // Deduplicate
  const deduped = deduplicate(products);
  log(
    "INFO",
    `After dedup: ${deduped.length} products, ${deduped.reduce((s, p) => s + p.variants.length, 0)} variants`,
  );

  log("INFO", "=== transformXml completed ===");
  return {
    products: deduped,
    productCount: deduped.length,
    variantCount: deduped.reduce((s, p) => s + p.variants.length, 0),
  };
}
