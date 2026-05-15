import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getProductByHandle, getProductHandles } from "@/lib/products";
import { ProductDetailClient } from "./client";

const SITE_URL = "https://ringsidesports.com.au";

interface ProductPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateStaticParams() {
  const handles = getProductHandles();
  return handles.map((handle) => ({ handle }));
}

export const viewport: Viewport = {
  colorScheme: "light",
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { handle } = await params;
  const product = getProductByHandle(handle);
  if (!product) {
    return {
      title: "Product Not Found",
      description: "The product you're looking for could not be found.",
    };
  }

  const title = product.title;
  const description = product.description
    ? product.description.slice(0, 160).trim() + (product.description.length > 160 ? "…" : "")
    : `${product.title} — premium combat sports equipment from Ringside Sports, Australia's factory outlet.`;
  const ogImage = product.images[0]
    ? product.images[0].startsWith("http")
      ? product.images[0]
      : `${SITE_URL}${product.images[0].startsWith("/") ? "" : "/"}${product.images[0]}`
    : `${SITE_URL}/og-image.jpg`;
  const productUrl = `${SITE_URL}/products/${product.handle}`;

  // Build structured data
  const priceInDollars = (product.price / 100).toFixed(2);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.images,
    sku: product.id,
    offers: {
      "@type": "Offer",
      price: priceInDollars,
      priceCurrency: "AUD",
      availability:
        product.stockStatus === "in_stock"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: productUrl,
    },
    brand: {
      "@type": "Brand",
      name: "Ringside Sports",
    },
  };

  return {
    title,
    description,
    alternates: {
      canonical: productUrl,
    },
    openGraph: {
      title,
      description,
      url: productUrl,
      type: "website",
      images: ogImage
        ? [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: product.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    other: {
      "product:price:amount": priceInDollars,
      "product:price:currency": "AUD",
      "product:availability": product.stockStatus === "in_stock" ? "in stock" : "out of stock",
      "product-json-ld": JSON.stringify(jsonLd),
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { handle } = await params;
  const product = getProductByHandle(handle);

  if (!product) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}
