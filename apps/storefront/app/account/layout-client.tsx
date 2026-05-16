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
  const { customer, loading, logout } = useAuth();

  // Allow login and signup pages without authentication
  const isAuthPage = pathname === "/account/login" || pathname === "/account/signup";
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Loading spinner
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-red-600 rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 text-sm mt-4">Loading...</p>
      </div>
    );
  }

  // Not logged in
  if (!customer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <User size={48} className="text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-primary mb-2">Sign In Required</h1>
        <p className="text-gray-500 mb-6">Please sign in to access your account.</p>
        <a href="/account/login" className="inline-block bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg px-5 py-2.5 transition-colors mr-3">
          Sign In
        </a>
        <a href="/account/signup" className="inline-block border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg px-5 py-2.5 transition-colors">
          Create Account
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row gap-8">
        <aside className="w-full sm:w-56 shrink-0">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="mb-4 pb-4 border-b border-gray-800">
              <p className="text-white font-semibold text-sm truncate">
                {customer.first_name} {customer.last_name}
              </p>
              <p className="text-gray-400 text-xs truncate mt-0.5">{customer.email}</p>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}
                    className={"flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors " + (isActive ? "bg-red-600 text-white" : "text-gray-300 hover:text-white hover:bg-gray-800")}>
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
