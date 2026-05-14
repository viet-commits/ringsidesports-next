# Data Model

Status: **Template — to be completed in phase 2.**

## Identity Model (§7)

- `Product.supplier_id` = supplier `<id>` from Extensionsell XML
- `ProductVariant.supplier_identity` = `${supplier_id}__${variant_sku}`
- NEVER use SKU alone as an identity key
- `supplier_identity` is the upsert key for all supplier sync writes

## Canonical Types

See `packages/shared-types/src/` for the authoritative Zod schemas.
