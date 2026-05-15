import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductListingContent } from "./listing-content";

const SITE_URL = "https://ringsidesports.com.au";

const PAGE_TITLE = "Combat Sports Equipment — All Products";
const PAGE_DESC = "Browse our complete range of boxing gloves, MMA gloves, Muay Thai & kickboxing equipment. Premium combat sports gear at factory outlet prices with fast shipping Australia-wide.";
const OG_DESC = "Browse our complete range of boxing, MMA, Muay Thai & kickboxing equipment at factory outlet prices.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: {
    canonical: `${SITE_URL}/products`,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: OG_DESC,
    url: `${SITE_URL}/products`,
    siteName: "Ringside Sports",
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: OG_DESC,
  },
};

export default function ProductListingPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-20 text-center text-secondary">Loading products...</div>}>
      <ProductListingContent />
    </Suspense>
  );
}
