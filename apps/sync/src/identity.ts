/**
 * identity.ts — supplier_id → medusa_product_id map
 *
 * Stores mapping in Postgres table `sync_identity_map`.
 * Bulk-loads at the start of each sync run, updates after each upsert.
 */
export interface SyncIdentityRow {
  supplier_id: string;
  supplier_identity: string;
  medusa_entity_type: "product" | "variant";
  medusa_entity_id: string;
  last_seen_at: Date;
  created_at: Date;
}

function log(level: string, msg: string): void {
  const ts = new Date().toISOString();
  console.log(`${ts} [${level}] identity.ts: ${msg}`);
}

// In-memory cache loaded once at sync start
let identityMap = new Map<string, SyncIdentityRow>();

export interface IdentityStore {
  /** Load all mappings from Postgres into memory */
  loadAll(): Promise<Map<string, SyncIdentityRow>>;
  /** Look up by supplier_identity */
  findBySupplierIdentity(
    supplierIdentity: string,
  ): SyncIdentityRow | undefined;
  /** Look up by supplier_id (product-level) */
  findBySupplierId(supplierId: string): SyncIdentityRow | undefined;
  /** Record a new or updated mapping */
  upsert(row: Omit<SyncIdentityRow, "last_seen_at" | "created_at">): void;
  /** Commit in-memory changes to Postgres */
  flush(): Promise<void>;
  /** Return all cached rows */
  all(): Map<string, SyncIdentityRow>;
  /** Initialize the DB schema (create table if not exists) */
  initSchema(): Promise<void>;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS sync_identity_map (
  supplier_id       TEXT NOT NULL,
  supplier_identity TEXT NOT NULL PRIMARY KEY,
  medusa_entity_type TEXT NOT NULL CHECK (medusa_entity_type IN ('product', 'variant')),
  medusa_entity_id  TEXT NOT NULL,
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_identity_supplier_id
  ON sync_identity_map (supplier_id);
`;

// Will be set externally by index.ts with the pg Pool
let pgPool: import("pg").Pool | null = null;

export function setPgPool(pool: import("pg").Pool): void {
  pgPool = pool;
}

function getPool(): import("pg").Pool {
  if (!pgPool) throw new Error("pg Pool not set — call setPgPool() first");
  return pgPool;
}

/**
 * Create sync_identity_map table if it doesn't exist.
 */
async function initSchema(): Promise<void> {
  const pool = getPool();
  log("INFO", "Initializing sync_identity_map schema");
  await pool.query(CREATE_TABLE_SQL);
  log("INFO", "sync_identity_map schema ready");
}

/**
 * Bulk-load all identity mappings from Postgres into memory.
 */
async function loadAll(): Promise<Map<string, SyncIdentityRow>> {
  const pool = getPool();
  const result = await pool.query<SyncIdentityRow>(
    `SELECT supplier_id, supplier_identity, medusa_entity_type, medusa_entity_id, last_seen_at, created_at
     FROM sync_identity_map`,
  );

  identityMap = new Map();
  for (const row of result.rows) {
    identityMap.set(row.supplier_identity, row);
  }
  log("INFO", `Loaded ${identityMap.size} identity mappings`);
  return identityMap;
}

function findBySupplierIdentity(
  supplierIdentity: string,
): SyncIdentityRow | undefined {
  return identityMap.get(supplierIdentity);
}

function findBySupplierId(supplierId: string): SyncIdentityRow | undefined {
  // Product-level identity: supplier_id maps to product (entity_type='product')
  for (const row of identityMap.values()) {
    if (
      row.supplier_id === supplierId &&
      row.medusa_entity_type === "product"
    ) {
      return row;
    }
  }
  return undefined;
}

interface UpsertInput {
  supplier_id: string;
  supplier_identity: string;
  medusa_entity_type: "product" | "variant";
  medusa_entity_id: string;
}

function upsert(row: UpsertInput): void {
  const existing = identityMap.get(row.supplier_identity);
  identityMap.set(row.supplier_identity, {
    supplier_id: row.supplier_id,
    supplier_identity: row.supplier_identity,
    medusa_entity_type: row.medusa_entity_type,
    medusa_entity_id: row.medusa_entity_id,
    last_seen_at: new Date(),
    created_at: existing?.created_at ?? new Date(),
  });
}

async function flush(): Promise<void> {
  const pool = getPool();
  if (identityMap.size === 0) {
    log("INFO", "No identity mappings to flush");
    return;
  }

  const rows = [...identityMap.values()];

  // Batch upsert using INSERT ... ON CONFLICT
  for (const row of rows) {
    await pool.query(
      `INSERT INTO sync_identity_map (supplier_id, supplier_identity, medusa_entity_type, medusa_entity_id, last_seen_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (supplier_identity)
       DO UPDATE SET
         supplier_id = EXCLUDED.supplier_id,
         medusa_entity_type = EXCLUDED.medusa_entity_type,
         medusa_entity_id = EXCLUDED.medusa_entity_id,
         last_seen_at = EXCLUDED.last_seen_at`,
      [
        row.supplier_id,
        row.supplier_identity,
        row.medusa_entity_type,
        row.medusa_entity_id,
        row.last_seen_at,
        row.created_at,
      ],
    );
    // We can't easily distinguish insert vs update with simple queries,
    // but the runtime behavior is correct
  }

  log("INFO", `Flushed ${rows.length} identity mappings`);
}

function all(): Map<string, SyncIdentityRow> {
  return identityMap;
}

export const identity: IdentityStore = {
  initSchema,
  loadAll,
  findBySupplierIdentity,
  findBySupplierId,
  upsert,
  flush,
  all,
};
