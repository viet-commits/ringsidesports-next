"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { products, categories, type Product } from "@/lib/products";
import { ProductCard } from "@/components/product/product-card";
import { ProductGrid } from "@/components/product/product-grid";
import { SearchBar } from "@/components/search/search-bar";
import { SlidersHorizontal, X, Search } from "lucide-react";

const ITEMS_PER_PAGE = 12;

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const activeCategory = searchParams.get("category") || "";
  const stockFilter = searchParams.get("stock") || "";
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  // Filter by search query
  let results: Product[] = [];
  if (query) {
    const q = query.toLowerCase();
    results = products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.categories.some((c) => c.toLowerCase().includes(q)) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q))
    );
  }

  // Apply additional filters
  if (activeCategory) {
    results = results.filter((p) =>
      p.categories.some((c) => c.toLowerCase() === activeCategory.toLowerCase())
    );
  }

  if (stockFilter === "in_stock") {
    results = results.filter((p) => p.stockStatus === "in_stock");
  } else if (stockFilter === "out_of_stock") {
    results = results.filter((p) => p.stockStatus === "out_of_stock");
  }

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = results.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const buildSearchUrl = (params: Record<string, string>) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    return `/search?${sp.toString()}`;
  };

  const hasActiveFilters = activeCategory || stockFilter;

  const clearFilters = () => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    window.location.href = `/search?${sp.toString()}`;
  };

  const FilterSidebar = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-primary mb-3">Categories</h3>
        <ul className="space-y-2">
          <li>
            <a
              href={buildSearchUrl({ category: "" })}
              className={`text-sm block py-1 transition-colors ${
                !activeCategory ? "font-semibold text-primary" : "text-secondary hover:text-primary"
              }`}
            >
              All Categories
            </a>
          </li>
          {categories.map((cat) => (
            <li key={cat.slug}>
              <a
                href={buildSearchUrl({ category: cat.slug })}
                className={`text-sm block py-1 transition-colors ${
                  activeCategory === cat.slug
                    ? "font-semibold text-primary"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {cat.name}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-bold text-primary mb-3">Availability</h3>
        <ul className="space-y-2">
          <li>
            <a
              href={buildSearchUrl({ stock: "in_stock" })}
              className={`text-sm block py-1 transition-colors ${
                stockFilter === "in_stock" ? "font-semibold text-primary" : "text-secondary hover:text-primary"
              }`}
            >
              In Stock
            </a>
          </li>
          <li>
            <a
              href={buildSearchUrl({ stock: "out_of_stock" })}
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

  if (!query) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <Search size={48} className="text-gray-300 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-primary mb-4">Search Products</h1>
          <SearchBar placeholder="Search for boxing gloves, MMA gear..." />
          <p className="mt-8 text-secondary">
            Try searching for &quot;gloves&quot;, &quot;shorts&quot;, or &quot;headgear&quot;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
          Search results for &quot;{query}&quot;
        </h1>
        <p className="text-secondary">
          {results.length} result{results.length !== 1 ? "s" : ""} found
        </p>
      </div>

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">
            <FilterSidebar />
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 max-w-md">
              <SearchBar placeholder="Refine your search..." />
            </div>
            <button
              className="lg:hidden p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label="Filters"
            >
              <SlidersHorizontal size={20} className="text-secondary" />
            </button>
          </div>

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
                  <button onClick={() => window.location.href = buildSearchUrl({ stock: "" })}>
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          )}

          {paginatedResults.length > 0 ? (
            <>
              <ProductGrid>
                {paginatedResults.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </ProductGrid>

              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <a
                      key={p}
                      href={buildSearchUrl({ page: p === 1 ? "" : String(p) })}
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
            </>
          ) : (
            <div className="text-center py-20">
              <Search size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-secondary text-lg mb-2">
                No products found for &quot;{query}&quot;
              </p>
              <p className="text-sm text-secondary mb-6">
                Try a different search term or browse categories
              </p>
              <a href="/products" className="text-primary font-semibold hover:underline">
                Browse All Products
              </a>
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
              Show {results.length} Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-20 text-center text-secondary">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
