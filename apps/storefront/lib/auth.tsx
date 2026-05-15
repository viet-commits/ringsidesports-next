"use client";

import * as React from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://45.124.55.87:9000";

interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: string;
}

interface AuthState {
  token: string | null;
  customer: Customer | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (data: { email: string; password: string; first_name: string; last_name: string }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  fetchOrders: (limit?: number, offset?: number) => Promise<{ orders: OrderSummary[]; total: number }>;
  fetchOrder: (id: number) => Promise<OrderDetail | null>;
  lookupOrder: (email: string, number: string) => Promise<OrderDetail | null>;
  resetPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
  confirmReset: (token: string, newPassword: string) => Promise<{ ok: boolean; message: string }>;
  updateProfile: (data: { first_name?: string; last_name?: string; phone?: string }) => Promise<{ ok: boolean; error?: string }>;
}

export interface OrderSummary {
  id: number;
  order_number: string;
  status: string;
  total_cents: number;
  item_count: number;
  created_at: string;
}

export interface OrderItem {
  id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
}

export interface OrderAddress {
  type: "billing" | "shipping";
  line1: string;
  line2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
}

export interface OrderDetail {
  id: number;
  order_number: string;
  status: string;
  total_cents: number;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  currency: string;
  shipping_method: string;
  payment_method: string;
  tracking_number: string | null;
  notes: string | null;
  items: OrderItem[];
  addresses: OrderAddress[];
  created_at: string;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function getStoredAuth(): AuthState {
  if (typeof window === "undefined") return { token: null, customer: null, loading: true };
  try {
    const raw = localStorage.getItem("rs_auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { token: parsed.token, customer: parsed.customer, loading: false };
    }
  } catch { /* ignore */ }
  return { token: null, customer: null, loading: false };
}

function storeAuth(token: string, customer: Customer) {
  localStorage.setItem("rs_auth", JSON.stringify({ token, customer }));
}

function clearAuth() {
  localStorage.removeItem("rs_auth");
}

async function api(
  path: string,
  options: RequestInit = {},
  token?: string | null
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/store${path}`, { ...options, headers });
  return res.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>(getStoredAuth);

  const login = React.useCallback(async (email: string, password: string) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (data.error) return { ok: false, error: data.error };
    storeAuth(data.token, data.customer);
    setState({ token: data.token, customer: data.customer, loading: false });
    return { ok: true };
  }, []);

  const signup = React.useCallback(async (input: { email: string; password: string; first_name: string; last_name: string }) => {
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (data.error) return { ok: false, error: data.error };
    storeAuth(data.token, data.customer);
    setState({ token: data.token, customer: data.customer, loading: false });
    return { ok: true };
  }, []);

  const logout = React.useCallback(() => {
    clearAuth();
    setState({ token: null, customer: null, loading: false });
  }, []);

  const fetchOrders = React.useCallback(async (limit = 20, offset = 0) => {
    const data = await api(
      `/customers/me/orders?limit=${limit}&offset=${offset}`,
      {},
      state.token
    );
    return { orders: data.orders || [], total: data.total || 0 };
  }, [state.token]);

  const fetchOrder = React.useCallback(async (id: number) => {
    const data = await api(`/customers/me/orders/${id}`, {}, state.token);
    if (data.error) return null;
    return data as OrderDetail;
  }, [state.token]);

  const lookupOrder = React.useCallback(async (email: string, number: string) => {
    const data = await api(`/orders/lookup?email=${encodeURIComponent(email)}&number=${encodeURIComponent(number)}`);
    if (data.error) return null;
    return data as OrderDetail;
  }, []);

  const resetPassword = React.useCallback(async (email: string) => {
    const data = await api("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return { ok: !data.error, message: data.message || data.error || "If that email exists, a reset link has been sent." };
  }, []);

  const confirmReset = React.useCallback(async (token: string, newPassword: string) => {
    const data = await api("/auth/reset-password/confirm", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    return { ok: !data.error, message: data.message || data.error || "Password updated." };
  }, []);

  const updateProfile = React.useCallback(async (input: { first_name?: string; last_name?: string; phone?: string }) => {
    const data = await api("/customers/me", {
      method: "PUT",
      body: JSON.stringify(input),
    }, state.token);
    if (data.error) return { ok: false, error: data.error };
    if (data.customer) {
      storeAuth(state.token!, data.customer);
      setState((s) => ({ ...s, customer: data.customer }));
    }
    return { ok: true };
  }, [state.token]);

  const value = React.useMemo(
    () => ({ ...state, login, signup, logout, fetchOrders, fetchOrder, lookupOrder, resetPassword, confirmReset, updateProfile }),
    [state, login, signup, logout, fetchOrders, fetchOrder, lookupOrder, resetPassword, confirmReset, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
