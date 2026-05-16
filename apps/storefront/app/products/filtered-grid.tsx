"use client";

import { ProductCard } from "@/components/product/product-card";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/products";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((v, k) => { params[k] = v; });
  return params;
}

interface Props {
  products: Product[];
}

export default function FilteredProductGrid({ products }: Props) {
  const [mounted, setMounted] = useState(false);
  const [params, setParams] = useState<Record<string, string>>({});

  useEffect(() => {
    setParams(getParams());
    setMounted(true);
    const el = document.getElementById("product-grid");
    if (el) el.style.display = "none";
  }, []);

  if (!mounted) return null;

  const activeCategory = params.category || "";
  const activeSort = params.sort || "default";
  const stockFilter = params.stock || "";
  const minPrice = params.minPrice || "";
  const maxPrice = params.maxPrice || "";

  let filtered = [...products];

  if (activeCategory) {
    filtered = filtered.filter((p) =>
      p.categories.some((c) => slugify(c) === activeCategory.toLowerCase())
    );
  }
  if (minPrice) filtered = filtered.filter((p) => p.price >= parseInt(minPrice, 10));
  if (maxPrice) filtered = filtered.filter((p) => p.price <= parseInt(maxPrice, 10));
  if (stockFilter === "in_stock") filtered = filtered.filter((p) => p.stockStatus === "in_stock");
  else if (stockFilter === "out_of_stock") filtered = filtered.filter((p) => p.stockStatus === "out_of_stock");

  switch (activeSort) {
    case "price-asc": filtered.sort((a, b) => a.price - b.price); break;
    case "price-desc": filtered.sort((a, b) => b.price - a.price); break;
    case "name": filtered.sort((a, b) => a.title.localeCompare(b.title)); break;
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-secondary text-lg">No products match your filters</p>
        <a href="/products" className="mt-4 inline-block text-primary font-semibold hover:underline">Clear all filters</a>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-secondary mb-4">
        {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        {(activeCategory || stockFilter || minPrice) && " (filtered)"}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  );
}
