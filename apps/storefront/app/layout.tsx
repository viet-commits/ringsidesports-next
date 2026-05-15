import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { CartProvider } from "@/lib/cart";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_NAME = "Ringside Sports";
const SITE_URL = "https://ringsidesports.com.au";
const SITE_DESC =
  "Australia's factory outlet for boxing, MMA, Muay Thai & kickboxing gear. Premium equipment at unbeatable prices.";
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export const viewport: Viewport = {
  colorScheme: "light",
};

export const metadata: Metadata = {
  title: {
    default: "Boxing Gloves, MMA & Combat Sports Equipment Australia | Ringside Sports",
    template: `%s | ${SITE_NAME}`,
  },
  description: "Australia's factory outlet for boxing, MMA, Muay Thai & kickboxing gear. Premium equipment at unbeatable prices. Shop boxing gloves, MMA gloves & more.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: `${SITE_NAME} — Combat Sports Factory Outlet`,
    description: "Premium combat sports gear at factory outlet prices.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_AU",
    type: "website",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Combat Sports Factory Outlet`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Combat Sports Factory Outlet`,
    description: "Premium combat sports gear at factory outlet prices.",
    images: [OG_IMAGE],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/og-image.jpg`,
      description: SITE_DESC,
      sameAs: [
        "https://www.facebook.com/ringsidesports",
        "https://www.instagram.com/ringsidesports",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+61-3-9000-0000",
        contactType: "customer service",
        areaServed: "AU",
        availableLanguage: "en",
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Melbourne",
        addressRegion: "VIC",
        addressCountry: "AU",
      },
    },
    {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESC,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU" className={`${inter.variable}`}>
      <head>
        <meta name="color-scheme" content="light" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans bg-white text-primary antialiased min-h-screen flex flex-col">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
