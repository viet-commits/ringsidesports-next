import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { featuredProducts, categories } from "@/lib/products";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { Shield, Truck, Factory, Award } from "lucide-react";

export const viewport: Viewport = {
  colorScheme: "light",
};

export const metadata: Metadata = {
  title: "Ringside Sports — Combat Sports Factory Outlet",
};

const TRUST_ITEMS = [
  {
    icon: <Shield size={20} />,
    title: "Australian Owned",
    desc: "Based in Melbourne, shipping nationwide",
  },
  {
    icon: <Truck size={20} />,
    title: "Fast Shipping",
    desc: "Orders dispatched within 24 hours",
  },
  {
    icon: <Factory size={20} />,
    title: "Factory Outlet",
    desc: "Direct pricing, no middleman markup",
  },
  {
    icon: <Award size={20} />,
    title: "Premium Quality",
    desc: "Trusted by fighters across Australia",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[70vh] overflow-hidden">
        {/* Video Background */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="https://ringsidesports.com.au/wp-content/uploads/2022/12/Punch-water-bag-banner.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-background/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32 flex items-center min-h-[70vh]">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
              Combat Sports{" "}
              <span className="text-secondary">Factory Outlet</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto">
              Premium boxing, MMA, Muay Thai & kickboxing gear at unbeatable
              prices. Direct from our Melbourne warehouse to your door.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/products">
                <Button variant="accent" size="lg" className="w-full sm:w-auto">
                  Shop All Products
                </Button>
              </Link>
              <Link href="/products">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-white text-white hover:bg-white hover:text-black">
                  View All Gear
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary">
            Shop by Category
          </h2>
          <p className="mt-3 text-secondary text-lg">
            Everything you need for your training and competition
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/products?category=${category.slug}`}
              className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 hover:shadow-lg transition-all duration-300"
            >
              <img
                src={category.image}
                alt={category.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-bold text-sm sm:text-base">
                  {category.name}
                </h3>
                <p className="text-gray-300 text-xs mt-0.5">
                  {category.count} products
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-primary">
                Top Sellers
              </h2>
              <p className="mt-3 text-secondary text-lg">
                Our most popular gear, trusted by fighters
              </p>
            </div>
            <Link href="/products" className="hidden sm:block">
              <Button variant="outline" size="md">
                View All
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="mt-10 text-center sm:hidden">
            <Link href="/products">
              <Button variant="outline" size="md">
                View All Products
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="bg-background py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {TRUST_ITEMS.map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary-light text-white shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">{item.title}</h3>
                  <p className="text-secondary text-xs mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
