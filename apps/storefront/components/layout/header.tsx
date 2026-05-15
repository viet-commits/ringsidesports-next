"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ShoppingCart, Menu, X, User, Package } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { categories } from "@/lib/products";

export function Header() {
  const { itemCount, toggleCart } = useCart();
  const { customer, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);

  const topCats = categories.slice(0, 6);

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!accountOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-account-dropdown]")) setAccountOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [accountOpen]);

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

            {/* Account */}
            <div className="relative" data-account-dropdown>
              {customer ? (
                <button
                  onClick={() => setAccountOpen(!accountOpen)}
                  className="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-primary-light"
                  aria-label="Account"
                >
                  <User size={20} />
                </button>
              ) : (
                <Link
                  href="/account/login"
                  className="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-primary-light"
                  aria-label="Sign in"
                >
                  <User size={20} />
                </Link>
              )}

              {accountOpen && customer && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-800">
                    <p className="text-sm font-medium text-white truncate">
                      {customer.first_name} {customer.last_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{customer.email}</p>
                  </div>
                  <Link
                    href="/account"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                    onClick={() => setAccountOpen(false)}
                  >
                    <User size={16} /> Dashboard
                  </Link>
                  <Link
                    href="/account/orders"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                    onClick={() => setAccountOpen(false)}
                  >
                    <Package size={16} /> Orders
                  </Link>
                  <button
                    onClick={() => { logout(); setAccountOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors w-full text-left border-t border-gray-800 mt-1 pt-2"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>

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
              <div className="border-t border-gray-800 mt-2 pt-2">
                {customer ? (
                  <>
                    <p className="px-3 py-1 text-xs text-gray-500">
                      {customer.first_name} {customer.last_name}
                    </p>
                    <Link
                      href="/account"
                      className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors block"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/account/orders"
                      className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors block"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Orders
                    </Link>
                    <button
                      onClick={() => { logout(); setMobileMenuOpen(false); }}
                      className="px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors w-full text-left"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/account/login"
                    className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
