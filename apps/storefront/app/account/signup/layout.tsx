import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a Ringside Sports account for faster checkout and order tracking.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
