"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { CreditCard, Truck, MapPin, Loader2, ChevronLeft, Shield } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.ringsidesports.com.au:8443";

// ── Types ──

interface Address {
  first_name: string;
  last_name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
}

type Step = "shipping" | "payment" | "review";

// ── Shipping rates ──

const FREE_SHIPPING_THRESHOLD = 15000; // $150 AUD
const FLAT_RATE = 1295; // $12.95 AUD

function calcShipping(subtotal: number) {
  if (subtotal >= FREE_SHIPPING_THRESHOLD) return { cents: 0, label: "Free Shipping" };
  return { cents: FLAT_RATE, label: "Standard Shipping ($12.95)" };
}

// ── Component ──

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const { customer, token } = useAuth();

  const [step, setStep] = useState<Step>("shipping");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Shipping form
  const [shipping, setShipping] = useState<Address>({
    first_name: customer?.first_name || "",
    last_name: customer?.last_name || "",
    line1: "",
    line2: "",
    city: "",
    state: "VIC",
    postcode: "",
    country: "AU",
    phone: customer?.phone || "",
  });
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [billing, setBilling] = useState<Address>({ ...shipping });

  // Payment
  const [cardComplete, setCardComplete] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);

  // Init Stripe on payment step
  const initStripe = async () => {
    if (stripe) return;
    const { loadStripe } = await import("@stripe/stripe-js");
    const s = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || "pk_live_L9DYFTLlmEnnrIaULa8U9N9R");
    if (!s) { setError("Failed to load payment processor."); return; }
    const els = s.elements();
    const card = els.create("card", {
      style: {
        base: {
          color: "#ffffff",
          fontFamily: '"Inter", sans-serif',
          fontSize: "16px",
          "::placeholder": { color: "#6b7280" },
        },
        invalid: { color: "#ef4444" },
      },
    });
    card.mount("#card-element");
    card.on("change", (e: any) => setCardComplete(e.complete));
    setStripe(s);
    setCardElement(card);
  };

  // Update shipping field
  const updateShipping = (field: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setShipping((prev) => {
      const next = { ...prev, [field]: val };
      if (sameAsShipping) setBilling(next);
      return next;
    });
  };

  const updateBilling = (field: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setBilling((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const shippingCost = calcShipping(subtotal);
  const total = subtotal + shippingCost.cents;

  // Submit order
  const handlePlaceOrder = async () => {
    if (!stripe || !cardElement) return;
    setLoading(true);
    setError("");

    try {
      // 1. Create PaymentIntent
      const piRes = await fetch(`${API_BASE}/store/payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: total,
          currency: "aud",
          customer_email: customer?.email || shipping.first_name + "@guest.order",
          metadata: { source: "ringsidesports-storefront" },
        }),
      });
      const piData = await piRes.json();
      if (piData.error) throw new Error(piData.error);
      if (!piData.client_secret) throw new Error("Payment initialization failed");

      // 2. Confirm card payment
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        piData.client_secret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: `${billing.first_name} ${billing.last_name}`,
              email: customer?.email || "",
              address: {
                line1: billing.line1,
                line2: billing.line2,
                city: billing.city,
                state: billing.state,
                postal_code: billing.postcode,
                country: billing.country,
              },
            },
          },
        }
      );

      if (confirmError) throw new Error(confirmError.message || "Payment failed");

      // 3. Create order in backend
      const orderRes = await fetch(`${API_BASE}/store/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          customer_email: customer?.email || "",
          customer_id: customer?.id || null,
          shipping_address: {
            line1: shipping.line1,
            line2: shipping.line2,
            city: shipping.city,
            state: shipping.state,
            postcode: shipping.postcode,
            country: shipping.country,
            phone: shipping.phone,
          },
          billing_address: sameAsShipping ? undefined : {
            line1: billing.line1,
            line2: billing.line2,
            city: billing.city,
            state: billing.state,
            postcode: billing.postcode,
            country: billing.country,
            phone: billing.phone,
          },
          shipping_method: shippingCost.label,
          items: items.map((item) => ({
            product_name: item.product.title,
            sku: item.variant.sku || "",
            quantity: item.quantity,
            unit_price_cents: item.variant.price,
            total_price_cents: item.variant.price * item.quantity,
          })),
          subtotal_cents: subtotal,
          shipping_cents: shippingCost.cents,
          total_cents: total,
        }),
      });
      const orderData = await orderRes.json();
      if (orderData.error) throw new Error(orderData.error);

      // 4. Success!
      clearCart();
      router.push(`/checkout/success?order=${orderData.order.order_number}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Redirect if cart empty
  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-primary mb-4">Your cart is empty</h1>
        <button onClick={() => router.push("/products")} className="text-red-600 hover:text-red-700 font-medium">
          Continue Shopping
        </button>
      </div>
    );
  }

  const addressFields = (addr: Address, onChange: (f: keyof Address) => any) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
        <input required value={addr.first_name} onChange={onChange("first_name")} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
        <input required value={addr.last_name} onChange={onChange("last_name")} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
        <input required value={addr.line1} onChange={onChange("line1")} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Apartment / Unit (optional)</label>
        <input value={addr.line2} onChange={onChange("line2")} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
        <input required value={addr.city} onChange={onChange("city")} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
        <select value={addr.state} onChange={onChange("state")} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white">
          {["VIC","NSW","QLD","WA","SA","TAS","ACT","NT"].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
        <input required value={addr.postcode} onChange={onChange("postcode")} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" maxLength={4} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
        <input required value={addr.phone} onChange={onChange("phone")} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" type="tel" />
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">Checkout</h1>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        {(["shipping", "payment", "review"] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? "bg-red-600 text-white" : i < ["shipping","payment","review"].indexOf(step) ? "bg-green-600 text-white" : "bg-gray-200 text-gray-500"
            }`}>{i + 1}</span>
            <span className={step === s ? "text-primary font-medium" : "text-gray-400 capitalize"}>{s}</span>
            {i < 2 && <span className="text-gray-300 mx-1">→</span>}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Main form */}
        <div className="lg:col-span-3 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {/* Step 1: Shipping */}
          {step === "shipping" && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6"><MapPin size={20} className="text-red-600" /><h2 className="text-lg font-semibold text-primary">Shipping Address</h2></div>
              {addressFields(shipping, updateShipping)}
              <div className="mt-6">
                <button onClick={() => setStep("payment")} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-6 py-3 transition-colors">
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Payment */}
          {step === "payment" && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4"><CreditCard size={20} className="text-red-600" /><h2 className="text-lg font-semibold text-primary">Payment</h2></div>
                <div ref={(el) => { if (el) initStripe(); }}>
                  <div id="card-element" className="border border-gray-300 rounded-lg px-4 py-3 min-h-[42px]" />
                </div>
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><Shield size={12} /> Secured by Stripe. We never store your card details.</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={sameAsShipping} onChange={(e) => { setSameAsShipping(e.target.checked); if (e.target.checked) setBilling(shipping); }} className="rounded" />
                  Billing address same as shipping
                </label>
                {!sameAsShipping && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Billing Address</h3>
                    {addressFields(billing, updateBilling)}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("shipping")} className="flex items-center gap-1 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"><ChevronLeft size={16} /> Back</button>
                <button onClick={() => setStep("review")} disabled={!cardComplete} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-3 transition-colors">
                  Review Order
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === "review" && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-primary mb-4">Review Your Order</h2>
                <div className="space-y-3">
                  {items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.product.title} × {item.quantity}</span>
                      <span className="font-medium">{formatPrice(item.variant.price * item.quantity)}</span>
                    </div>
                  ))}
                  <hr />
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Shipping</span><span>{shippingCost.cents === 0 ? "FREE" : formatPrice(shippingCost.cents)}</span></div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span className="text-red-600">{formatPrice(total)}</span></div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-2"><Truck size={16} className="text-gray-400" /><span className="text-sm text-gray-600">Shipping to: {shipping.line1}, {shipping.city} {shipping.state} {shipping.postcode}</span></div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep("payment")} className="flex items-center gap-1 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"><ChevronLeft size={16} /> Back</button>
                <button onClick={handlePlaceOrder} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg px-6 py-3 flex items-center justify-center gap-2 transition-colors">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : `Pay ${formatPrice(total)}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-2">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 sticky top-24">
            <h2 className="text-sm font-semibold text-gray-700 uppercase mb-4">Order Summary</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate pr-2">{item.product.title} × {item.quantity}</span>
                  <span className="font-medium shrink-0">{formatPrice(item.variant.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <hr className="my-3" />
            <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Shipping</span><span>{shippingCost.cents === 0 ? "FREE" : formatPrice(shippingCost.cents)}</span></div>
            <div className="flex justify-between font-bold text-lg pt-2 mt-2 border-t"><span>Total</span><span className="text-red-600">{formatPrice(total)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
