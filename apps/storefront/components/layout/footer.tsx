import Link from "next/link";
import { categories } from "@/lib/products";

const INFO_LINKS = [
  { label: "About Us", href: "/products" },
  { label: "All Products", href: "/products" },
  { label: "Search", href: "/search" },
  { label: "Cart", href: "/cart" },
];

const ACCOUNT_LINKS = [
  { label: "My Account", href: "/account" },
  { label: "Order History", href: "/orders" },
  { label: "Contact Us", href: "/contact" },
];

export function Footer() {
  const topCategories = categories.slice(0, 6);

  return (
    <footer className="bg-background border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block">
              <img
                src="/logo.png"
                alt="Ringside Sports"
                className="h-8 w-auto mb-3"
              />
            </Link>
            <p className="mt-3 text-sm text-secondary leading-relaxed">
              Australia&apos;s factory outlet for combat sports gear.
              Premium equipment at unbeatable prices.
            </p>
          </div>

          {/* Shop Categories */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3">Shop</h4>
            <ul className="space-y-2">
              {topCategories.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/products?category=${cat.slug}`}
                    className="text-sm text-secondary hover:text-white transition-colors"
                  >
                    {cat.name} ({cat.count})
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/products" className="text-sm text-secondary hover:text-white transition-colors">
                  All Products
                </Link>
              </li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3">Info</h4>
            <ul className="space-y-2">
              {INFO_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-secondary hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3">Account</h4>
            <ul className="space-y-2">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-secondary hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li>Melbourne, Australia</li>
              <li>
                <a href="mailto:info@ringsidesports.com.au" className="hover:text-white transition-colors">
                  info@ringsidesports.com.au
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-secondary">
            © {new Date().getFullYear()} Ringside Sports. All rights reserved.
            All prices in AUD and include GST.
          </p>

          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span>Visa</span>
            <span>Mastercard</span>
            <span>AMEX</span>
            <span>Afterpay</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
