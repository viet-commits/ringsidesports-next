"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { products, categories } from "@/lib/products";
import { ProductCard } from "@/components/product/product-card";
import { ProductGrid } from "@/components/product/product-grid";
import { SearchBar } from "@/components/search/search-bar";
import { SlidersHorizontal, X } from "lucide-react";

const ITEMS_PER_PAGE = 12;

function ProductListingContent() {
  const searchParams = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const activeCategory = searchParams.get("category") || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const stockFilter = searchParams.get("stock") || "";
  const activeSort = searchParams.get("sort") || "default";
  const page = parseInt(searchParams.get("page") || "1", 10);

  // Filter products
  let filtered = [...products];

  if (activeCategory) {
    filtered = filtered.filter((p) =>
      p.categories.some((c) => c.toLowerCase() === activeCategory.toLowerCase())
    );
  }

  if (minPrice) {
    filtered = filtered.filter((p) => p.price >= parseInt(minPrice, 10));
  }

  if (maxPrice) {
    filtered = filtered.filter((p) => p.price <= parseInt(maxPrice, 10));
  }

  if (stockFilter === "in_stock") {
    filtered = filtered.filter((p) => p.stockStatus === "in_stock");
  } else if (stockFilter === "out_of_stock") {
    filtered = filtered.filter((p) => p.stockStatus === "out_of_stock");
  }

  // Sort
  switch (activeSort) {
    case "price-asc":
      filtered.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      filtered.sort((a, b) => b.price - a.price);
      break;
    case "name":
      filtered.sort((a, b) => a.title.localeCompare(b.title));
      break;
    default:
      // Default: featured products first
      break;
  }

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedProducts = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const buildUrl = (params: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    return `/products?${sp.toString()}`;
  };

  const hasActiveFilters = activeCategory || minPrice || maxPrice || stockFilter;

  const clearFilters = () => {
    window.location.href = "/products";
  };

  const FilterSidebar = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="text-sm font-bold text-primary mb-3">Categories</h3>
        <ul className="space-y-2">
          <li>
            <a
              href="/products"
              className={`text-sm block py-1 transition-colors ${
                !activeCategory ? "font-semibold text-primary" : "text-secondary hover:text-primary"
              }`}
            >
              All Products
            </a>
          </li>
          {categories.map((cat) => (
            <li key={cat.slug}>
              <a
                href={`/products?category=${cat.slug}`}
                className={`text-sm block py-1 transition-colors ${
                  activeCategory === cat.slug
                    ? "font-semibold text-primary"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {cat.name}
                <span className="text-xs text-gray-400 ml-1">({cat.count})</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="text-sm font-bold text-primary mb-3">Price Range (AUD)</h3>
        <div className="space-y-2">
          {[
            { label: "Under $25", min: "0", max: "2500" },
            { label: "$25 — $50", min: "2500", max: "5000" },
            { label: "$50 — $100", min: "5000", max: "10000" },
            { label: "$100 — $150", min: "10000", max: "15000" },
            { label: "Over $150", min: "15000", max: "" },
          ].map((range) => {
            const isActive = minPrice === range.min && maxPrice === range.max;
            return (
              <a
                key={range.label}
                href={buildUrl({ minPrice: range.min, maxPrice: range.max, page: "" })}
                className={`text-sm block py-1 transition-colors ${
                  isActive ? "font-semibold text-primary" : "text-secondary hover:text-primary"
                }`}
              >
                {range.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* Stock Status */}
      <div>
        <h3 className="text-sm font-bold text-primary mb-3">Availability</h3>
        <ul className="space-y-2">
          <li>
            <a
              href={buildUrl({ stock: "in_stock", page: "" })}
              className={`text-sm block py-1 transition-colors ${
                stockFilter === "in_stock" ? "font-semibold text-primary" : "text-secondary hover:text-primary"
              }`}
            >
              In Stock
            </a>
          </li>
          <li>
            <a
              href={buildUrl({ stock: "out_of_stock", page: "" })}
              className={`text-sm block py-1 transition-colors ${
                stockFilter === "out_of_stock" ? "font-semibold text-primary" : "text-secondary hover:text-primary"
              }`}
            >
              Out of Stock
            </a>
          </li>
        </ul>
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="text-sm text-accent hover:underline font-medium flex items-center gap-1"
        >
          <X size={14} />
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary">
          {activeCategory
            ? categories.find((c) => c.slug === activeCategory)?.name || "Products"
            : "All Products"}
        </h1>
        <p className="mt-2 text-secondary">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
          {hasActiveFilters && " (filtered)"}
        </p>
      </div>

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">
            <FilterSidebar />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-4 mb-6">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <SearchBar placeholder="Search products..." />
            </div>

            {/* Sort */}
            <select
              value={activeSort}
              onChange={(e) => {
                const sp = new URLSearchParams(searchParams.toString());
                sp.set("sort", e.target.value);
                sp.delete("page");
                window.location.href = `/products?${sp.toString()}`;
              }}
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="default">Default</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
            </select>

            {/* Mobile filter button */}
            <button
              className="lg:hidden p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label="Filters"
            >
              <SlidersHorizontal size={20} className="text-secondary" />
            </button>
          </div>

          {/* Active filters */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mb-6">
              {activeCategory && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary text-white rounded-full px-3 py-1">
                  {categories.find((c) => c.slug === activeCategory)?.name}
                  <button onClick={clearFilters}>
                    <X size={12} />
                  </button>
                </span>
              )}
              {stockFilter && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary text-white rounded-full px-3 py-1">
                  {stockFilter === "in_stock" ? "In Stock" : "Out of Stock"}
                  <button onClick={() => window.location.href = buildUrl({ stock: "" })}>
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Product Grid */}
          {paginatedProducts.length > 0 ? (
            <ProductGrid>
              {paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ProductGrid>
          ) : (
            <div className="text-center py-20">
              <p className="text-secondary text-lg">No products found</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 text-primary font-semibold hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={buildUrl({ page: p === 1 ? "" : String(p) })}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                    page === p
                      ? "bg-primary text-white"
                      : "text-secondary hover:text-primary hover:bg-gray-100"
                  }`}
                >
                  {p}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileFiltersOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-primary">Filters</h2>
              <button onClick={() => setMobileFiltersOpen(false)} className="p-1">
                <X size={20} className="text-secondary" />
              </button>
            </div>
            <FilterSidebar />
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="mt-8 w-full py-3 bg-primary text-white font-semibold rounded-lg"
            >
              Show {filtered.length} Products
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductListingPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-20 text-center text-secondary">Loading products...</div>}>
      <ProductListingContent />
    </Suspense>
  );
}
