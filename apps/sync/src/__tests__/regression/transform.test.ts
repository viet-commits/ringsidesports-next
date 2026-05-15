/**
 * regression/transform.test.ts
 *
 * §8 Regression test: XML transform correctness
 *
 * Tests that the streaming XML parser correctly:
 * 1. Parses the flat supplier XML structure into CanonicalProduct/Variant
 * 2. Handles variant SKU fallback when supplier omits it
 * 3. Validates and replaces images
 * 4. Cleans phone snippets
 * 5. Deduplicates products
 * 6. Infers product type from variant count
 */
import { describe, it, expect } from "vitest";
import sax from "sax";
import {
  cleanText,
  validateImage,
  parsePrice,
  parseStockStatus,
  deduplicate,
} from "../../transform.js";
import type {
  CanonicalProduct,
  CanonicalVariant,
} from "@ringsidesports/shared-types";

// ── XML Parser (mirrors transform.ts parseXmlStream) ──────────────────────────

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

function makeEmptyProduct(): RawProduct {
  return {
    id: "", mpn: "", name: "", description: "", price: "", instock: "",
    quantity: "", category: "", tags: "", image: "", additionalImages: [],
    variants: [], weight: "", barcode: "",
  };
}

function makeEmptyVariant(): RawVariant {
  return {
    name: "", sku: "", price: "", instock: "", quantity: "",
    size: "", color: "", images: [], description: "", weight: "", barcode: "",
  };
}

function rawVariantToCanonical(
  raw: RawVariant,
  supplierId: string,
  productMpn: string,
  productTitle: string,
  index: number,
): CanonicalVariant {
  const variantSku = cleanText(raw.sku) || "";

  let supplierVariantSku = variantSku;
  if (!supplierVariantSku) {
    const sizePart = cleanText(raw.size) || "";
    const colorPart = cleanText(raw.color) || "";
    const suffix = [sizePart, colorPart].filter(Boolean).join("_") || String(index);
    supplierVariantSku = `${productMpn}_${suffix}`;
  }

  const supplierIdentity = `${supplierId}__${supplierVariantSku}`;
  const options: Record<string, string> = {};
  const size = cleanText(raw.size);
  const color = cleanText(raw.color);
  if (size && size !== "Default Title") options.size = size;
  if (color) options.colour = color;

  const variantImages: string[] = [];
  for (const img of raw.images) {
    const validated = validateImage(cleanText(img));
    if (!validated.includes("default-placeholder")) variantImages.push(validated);
  }
  const variantTitle = cleanText(raw.name) || productTitle;

  return {
    supplierVariantSku,
    supplierIdentity,
    title: variantTitle,
    price: parsePrice(raw.price),
    stockQuantity: parseInt(raw.quantity, 10) || 0,
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

  const variants = raw.variants.map((v, i) =>
    rawVariantToCanonical(v, supplierId, supplierMpn ?? "UNKNOWN", title, i + 1),
  );

  const productType = variants.length > 1 ? "variable" : "simple";

  const productImages: string[] = [];
  const mainImg = validateImage(cleanText(raw.image));
  if (!mainImg.includes("default-placeholder")) productImages.push(mainImg);
  for (const ai of raw.additionalImages) {
    const validated = validateImage(cleanText(ai));
    if (!validated.includes("default-placeholder")) productImages.push(validated);
  }

  const category = cleanText(raw.category);
  const categories = category
    ? category.replace(/&amp;/g, "&").split(/\||&/).map((c) => c.trim()).filter(Boolean)
    : [];

  const tagsRaw = cleanText(raw.tags);
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  return {
    supplierId,
    title,
    description: cleanText(raw.description) || undefined,
    handle: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200) + "-" + supplierId,
    status: "published",
    categories,
    tags,
    images: productImages,
    variants,
    wcPostId: 0,
    productType,
    supplierMpn,
    price: parsePrice(raw.price),
    stockQuantity: parseInt(raw.quantity, 10) || 0,
    stockStatus: parseStockStatus(raw.instock),
  };
}

function parseTestXml(xml: string): Promise<CanonicalProduct[]> {
  return new Promise((resolve, reject) => {
    const products: CanonicalProduct[] = [];
    let currentProduct: RawProduct = makeEmptyProduct();
    let currentVariant: RawVariant = makeEmptyVariant();
    let inProduct = false;
    let inVariant = false;
    let inVariants = false;
    let textBuffer = "";

    const saxStream = sax.createStream(true, { lowercase: true, trim: false });

    saxStream.on("opentag", (node) => {
      const tag = node.name.toLowerCase();
      textBuffer = "";

      if (tag === "id" && !inVariants) {
        if (inProduct && currentProduct.id) {
          products.push(rawProductToCanonical(currentProduct));
        }
        currentProduct = makeEmptyProduct();
        inProduct = true;
      } else if (tag === "variants") {
        inVariants = true;
      } else if (tag === "variant" && inVariants) {
        inVariant = true;
        currentVariant = makeEmptyVariant();
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
      } else if (tag === "id" && !inVariants && inProduct) {
        currentProduct.id = text;
      } else if (inVariant) {
        switch (tag) {
          case "name": currentVariant.name = text; break;
          case "sku": currentVariant.sku = text; break;
          case "price": currentVariant.price = text; break;
          case "instock": currentVariant.instock = text; break;
          case "quantity": currentVariant.quantity = text; break;
          case "size": currentVariant.size = text; break;
          case "color": case "colour": currentVariant.color = text; break;
          case "image": case "variant_image": if (text) currentVariant.images.push(text); break;
          case "description": currentVariant.description = text; break;
          case "weight": currentVariant.weight = text; break;
          case "barcode": currentVariant.barcode = text; break;
        }
      } else if (inProduct && !inVariants) {
        switch (tag) {
          case "mpn": currentProduct.mpn = text; break;
          case "name": currentProduct.name = text; break;
          case "description": currentProduct.description = text; break;
          case "price": currentProduct.price = text; break;
          case "instock": currentProduct.instock = text; break;
          case "quantity": currentProduct.quantity = text; break;
          case "category": currentProduct.category = text; break;
          case "tags": currentProduct.tags = text; break;
          case "image": currentProduct.image = text; break;
          case "additional_image": if (text) currentProduct.additionalImages.push(text); break;
          case "weight": currentProduct.weight = text; break;
          case "barcode": currentProduct.barcode = text; break;
        }
      }
      textBuffer = "";
    });

    saxStream.on("text", (t) => { textBuffer += t; });
    saxStream.on("end", () => {
      if (inProduct && currentProduct.id) {
        products.push(rawProductToCanonical(currentProduct));
      }
      resolve(products);
    });
    saxStream.on("error", reject);

    saxStream.end(xml);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("XML Transform — Basic Parsing", () => {
  it("parses a simple product without variants", async () => {
    const xml = `<products>
      <id>PROD001</id>
      <mpn>MPN-ABC</mpn>
      <name>Boxing Gloves Pro</name>
      <description>Premium leather boxing gloves</description>
      <price>49.99</price>
      <instock>in_stock</instock>
      <quantity>100</quantity>
      <category>Boxing|Gloves</category>
      <tags>sale,new</tags>
      <image>https://example.com/gloves.jpg</image>
    </products>`;

    const products = await parseTestXml(xml);
    expect(products).toHaveLength(1);

    const p = products[0]!;
    expect(p.supplierId).toBe("PROD001");
    expect(p.title).toBe("Boxing Gloves Pro");
    expect(p.description).toBe("Premium leather boxing gloves");
    expect(p.price).toBe(4999); // cents
    expect(p.stockStatus).toBe("in_stock");
    expect(p.stockQuantity).toBe(100);
    expect(p.categories).toEqual(["Boxing", "Gloves"]);
    expect(p.tags).toEqual(["sale", "new"]);
    expect(p.images).toEqual(["https://example.com/gloves.jpg"]);
    expect(p.productType).toBe("simple");
    expect(p.variants).toHaveLength(0);
  });

  it("parses a product with variants", async () => {
    const xml = `<products>
      <id>PROD002</id>
      <mpn>MPN-XYZ</mpn>
      <name>MMA Shorts</name>
      <price>59.99</price>
      <instock>instock</instock>
      <category>Clothing</category>
      <tags>mma</tags>
      <image>https://example.com/shorts.jpg</image>
      <Variants>
        <variant>
          <name>MMA Shorts - Small</name>
          <sku>SHRT-SM</sku>
          <price>59.99</price>
          <instock>instock</instock>
          <size>S</size>
          <color>Black</color>
          <image>https://example.com/shorts-s.jpg</image>
        </variant>
        <variant>
          <name>MMA Shorts - Medium</name>
          <sku>SHRT-MD</sku>
          <price>59.99</price>
          <instock>instock</instock>
          <size>M</size>
          <color>Black</color>
          <image>https://example.com/shorts-m.jpg</image>
        </variant>
        <variant>
          <name>MMA Shorts - Large</name>
          <sku>SHRT-LG</sku>
          <price>59.99</price>
          <instock>outofstock</instock>
          <size>L</size>
          <color>Black</color>
        </variant>
      </Variants>
    </products>`;

    const products = await parseTestXml(xml);
    expect(products).toHaveLength(1);

    const p = products[0]!;
    expect(p.productType).toBe("variable");
    expect(p.variants).toHaveLength(3);

    // First variant
    const v1 = p.variants[0]!;
    expect(v1.supplierVariantSku).toBe("SHRT-SM");
    expect(v1.supplierIdentity).toBe("PROD002__SHRT-SM");
    expect(v1.options).toEqual({ size: "S", colour: "Black" });
    expect(v1.stockStatus).toBe("in_stock");

    // Third variant (out of stock)
    const v3 = p.variants[2]!;
    expect(v3.stockStatus).toBe("out_of_stock");
    // Missing image → no images array
    expect(v3.images).toEqual([]);
  });

  it("handles product with single variant → type = simple", async () => {
    const xml = `<products>
      <id>PROD003</id>
      <mpn>MPN-ONE</mpn>
      <name>Single Variant Product</name>
      <price>19.99</price>
      <instock>instock</instock>
      <category>Gear</category>
      <Variants>
        <variant>
          <name>Default</name>
          <sku>ONE-001</sku>
          <price>19.99</price>
          <instock>instock</instock>
        </variant>
      </Variants>
    </products>`;

    const products = await parseTestXml(xml);
    expect(products[0]!.productType).toBe("simple");
    expect(products[0]!.variants).toHaveLength(1);
  });
});

describe("XML Transform — Variant SKU Fallback", () => {
  it("generates fallback SKU when variant omits it", async () => {
    const xml = `<products>
      <id>PROD004</id>
      <mpn>HOODIE-BLK</mpn>
      <name>Hoodie</name>
      <price>39.99</price>
      <instock>instock</instock>
      <category>Clothing</category>
      <Variants>
        <variant>
          <price>39.99</price>
          <instock>instock</instock>
          <size>XL</size>
          <color>Red</color>
        </variant>
      </Variants>
    </products>`;

    const products = await parseTestXml(xml);
    const v = products[0]!.variants[0]!;

    // Fallback: mpn_size_colour
    expect(v.supplierVariantSku).toBe("HOODIE-BLK_XL_Red");
    expect(v.supplierIdentity).toBe("PROD004__HOODIE-BLK_XL_Red");
  });

  it("preserves variant's own SKU when present", async () => {
    const xml = `<products>
      <id>PROD005</id>
      <mpn>HOODIE-BLK</mpn>
      <name>Hoodie</name>
      <price>39.99</price>
      <instock>instock</instock>
      <category>Clothing</category>
      <Variants>
        <variant>
          <sku>HOOD-XL-RED</sku>
          <price>39.99</price>
          <instock>instock</instock>
          <size>XL</size>
          <color>Red</color>
        </variant>
      </Variants>
    </products>`;

    const products = await parseTestXml(xml);
    const v = products[0]!.variants[0]!;

    // Uses variant's own SKU, not MPN fallback
    expect(v.supplierVariantSku).toBe("HOOD-XL-RED");
    expect(v.supplierIdentity).toBe("PROD005__HOOD-XL-RED");
    // Should NOT be the MPN
    expect(v.supplierVariantSku).not.toBe("HOODIE-BLK");
  });
});

describe("XML Transform — Image Handling", () => {
  it("validates product image URLs", async () => {
    const xml = `<products>
      <id>PROD006</id>
      <name>Test Product</name>
      <price>10.00</price>
      <instock>instock</instock>
      <category>Test</category>
      <image>https://example.com/valid.jpg</image>
      <additional_image>not-a-valid-url</additional_image>
      <additional_image>https://example.com/valid2.png</additional_image>
    </products>`;

    const products = await parseTestXml(xml);
    const p = products[0]!;

    // Only valid images are kept
    expect(p.images).toHaveLength(2);
    expect(p.images).toContain("https://example.com/valid.jpg");
    expect(p.images).toContain("https://example.com/valid2.png");
    // Invalid image is dropped, not replaced with placeholder in the array
    expect(p.images).not.toContain("not-a-valid-url");
  });

  it("validates variant image URLs", async () => {
    const xml = `<products>
      <id>PROD007</id>
      <name>Test</name>
      <price>10.00</price>
      <instock>instock</instock>
      <category>Test</category>
      <Variants>
        <variant>
          <sku>V-001</sku>
          <price>10.00</price>
          <instock>instock</instock>
          <image>https://example.com/var-valid.jpg</image>
        </variant>
        <variant>
          <sku>V-002</sku>
          <price>10.00</price>
          <instock>instock</instock>
          <image>ftp://invalid-protocol/img.jpg</image>
        </variant>
      </Variants>
    </products>`;

    const products = await parseTestXml(xml);
    const v1 = products[0]!.variants[0]!;
    const v2 = products[0]!.variants[1]!;

    // Valid variant image preserved
    expect(v1.images).toEqual(["https://example.com/var-valid.jpg"]);

    // Invalid variant image → empty array (placeholder replaced at validation level)
    expect(v2.images).toEqual([]);
  });
});

describe("XML Transform — Phone Snippet Cleaning", () => {
  it("strips phone spam from description fields", async () => {
    const xml = `<products>
      <id>PROD008</id>
      <name>Quality Gloves</name>
      <price>29.99</price>
      <instock>instock</instock>
      <category>Gloves</category>
      <description>Premium gloves. &lt;li&gt;PHONE &lt;a href=&quot;tel:0400919454&quot;&gt;0400919454&lt;/a&gt; FOR GREAT QTY BUY ON THIS ITEM !!&lt;/li&gt; Buy now!</description>
    </products>`;

    const products = await parseTestXml(xml);
    const p = products[0]!;

    expect(p.description).not.toContain("0400919454");
    expect(p.description).not.toContain("PHONE");
    expect(p.description).toContain("Premium gloves");
    expect(p.description).toContain("Buy now");
  });

  it("strips escaped phone HTML from description (real feed format)", async () => {
    // Real supplier XML uses escaped HTML entities for embedded content
    const xml = `<products>
      <id>PROD009</id>
      <name>Test</name>
      <price>10.00</price>
      <instock>instock</instock>
      <category>Test</category>
      <description>Great item! &lt;li&gt;PHONE &lt;a href=&quot;tel:0400919454&quot;&gt;0400919454&lt;/a&gt; FOR GREAT QTY BUY ON THIS ITEM !!&lt;/li&gt; Order today.</description>
    </products>`;

    const products = await parseTestXml(xml);
    const p = products[0]!;

    expect(p.description).not.toContain("0400919454");
    expect(p.description).not.toContain("PHONE");
    expect(p.description).toContain("Great item");
    expect(p.description).toContain("Order today");
  });
});

describe("XML Transform — Deduplication", () => {
  it("merges duplicate products by title + category", async () => {
    const xml = `<products>
      <id>PROD010</id>
      <name>Boxing Gloves</name>
      <price>49.99</price>
      <instock>instock</instock>
      <category>Gloves|Boxing</category>
      <image>https://example.com/img1.jpg</image>
      <Variants>
        <variant>
          <sku>GLOVE-RD-S</sku>
          <price>49.99</price>
          <instock>instock</instock>
          <size>S</size>
          <color>Red</color>
        </variant>
      </Variants>
      <id>PROD011</id>
      <name>Boxing Gloves</name>
      <price>49.99</price>
      <instock>instock</instock>
      <category>Gloves|Boxing</category>
      <image>https://example.com/img2.jpg</image>
      <Variants>
        <variant>
          <sku>GLOVE-RD-M</sku>
          <price>49.99</price>
          <instock>instock</instock>
          <size>M</size>
          <color>Red</color>
        </variant>
      </Variants>
    </products>`;

    const products = await parseTestXml(xml);

    // Before deduplication: 2 products
    expect(products).toHaveLength(2);

    // After deduplication
    const deduped = deduplicate(products);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]!.productType).toBe("variable");
    expect(deduped[0]!.variants).toHaveLength(2);
    expect(deduped[0]!.images).toHaveLength(2);
  });
});

describe("XML Transform — Multiple Products", () => {
  it("parses multiple products from a single XML stream", async () => {
    const xml = `<products>
      <id>PROD-A</id>
      <name>Product A</name>
      <price>10.00</price>
      <instock>instock</instock>
      <category>CatA</category>
      <id>PROD-B</id>
      <name>Product B</name>
      <price>20.00</price>
      <instock>outofstock</instock>
      <category>CatB</category>
    </products>`;

    const products = await parseTestXml(xml);
    expect(products).toHaveLength(2);
    expect(products[0]!.supplierId).toBe("PROD-A");
    expect(products[1]!.supplierId).toBe("PROD-B");
    expect(products[1]!.stockStatus).toBe("out_of_stock");
  });
});
