import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getProductByHandle, getProductHandles } from "@/lib/products";
import { ProductDetailClient } from "./client";

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
  if (!product) return { title: "Product Not Found" };

  return {
    title: product.title,
    description: product.description,
    openGraph: {
      title: product.title,
      description: product.description,
      images: product.images.slice(0, 1),
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
