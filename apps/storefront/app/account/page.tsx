import type { Metadata } from "next";
import Link from "next/link";
import { User } from "lucide-react";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your Ringside Sports account.",
};

export default function AccountPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
      <User size={56} className="text-gray-300 mx-auto mb-6" />
      <h1 className="text-3xl font-bold text-primary mb-4">Customer Accounts</h1>
      <p className="text-secondary text-lg mb-2">
        Customer accounts coming soon.
      </p>
      <p className="text-secondary mb-8">
        Password reset will be emailed to existing customers at launch.
        In the meantime, all order updates are sent directly to your email.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link
          href="/orders"
          className="inline-flex items-center text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg px-5 py-2.5 transition-colors"
        >
          Check Order Status
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center text-sm font-medium text-primary border border-gray-300 hover:bg-gray-50 rounded-lg px-5 py-2.5 transition-colors"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}
