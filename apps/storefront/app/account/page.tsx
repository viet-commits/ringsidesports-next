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

export default function AccountDashboard() {
  const { customer, fetchOrders } = useAuth();
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders(5, 0).then(({ orders }) => {
      setRecentOrders(orders);
      setLoading(false);
    });
  }, [fetchOrders]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">My Account</h1>
      <p className="text-gray-400 mb-8">
        Welcome back, {customer?.first_name}
      </p>

      {/* Recent Orders */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
          <Link
            href="/account/orders"
            className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
          >
            View All <ChevronRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <Package size={32} className="text-gray-600 mx-auto mb-3 animate-pulse" />
            <p className="text-gray-500 text-sm">Loading orders...</p>
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <Package size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-1">No orders yet</p>
            <Link href="/products" className="text-sm text-red-400 hover:text-red-300 transition-colors">
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Order</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">
                      #{order.order_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(order.created_at).toLocaleDateString("en-AU")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || "bg-gray-700 text-gray-300 border-gray-600"}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white text-right font-medium">
                      {formatPrice(order.total_cents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/account/orders/detail?id=${order.id}`}
                        className="text-red-400 hover:text-red-300 text-sm transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quick links */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/account/orders"
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-red-600 transition-colors group"
          >
            <Package size={20} className="text-gray-400 group-hover:text-red-400 mb-2 transition-colors" />
            <p className="text-white font-medium">Order History</p>
            <p className="text-gray-400 text-sm">View all your orders</p>
          </Link>
          <Link
            href="/orders/lookup"
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-red-600 transition-colors group"
          >
            <Package size={20} className="text-gray-400 group-hover:text-red-400 mb-2 transition-colors" />
            <p className="text-white font-medium">Track an Order</p>
            <p className="text-gray-400 text-sm">Guest order lookup</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
