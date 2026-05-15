import { readFileSync } from "node:fs";
import { searchClient, PRODUCTS_INDEX } from "./meilisearch-client";

interface VariantOption {
  size?: string;
  colour?: string;
}

interface CatalogVariant {
  supplierVariantSku: string;
  supplierIdentity: string;
  title: string;
  price: number;
  stockQuantity: number;
  stockStatus: string;
  options: VariantOption;
  images: string[];
  wcVariationId: number;
}

interface CatalogProduct {
  supplierId: string;
  title: string;
  description: string;
  handle: string;
  status: string;
  categories: string[];
  tags: string[];
  images: string[];
  variants: CatalogVariant[];
  wcPostId: number;
  productType: string;
}

interface CatalogExport {
  exportedAt: string;
  totalProducts: number;
  totalVariants: number;
  products: CatalogProduct[];
}

interface SearchDocument {
  id: string;
  title: string;
  handle: string;
  description: string;
  categories: string[];
  tags: string[];
  price: number;
  image: string;
  variants: {
    title: string;
    price: number;
    size?: string;
    colour?: string;
    stockStatus: string;
  }[];
  stockStatus: string;
  productType: string;
}

function loadCatalog(filePath: string): CatalogExport {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as CatalogExport;
}

function productToDocument(product: CatalogProduct): SearchDocument {
  const lowestPrice = product.variants.reduce(
    (min, v) => (v.price < min ? v.price : min),
    Infinity
  );

  const overallStock = product.variants.some(
    (v) => v.stockStatus === "in_stock"
  )
    ? "in_stock"
    : "out_of_stock";

  return {
    id: product.supplierId,
    title: product.title,
    handle: product.handle,
    description: product.description,
    categories: product.categories,
    tags: product.tags,
    price: lowestPrice === Infinity ? 0 : lowestPrice,
    image: product.images[0] || "",
    variants: product.variants.map((v) => ({
      title: v.title,
      price: v.price,
      size: v.options.size,
      colour: v.options.colour,
      stockStatus: v.stockStatus,
    })),
    stockStatus: overallStock,
    productType: product.productType,
  };
}

async function configureIndex() {
  const index = searchClient.index(PRODUCTS_INDEX);

  await index.updateSettings({
    searchableAttributes: [
      "title",
      "description",
      "categories",
      "tags",
      "variants.title",
    ],
    filterableAttributes: [
      "categories",
      "tags",
      "price",
      "stockStatus",
      "productType",
    ],
    sortableAttributes: ["price", "title"],
    typoTolerance: {
      enabled: true,
    },
  });

  console.log("Index settings configured.");
}

async function indexProducts(filePath: string) {
  console.log(`Loading catalog from ${filePath}...`);
  const catalog = loadCatalog(filePath);
  console.log(
    `Loaded ${catalog.products.length} products (${catalog.totalVariants} variants).`
  );

  const documents = catalog.products
    .filter((p) => p.status === "published")
    .map(productToDocument);

  console.log(
    `Prepared ${documents.length} published products for indexing.`
  );

  await configureIndex();

  const index = searchClient.index(PRODUCTS_INDEX);
  const BATCH_SIZE = 100;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const result = await index.addDocuments(batch);
    console.log(
      `Batch ${Math.floor(i / BATCH_SIZE) + 1}: indexed ${batch.length} docs (task: ${result.taskUid})`
    );
  }

  console.log("Indexing complete!");
  return documents.length;
}

// Allow running as a script
const args = process.argv.slice(2);
const catalogPath = args[0] || "/tmp/catalog-export.json";

indexProducts(catalogPath)
  .then((count) => {
    console.log(`Successfully indexed ${count} products.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Indexing failed:", err);
    process.exit(1);
  });
