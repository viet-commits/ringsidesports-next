"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, Package } from "lucide-react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order");
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        <CheckCircle size={64} className="text-green-500 mx-auto mb-6" />
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-4">Order Confirmed!</h1>
        <p className="text-gray-600 mb-2">
          Thank you for your order. You&apos;ll receive a confirmation email shortly.
        </p>
        {orderNumber && (
          <p className="text-lg font-semibold text-primary mb-8">
            Order #{orderNumber}
          </p>
        )}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => router.push("/account/orders")}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
          >
            <Package size={18} /> View Orders
          </button>
          <button
            onClick={() => router.push("/products")}
            className="inline-flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg px-5 py-2.5 transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 size={32} className="text-gray-400 animate-spin" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
