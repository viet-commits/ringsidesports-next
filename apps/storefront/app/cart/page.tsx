"use client";

import * as React from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Minus, Plus, X, ArrowLeft } from "lucide-react";

export default function CartPage() {
  const { items, itemCount, subtotal, gst, total, removeItem, updateQuantity, clearCart } = useCart();

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
                <div className="flex justify-between">
                  <span className="text-secondary">Shipping</span>
                  <span className="text-primary">Calculated at checkout</span>
                </div>
              </div>

              <div className="border-t border-gray-200 mt-4 pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-primary">Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
                <p className="text-xs text-secondary mt-1">All prices include GST</p>
              </div>

              <Button variant="accent" size="lg" className="w-full mt-6">
                Proceed to Checkout
              </Button>

              <div className="mt-4 text-xs text-secondary space-y-1">
                <p>✓ Secure checkout with Stripe</p>
                <p>✓ 30-day returns</p>
                <p>✓ Australian owned & operated</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
