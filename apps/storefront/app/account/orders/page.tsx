"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth, OrderSummary } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { Package, ChevronRight } from "lucide-react";

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

export default function OrderHistoryPage() {
  const { fetchOrders } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    setLoading(true);
    fetchOrders(LIMIT, offset).then((data) => {
      setOrders(data.orders);
      setTotal(data.total);
      setLoading(false);
    });
  }, [fetchOrders, offset]);

  const hasMore = offset + LIMIT < total;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Order History</h1>
      <p className="text-gray-400 mb-8">
        {total} {total === 1 ? "order" : "orders"} total
      </p>

      {loading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Package size={32} className="text-gray-600 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-500 text-sm">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Package size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-1">No orders yet</p>
          <Link href="/products" className="text-sm text-red-400 hover:text-red-300 transition-colors">
            Start shopping
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Order</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase hidden sm:table-cell">Items</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">
                      #{order.order_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden sm:table-cell">
                      {new Date(order.created_at).toLocaleDateString("en-AU")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || "bg-gray-700 text-gray-300 border-gray-600"}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden sm:table-cell">
                      {order.item_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-white text-right font-medium">
                      {formatPrice(order.total_cents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/account/orders/${order.id}`}
                        className="text-red-400 hover:text-red-300 text-sm flex items-center justify-end gap-1 transition-colors"
                      >
                        View <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors px-3 py-1.5"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={!hasMore}
                className="text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors px-3 py-1.5"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
