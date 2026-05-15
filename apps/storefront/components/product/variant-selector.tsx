"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { ProductVariant } from "@/lib/products";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedSku: string;
  onSelect: (variant: ProductVariant) => void;
}

export function VariantSelector({ variants, selectedSku, onSelect }: VariantSelectorProps) {
  // Group variants by option types
  const optionNames = new Set<string>();
  variants.forEach((v) => Object.keys(v.options).forEach((k) => optionNames.add(k)));

  // Build option groups
  const optionValues: Map<string, string[]> = new Map();
  for (const name of optionNames) {
    const values = new Set<string>();
    variants.forEach((v) => {
      const val = v.options[name];
      if (val) values.add(val);
    });
    optionValues.set(name, Array.from(values));
  }

  const selectedVariant = variants.find((v) => v.sku === selectedSku);

  const nameArray = Array.from(optionNames);

  return (
    <div className="space-y-4">
      {nameArray.map((optionName) => {
        const values = optionValues.get(optionName) ?? [];
        return (
          <div key={optionName}>
            <h4 className="text-sm font-semibold text-primary mb-2 capitalize">{optionName}</h4>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                const matchingVariants = variants.filter(
                  (v) => v.options[optionName] === value
                );

                const isAvailable = matchingVariants.some(
                  (v) => v.stockStatus === "in_stock"
                );
                const isSelected = selectedVariant?.options[optionName] === value;

                const handleClick = () => {
                  if (!isAvailable) return;
                  if (optionNames.size === 1 && matchingVariants[0]) {
                    onSelect(matchingVariants[0]);
                  } else {
                    const compatible = variants.find((v) => {
                      const match = v.options[optionName] === value;
                      if (!selectedVariant) return match;
                      return (
                        match &&
                        nameArray
                          .filter((n) => n !== optionName)
                          .every((n) => v.options[n] === selectedVariant.options[n])
                      );
                    });
                    if (compatible && compatible.stockStatus === "in_stock") {
                      onSelect(compatible);
                    }
                  }
                };

                const firstMatch = matchingVariants[0];

                return (
                  <button
                    key={value}
                    onClick={handleClick}
                    disabled={!isAvailable}
                    className={`relative px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : isAvailable
                          ? "border-gray-300 bg-white text-primary hover:border-primary"
                          : "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed line-through"
                    }`}
                  >
                    {value}
                    {firstMatch && firstMatch.stockQuantity > 0 && firstMatch.stockQuantity <= 3 && isAvailable && (
                      <Badge variant="warning" className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0">
                        {firstMatch.stockQuantity}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Stock status for selected variant */}
      {selectedVariant && (
        <div className="pt-2">
          {selectedVariant.stockStatus === "in_stock" ? (
            <p className="text-sm text-green-600 font-medium">
              ✓ In Stock ({selectedVariant.stockQuantity} available)
            </p>
          ) : (
            <p className="text-sm text-accent font-medium">✕ Out of Stock</p>
          )}
        </div>
      )}
    </div>
  );
}
