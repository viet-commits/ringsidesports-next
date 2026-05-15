"use client";

import * as React from "react";
import Link from "next/link";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function CartDrawer() {
  const {
    items,
    isOpen,
    itemCount,
    subtotal,
    gst,
    total,
    removeItem,
    updateQuantity,
    closeCart,
  } = useCart();

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <ShoppingBag size={20} />
            Cart ({itemCount})
          </h2>
          <button
            onClick={closeCart}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close cart"
          >
            <X size={20} className="text-secondary" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag size={48} className="text-gray-300 mb-4" />
              <p className="text-secondary mb-2">Your cart is empty</p>
              <Link
                href="/products"
                className="text-primary font-semibold hover:underline"
                onClick={closeCart}
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.variant.sku} className="flex gap-4 py-4 border-b border-gray-100 last:border-0">
                  {/* Image */}
                  <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                    <img
                      src={item.variant.images[0] || item.product.images[0]}
                      alt={item.variant.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-primary truncate">
                      {item.product.title}
                    </h4>
                    {Object.entries(item.variant.options).map(([key, value]) => (
                      <span key={key} className="text-xs text-secondary">
                        {value}{" "}
                      </span>
                    ))}
                    <p className="text-sm font-bold text-primary mt-1">
                      {formatPrice(item.variant.price)}
                    </p>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.variant.sku, item.quantity - 1)
                        }
                        className="p-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.variant.sku, item.quantity + 1)
                        }
                        className="p-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>

                      <button
                        onClick={() => removeItem(item.variant.sku)}
                        className="ml-auto p-1 text-secondary hover:text-accent transition-colors"
                        aria-label="Remove item"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Subtotal</span>
              <span className="font-medium text-primary">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-secondary">GST (10%)</span>
              <span className="font-medium text-primary">{formatPrice(gst)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-3">
              <span className="text-primary">Total (AUD)</span>
              <span className="text-primary">{formatPrice(total)}</span>
            </div>

            <Button variant="accent" size="lg" className="w-full">
              Checkout
            </Button>
            <p className="text-xs text-secondary text-center">
              Shipping calculated at checkout
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
