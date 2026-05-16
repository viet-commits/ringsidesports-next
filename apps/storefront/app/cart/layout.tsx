import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shopping Cart',
  description: 'Review your items and proceed to secure checkout at Ringside Sports. Free shipping on orders over $150 Australia-wide.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
