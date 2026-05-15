/**
 * Mock product data for static export builds.
 * Represents Ringside Sports catalog with realistic MMA/Boxing gear.
 * Prices in AUD cents, GST inclusive.
 */

export interface MockVariant {
  sku: string;
  title: string;
  price: number;
  stockQuantity: number;
  stockStatus: "in_stock" | "out_of_stock";
  options: Record<string, string>;
  images: string[];
}

export interface MockProduct {
  id: string;
  supplierId: string;
  title: string;
  description: string;
  handle: string;
  status: "published" | "draft";
  categories: string[];
  tags: string[];
  images: string[];
  variants: MockVariant[];
  productType: "simple" | "variable";
  /** Min price across variants in cents */
  price: number;
  stockStatus: "in_stock" | "out_of_stock";
  stockQuantity: number;
}

const PLACEHOLDER_IMG = (id: string) =>
  `https://placehold.co/600x600/0A0A0A/FFFFFF?text=${encodeURIComponent(id)}`;

export const CATEGORIES = [
  { name: "Boxing", slug: "boxing", image: PLACEHOLDER_IMG("Boxing"), count: 142 },
  { name: "MMA", slug: "mma", image: PLACEHOLDER_IMG("MMA"), count: 98 },
  { name: "Muay Thai", slug: "muay-thai", image: PLACEHOLDER_IMG("Muay+Thai"), count: 67 },
  { name: "Kickboxing", slug: "kickboxing", image: PLACEHOLDER_IMG("Kickboxing"), count: 54 },
  { name: "Apparel", slug: "apparel", image: PLACEHOLDER_IMG("Apparel"), count: 73 },
  { name: "Accessories", slug: "accessories", image: PLACEHOLDER_IMG("Accessories"), count: 49 },
];

export const FEATURED_PRODUCTS: MockProduct[] = [
  {
    id: "prod-001",
    supplierId: "101",
    title: "Ringside Pro Boxing Gloves 16oz",
    description:
      "Premium leather boxing gloves with multi-layer foam padding. Ideal for sparring and heavy bag work. Available in multiple colours and sizes.",
    handle: "ringside-pro-boxing-gloves-16oz",
    status: "published",
    categories: ["Boxing", "Gloves"],
    tags: ["sparring", "training", "pro-series"],
    images: [PLACEHOLDER_IMG("Pro+Gloves+16oz"), PLACEHOLDER_IMG("Gloves+Side")],
    variants: [
      {
        sku: "RBG-16-BLK",
        title: "Black / 16oz",
        price: 12999,
        stockQuantity: 15,
        stockStatus: "in_stock",
        options: { colour: "Black", size: "16oz" },
        images: [PLACEHOLDER_IMG("Gloves+Black")],
      },
      {
        sku: "RBG-16-RED",
        title: "Red / 16oz",
        price: 12999,
        stockQuantity: 8,
        stockStatus: "in_stock",
        options: { colour: "Red", size: "16oz" },
        images: [PLACEHOLDER_IMG("Gloves+Red")],
      },
      {
        sku: "RBG-14-BLK",
        title: "Black / 14oz",
        price: 11999,
        stockQuantity: 20,
        stockStatus: "in_stock",
        options: { colour: "Black", size: "14oz" },
        images: [PLACEHOLDER_IMG("Gloves+Black+14")],
      },
      {
        sku: "RBG-14-RED",
        title: "Red / 14oz",
        price: 11999,
        stockQuantity: 0,
        stockStatus: "out_of_stock",
        options: { colour: "Red", size: "14oz" },
        images: [PLACEHOLDER_IMG("Gloves+Red+14")],
      },
    ],
    productType: "variable",
    price: 11999,
    stockStatus: "in_stock",
    stockQuantity: 43,
  },
  {
    id: "prod-002",
    supplierId: "102",
    title: "MMA Grappling Gloves 7oz",
    description:
      "Open-palm MMA gloves designed for grappling and striking. Pre-curved design for natural hand position.",
    handle: "mma-grappling-gloves-7oz",
    status: "published",
    categories: ["MMA", "Gloves"],
    tags: ["mma", "grappling", "competition"],
    images: [PLACEHOLDER_IMG("MMA+Gloves"), PLACEHOLDER_IMG("MMA+Gloves+2")],
    variants: [
      {
        sku: "MMA-G7-BLK",
        title: "Black / 7oz",
        price: 8999,
        stockQuantity: 25,
        stockStatus: "in_stock",
        options: { colour: "Black", size: "7oz" },
        images: [PLACEHOLDER_IMG("MMA+Black")],
      },
    ],
    productType: "simple",
    price: 8999,
    stockStatus: "in_stock",
    stockQuantity: 25,
  },
  {
    id: "prod-003",
    supplierId: "103",
    title: "Muay Thai Shorts - Premium",
    description:
      "Authentic Muay Thai shorts made from satin with wide leg openings for unrestricted kicks. Elastic waistband with drawstring.",
    handle: "muay-thai-shorts-premium",
    status: "published",
    categories: ["Muay Thai", "Apparel"],
    tags: ["muay-thai", "shorts", "premium"],
    images: [PLACEHOLDER_IMG("MT+Shorts"), PLACEHOLDER_IMG("MT+Shorts+2")],
    variants: [
      {
        sku: "MTS-RED-M",
        title: "Red / M",
        price: 6499,
        stockQuantity: 12,
        stockStatus: "in_stock",
        options: { colour: "Red", size: "M" },
        images: [PLACEHOLDER_IMG("MT+Red+M")],
      },
      {
        sku: "MTS-RED-L",
        title: "Red / L",
        price: 6499,
        stockQuantity: 18,
        stockStatus: "in_stock",
        options: { colour: "Red", size: "L" },
        images: [PLACEHOLDER_IMG("MT+Red+L")],
      },
      {
        sku: "MTS-BLU-M",
        title: "Blue / M",
        price: 6499,
        stockQuantity: 10,
        stockStatus: "in_stock",
        options: { colour: "Blue", size: "M" },
        images: [PLACEHOLDER_IMG("MT+Blue+M")],
      },
      {
        sku: "MTS-BLU-L",
        title: "Blue / L",
        price: 6499,
        stockQuantity: 7,
        stockStatus: "in_stock",
        options: { colour: "Blue", size: "L" },
        images: [PLACEHOLDER_IMG("MT+Blue+L")],
      },
    ],
    productType: "variable",
    price: 6499,
    stockStatus: "in_stock",
    stockQuantity: 47,
  },
  {
    id: "prod-004",
    supplierId: "104",
    title: "Kickboxing Shin Guards",
    description:
      "Professional kickboxing shin guards with high-density foam padding. Full shin and instep coverage with secure velcro straps.",
    handle: "kickboxing-shin-guards",
    status: "published",
    categories: ["Kickboxing", "Protective Gear"],
    tags: ["kickboxing", "shin-guards", "protection"],
    images: [PLACEHOLDER_IMG("Shin+Guards"), PLACEHOLDER_IMG("Shin+Guards+2")],
    variants: [
      {
        sku: "KSG-BLK-S",
        title: "Black / S",
        price: 7999,
        stockQuantity: 14,
        stockStatus: "in_stock",
        options: { colour: "Black", size: "S" },
        images: [PLACEHOLDER_IMG("Shin+Black+S")],
      },
      {
        sku: "KSG-BLK-M",
        title: "Black / M",
        price: 7999,
        stockQuantity: 22,
        stockStatus: "in_stock",
        options: { colour: "Black", size: "M" },
        images: [PLACEHOLDER_IMG("Shin+Black+M")],
      },
    ],
    productType: "variable",
    price: 7999,
    stockStatus: "in_stock",
    stockQuantity: 36,
  },
  {
    id: "prod-005",
    supplierId: "105",
    title: "Ringside Sports Hoodie",
    description:
      "Heavyweight cotton blend hoodie with embroidered Ringside Sports logo. Kangaroo pocket, adjustable drawstring hood.",
    handle: "ringside-sports-hoodie",
    status: "published",
    categories: ["Apparel"],
    tags: ["apparel", "hoodie", "merchandise"],
    images: [PLACEHOLDER_IMG("Hoodie"), PLACEHOLDER_IMG("Hoodie+Back")],
    variants: [
      {
        sku: "RSH-BLK-M",
        title: "Black / M",
        price: 6999,
        stockQuantity: 30,
        stockStatus: "in_stock",
        options: { colour: "Black", size: "M" },
        images: [PLACEHOLDER_IMG("Hoodie+Black+M")],
      },
      {
        sku: "RSH-BLK-L",
        title: "Black / L",
        price: 6999,
        stockQuantity: 25,
        stockStatus: "in_stock",
        options: { colour: "Black", size: "L" },
        images: [PLACEHOLDER_IMG("Hoodie+Black+L")],
      },
      {
        sku: "RSH-BLK-XL",
        title: "Black / XL",
        price: 7499,
        stockQuantity: 20,
        stockStatus: "in_stock",
        options: { colour: "Black", size: "XL" },
        images: [PLACEHOLDER_IMG("Hoodie+Black+XL")],
      },
    ],
    productType: "variable",
    price: 6999,
    stockStatus: "in_stock",
    stockQuantity: 75,
  },
  {
    id: "prod-006",
    supplierId: "106",
    title: "Hand Wraps 4.5m Mexican Style",
    description:
      "Stretch cotton hand wraps with thumb loop and velcro closure. Mexican style for a snug, protective wrap.",
    handle: "hand-wraps-4-5m-mexican",
    status: "published",
    categories: ["Boxing", "Accessories"],
    tags: ["hand-wraps", "protection", "essential"],
    images: [PLACEHOLDER_IMG("Hand+Wraps"), PLACEHOLDER_IMG("Hand+Wraps+2")],
    variants: [
      {
        sku: "HW-MEX-RED",
        title: "Red",
        price: 1499,
        stockQuantity: 50,
        stockStatus: "in_stock",
        options: { colour: "Red" },
        images: [PLACEHOLDER_IMG("Wraps+Red")],
      },
      {
        sku: "HW-MEX-BLK",
        title: "Black",
        price: 1499,
        stockQuantity: 45,
        stockStatus: "in_stock",
        options: { colour: "Black" },
        images: [PLACEHOLDER_IMG("Wraps+Black")],
      },
      {
        sku: "HW-MEX-WHT",
        title: "White",
        price: 1499,
        stockQuantity: 40,
        stockStatus: "in_stock",
        options: { colour: "White" },
        images: [PLACEHOLDER_IMG("Wraps+White")],
      },
    ],
    productType: "variable",
    price: 1499,
    stockStatus: "in_stock",
    stockQuantity: 135,
  },
  {
    id: "prod-007",
    supplierId: "107",
    title: "Boxing Headgear - Competition",
    description:
      "AIBA-approved competition headgear with full cheek protection. Lightweight design with moisture-wicking lining.",
    handle: "boxing-headgear-competition",
    status: "published",
    categories: ["Boxing", "Protective Gear"],
    tags: ["headgear", "competition", "protection"],
    images: [PLACEHOLDER_IMG("Headgear"), PLACEHOLDER_IMG("Headgear+2")],
    variants: [
      {
        sku: "BHG-COMP-BLK",
        title: "Black",
        price: 9999,
        stockQuantity: 10,
        stockStatus: "in_stock",
        options: { colour: "Black" },
        images: [PLACEHOLDER_IMG("Headgear+Black")],
      },
    ],
    productType: "simple",
    price: 9999,
    stockStatus: "in_stock",
    stockQuantity: 10,
  },
  {
    id: "prod-008",
    supplierId: "108",
    title: "Mouthguard - Double Layer",
    description:
      "Double-layer mouthguard with gel inner lining for superior comfort. Boil-and-bite fit. Includes ventilated case.",
    handle: "mouthguard-double-layer",
    status: "published",
    categories: ["Boxing", "MMA", "Protective Gear"],
    tags: ["mouthguard", "protection", "essential"],
    images: [PLACEHOLDER_IMG("Mouthguard"), PLACEHOLDER_IMG("Mouthguard+Case")],
    variants: [
      {
        sku: "MG-DL-CLR",
        title: "Clear",
        price: 2499,
        stockQuantity: 60,
        stockStatus: "in_stock",
        options: { colour: "Clear" },
        images: [PLACEHOLDER_IMG("Mouthguard+Clear")],
      },
      {
        sku: "MG-DL-BLK",
        title: "Black",
        price: 2499,
        stockQuantity: 45,
        stockStatus: "in_stock",
        options: { colour: "Black" },
        images: [PLACEHOLDER_IMG("Mouthguard+Black")],
      },
    ],
    productType: "variable",
    price: 2499,
    stockStatus: "in_stock",
    stockQuantity: 105,
  },
];

export const PRODUCTS: MockProduct[] = [
  ...FEATURED_PRODUCTS,
  // Additional products for the full catalog
  {
    id: "prod-009",
    supplierId: "109",
    title: "Focus Mitts - Curved",
    description: "Ergonomic curved focus mitts for precision training. Lightweight with reinforced palm padding.",
    handle: "focus-mitts-curved",
    status: "published",
    categories: ["Boxing", "Training Equipment"],
    tags: ["focus-mitts", "training", "coaching"],
    images: [PLACEHOLDER_IMG("Focus+Mitts")],
    variants: [{ sku: "FM-CUR-BLK", title: "Black", price: 5499, stockQuantity: 20, stockStatus: "in_stock", options: { colour: "Black" }, images: [PLACEHOLDER_IMG("Mitts+Black")] }],
    productType: "simple",
    price: 5499,
    stockStatus: "in_stock",
    stockQuantity: 20,
  },
  {
    id: "prod-010",
    supplierId: "110",
    title: "MMA Rash Guard - Long Sleeve",
    description: "Compression fit rash guard with flatlock seams. Quick-dry fabric with UV protection.",
    handle: "mma-rash-guard-long-sleeve",
    status: "published",
    categories: ["MMA", "Apparel"],
    tags: ["rash-guard", "compression", "mma"],
    images: [PLACEHOLDER_IMG("Rash+Guard")],
    variants: [
      { sku: "RG-LS-BLK-M", title: "Black / M", price: 5499, stockQuantity: 15, stockStatus: "in_stock", options: { colour: "Black", size: "M" }, images: [PLACEHOLDER_IMG("RG+Black+M")] },
      { sku: "RG-LS-BLK-L", title: "Black / L", price: 5499, stockQuantity: 12, stockStatus: "in_stock", options: { colour: "Black", size: "L" }, images: [PLACEHOLDER_IMG("RG+Black+L")] },
    ],
    productType: "variable",
    price: 5499,
    stockStatus: "in_stock",
    stockQuantity: 27,
  },
  {
    id: "prod-011",
    supplierId: "111",
    title: "Jump Rope - Speed Cable",
    description: "Adjustable speed cable jump rope with ball bearing handles. Lightweight for double-unders and footwork.",
    handle: "jump-rope-speed-cable",
    status: "published",
    categories: ["Boxing", "Accessories", "Training Equipment"],
    tags: ["jump-rope", "conditioning", "speed"],
    images: [PLACEHOLDER_IMG("Jump+Rope")],
    variants: [{ sku: "JR-SC-BLK", title: "Black Cable", price: 2999, stockQuantity: 35, stockStatus: "in_stock", options: { colour: "Black" }, images: [PLACEHOLDER_IMG("Rope+Black")] }],
    productType: "simple",
    price: 2999,
    stockStatus: "in_stock",
    stockQuantity: 35,
  },
  {
    id: "prod-012",
    supplierId: "112",
    title: "Kickboxing Ankle Supports",
    description: "Neoprene ankle supports with adjustable strap. Provides compression and stability during training.",
    handle: "kickboxing-ankle-supports",
    status: "published",
    categories: ["Kickboxing", "Protective Gear"],
    tags: ["ankle-supports", "protection", "kickboxing"],
    images: [PLACEHOLDER_IMG("Ankle+Supports")],
    variants: [
      { sku: "KAS-BLK-S", title: "Black / S-M", price: 3499, stockQuantity: 18, stockStatus: "in_stock", options: { colour: "Black", size: "S-M" }, images: [PLACEHOLDER_IMG("Ankle+Black+S")] },
      { sku: "KAS-BLK-L", title: "Black / L-XL", price: 3499, stockQuantity: 14, stockStatus: "in_stock", options: { colour: "Black", size: "L-XL" }, images: [PLACEHOLDER_IMG("Ankle+Black+L")] },
    ],
    productType: "variable",
    price: 3499,
    stockStatus: "in_stock",
    stockQuantity: 32,
  },
];

export function getProductByHandle(handle: string): MockProduct | undefined {
  return PRODUCTS.find((p) => p.handle === handle);
}

export function getProductsByCategory(category: string): MockProduct[] {
  return PRODUCTS.filter((p) =>
    p.categories.some((c) => c.toLowerCase() === category.toLowerCase())
  );
}

export function getProductHandles(): string[] {
  return PRODUCTS.map((p) => p.handle);
}
