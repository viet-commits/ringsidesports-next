# Ringside Sports — Headless Rebuild

Monorepo for the Ringside Sports headless commerce stack, replacing
WordPress/WooCommerce with Medusa v2 + Next.js 15.

## Architecture

```
apps/backend      — Medusa v2 admin & store API
apps/storefront   — Next.js 15 App Router (Cloudflare Pages)
apps/sync         — Supplier XML → Medusa sync worker (BullMQ)
packages/         — Shared types, ESLint config, TypeScript config
infra/            — Terraform, Ansible, Docker Compose, Caddy
docs/             — ADRs, runbooks, journal
scripts/          — One-shot migration scripts (WC → Medusa)
```

## Quick Start (Bootstrap)

**Prerequisites:** Node 22 LTS, pnpm 9.x, Docker 27+

```bash
# 1. Clone
git clone https://github.com/viet-commits/ringsidesports-next
cd ringsidesports-next

# 2. Install
pnpm install

# 3. Verify
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

All four checks should exit 0 on a clean clone.

## Development

```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all apps
pnpm test         # Run all tests
pnpm lint         # Lint all workspaces
pnpm typecheck    # Type-check all workspaces
```

## Environment Variables

See `.env.example` in each app directory. Secrets are stored in 1Password vault
`ringsidesports-next`. Never commit `.env` files.

## Deployment

- **Backend** → Metalduet VPS (45.124.55.87) via Docker Compose + Caddy
- **Storefront** → Cloudflare Pages
- **Sync Worker** → Metalduet VPS via systemd timer

## Phase Plan

| Phase | Name | Status |
|-------|------|--------|
| 0 | Bootstrap | 🔄 In progress |
| 1 | Backend foundation | ⏳ |
| 2 | Catalog data model + WC import | ⏳ |
| 3 | Supplier sync rewrite | ⏳ |
| 4 | Search (MeiliSearch) | ⏳ |
| 5 | Storefront build | ⏳ |
| 6 | Redirect map + SEO | ⏳ |
| 7 | Customer & order migration | ⏳ |
| 8 | Go-live preparation | ⏳ |
| 9 | Cutover | ⏳ |
| 10 | Archive legacy | ⏳ |

## License

Proprietary — all rights reserved.
