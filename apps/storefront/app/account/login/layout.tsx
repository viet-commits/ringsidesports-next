import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Ringside Sports account to view orders and track shipments.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
