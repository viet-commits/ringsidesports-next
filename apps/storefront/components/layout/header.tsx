"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ShoppingCart, Menu, X } from "lucide-react";
import { useCart } from "@/lib/cart";

const NAV_LINKS = [
  { label: "Boxing", href: "/products?category=boxing" },
  { label: "MMA", href: "/products?category=mma" },
  { label: "Muay Thai", href: "/products?category=muay-thai" },
  { label: "Kickboxing", href: "/products?category=kickboxing" },
  { label: "Apparel", href: "/products?category=apparel" },
  { label: "Accessories", href: "/products?category=accessories" },
];

export function Header() {
  const { itemCount, toggleCart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

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
            <span className="text-xl font-bold text-white tracking-tight">
              RINGSIDE<span className="text-secondary">SPORTS</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white rounded-lg hover:bg-primary-light transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <Link
              href="/search"
              className="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-primary-light"
              aria-label="Search"
            >
              <Search size={20} />
            </Link>

            {/* Cart */}
            <button
              onClick={toggleCart}
              className="relative p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-primary-light"
              aria-label="Cart"
            >
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="lg:hidden pb-4 border-t border-gray-800 pt-4">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2.5 text-base font-medium text-gray-300 hover:text-white hover:bg-primary-light rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/products"
                className="px-4 py-2.5 text-base font-bold text-white hover:bg-primary-light rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Shop All →
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
