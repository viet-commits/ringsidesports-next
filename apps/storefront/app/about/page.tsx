import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us — Ringside Sports",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-6">About Ringside Sports</h1>

      <div className="prose prose-lg max-w-none space-y-6 text-secondary">
        <p>
          Ringside Sports is Australia&apos;s premier factory outlet for combat sports
          equipment. We supply premium boxing, MMA, Muay Thai, and kickboxing gear
          at unbeatable direct-from-warehouse prices.
        </p>

        <h2 className="text-xl font-bold text-primary mt-8">Our Story</h2>
        <p>
          Based in Melbourne, we cut out the middleman to bring you professional-grade
          equipment without the retail markup. Every product in our catalogue is sourced
          from trusted manufacturers and tested by real fighters.
        </p>

        <h2 className="text-xl font-bold text-primary mt-8">Why Shop With Us</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Factory Direct Pricing</strong> — no distributor markup, no hidden costs</li>
          <li><strong>Fast Australia-Wide Shipping</strong> — orders dispatched within 24 hours</li>
          <li><strong>Premium Quality</strong> — gear trusted by fighters across Australia</li>
          <li><strong>Australian Owned & Operated</strong> — support a local business</li>
          <li><strong>30-Day Returns</strong> — shop with confidence</li>
        </ul>

        <h2 className="text-xl font-bold text-primary mt-8">Contact</h2>
        <p>
          Email:{" "}
          <a href="mailto:info@ringsidesports.com.au" className="text-primary hover:underline">
            info@ringsidesports.com.au
          </a>
        </p>
        <p>Location: Melbourne, Australia</p>
      </div>
    </div>
  );
}
