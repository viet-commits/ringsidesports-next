import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/products";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className = "" }: ProductCardProps) {
  const isOutOfStock = product.stockStatus === "out_of_stock";

  return (
    <Link href={`/products/${product.handle}`} className={`group block ${className}`}>
      <Card padding="none" className="overflow-hidden hover:shadow-md transition-shadow duration-200">
        {/* Image */}
        <div className="relative aspect-square bg-gray-100 overflow-hidden">
          <img
            src={product.images[0] || "/placeholder.svg"}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.tags.includes("pro-series") && (
              <Badge variant="default">Pro</Badge>
            )}
            {product.tags.includes("premium") && (
              <Badge variant="warning">Premium</Badge>
            )}
          </div>
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Badge variant="danger" className="text-sm px-4 py-1.5">Out of Stock</Badge>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          {/* Categories */}
          <div className="text-xs text-secondary mb-1">
            {product.categories.slice(0, 2).join(" · ")}
          </div>

          {/* Title */}
          <h3 className="font-bold text-primary text-sm leading-tight mb-2 line-clamp-2 group-hover:text-secondary transition-colors">
            {product.title}
          </h3>

          {/* Price */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">
              {formatPrice(product.price)}
            </span>
            {product.price > 5000 && (
              <span className="text-xs text-secondary">inc. GST</span>
            )}
          </div>

          {/* Stock indicator */}
          {product.stockStatus === "in_stock" && product.stockQuantity > 0 && product.stockQuantity <= 5 && (
            <p className="text-xs text-accent mt-1 font-medium">
              Only {product.stockQuantity} left
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
