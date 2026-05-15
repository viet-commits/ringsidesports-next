/**
 * Cloudflare Pages Function — Stripe Checkout
 *
 * POST /api/checkout
 * Body: { items: [{ name: string, price: number, quantity: number }], discountCode?: string, discountAmount?: number }
 * Returns: { url: string } — Stripe Checkout URL
 *
 * REQUIRED env vars (set in Cloudflare Dashboard or .cloudflare/pages.json):
 *   STRIPE_SECRET_KEY — sk_live_... or sk_test_...
 *   STRIPE_CHECKOUT_DOMAIN — e.g. ringsidesports.com.au
 *
 * If keys are missing, returns 503 with a clear message.
 */
import Stripe from "stripe";

interface CheckoutItem {
  name: string;
  price: number; // AUD cents
  quantity: number;
}

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_CHECKOUT_DOMAIN: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const secretKey = env.STRIPE_SECRET_KEY || "";

  if (!secretKey) {
    return Response.json(
      {
        error: "Stripe is not configured",
        message:
          "STRIPE_SECRET_KEY environment variable is not set. " +
          "Add it in the Cloudflare Dashboard → Workers & Pages → ringsidesports → Settings → Variables. " +
          "Use sk_test_... for testing or sk_live_... for production.",
        docs: "https://docs.stripe.com/keys",
      },
      { status: 503 }
    );
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2025-04-30.basil",
  });

  let body: { items: CheckoutItem[]; discountCode?: string; discountAmount?: number };
  try {
    body = (await request.json()) as { items: CheckoutItem[]; discountCode?: string; discountAmount?: number };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { items, discountCode, discountAmount } = body;

  if (!items || items.length === 0) {
    return Response.json({ error: "No items provided" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const checkoutDomain = env.STRIPE_CHECKOUT_DOMAIN || new URL(request.url).hostname;

  // Build Stripe line items with optional discount coupon
  const lineItems = items.map((item) => ({
    price_data: {
      currency: "aud",
      product_data: { name: item.name },
      unit_amount: item.price,
    },
    quantity: item.quantity,
  }));

  // Build session metadata for order confirmation
  const metadata: Record<string, string> = {};
  if (discountCode) {
    metadata.discountCode = discountCode;
    metadata.discountAmount = String(discountAmount || 0);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    shipping_address_collection: { allowed_countries: ["AU"] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: 0, currency: "aud" },
          display_name: "Free Shipping",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 2 },
            maximum: { unit: "business_day", value: 7 },
          },
        },
      },
    ],
    line_items: lineItems,
    ...(discountCode && discountAmount && discountAmount > 0
      ? {
          discounts: [
            {
              coupon: await createOrGetCoupon(stripe, discountCode, discountAmount),
            },
          ],
        }
      : {}),
    success_url: `https://${checkoutDomain}/cart?success=true`,
    cancel_url: `https://${checkoutDomain}/cart?canceled=true`,
    automatic_tax: { enabled: true },
    metadata,
  });

  return Response.json({ url: session.url });
};

/**
 * Create or retrieve a one-time coupon in Stripe for the given discount.
 * Coupons are idempotent by name — reuse if already exists.
 */
async function createOrGetCoupon(
  stripe: Stripe,
  code: string,
  amount: number
): Promise<string> {
  const couponId = `discount_${code.toLowerCase()}`;

  try {
    // Try to retrieve existing
    await stripe.coupons.retrieve(couponId);
    return couponId;
  } catch {
    // Create new: Stripe coupons use same currency as checkout (AUD cents)
    await stripe.coupons.create({
      id: couponId,
      amount_off: amount,
      currency: "aud",
      duration: "once",
      name: code,
    });
    return couponId;
  }
}
