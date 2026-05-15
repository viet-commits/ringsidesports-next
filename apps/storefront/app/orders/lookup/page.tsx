"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, OrderDetail } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { Search, Package, Truck, ArrowLeft } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  completed: "Delivered",
  processing: "Processing",
  pending: "Pending",
  "on-hold": "On Hold",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-900/30 text-green-400 border-green-700",
  processing: "bg-blue-900/30 text-blue-400 border-blue-700",
  pending: "bg-yellow-900/30 text-yellow-400 border-yellow-700",
  "on-hold": "bg-orange-900/30 text-orange-400 border-orange-700",
  cancelled: "bg-red-900/30 text-red-400 border-red-700",
  refunded: "bg-gray-700 text-gray-300 border-gray-600",
  failed: "bg-red-900/30 text-red-400 border-red-700",
};

export default function OrderLookupPage() {
  const { lookupOrder } = useAuth();
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOrder(null);
    setLoading(true);
    setSearched(false);

    const result = await lookupOrder(email.trim(), orderNumber.trim());
    setLoading(false);
    setSearched(true);

    if (result) {
      setOrder(result);
    } else {
      setError("No order found with that email and order number. Please check and try again.");
    }
  }

  const shippingAddr = order?.addresses?.find((a) => a.type === "shipping");

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-white text-center mb-2">Track Your Order</h1>
      <p className="text-gray-400 text-center mb-8">
        Enter your order details to check the status
      </p>

      {!order && (
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <label htmlFor="lookup-email" className="block text-sm font-medium text-gray-300 mb-1">
              Email used at checkout
            </label>
            <input
              id="lookup-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="you@email.com"
            />
          </div>

          <div>
            <label htmlFor="lookup-order" className="block text-sm font-medium text-gray-300 mb-1">
              Order Number
            </label>
            <input
              id="lookup-order"
              type="text"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="e.g. 1234"
            />
          </div>

          {searched && error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-colors"
          >
            <Search size={18} />
            {loading ? "Searching..." : "Track Order"}
          </button>

          <p className="text-center text-sm text-gray-500 pt-2">
            Already have an account?{" "}
            <Link href="/account/login" className="text-red-400 hover:text-red-300 transition-colors">
              Sign in
            </Link>{" "}
            to view all your orders.
          </p>
        </form>
      )}

      {/* Loading state */}
      {loading && !order && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center mt-4">
          <Package size={32} className="text-gray-600 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-500 text-sm">Looking up your order...</p>
        </div>
      )}

      {/* Order detail after lookup */}
      {order && (
        <div>
          <button
            onClick={() => { setOrder(null); setSearched(false); setError(""); }}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> New search
          </button>

          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-bold text-white">Order #{order.order_number}</h2>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || "bg-gray-700 text-gray-300 border-gray-600"}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>

          <p className="text-gray-400 text-sm mb-6">
            Placed on {new Date(order.created_at).toLocaleDateString("en-AU", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>

          {order.tracking_number && (
            <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4 mb-6 flex items-center gap-3">
              <Truck size={20} className="text-blue-400 shrink-0" />
              <div>
                <p className="text-blue-300 text-sm font-medium">Tracking Number</p>
                <p className="text-blue-400 text-sm font-mono">{order.tracking_number}</p>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Items ({order.items.length})</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Product</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase text-center">Qty</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-sm text-white">{item.product_name}</p>
                      <p className="text-xs text-gray-500">{item.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-white text-right font-medium">
                      {formatPrice(item.total_price_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary + Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-white mb-2">Order Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white">{formatPrice(order.subtotal_cents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Shipping</span>
                <span className="text-white">{formatPrice(order.shipping_cents)}</span>
              </div>
              {order.tax_cents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">GST</span>
                  <span className="text-white">{formatPrice(order.tax_cents)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-800">
                <span className="text-white">Total</span>
                <span className="text-red-400">{formatPrice(order.total_cents)}</span>
              </div>
              <p className="text-xs text-gray-500 pt-2">
                {order.payment_method} • {order.shipping_method}
              </p>
            </div>
            {shippingAddr && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-2">Shipping To</h3>
                <div className="text-sm text-gray-400 space-y-0.5">
                  <p>{shippingAddr.line1}</p>
                  {shippingAddr.line2 && <p>{shippingAddr.line2}</p>}
                  <p>{shippingAddr.city} {shippingAddr.state} {shippingAddr.postcode}</p>
                  <p>{shippingAddr.country}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
