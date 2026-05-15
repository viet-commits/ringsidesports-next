"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ShoppingCart, Menu, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { categories } from "@/lib/products";

export function Header() {
  const { itemCount, toggleCart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const topCats = categories.slice(0, 6);

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 text-white hover:text-secondary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img
              src="/logo.png"
              alt="Ringside Sports"
              className="h-10 w-auto"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {topCats.map((cat) => (
              <Link
                key={cat.slug}
                href={`/products?category=${cat.slug}`}
                className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white rounded-lg hover:bg-primary-light transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/search"
              className="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-primary-light"
              aria-label="Search"
            >
              <Search size={20} />
            </Link>

            <button
              onClick={toggleCart}
              className="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-primary-light relative"
              aria-label="Cart"
            >
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-800 py-4">
            <nav className="flex flex-col gap-1">
              {topCats.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/products?category=${cat.slug}`}
                  className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white rounded-lg hover:bg-primary-light transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {cat.name}
                </Link>
              ))}
              <Link
                href="/products"
                className="px-3 py-2 text-sm font-medium text-accent hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                All Products
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
