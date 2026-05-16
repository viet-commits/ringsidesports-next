import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your Ringside Sports account, view orders and track deliveries.",
};

import AccountLayoutClient from "./layout-client";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountLayoutClient>{children}</AccountLayoutClient>;
}
