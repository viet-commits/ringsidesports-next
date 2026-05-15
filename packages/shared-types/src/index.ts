/**
 * @ringsidesports/shared-types
 *
 * Canonical Zod schemas shared across apps/backend, apps/storefront, and apps/sync.
 * §7 data model invariants live here.
 */
export {
  CanonicalProductSchema,
  CanonicalVariantSchema,
  CatalogExportSchema,
} from "./catalog.js";
export type { CanonicalProduct, CanonicalVariant, CatalogExport } from "./catalog.js";
