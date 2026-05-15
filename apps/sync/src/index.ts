/**
 * index.ts — Supplier sync orchestrator
 *
 * Entry point called from cron every 15 minutes:
 *   &#42;/15 * * * * cd /opt/ringsidesports/apps/sync && node dist/index.js >> /opt/ringsidesports/logs/sync.log 2>&1
 *
 * Pipeline:
 *   1. fetch.ts    — Download supplier XML
 *   2. transform.ts — Parse & normalize into CanonicalProduct/Variant
 *   3. reconcile.ts — Upsert to Medusa Postgres, mark stale items
 *   4. images.ts    — Download external images to Cloudflare R2
 *
 * Exit 0 on success, exit 1 on failure.
 */
import { fetchXml } from "./fetch.js";
import { transformXml } from "./transform.js";
import { reconcile, setPgPool as setReconcilePool } from "./reconcile.js";
import { processProductImages, setPgPool as setImagesPool } from "./images.js";
import { identity, setPgPool as setIdentityPool } from "./identity.js";
import pg from "pg";

// ── Config ────────────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/ringsidesports";

const _LOG_DIR = process.env.SYNC_LOG_DIR ?? "/opt/ringsidesports/logs";
void _LOG_DIR;

function log(level: string, msg: string): void {
  const ts = new Date().toISOString();
  console.log(`${ts} [${level}] index.ts: ${msg}`);
}

// ── Timings ───────────────────────────────────────────────────────────────────

interface StepTiming {
  name: string;
  durationMs: number;
  success: boolean;
  counts?: Record<string, number>;
}

const timings: StepTiming[] = [];

async function runStep<T>(
  name: string,
  fn: () => Promise<T>,
  extractCounts?: (result: T) => Record<string, number>,
): Promise<T> {
  const start = performance.now();
  log("INFO", `[${name}] Starting...`);
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    const counts = extractCounts ? extractCounts(result) : undefined;
    timings.push({ name, durationMs, success: true, counts });
    log("INFO", `[${name}] Complete: ${durationMs}ms${counts ? " " + JSON.stringify(counts) : ""}`);
    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    timings.push({ name, durationMs, success: false });
    log("ERROR", `[${name}] FAILED after ${durationMs}ms: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log("INFO", "=== Ringside Sports Supplier Sync START ===");
  const totalStart = performance.now();

  // 0. Set up Postgres pool
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  setReconcilePool(pool);
  setImagesPool(pool);
  setIdentityPool(pool);

  // Test connection
  try {
    await pool.query("SELECT 1");
    log("INFO", "Postgres connection OK");
  } catch (err) {
    log("ERROR", `Postgres connection failed: ${err instanceof Error ? err.message : String(err)}`);
    await pool.end();
    process.exit(1);
  }

  try {
    // 1. Initialize identity schema
    log("INFO", "Initializing identity schema...");
    await identity.initSchema();

    // 2. Fetch supplier XML
    const fetchResult = await runStep(
      "fetch",
      fetchXml,
      (r) => ({ bytes: r.byteCount, skipped: r.skipped ? 1 : 0 }),
    );

    if (fetchResult.skipped) {
      log("INFO", "XML unchanged — loading identity map and checking for stale items only");
      // Still need to reconcile stale items if any
      await identity.loadAll();
      log("INFO", `Identity map loaded: ${identity.all().size} entries`);
      // Run reconciliation with empty product list to handle stale items
      await runStep("reconcile-empty", () => reconcile([]), (r) => ({
        staleProducts: r.productsOutOfStock,
        staleVariants: r.variantsOutOfStock,
      }));
    } else {
      // 3. Load identity map
      await runStep(
        "identity-load",
        async () => {
          await identity.loadAll();
          return { entries: identity.all().size };
        },
        (r) => ({ entries: r.entries }),
      );

      // 4. Transform XML
      const transformResult = await runStep(
        "transform",
        () => transformXml(fetchResult.xmlPath),
        (r) => ({ products: r.productCount, variants: r.variantCount }),
      );

      // 5. Reconcile
      await runStep(
        "reconcile",
        () => reconcile(transformResult.products),
        (r) => ({
          created: r.productsCreated,
          updated: r.productsUpdated,
          varCreated: r.variantsCreated,
          varUpdated: r.variantsUpdated,
          stale: r.productsOutOfStock + r.variantsOutOfStock,
          errors: r.errors,
        }),
      );

      // 6. Process images
      await runStep(
        "images",
        () => processProductImages(transformResult.products),
        (r) => ({
          downloaded: r.downloaded,
          cached: r.cached,
          errors: r.errors,
          productImages: r.productImages,
          variantImages: r.variantImages,
        }),
      );
    }
  } catch (err) {
    log("ERROR", `Sync pipeline failed: ${err instanceof Error ? err.message : String(err)}`);
    await pool.end();
    process.exit(1);
  }

  await pool.end();

  // Print summary
  const totalMs = Math.round(performance.now() - totalStart);
  log("INFO", "=== Sync Summary ===");
  for (const step of timings) {
    const status = step.success ? "✓" : "✗";
    const counts = step.counts ? ` | ${JSON.stringify(step.counts)}` : "";
    log("INFO", `  ${status} ${step.name}: ${(step.durationMs / 1000).toFixed(2)}s${counts}`);
  }
  log("INFO", `Total: ${(totalMs / 1000).toFixed(2)}s`);
  log("INFO", "=== Ringside Sports Supplier Sync DONE ===");
}

main();
