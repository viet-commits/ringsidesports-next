import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Order History",
  description: "Track your Ringside Sports orders.",
};

export default function OrdersPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
      <FileText size={56} className="text-gray-300 mx-auto mb-6" />
      <h1 className="text-3xl font-bold text-primary mb-4">Order History</h1>
      <p className="text-secondary text-lg mb-2">
        Order history coming soon — check your email for order confirmations.
      </p>
      <p className="text-secondary mb-8">
        We&apos;ll email you tracking details and order updates once your order ships.
      </p>
      <Link
        href="/contact"
        className="inline-flex items-center text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg px-5 py-2.5 transition-colors"
      >
        Need help? Contact Us
      </Link>
    </div>
  );
}
