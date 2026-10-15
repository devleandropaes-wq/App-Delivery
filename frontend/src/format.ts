import dayjs from "dayjs";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function fmtBRL(value: number): string {
  return brl.format(value ?? 0);
}

export function fmtDateTime(iso: string): string {
  return dayjs(iso).format("DD/MM/YYYY HH:mm");
}

export function fmtShortDateTime(iso: string): string {
  return dayjs(iso).format("DD/MM HH:mm");
}

export function onlyDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export function parsePrice(value: string): number | null {
  const cleaned = (value ?? "").replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (normalized.includes(",")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    }
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export function buildWhatsAppLink(phone: string, message?: string): string {
  const digits = onlyDigits(phone);
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  const base = `https://wa.me/${full}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
