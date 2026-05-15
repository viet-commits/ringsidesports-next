import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { CartProvider } from "@/lib/cart";
import { AuthProvider } from "@/lib/auth";
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
  description: SITE_DESC,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: SITE_NAME,
    title: "Boxing Gloves, MMA & Combat Sports Equipment Australia",
    description: SITE_DESC,
    url: SITE_URL,
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESC,
    images: [OG_IMAGE],
  },
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU" className={`${inter.variable} font-sans`}>
      <body className="bg-background text-text-primary antialiased min-h-screen flex flex-col">
        <AuthProvider>
          <CartProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <CartDrawer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
