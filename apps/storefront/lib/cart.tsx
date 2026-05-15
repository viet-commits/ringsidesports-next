"use client";

import React, { createContext, useContext, useReducer, useCallback, useEffect } from "react";
import type { Product, ProductVariant } from "./products";

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

type CartAction =
  | { type: "ADD_ITEM"; product: Product; variant: ProductVariant; quantity?: number }
  | { type: "REMOVE_ITEM"; sku: string }
  | { type: "UPDATE_QUANTITY"; sku: string; quantity: number }
  | { type: "CLEAR_CART" }
  | { type: "TOGGLE_CART" }
  | { type: "OPEN_CART" }
  | { type: "CLOSE_CART" }
  | { type: "LOAD_CART"; state: CartState };

function loadCartFromStorage(): CartState {
  if (typeof window === "undefined") return { items: [], isOpen: false };
  try {
    const stored = localStorage.getItem("ringsidesports-cart");
    if (stored) {
      const parsed = JSON.parse(stored);
      return { items: parsed.items || [], isOpen: false };
    }
  } catch {
    // ignore
  }
  return { items: [], isOpen: false };
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
      return { ...state, items: [] };
    case "TOGGLE_CART":
      return { ...state, isOpen: !state.isOpen };
    case "OPEN_CART":
      return { ...state, isOpen: true };
    case "CLOSE_CART":
      return { ...state, isOpen: false };
    case "LOAD_CART":
      return { ...action.state, isOpen: false };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  itemCount: number;
  subtotal: number;
  gst: number;
  total: number;
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
  removeItem: (sku: string) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false });

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
        JSON.stringify({ items: state.items })
      );
    }
  }, [state.items]);

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

  const subtotal = state.items.reduce(
    (sum, item) => sum + item.variant.price * item.quantity,
    0
  );
  const gst = Math.round(subtotal - subtotal / 1.1);
  const total = subtotal;
  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        isOpen: state.isOpen,
        itemCount,
        subtotal,
        gst,
        total,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        toggleCart,
        openCart,
        closeCart,
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
