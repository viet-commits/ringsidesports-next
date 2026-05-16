"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Package, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/account", label: "Dashboard", icon: User },
  { href: "/account/orders", label: "Orders", icon: Package },
];

export default function AccountLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { customer, logout } = useAuth();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row gap-8">
        <aside className="w-full sm:w-56 shrink-0">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="mb-4 pb-4 border-b border-gray-800">
              <p className="text-white font-semibold text-sm truncate">
                {customer?.first_name} {customer?.last_name}
              </p>
              <p className="text-gray-400 text-xs truncate mt-0.5">{customer?.email}</p>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-red-600 text-white" : "text-gray-300 hover:text-white hover:bg-gray-800"}`}>
                    <Icon size={16} />{item.label}
                  </Link>
                );
              })}
              <button onClick={logout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors mt-2">
                <LogOut size={16} />Sign Out
              </button>
            </nav>
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
