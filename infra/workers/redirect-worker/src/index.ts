/**
 * Cloudflare Worker — Bulk Redirect Handler
 *
 * Deployed to ringsidesports.com.au to handle legacy WordPress → Next.js redirects.
 *
 * Architecture:
 * - Redirect map stored in Cloudflare KV (namespace: REDIRECTS)
 * - On request, checks path against KV store
 * - Returns 301 for matched URLs with query string preserved
 * - Passes unmatched requests through to Cloudflare Pages origin
 *
 * Deploy:
 *   wrangler deploy
 */

interface Env {
  REDIRECTS: KVNamespace;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

interface RedirectEntry {
  source: string;
  destination: string;
  code: number;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Normalize: ensure trailing slash for lookup (matching source format)
    const lookupPath = path.endsWith("/") ? path : `${path}/`;

    // Check KV for exact match first
    let redirect = await env.REDIRECTS.get(lookupPath, { type: "json" }) as RedirectEntry | null;

    // If no exact match, try without trailing slash
    if (!redirect) {
      const altPath = path.endsWith("/") ? path.slice(0, -1) : `${path}/`;
      redirect = await env.REDIRECTS.get(altPath, { type: "json" }) as RedirectEntry | null;
    }

    if (redirect) {
      const statusCode = redirect.code || 301;

      // Preserve query string
      const destination = url.search
        ? `${redirect.destination}${url.search}`
        : redirect.destination;

      // Build the full redirect URL using the original host
      const redirectUrl = new URL(destination, url.origin);

      return Response.redirect(redirectUrl.toString(), statusCode);
    }

    // Pass through to origin (Cloudflare Pages)
    try {
      return await env.ASSETS.fetch(request);
    } catch {
      // Fallback: if no ASSETS binding, just pass through
      return fetch(request);
    }
  },
};

/**
 * Seed KV with redirect map (run once before deploy):
 *
 * ```bash
 * # From local redirect-map.json
 * wrangler kv:bulk put REDIRECTS --path=<(node -e "
 *   const data = require('./redirect-map.json');
 *   data.forEach(r => console.log(JSON.stringify({key: r.source, value: JSON.stringify(r)})));
 * ")
 * ```
 *
 * Or use wrangler.toml kv_namespaces binding for production.
 */
