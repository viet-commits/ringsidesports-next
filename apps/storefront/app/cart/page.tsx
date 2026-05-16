"use client";

import * as React from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Minus, Plus, X, ArrowLeft, Tag, Ticket } from "lucide-react";

const AfterpayLogo = () => (
  <svg
    viewBox="0 0 120 28"
    fill="none"
    className="h-5 inline-block align-middle mx-1"
    aria-label="Afterpay"
  >
    <path
      d="M34.8 10.4c-2.1 0-3.5 1.2-3.5 3.6s1.4 3.6 3.5 3.6c2 0 3.4-1.2 3.5-3.6 0-2.4-1.4-3.6-3.5-3.6zm0 5.9c-1 0-1.7-.8-1.7-2.3s.7-2.3 1.7-2.3c1 0 1.7.8 1.7 2.3s-.7 2.3-1.7 2.3z"
      fill="#292929"
    />
    <path
      d="M47.4 10.7h-2.1l-1.9 4.1-1.9-4.1h-2.1v6.9h1.5v-5l1.7 3.7h1.5l1.7-3.7v5h1.5v-6.9zM53.8 10.7h-3.6v6.9h3.6v-1.3h-2.1v-1.6h2v-1.3h-2v-1.5h2.1v-1.2zM57.6 15.1L59.3 10.7h1.7l-2.5 6.9h-1.5L54.5 10.7h1.7l1.4 4.4zM63.2 10.7h-1.9v6.9h1.9c2.1 0 3.3-1.2 3.3-3.5s-1.2-3.4-3.3-3.4zm0 5.7h-.5v-4.4h.5c1.2 0 1.9.8 1.9 2.2s-.7 2.2-1.9 2.2zM73.1 10.7h-1.5l-2.3 6.9h1.6l.5-1.6h2.4l.5 1.6h1.6l-2.8-6.9zm-1.4 4.3l.9-2.8.9 2.8h-1.8zM76.2 10.7h1.5v6.9h-1.5zM82.4 10.7h-2.1l-1.9 4.1-1.9-4.1h-2.1v6.9h1.5v-5l1.7 3.7h1.5l1.7-3.7v5h1.5v-6.9zM88.8 10.7h-3.6v6.9h3.6v-1.3h-2.1v-1.6h2v-1.3h-2v-1.5h2.1v-1.2zM92.6 15.1L94.3 10.7h1.7l-2.5 6.9h-1.5L89.5 10.7h1.7l1.4 4.4zM98.2 10.7h-1.9v6.9h1.9c2.1 0 3.3-1.2 3.3-3.5s-1.2-3.4-3.3-3.4zm0 5.7h-.5v-4.4h.5c1.2 0 1.9.8 1.9 2.2s-.7 2.2-1.9 2.2zM104.7 10.7v6.9h1.5v-6.9zM110.6 14c-.3-.8-.9-1.3-1.8-1.3-1.2 0-1.9.8-1.9 2.3s.7 2.3 1.9 2.3c.9 0 1.5-.5 1.8-1.3h1.5c-.4 1.5-1.6 2.5-3.3 2.5-2.1 0-3.5-1.2-3.5-3.5s1.4-3.5 3.5-3.5c1.7 0 2.9 1 3.3 2.5h-1.5zM117.3 11.5c-.3-.5-.9-.8-1.7-.8-1.1 0-1.8.8-1.8 2.3s.7 2.3 1.8 2.3c.8 0 1.4-.3 1.7-.8v.7h1.5V6.7h-1.5v4.8zm0 1.9c0 1-.5 1.7-1.2 1.7s-1.2-.7-1.2-1.7.5-1.7 1.2-1.7 1.2.7 1.2 1.7z"
      fill="#292929"
    />
    <path
      d="M10.2 7.8L7.4 4.9c-.4-.4-1-.4-1.4 0L4.6 6.3l4.2 4.3L4.5 15l1.4 1.4c.2.2.4.3.7.3s.5-.1.7-.3l2.9-2.9-2.9-2.9 2.9-2.8zM16.2 10.6L13.4 7.8 10.5 10.6l2.9 2.9 2.8-2.9z"
      fill="#292929"
    />
  </svg>
);

export default function CartPage() {
  const {
    items,
    itemCount,
    subtotal,
    gst,
    shipping,
    discount,
    discountDescription,
    total,
    coupon,
    couponError,
    removeItem,
    updateQuantity,
    clearCart,
    applyCoupon,
    removeCoupon,
  } = useCart();
  const [promoInput, setPromoInput] = React.useState("");

  const afterpayAmount = total / 4;

  const handleApplyCoupon = () => {
    if (promoInput.trim()) {
      applyCoupon(promoInput.trim());
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-3xl font-bold text-primary mb-2">Shopping Cart</h1>
      <p className="text-secondary mb-8">
        {itemCount} item{itemCount !== 1 ? "s" : ""} in your cart
      </p>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag size={64} className="text-gray-300 mx-auto mb-6" />
          <p className="text-secondary text-lg mb-6">Your cart is empty</p>
          <Link href="/products">
            <Button variant="primary" size="lg">
              Continue Shopping
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.variant.sku}
                  className="flex gap-4 p-4 rounded-xl border border-gray-200 bg-white"
                >
                  {/* Image */}
                  <Link
                    href={`/products/${item.product.handle}`}
                    className="w-24 h-24 rounded-lg bg-gray-100 overflow-hidden shrink-0"
                  >
                    <img
                      src={item.variant.images[0] || item.product.images[0]}
                      alt={item.variant.title}
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <Link href={`/products/${item.product.handle}`}>
                      <h3 className="text-base font-bold text-primary hover:text-secondary transition-colors">
                        {item.product.title}
                      </h3>
                    </Link>
                    <div className="text-sm text-secondary mt-0.5">
                      {Object.entries(item.variant.options).map(([key, value]) => (
                        <span key={key}>
                          {value}{" "}
                        </span>
                      ))}
                      <span className="text-gray-400">· SKU: {item.variant.sku}</span>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      {/* Quantity */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.variant.sku, item.quantity - 1)}
                          className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-medium w-8 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.variant.sku, item.quantity + 1)}
                          className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Price & Remove */}
                      <div className="flex items-center gap-4">
                        <span className="text-base font-bold text-primary">
                          {formatPrice(item.variant.price * item.quantity)}
                        </span>
                        <button
                          onClick={() => removeItem(item.variant.sku)}
                          className="p-1.5 text-secondary hover:text-accent transition-colors"
                          aria-label="Remove item"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Link
                href="/products"
                className="inline-flex items-center text-sm text-secondary hover:text-primary transition-colors"
              >
                <ArrowLeft size={16} className="mr-1" />
                Continue Shopping
              </Link>
              <button
                onClick={clearCart}
                className="text-sm text-accent hover:underline"
              >
                Clear Cart
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-bold text-primary mb-4">Order Summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">Subtotal</span>
                  <span className="font-medium text-primary">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">GST (10% included)</span>
                  <span className="font-medium text-primary">{formatPrice(gst)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <Tag size={14} />
                      {discountDescription}
                    </span>
                    <span className="font-medium">−{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-secondary">Shipping</span>
                  <span className="text-primary">
                    {shipping.cost === -1
                      ? `Freight (POA)`
                      : shipping.cost > 0
                        ? `${shipping.label} (${formatPrice(shipping.cost)})`
                        : items.length > 0
                          ? shipping.label
                          : "—"}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200 mt-4 pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-primary">Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
                <p className="text-xs text-secondary mt-1">All prices include GST</p>
              </div>

              {/* Promo Code */}
              <div className="mt-4">
                {coupon ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center gap-1.5 text-sm text-green-700">
                      <Ticket size={14} />
                      <span className="font-medium">{coupon.code}</span>
                      <span>— {coupon.description}</span>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="p-0.5 text-green-600 hover:text-green-800"
                      aria-label="Remove coupon"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="Promo code"
                        className="flex-1 h-10 rounded-lg border border-gray-300 px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                      />
                      <Button
                        variant="outline"
                        size="md"
                        onClick={handleApplyCoupon}
                      >
                        Apply
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-xs text-red-500 mt-1">{couponError}</p>
                    )}
                  </div>
                )}
              </div>

              <a
                href="/checkout"
                className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-6 py-3 text-center block transition-colors"
              >
                Proceed to Checkout
              </a>

              {/* Afterpay */}
              <div className="mt-4 p-3 rounded-lg bg-[#FFF9EC] border border-[#FFE5B4]">
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-secondary">or 4 payments of</span>
                  <span className="font-bold text-primary">{formatPrice(afterpayAmount)}</span>
                  <span className="text-secondary">with</span>
                  <AfterpayLogo />
                </div>
                <a
                  href="https://www.afterpay.com/en-AU/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#292929] underline mt-1 inline-block"
                >
                  Learn more
                </a>
              </div>

              <div className="mt-4 text-xs text-secondary space-y-1">
                <p>✓ Secure checkout with Stripe</p>
                <p>✓ 30-day returns</p>
                <p>✓ Australian owned &amp; operated</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
