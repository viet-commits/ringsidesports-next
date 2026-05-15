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

export const viewport: Viewport = {
  colorScheme: "light",
};

export const metadata: Metadata = {
  title: {
    default: "Ringside Sports — Combat Sports Factory Outlet",
    template: "%s | Ringside Sports",
  },
  description:
    "Australia's factory outlet for boxing, MMA, Muay Thai & kickboxing gear. Premium equipment at unbeatable prices.",
  metadataBase: new URL("https://ringsidesports.com.au"),
  openGraph: {
    title: "Ringside Sports — Combat Sports Factory Outlet",
    description: "Premium combat sports gear at factory outlet prices.",
    url: "https://ringsidesports.com.au",
    siteName: "Ringside Sports",
    locale: "en_AU",
    type: "website",
  },
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
