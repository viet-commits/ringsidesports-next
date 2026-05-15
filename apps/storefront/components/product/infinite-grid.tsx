"use client";

import * as React from "react";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/lib/products";

interface InfiniteProductGridProps {
  products: Product[];
  itemsPerLoad?: number;
}

export function InfiniteProductGrid({ products, itemsPerLoad = 24 }: InfiniteProductGridProps) {
  const [visible, setVisible] = React.useState(itemsPerLoad);
  const loaderRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && visible < products.length) {
          setVisible((v) => Math.min(v + itemsPerLoad, products.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, products.length, itemsPerLoad]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {products.slice(0, visible).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {visible < products.length && (
        <div ref={loaderRef} className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {visible >= products.length && products.length > itemsPerLoad && (
        <p className="text-center text-sm text-secondary py-6">
          Showing all {products.length} products
        </p>
      )}
    </>
  );
}
