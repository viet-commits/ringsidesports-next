"use client";

import React, { createContext, useContext, useReducer, useCallback, useEffect } from "react";
import type { Product, ProductVariant } from "./products";

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export interface CouponResult {
  code: string;
  type: "fixed" | "percentage";
  amount: number; // cents for fixed, basis points for percentage (e.g. 1000 = 10%)
  description: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  coupon: CouponResult | null;
  couponError: string | null;
}

type CartAction =
  | { type: "ADD_ITEM"; product: Product; variant: ProductVariant; quantity?: number }
  | { type: "REMOVE_ITEM"; sku: string }
  | { type: "UPDATE_QUANTITY"; sku: string; quantity: number }
  | { type: "CLEAR_CART" }
  | { type: "TOGGLE_CART" }
  | { type: "OPEN_CART" }
  | { type: "CLOSE_CART" }
  | { type: "LOAD_CART"; state: CartState }
  | { type: "APPLY_COUPON"; coupon: CouponResult }
  | { type: "REMOVE_COUPON" }
  | { type: "COUPON_ERROR"; error: string };

function loadCartFromStorage(): CartState {
  if (typeof window === "undefined") return { items: [], isOpen: false, coupon: null, couponError: null };
  try {
    const stored = localStorage.getItem("ringsidesports-cart");
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        items: parsed.items || [],
        isOpen: false,
        coupon: parsed.coupon || null,
        couponError: null,
      };
    }
  } catch {
    // ignore
  }
  return { items: [], isOpen: false, coupon: null, couponError: null };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find(
        (item) => item.variant.sku === action.variant.sku
      );
      const items = existing
        ? state.items.map((item) =>
            item.variant.sku === action.variant.sku
              ? { ...item, quantity: item.quantity + (action.quantity || 1) }
              : item
          )
        : [
            ...state.items,
            {
              product: action.product,
              variant: action.variant,
              quantity: action.quantity || 1,
            },
          ];
      return { ...state, items, isOpen: true };
    }
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((item) => item.variant.sku !== action.sku),
      };
    case "UPDATE_QUANTITY":
      return {
        ...state,
        items: action.quantity < 1
          ? state.items.filter((item) => item.variant.sku !== action.sku)
          : state.items.map((item) =>
              item.variant.sku === action.sku
                ? { ...item, quantity: action.quantity }
                : item
            ),
      };
    case "CLEAR_CART":
      return { ...state, items: [], coupon: null, couponError: null };
    case "TOGGLE_CART":
      return { ...state, isOpen: !state.isOpen };
    case "OPEN_CART":
      return { ...state, isOpen: true };
    case "CLOSE_CART":
      return { ...state, isOpen: false };
    case "LOAD_CART":
      return { ...action.state, isOpen: false };
    case "APPLY_COUPON":
      return { ...state, coupon: action.coupon, couponError: null };
    case "REMOVE_COUPON":
      return { ...state, coupon: null, couponError: null };
    case "COUPON_ERROR":
      return { ...state, coupon: null, couponError: action.error };
    default:
      return state;
  }
}

export interface ShippingEstimate {
  label: string;
  cost: number; // AUD cents, 0 = free, -1 = POA
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  itemCount: number;
  subtotal: number;
  gst: number;
  shipping: ShippingEstimate;
  discount: number;
  discountDescription: string | null;
  total: number;
  coupon: CouponResult | null;
  couponError: string | null;
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
  removeItem: (sku: string) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  applyCoupon: (code: string) => void;
  removeCoupon: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Known coupon codes */
const KNOWN_COUPONS: Record<string, { type: "fixed" | "percentage"; amount: number; description: string; minOrder?: number; expired?: boolean }> = {
  "BH766HZT": { type: "fixed", amount: 1500, description: "$15 off", minOrder: 5000 },
  "AUGUSTYAY": { type: "percentage", amount: 1000, description: "10% off", expired: true },
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false, coupon: null, couponError: null });

  useEffect(() => {
    const saved = loadCartFromStorage();
    if (saved.items.length > 0) {
      dispatch({ type: "LOAD_CART", state: saved });
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "ringsidesports-cart",
        JSON.stringify({ items: state.items, coupon: state.coupon })
      );
    }
  }, [state.items, state.coupon]);

  const addItem = useCallback(
    (product: Product, variant: ProductVariant, quantity = 1) => {
      dispatch({ type: "ADD_ITEM", product, variant, quantity });
    },
    []
  );
  const removeItem = useCallback((sku: string) => {
    dispatch({ type: "REMOVE_ITEM", sku });
  }, []);
  const updateQuantity = useCallback((sku: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", sku, quantity });
  }, []);
  const clearCart = useCallback(() => dispatch({ type: "CLEAR_CART" }), []);
  const toggleCart = useCallback(() => dispatch({ type: "TOGGLE_CART" }), []);
  const openCart = useCallback(() => dispatch({ type: "OPEN_CART" }), []);
  const closeCart = useCallback(() => dispatch({ type: "CLOSE_CART" }), []);

  const applyCoupon = useCallback((code: string) => {
    const normalized = code.trim().toUpperCase();
    const couponDef = KNOWN_COUPONS[normalized];

    if (!couponDef) {
      dispatch({ type: "COUPON_ERROR", error: "Invalid promo code" });
      return;
    }

    if (couponDef.expired) {
      dispatch({ type: "COUPON_ERROR", error: "This promo code has expired" });
      return;
    }

    dispatch({
      type: "APPLY_COUPON",
      coupon: {
        code: normalized,
        type: couponDef.type,
        amount: couponDef.amount,
        description: couponDef.description,
      },
    });
  }, []);

  const removeCoupon = useCallback(() => {
    dispatch({ type: "REMOVE_COUPON" });
  }, []);

  const subtotal = state.items.reduce(
    (sum, item) => sum + item.variant.price * item.quantity,
    0
  );
  const gst = Math.round(subtotal - subtotal / 1.1);

  // Calculate discount
  let discount = 0;
  let discountDescription: string | null = null;
  if (state.coupon && state.items.length > 0) {
    const couponDef = KNOWN_COUPONS[state.coupon.code];
    const minOrder = couponDef?.minOrder || 0;
    if (subtotal >= minOrder) {
      if (state.coupon.type === "fixed") {
        discount = Math.min(state.coupon.amount, subtotal);
      } else {
        discount = Math.round(subtotal * state.coupon.amount / 10000);
      }
      discountDescription = state.coupon.description;
    }
  }

  // Calculate shipping based on total cart weight
  const totalWeight = state.items.reduce((sum, item) => {
    const variantWeight = item.variant.weight || 0;
    return sum + variantWeight * item.quantity;
  }, 0);

  const shipping: ShippingEstimate = (() => {
    if (state.items.length === 0) return { label: "—", cost: 0 };
    if (totalWeight <= 0) return { label: "Calculated at checkout", cost: 0 };
    if (totalWeight < 5) return { label: "Standard", cost: 1000 };
    if (totalWeight <= 20) return { label: "Heavy", cost: 2500 };
    return { label: "Freight (POA)", cost: -1 };
  })();

  const shippingCost = shipping.cost > 0 ? shipping.cost : 0;
  const total = Math.max(0, subtotal + shippingCost - discount);
  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        isOpen: state.isOpen,
        itemCount,
        subtotal,
        gst,
        shipping,
        discount,
        discountDescription,
        total,
        coupon: state.coupon,
        couponError: state.couponError,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        toggleCart,
        openCart,
        closeCart,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
