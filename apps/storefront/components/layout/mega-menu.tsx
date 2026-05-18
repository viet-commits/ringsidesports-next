"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { categories, type Category } from "@/lib/products";

interface MegaGroup {
  name: string;
  slug: string;
  featured: string[];
}

const MEGA_GROUPS: MegaGroup[] = [
  {
    name: "Boxing",
    slug: "boxing",
    featured: ["boxing-gloves","mitts","punching-training-bags","protective-gear","hand-wraps","fight-gloves","boxing-shorts","boxing-rings","boxing-martial-arts"],
  },
  {
    name: "MMA",
    slug: "mma",
    featured: ["mma-gloves","mma-hand-wraps","mma-punch-mitts","martial-arts-shorts","martial-arts","training-heavy-bags","training-punch-pads","training-bag-accessories"],
  },
  {
    name: "Martial Arts",
    slug: "martial-arts",
    featured: ["martial-arts-training-equipment","martial-arts-protective-gear","martial-arts-headgear","martial-arts-body-protectors","punch-mitts-pads","sports-mouthguards"],
  },
  {
    name: "Apparel",
    slug: "apparel",
    featured: ["shirts-tops","shirts","tops","boxing-shorts","martial-arts-shorts","gym-duffel-bags"],
  },
  {
    name: "Accessories",
    slug: "accessories",
    featured: ["e-books","gift-cards","hand-supports","weight-lifting-gloves","sporting-goods","bundles"],
  },
];

function getCat(slug: string): Category | undefined {
  return categories.find(function (c) { return c.slug === slug; });
}

export function MegaMenu() {
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = (slug: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpenGroup(slug);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpenGroup(null), 200);
  };

  return (
    <nav className="hidden lg:flex items-center" onMouseLeave={handleLeave}>
      {MEGA_GROUPS.map((group) => {
        const isOpen = openGroup === group.slug;
        const featuredCats: Category[] = [];
        for (const featSlug of group.featured) {
          const cat = getCat(featSlug);
          if (cat) featuredCats.push(cat);
        }

        return (
          <div key={group.slug} className="relative" onMouseEnter={() => handleEnter(group.slug)}>
            <Link
              href={"/products?category=" + group.slug}
              className={"flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors " + (isOpen ? "text-white bg-primary-light" : "text-gray-300 hover:text-white hover:bg-primary-light")}
            >
              {group.name}
              <ChevronDown size={14} className={"transition-transform " + (isOpen ? "rotate-180" : "")} />
            </Link>

            {isOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[720px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50"
                onMouseEnter={() => handleEnter(group.slug)}>
                <div className="p-6">
                  <div className="grid grid-cols-4 gap-6">
                    <div className="col-span-3">
                      <div className="grid grid-cols-3 gap-x-6 gap-y-1">
                        {featuredCats.map((cat) => (
                            <Link key={cat.slug} href={"/products?category=" + cat.slug}
                              className="text-sm text-gray-300 hover:text-white py-1.5 transition-colors">
                              {cat.name}
                              <span className="text-xs text-gray-500 ml-1">({cat.count})</span>
                            </Link>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <Link href={"/products?category=" + group.slug}
                          className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors">
                          Shop All {group.name} &rarr;
                        </Link>
                      </div>
                    </div>
                    <div className="col-span-1">
                      {featuredCats.length > 0 && featuredCats[0] && featuredCats[0].image && (
                        <Link href={"/products?category=" + group.slug}>
                          <img src={featuredCats[0].image} alt={group.name}
                            className="w-full h-40 object-cover rounded-lg" />
                        </Link>
                      )}
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        {group.name} &mdash; Factory Direct Prices
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
