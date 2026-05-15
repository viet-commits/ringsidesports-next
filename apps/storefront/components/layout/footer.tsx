import Link from "next/link";

const FOOTER_LINKS = [
  {
    title: "Shop",
    links: [
      { label: "Boxing", href: "/products?category=boxing" },
      { label: "MMA", href: "/products?category=mma" },
      { label: "Muay Thai", href: "/products?category=muay-thai" },
      { label: "Kickboxing", href: "/products?category=kickboxing" },
      { label: "Apparel", href: "/products?category=apparel" },
      { label: "All Products", href: "/products" },
    ],
  },
  {
    title: "Info",
    links: [
      { label: "About Us", href: "#" },
      { label: "Shipping", href: "#" },
      { label: "Returns", href: "#" },
      { label: "Size Guide", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-background border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="text-xl font-bold text-white tracking-tight">
              RINGSIDE<span className="text-secondary">SPORTS</span>
            </span>
            <p className="mt-3 text-sm text-secondary leading-relaxed">
              Australia&apos;s factory outlet for combat sports gear.
              Premium equipment at unbeatable prices.
            </p>
          </div>

          {/* Links */}
          {FOOTER_LINKS.map((section) => (
            <div key={section.title}>
              <h4 className="text-sm font-bold text-white mb-3">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
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
          ))}

          {/* Contact */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li>Melbourne, Australia</li>
              <li>ABN: 12 345 678 901</li>
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

          {/* Payment icons — placeholder text */}
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
