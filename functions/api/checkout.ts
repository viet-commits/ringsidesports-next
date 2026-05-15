/**
 * Cloudflare Pages Function — Stripe Checkout
 *
 * POST /api/checkout
 * Body: { items: [{ name: string, price: number, quantity: number }] }
 * Returns: { url: string } — Stripe Checkout URL
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
  const stripe = new Stripe(env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-04-30.basil",
  });

  const body = (await request.json()) as { items: CheckoutItem[] };
  const { items } = body;

  if (!items || items.length === 0) {
    return Response.json({ error: "No items provided" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    shipping_address_collection: { allowed_countries: ["AU"] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: 0, currency: "aud" },
          display_name: "Free Shipping",
          delivery_estimate: { minimum: { unit: "business_day", value: 2 }, maximum: { unit: "business_day", value: 7 } },
        },
      },
    ],
    line_items: items.map((item) => ({
      price_data: {
        currency: "aud",
        product_data: { name: item.name },
        unit_amount: item.price,
      },
      quantity: item.quantity,
      tax_rates: ["txr_placeholder"], // GST 10% — create this in Stripe dashboard
    })),
    success_url: `${origin}/cart?success=true`,
    cancel_url: `${origin}/cart?canceled=true`,
    automatic_tax: { enabled: true },
  });

  return Response.json({ url: session.url });
};
