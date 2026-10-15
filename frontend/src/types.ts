export type Category = "medicamentos" | "higiene" | "cosmeticos" | "suplementos";

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: "medicamentos", label: "Medicamentos" },
  { key: "higiene", label: "Higiene" },
  { key: "cosmeticos", label: "Cosméticos" },
  { key: "suplementos", label: "Suplementos" },
];

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  promo_price: number | null;
  stock: number;
  barcode: string | null;
  external_id: string | null;
  image_url: string | null;
  active: boolean;
}

export type OrderStatus = "pendente" | "em_separacao" | "saiu_entrega" | "finalizado";

export const STATUS_ORDER: OrderStatus[] = ["pendente", "em_separacao", "saiu_entrega", "finalizado"];

export type PaymentMethod = "pix" | "dinheiro" | "cartao";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix no site",
  dinheiro: "Dinheiro na entrega",
  cartao: "Cartão na entrega",
};

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  neighborhood: string;
  complement: string;
  payment_method: PaymentMethod;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface StoreConfig {
  name: string;
  phone: string;
  city: string;
  pix_key: string;
  pix_name: string;
  delivery_fee: number;
  delivery_time: string;
}

export interface ImportSummary {
  ok?: boolean;
  total_rows?: number;
  updated?: number;
  created?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
}

export function unitPriceOf(product: Product): number {
  return product.promo_price && product.promo_price < product.price ? product.promo_price : product.price;
}

export function discountPercentOf(product: Product): number {
  if (product.promo_price && product.promo_price < product.price && product.price > 0) {
    return Math.round((1 - product.promo_price / product.price) * 100);
  }
  return 0;
}
