#!/usr/bin/env node

/**
 * Standalone script to index the Ringside Sports product catalog into MeiliSearch.
 *
 * Usage:
 *   node scripts/index-meilisearch.mjs [/path/to/catalog-export.json]
 *
 * Environment variables:
 *   MEILISEARCH_HOST  - MeiliSearch server URL (default: http://localhost:7700)
 *   MEILI_MASTER_KEY  - MeiliSearch master key
 */

import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Minimal MeiliSearch HTTP client (no npm dependency needed for the script)
// ---------------------------------------------------------------------------

const HOST = process.env.MEILISEARCH_HOST || "http://localhost:7700";
const API_KEY = process.env.MEILI_MASTER_KEY || "ringsidesports-meili-key";
const INDEX_UID = "products";
const CATALOG_PATH =
  process.argv[2] || "/tmp/catalog-export.json";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

async function meiliRequest(method, path, body) {
  const url = `${HOST}${path}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MeiliSearch ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function waitForTask(taskUid) {
  while (true) {
    const task = await meiliRequest("GET", `/tasks/${taskUid}`);
    if (task.status === "succeeded") return task;
    if (task.status === "failed") {
      throw new Error(
        `Task ${taskUid} failed: ${JSON.stringify(task.error)}`
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

// ---------------------------------------------------------------------------
// Main indexing logic
// ---------------------------------------------------------------------------

function loadCatalog(filePath) {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function productToDocument(product) {
  let lowestPrice = Infinity;
  for (const v of product.variants) {
    if (v.price < lowestPrice) lowestPrice = v.price;
  }

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
      size: v.options?.size,
      colour: v.options?.colour,
      stockStatus: v.stockStatus,
    })),
    stockStatus: overallStock,
    productType: product.productType,
  };
}

async function configureIndex() {
  console.log("Configuring index settings...");
  const task = await meiliRequest("PATCH", `/indexes/${INDEX_UID}/settings`, {
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
  await waitForTask(task.taskUid);
  console.log("Index settings configured.");
}

async function indexProducts() {
  console.log(`Loading catalog from ${CATALOG_PATH}...`);
  const catalog = loadCatalog(CATALOG_PATH);
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

  const BATCH_SIZE = 100;
  let totalIndexed = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const task = await meiliRequest(
      "POST",
      `/indexes/${INDEX_UID}/documents`,
      batch
    );
    await waitForTask(task.taskUid);
    totalIndexed += batch.length;
    console.log(
      `Batch ${Math.floor(i / BATCH_SIZE) + 1}: indexed ${batch.length} docs (total: ${totalIndexed})`
    );
  }

  console.log(`\n✅ Done! Indexed ${totalIndexed} products into MeiliSearch.`);
  return totalIndexed;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

indexProducts()
  .then((count) => {
    console.log(`Success: ${count} products indexed.`);
  })
  .catch((err) => {
    console.error("Indexing failed:", err);
    process.exit(1);
  });
