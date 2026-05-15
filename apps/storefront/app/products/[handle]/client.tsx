"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatPrice, formatGst } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VariantSelector } from "@/components/product/variant-selector";
import type { Product } from "@/lib/products";

interface ProductDetailClientProps {
  product: Product;
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const { addItem } = useCart();
  const [selectedSku, setSelectedSku] = React.useState(
    product.variants[0]?.sku || ""
  );
  const [mainImageIndex, setMainImageIndex] = React.useState(0);
  const [addedFeedback, setAddedFeedback] = React.useState(false);

  const selectedVariant = product.variants.find((v) => v.sku === selectedSku);
  const isOutOfStock = !selectedVariant || selectedVariant.stockStatus === "out_of_stock";

  const handleAddToCart = () => {
    if (!selectedVariant || isOutOfStock) return;
    addItem(product, selectedVariant);
    setAddedFeedback(true);
    setTimeout(() => { setAddedFeedback(false); window.location.href = "/cart"; }, 600);
  };

  // All images: product images + selected variant images
  const allImages = [
    ...product.images,
    ...(selectedVariant?.images || []),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link
          href="/products"
          className="inline-flex items-center text-sm text-secondary hover:text-primary transition-colors"
        >
          <ChevronLeft size={16} />
          Back to Products
        </Link>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Image Gallery */}
        <div>
          {/* Main Image */}
          <div className="aspect-square rounded-xl bg-gray-100 overflow-hidden mb-4">
            <img
              src={allImages[mainImageIndex] || "/placeholder.svg"}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setMainImageIndex(idx)}
                  className={`aspect-square rounded-lg bg-gray-100 overflow-hidden border-2 transition-colors ${
                    idx === mainImageIndex
                      ? "border-primary"
                      : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.title} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          {/* Categories */}
          <div className="flex flex-wrap gap-2 mb-3">
            {product.categories.map((cat) => (
              <Link key={cat} href={`/products?category=${cat.toLowerCase()}`}>
                <Badge variant="outline">{cat}</Badge>
              </Link>
            ))}
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-3">
            {product.title}
          </h1>

          {/* Price */}
          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">
                {selectedVariant
                  ? formatPrice(selectedVariant.price)
                  : formatPrice(product.price)}
              </span>
              <span className="text-sm text-secondary">inc. GST</span>
            </div>
            {selectedVariant && (
              <p className="text-xs text-secondary mt-1">
                GST: {formatGst(selectedVariant.price)} included
              </p>
            )}
          </div>

          {/* Description */}
          <p className="text-secondary leading-relaxed mb-6">
            {product.description}
          </p>

          {/* Variant Selector */}
          {product.variants.length > 1 && (
            <div className="mb-6">
              <VariantSelector
                variants={product.variants}
                selectedSku={selectedSku}
                onSelect={(v) => setSelectedSku(v.sku)}
              />
            </div>
          )}

          {/* Add to Cart */}
          <div className="mb-6">
            <Button
              variant="accent"
              size="lg"
              className="w-full sm:w-auto"
              disabled={isOutOfStock}
              onClick={handleAddToCart}
            >
              <ShoppingCart size={20} className="mr-2" />
              {isOutOfStock ? "Out of Stock" : addedFeedback ? "Added! ✓" : "Add to Cart"}
            </Button>
          </div>

          {/* Meta */}
          <div className="border-t border-gray-200 pt-6 space-y-3">
            {selectedVariant && (
              <div className="text-sm">
                <span className="text-secondary">SKU: </span>
                <span className="text-primary font-mono">{selectedVariant.sku}</span>
              </div>
            )}
            <div className="text-sm">
              <span className="text-secondary">Categories: </span>
              <span className="text-primary">{product.categories.join(", ")}</span>
            </div>
            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <Badge key={tag} variant="default" className="text-[11px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
