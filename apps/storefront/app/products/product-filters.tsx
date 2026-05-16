"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search/search-bar";
import { SlidersHorizontal } from "lucide-react";

export default function ProductFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSort = searchParams.get("sort") || "default";

  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="flex-1 max-w-md">
        <SearchBar placeholder="Search products..." />
      </div>
      <select
        value={activeSort}
        onChange={(e) => {
          const sp = new URLSearchParams(searchParams.toString());
          sp.set("sort", e.target.value);
          router.push(`/products?${sp.toString()}`);
        }}
        className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="default">Default</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="name">Name: A-Z</option>
      </select>
      <button
        className="lg:hidden p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        onClick={() => {
          const sidebar = document.getElementById("mobile-filters");
          if (sidebar) sidebar.classList.toggle("hidden");
        }}
        aria-label="Filters"
      >
        <SlidersHorizontal size={20} className="text-secondary" />
      </button>
    </div>
  );
}
