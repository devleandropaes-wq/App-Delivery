import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { storage } from "@/src/utils/storage";
import type { Product } from "@/src/types";

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  qty: number;
  image_url: string | null;
}

interface CartContextValue {
  items: CartItem[];
  ready: boolean;
  add: (product: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = "cart_items";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.getItem<string>(CART_KEY, "[]").then((raw) => {
      try {
        const parsed = JSON.parse(raw ?? "[]");
        if (Array.isArray(parsed)) setItems(parsed);
      } catch {
        // carrinho corrompido → começa vazio
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) storage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, ready]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((acc, item) => acc + item.qty, 0);
    const subtotal = items.reduce((acc, item) => acc + item.price * item.qty, 0);
    return {
      items,
      ready,
      add: (product, qty = 1) =>
        setItems((prev) => {
          const unit = product.promo_price && product.promo_price < product.price ? product.promo_price : product.price;
          const existing = prev.find((i) => i.product_id === product.id);
          if (existing) {
            return prev.map((i) =>
              i.product_id === product.id ? { ...i, qty: Math.min(99, i.qty + qty), price: unit } : i,
            );
          }
          return [
            ...prev,
            { product_id: product.id, name: product.name, price: unit, qty, image_url: product.image_url },
          ];
        }),
      setQty: (productId, qty) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((i) => i.product_id !== productId)
            : prev.map((i) => (i.product_id === productId ? { ...i, qty: Math.min(99, qty) } : i)),
        ),
      remove: (productId) => setItems((prev) => prev.filter((i) => i.product_id !== productId)),
      clear: () => setItems([]),
      count,
      subtotal,
    };
  }, [items, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de CartProvider");
  return ctx;
}
