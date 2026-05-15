"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, OrderDetail } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { ArrowLeft, Package, Truck, Loader2 } from "lucide-react";

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

function OrderDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();
  const { fetchOrder } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("No order specified.");
      setLoading(false);
      return;
    }
    fetchOrder(Number(id)).then((data) => {
      if (data) {
        setOrder(data);
      } else {
        setError("Order not found.");
      }
      setLoading(false);
    });
  }, [id, fetchOrder]);

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <Loader2 size={32} className="text-gray-400 mx-auto mb-3 animate-spin" />
        <p className="text-gray-400 text-sm">Loading order...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <Package size={32} className="text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 mb-4">{error || "Order not found."}</p>
        <button
          onClick={() => router.push("/account/orders")}
          className="text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          Back to orders
        </button>
      </div>
    );
  }

  const shippingAddr = order.addresses?.find((a) => a.type === "shipping");

  return (
    <div>
      <button
        onClick={() => router.push("/account/orders")}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to orders
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">Order #{order.order_number}</h1>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || "bg-gray-700 text-gray-300 border-gray-600"}`}>
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      <p className="text-gray-400 text-sm mb-8">
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
            <p className="text-blue-300 text-sm font-medium">Tracking</p>
            <p className="text-blue-400 text-sm font-mono">{order.tracking_number}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">Items ({order.items.length})</h2>
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
        </div>

        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold text-white mb-3">Order Summary</h2>
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
            <div className="pt-2">
              <p className="text-xs text-gray-500">Payment: {order.payment_method}</p>
              <p className="text-xs text-gray-500">Shipping: {order.shipping_method}</p>
            </div>
          </div>
        </div>
      </div>

      {shippingAddr && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 max-w-sm">
          <h3 className="text-sm font-semibold text-white mb-2">Shipping Address</h3>
          <div className="text-sm text-gray-400 space-y-0.5">
            <p>{shippingAddr.line1}</p>
            {shippingAddr.line2 && <p>{shippingAddr.line2}</p>}
            <p>{shippingAddr.city} {shippingAddr.state} {shippingAddr.postcode}</p>
            <p>{shippingAddr.country}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Loader2 size={32} className="text-gray-400 mx-auto mb-3 animate-spin" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      }
    >
      <OrderDetailContent />
    </Suspense>
  );
}
