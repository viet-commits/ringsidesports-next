# ADR-0001: Stack Decisions

Date: 2026-05-15
Status: Accepted

## Context

Ringside Sports is replacing its WordPress/WooCommerce stack with a headless commerce
system. The legacy stack (§2 of rebuild-handover.md) suffers from identity model bugs,
plugin maintenance overhead, and a nightly batch pipeline that delays stock visibility.

## Decisions

The following choices are locked per §3 of the rebuild brief.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Medusa.js v2.x | Open-source headless commerce with native multi-currency, event system, and workflow engine. Avoids vendor lock-in. Backed by active community. |
| 2 | Next.js 15 App Router | React Server Components, streaming, ISR for PLPs. The storefront framework with the strongest Cloudflare Pages support. |
| 3 | Cloudflare Pages | Global edge delivery, native Next.js support via `@cloudflare/next-on-pages`, free tier generous enough for MVP. |
| 4 | Metalduet VPS (self-managed) | Existing infrastructure at 45.124.55.87. Avoids Hetzner provisioning complexity. Single VPS for Postgres, Redis, MeiliSearch, Caddy. |
| 5 | Stripe + Afterpay | Preserve all currently-active payment gateways from the WC store. Stripe handles cards + wallets natively. |
| 6 | MeiliSearch self-hosted | Typo-tolerant search, instant indexing, Rust-native performance. Avoids Algolia cost at scale. |
| 7 | Tailwind UI + shadcn/ui | Rebuild UI from modern primitives rather than pixel-matching legacy Flatsome theme. Faster to build, easier to maintain. |
| 8 | AUD / en-AU / GST 10% | Australian store. Prices include GST. |
| 9 | Monorepo with pnpm + Turborepo | Shared types, single CI, consistent tooling. |
| 10 | Caddy + Let's Encrypt | Zero-config TLS. Replaces the cPanel/nginx proxy stack for the headless backend. |
| 11 | Resend + Postmark | Transactional email (order confirmations, password resets) via Resend. Supplier alerts via Postmark fallback. |

## Consequences

- The team must learn Medusa v2 concepts (modules, workflows, subscribers).
- Self-hosting MeiliSearch adds an operational responsibility.
- Cloudflare Pages build limits (500 builds/month on free tier) may require Pro upgrade at scale.
