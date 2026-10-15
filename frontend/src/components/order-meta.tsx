import { Text, View } from "react-native";

import { makeStyles, useTheme } from "@/src/theme";
import { STATUS_ORDER, type OrderStatus } from "@/src/types";

export const STATUS_META: Record<
  OrderStatus,
  { label: string; icon: string; bg: string; fg: string }
> = {
  pendente: { label: "Pendente", icon: "time-outline", bg: "warning", fg: "onWarning" },
  em_separacao: { label: "Em Separação", icon: "cube-outline", bg: "info", fg: "onInfo" },
  saiu_entrega: { label: "Saiu para Entrega", icon: "bicycle-outline", bg: "brandPrimary", fg: "onBrandPrimary" },
  finalizado: { label: "Finalizado", icon: "checkmark-circle-outline", bg: "success", fg: "onSuccess" },
};

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 && idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
}

export function prevStatus(status: OrderStatus): OrderStatus | null {
  const idx = STATUS_ORDER.indexOf(status);
  return idx > 0 ? STATUS_ORDER[idx - 1] : null;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const meta = STATUS_META[status];
  const bg = colors[meta.bg as keyof typeof colors] as string;
  const fg = colors[meta.fg as keyof typeof colors] as string;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{meta.label}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans-Bold",
  },
}));
