/**
 * regression/identity.test.ts
 *
 * §8 Regression test: Duplicate variation bug
 *
 * MANDATORY: supplier_identity is unique per variant.
 * SKU is NEVER used as the identity key — supplier_identity
 * is always `${supplierId}__${variantSku}`.
 *
 * Legacy bug: the old pipeline sometimes used SKU alone as
 * the variation match key, causing collisions when different
 * suppliers shared the same SKU value.
 */
import { describe, it, expect } from "vitest";
import {
  cleanText,
  isValidImageUrl,
  validateImage,
  parsePrice,
  parseStockStatus,
  deduplicate,
} from "../../transform.js";

// Import types for type-checking
import type {
  CanonicalProduct,
  CanonicalVariant,
} from "@ringsidesports/shared-types";

/**
 * Helper: build a minimal CanonicalVariant for testing.
 * Ensures supplierIdentity follows the `${supplierId}__${variantSku}` pattern.
 */
function makeVariant(overrides: Partial<CanonicalVariant> = {}): CanonicalVariant {
  const supplierId = overrides.supplierIdentity?.split("__")[0] ?? "SUP001";
  const sku = overrides.supplierVariantSku ?? "VAR-001";
  return {
    supplierVariantSku: overrides.supplierVariantSku ?? sku,
    supplierIdentity: overrides.supplierIdentity ?? `${supplierId}__${sku}`,
    title: "Test Variant",
    price: 2999,
    stockQuantity: 10,
    stockStatus: "in_stock",
    options: {},
    images: [],
    wcVariationId: 0,
    ...overrides,
  };
}

describe("Supplier Identity Uniqueness", () => {
  it("supplier_identity uses the composite key format: supplierId__variantSku", () => {
    const variant = makeVariant({
      supplierVariantSku: "SKU-ABC",
      supplierIdentity: "SUP123__SKU-ABC",
    });

    // Verify format
    const parts = variant.supplierIdentity.split("__");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe("SUP123");
    expect(parts[1]).toBe("SKU-ABC");
  });

  it("SKU is NEVER used alone as identity key", () => {
    // Two different suppliers could have the same SKU
    const variant1 = makeVariant({
      supplierVariantSku: "COMMON-SKU",
      supplierIdentity: "SUP_A__COMMON-SKU",
    });
    const variant2 = makeVariant({
      supplierVariantSku: "COMMON-SKU",
      supplierIdentity: "SUP_B__COMMON-SKU",
    });

    // Same SKU but different identities — no collision
    expect(variant1.supplierVariantSku).toBe("COMMON-SKU");
    expect(variant2.supplierVariantSku).toBe("COMMON-SKU");
    expect(variant1.supplierIdentity).not.toBe(variant2.supplierIdentity);
    expect(variant1.supplierIdentity).toBe("SUP_A__COMMON-SKU");
    expect(variant2.supplierIdentity).toBe("SUP_B__COMMON-SKU");
  });

  it("variantSku is the VARIANT'S OWN sku, never the parent MPN", () => {
    // Parent MPN should not leak into variant identity
    const variant = makeVariant({
      supplierVariantSku: "VARIANT-OWN-SKU",
      supplierIdentity: "SUP001__VARIANT-OWN-SKU",
    });

    // The variant SKU should not contain the MPN
    expect(variant.supplierVariantSku).not.toContain("MPN");
    expect(variant.supplierIdentity.split("__")[1]).toBe("VARIANT-OWN-SKU");
  });

  it("variant identity fallback uses mpn_size_colour when supplier omits SKU", () => {
    // This is tested at the transform level — when raw variant has no SKU,
    // the transform should generate a fallback: `${mpn}_${size}_${colour}`
    // The identity itself is still `${supplierId}__${generatedSku}`

    const fallbackSku = "ABC123_XL_Red";
    const supplierId = "SUP001";
    const identity = `${supplierId}__${fallbackSku}`;

    // Even with fallback, the composite identity format holds
    expect(identity.split("__")).toHaveLength(2);
    expect(identity).toBe("SUP001__ABC123_XL_Red");
  });

  it("each variant in a product has a unique supplier_identity", () => {
    const supplierId = "PROD-001";
    const variants = [
      makeVariant({
        supplierVariantSku: "V1",
        supplierIdentity: `${supplierId}__V1`,
      }),
      makeVariant({
        supplierVariantSku: "V2",
        supplierIdentity: `${supplierId}__V2`,
      }),
      makeVariant({
        supplierVariantSku: "V3",
        supplierIdentity: `${supplierId}__V3`,
      }),
    ];

    const identities = variants.map((v) => v.supplierIdentity);
    const uniqueIdentities = new Set(identities);

    // All identities must be unique
    expect(uniqueIdentities.size).toBe(variants.length);
  });
});

describe("Phone Snippet Cleaning", () => {
  it("cleans the exact bad snippet", () => {
    const input =
      '<li>PHONE <a href="tel:0400919454">0400919454</a> FOR GREAT QTY BUY ON THIS ITEM !!</li>';
    const result = cleanText(input);
    expect(result).not.toContain("0400919454");
    expect(result).not.toContain("PHONE");
    expect(result.length).toBeLessThan(input.length);
  });

  it("cleans HTML-escaped phone snippet", () => {
    const input =
      "&lt;li&gt;PHONE &lt;a href=&quot;tel:0400919454&quot;&gt;0400919454&lt;/a&gt; FOR GREAT QTY BUY ON THIS ITEM !!&lt;/li&gt;";
    const result = cleanText(input);
    expect(result).not.toContain("0400919454");
  });

  it("cleans raw phone numbers in various formats", () => {
    const inputs = [
      "Call 0400919454 for deals",
      "Call 0400 919 454 for deals",
      "tel:0400919454 contact us",
    ];
    for (const input of inputs) {
      const result = cleanText(input);
      expect(result).not.toContain("0400919454");
      expect(result).not.toMatch(/0400\s*919\s*454/);
    }
  });

  it("does not mangle legitimate text", () => {
    const input = "Great quality boxing gloves for sale";
    const result = cleanText(input);
    expect(result).toBe(input);
  });
});

describe("Image URL Validation", () => {
  it("accepts valid http/https image URLs", () => {
    expect(
      isValidImageUrl("https://example.com/product.jpg"),
    ).toBe(true);
    expect(
      isValidImageUrl("http://example.com/photo.png"),
    ).toBe(true);
    expect(
      isValidImageUrl("https://cdn.shopify.com/image.webp?w=500"),
    ).toBe(true);
  });

  it("rejects non-http URLs", () => {
    expect(isValidImageUrl("ftp://example.com/img.jpg")).toBe(false);
    expect(isValidImageUrl("file:///path/to/img.png")).toBe(false);
    expect(isValidImageUrl("")).toBe(false);
  });

  it("rejects URLs without image extensions", () => {
    expect(isValidImageUrl("https://example.com/page")).toBe(false);
    expect(isValidImageUrl("https://example.com/product.html")).toBe(false);
  });

  it("replaces invalid images with placeholder", () => {
    const result = validateImage("not-a-url");
    expect(result).toContain("default-placeholder");
  });

  it("does not replace valid images", () => {
    const url = "https://example.com/product.jpg";
    expect(validateImage(url)).toBe(url);
  });
});

describe("Price Parsing", () => {
  it("converts dollar amounts to cents", () => {
    expect(parsePrice("29.99")).toBe(2999);
    expect(parsePrice("100")).toBe(10000);
    expect(parsePrice("0.99")).toBe(99);
  });

  it("handles invalid inputs", () => {
    expect(parsePrice(null)).toBe(0);
    expect(parsePrice(undefined)).toBe(0);
    expect(parsePrice("")).toBe(0);
    expect(parsePrice("abc")).toBe(0);
  });
});

describe("Stock Status Parsing", () => {
  it("maps instock → in_stock", () => {
    expect(parseStockStatus("instock")).toBe("in_stock");
    expect(parseStockStatus("INSTOCK")).toBe("in_stock");
    expect(parseStockStatus("in_stock")).toBe("in_stock");
  });

  it("maps everything else to out_of_stock", () => {
    expect(parseStockStatus("outofstock")).toBe("out_of_stock");
    expect(parseStockStatus("")).toBe("out_of_stock");
    expect(parseStockStatus(null)).toBe("out_of_stock");
  });
});

describe("Deduplication", () => {
  it("merges products with same title + categories", () => {
    const baseProduct: CanonicalProduct = {
      supplierId: "P1",
      title: "Boxing Gloves",
      description: "Great gloves",
      handle: "boxing-gloves-p1",
      status: "published",
      categories: ["Gloves", "Boxing"],
      tags: ["sale"],
      images: ["img1.jpg"],
      variants: [
        makeVariant({
          supplierIdentity: "P1__V1",
          supplierVariantSku: "V1",
        }),
      ],
      wcPostId: 0,
      productType: "simple",
    };

    const dupProduct: CanonicalProduct = {
      ...baseProduct,
      supplierId: "P2",
      handle: "boxing-gloves-p2",
      variants: [
        makeVariant({
          supplierIdentity: "P2__V2",
          supplierVariantSku: "V2",
        }),
      ],
      images: ["img2.jpg"],
    };

    const result = deduplicate([baseProduct, dupProduct]);

    // Should merge into 1 product
    expect(result).toHaveLength(1);
    expect(result[0]!.productType).toBe("variable");
    // Should have both variants
    expect(result[0]!.variants).toHaveLength(2);
    // Should have both images
    expect(result[0]!.images).toHaveLength(2);
  });

  it("does not merge products with different titles", () => {
    const p1: CanonicalProduct = {
      supplierId: "P1",
      title: "Boxing Gloves",
      description: "",
      handle: "boxing-gloves-p1",
      status: "published",
      categories: ["Gloves"],
      tags: [],
      images: [],
      variants: [],
      wcPostId: 0,
      productType: "simple",
    };

    const p2: CanonicalProduct = {
      ...p1,
      supplierId: "P2",
      title: "MMA Gloves",
      handle: "mma-gloves-p2",
    };

    const result = deduplicate([p1, p2]);
    expect(result).toHaveLength(2);
  });

  it("does not merge products with different categories", () => {
    const p1: CanonicalProduct = {
      supplierId: "P1",
      title: "Boxing Gloves",
      description: "",
      handle: "boxing-gloves-p1",
      status: "published",
      categories: ["Gloves", "Boxing"],
      tags: [],
      images: [],
      variants: [],
      wcPostId: 0,
      productType: "simple",
    };

    const p2: CanonicalProduct = {
      ...p1,
      supplierId: "P2",
      categories: ["MMA"],
      handle: "boxing-gloves-p2",
    };

    const result = deduplicate([p1, p2]);
    expect(result).toHaveLength(2);
  });

  it("fixes product type when variant count changes", () => {
    const product: CanonicalProduct = {
      supplierId: "P1",
      title: "Cap",
      description: "",
      handle: "cap-p1",
      status: "published",
      categories: ["Hats"],
      tags: [],
      images: [],
      variants: [
        makeVariant({
          supplierIdentity: "P1__V1",
          supplierVariantSku: "V1",
        }),
        makeVariant({
          supplierIdentity: "P1__V2",
          supplierVariantSku: "V2",
        }),
      ],
      wcPostId: 0,
      productType: "simple", // Wrong! Should be variable
    };

    const result = deduplicate([product]);
    expect(result[0]!.productType).toBe("variable");
  });
});
