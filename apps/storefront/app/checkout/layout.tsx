import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Secure checkout with Stripe and Afterpay. Free shipping on orders over $150.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
