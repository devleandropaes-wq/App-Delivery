import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/src/api";
import { adminLogout, useAdminToken } from "@/src/auth/admin";
import { usesNativeTabs } from "@/src/navigation";
import { nextStatus, prevStatus, STATUS_META, StatusBadge } from "@/src/components/order-meta";
import { FONTS } from "@/src/fonts";
import { buildWhatsAppLink, fmtBRL, fmtShortDateTime } from "@/src/format";
import { PAYMENT_LABELS, STATUS_ORDER, type Order, type OrderStatus } from "@/src/types";
import { makeStyles, useTheme } from "@/src/theme";

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { token } = useAdminToken();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => apiFetch<Order[]>("/admin/orders", { token }),
    refetchInterval: 4000,
    enabled: !!token,
  });

  // Alerta háptico quando um pedido novo chega
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!orders.data) return;
    const codes = new Set(orders.data.map((o) => o.code));
    if (seenRef.current === null) {
      seenRef.current = codes;
      return;
    }
    const fresh = orders.data.filter((o) => o.status === "pendente" && !seenRef.current!.has(o.code));
    seenRef.current = codes;
    if (fresh.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [orders.data]);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      apiFetch<Order>(`/admin/orders/${id}/status`, { method: "PATCH", body: { status }, token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  const selected = orders.data?.find((o) => o.id === selectedId) ?? null;

  const handleLogout = async () => {
    await adminLogout();
    router.replace("/admin");
  };

  const openWhats = (order: Order) => {
    const msg = `Olá ${order.customer_name}! Sobre o seu pedido #${order.code} na A Sua Drogaria...`;
    Linking.openURL(buildWhatsAppLink(order.customer_phone, msg)).catch(() => {});
  };

  const byStatus = (status: OrderStatus) =>
    (orders.data ?? []).filter((o) => o.status === status);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.headerTitle}>Pedidos</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Atualizando em tempo real</Text>
          </View>
        </View>
        <Pressable testID="admin-logout" style={styles.logoutBtn} onPress={handleLogout} hitSlop={8}>
          <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: colors.onBrandPrimary }} />
        </Pressable>
      </View>

      {orders.isLoading ? (
        <View style={styles.stateBox}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandPrimary }} />
          <Text style={styles.stateText}>Carregando pedidos ativos...</Text>
        </View>
      ) : orders.isError ? (
        <View style={styles.stateBox}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.error }} />
          <Text style={styles.stateText}>Erro ao sincronizar pedidos em tempo real.</Text>
          <Pressable testID="orders-retry" style={styles.retryBtn} onPress={() => orders.refetch()}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          horizontal
          data={STATUS_ORDER}
          keyExtractor={(s) => s}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: (usesNativeTabs ? insets.bottom : 0) + 16,
            gap: 10,
          }}
          renderItem={({ item: status }) => {
            const list = byStatus(status);
            const meta = STATUS_META[status];
            const dot = colors[meta.bg as keyof typeof colors] as string;
            return (
              <View testID={`orders-column-${status}`} style={styles.column}>
                <View style={styles.columnHeader}>
                  <View style={[styles.columnDot, { backgroundColor: dot }]} />
                  <Text style={styles.columnTitle}>{meta.label}</Text>
                  <View style={[styles.columnCount, { backgroundColor: dot }]}>
                    <Text style={styles.columnCountText}>{list.length}</Text>
                  </View>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingHorizontal: 10, paddingBottom: 8 }}
                >
                  {list.length === 0 && <Text style={styles.emptyColumn}>Nenhum pedido aqui</Text>}
                  {list.map((order) => {
                    const isNew = order.status === "pendente" && Date.now() - new Date(order.created_at).getTime() < 120000;
                    return (
                      <Pressable
                        key={order.id}
                        testID={`order-card-${order.code}`}
                        style={({ pressed }) => [styles.orderCard, isNew && styles.orderCardNew, pressed && { opacity: 0.85 }]}
                        onPress={() => setSelectedId(order.id)}
                      >
                        <View style={styles.orderCardTop}>
                          <Text style={styles.orderCode}>#{order.code}</Text>
                          <Text style={styles.orderTime}>{fmtShortDateTime(order.created_at)}</Text>
                        </View>
                        <Text style={styles.orderName} numberOfLines={1}>
                          {order.customer_name}
                        </Text>
                        <View style={styles.orderCardRow}>
                          <Text style={styles.orderTotal}>{fmtBRL(order.total)}</Text>
                          <View style={styles.paymentChip}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onSurfaceTertiary }} />
                            <Text style={styles.paymentChipText}>{PAYMENT_LABELS[order.payment_method]}</Text>
                          </View>
                        </View>
                        <Text style={styles.orderMeta} numberOfLines={1}>
                          {order.items.reduce((acc, i) => acc + i.qty, 0)} itens • {order.neighborhood}
                        </Text>
                        {isNew && (
                          <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NOVO</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            );
          }}
        />
      )}

      {/* Detalhes do pedido */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelectedId(null)}>
        {selected && (
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Pedido #{selected.code}</Text>
                  <Text style={styles.modalTime}>{fmtShortDateTime(selected.created_at)}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <StatusBadge status={selected.status} />
                  <Pressable testID="order-modal-close" style={styles.modalClose} onPress={() => setSelectedId(null)} hitSlop={8}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onSurfaceSecondary }} />
                  </Pressable>
                </View>
              </View>

              <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }} showsVerticalScrollIndicator={false}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalCardTitle}>Cliente</Text>
                  <Text style={styles.modalLine}>{selected.customer_name}</Text>
                  <Pressable testID="order-modal-whatsapp" style={styles.phoneRow} onPress={() => openWhats(selected)}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success }} />
                    <Text style={[styles.modalLine, { color: colors.success }]}>{selected.customer_phone}</Text>
                  </Pressable>
                </View>

                <View style={styles.modalCard}>
                  <Text style={styles.modalCardTitle}>Endereço de entrega</Text>
                  <Text style={styles.modalLine}>{selected.address}</Text>
                  <Text style={styles.modalSubLine}>
                    {selected.neighborhood}
                    {selected.complement ? ` • ${selected.complement}` : ""} • Duque de Caxias, RJ
                  </Text>
                </View>

                <View style={styles.modalCard}>
                  <Text style={styles.modalCardTitle}>Itens comprados</Text>
                  {selected.items.map((item, idx) => (
                    <View key={`${item.product_id}-${idx}`} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{item.qty}×</Text>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemPrice}>{fmtBRL(item.price * item.qty)}</Text>
                    </View>
                  ))}
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>{fmtBRL(selected.subtotal)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Taxa de entrega</Text>
                    <Text style={styles.summaryValue}>{selected.delivery_fee > 0 ? fmtBRL(selected.delivery_fee) : "Grátis"}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Valor total</Text>
                    <Text style={styles.totalValue}>{fmtBRL(selected.total)}</Text>
                  </View>
                  <View style={styles.paymentRow}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandSecondary }} />
                    <Text style={styles.paymentRowText}>{PAYMENT_LABELS[selected.payment_method]}</Text>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                {prevStatus(selected.status) && (
                  <Pressable
                    testID="order-back-status-button"
                    style={({ pressed }) => [styles.footerBtnSecondary, pressed && { opacity: 0.85 }]}
                    onPress={() =>
                      updateStatus.mutate({ id: selected.id, status: prevStatus(selected.status) as OrderStatus })
                    }
                    disabled={updateStatus.isPending}
                  >
                    <Text style={styles.footerBtnSecondaryText}>Voltar para {STATUS_META[prevStatus(selected.status) as OrderStatus].label}</Text>
                  </Pressable>
                )}
                {nextStatus(selected.status) ? (
                  <Pressable
                    testID="order-advance-button"
                    style={({ pressed }) => [styles.footerBtnPrimary, pressed && { opacity: 0.85 }]}
                    onPress={() =>
                      updateStatus.mutate({ id: selected.id, status: nextStatus(selected.status) as OrderStatus })
                    }
                    disabled={updateStatus.isPending}
                  >
                    <Text style={styles.footerBtnPrimaryText}>Avançar para {STATUS_META[nextStatus(selected.status) as OrderStatus].label}</Text>
                  </Pressable>
                ) : (
                  <View style={styles.finalizedBox}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success }} />
                    <Text style={styles.finalizedText}>Pedido finalizado</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTitle: { color: colors.onBrand, fontSize: 20, fontFamily: FONTS.extraBold },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.onBrand, opacity: 0.85, fontSize: 12, fontFamily: FONTS.medium },
  logoutBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)" },
  stateBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  stateText: { color: colors.onSurfaceTertiary, fontSize: 14, textAlign: "center", fontFamily: FONTS.medium },
  retryBtn: { backgroundColor: colors.brandPrimary, borderRadius: 12, paddingHorizontal: 20, height: 44, alignItems: "center", justifyContent: "center" },
  retryText: { color: colors.onBrandPrimary, fontFamily: FONTS.bold, fontSize: 14 },
  column: {
    width: 290,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  columnHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  columnDot: { width: 10, height: 10, borderRadius: 5 },
  columnTitle: { flex: 1, color: colors.onSurface, fontSize: 14, fontFamily: FONTS.bold },
  columnCount: { borderRadius: 999, minWidth: 24, paddingHorizontal: 7, paddingVertical: 2, alignItems: "center" },
  columnCountText: { color: colors.onBrandPrimary, fontSize: 11, fontFamily: FONTS.bold },
  emptyColumn: { color: colors.muted, fontSize: 12, fontFamily: FONTS.medium, paddingVertical: 16, textAlign: "center" },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 3,
  },
  orderCardNew: { borderColor: colors.brandSecondary, borderWidth: 1.5 },
  orderCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderCode: { color: colors.brandPrimary, fontSize: 14, fontFamily: FONTS.extraBold },
  orderTime: { color: colors.muted, fontSize: 11, fontFamily: FONTS.medium },
  orderName: { color: colors.onSurface, fontSize: 13, fontFamily: FONTS.semiBold },
  orderCardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  orderTotal: { color: colors.brandSecondary, fontSize: 15, fontFamily: FONTS.extraBold },
  paymentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 1,
  },
  paymentChipText: { color: colors.onSurfaceTertiary, fontSize: 10, fontFamily: FONTS.semiBold },
  orderMeta: { color: colors.onSurfaceTertiary, fontSize: 11, fontFamily: FONTS.medium },
  newBadge: { alignSelf: "flex-start", backgroundColor: colors.brandSecondary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  newBadgeText: { color: colors.onBrandSecondary, fontSize: 9, fontFamily: FONTS.extraBold },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: { color: colors.onSurface, fontSize: 18, fontFamily: FONTS.extraBold },
  modalTime: { color: colors.muted, fontSize: 12, fontFamily: FONTS.medium, marginTop: 2 },
  modalClose: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  modalCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  modalCardTitle: { color: colors.onSurface, fontSize: 13, fontFamily: FONTS.extraBold, marginBottom: 2 },
  modalLine: { color: colors.onSurfaceSecondary, fontSize: 14, fontFamily: FONTS.semiBold },
  modalSubLine: { color: colors.onSurfaceTertiary, fontSize: 12, fontFamily: FONTS.regular },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  itemQty: { width: 28, color: colors.brandSecondary, fontSize: 13, fontFamily: FONTS.bold },
  itemName: { flex: 1, color: colors.onSurface, fontSize: 13, fontFamily: FONTS.medium },
  itemPrice: { color: colors.onSurface, fontSize: 13, fontFamily: FONTS.semiBold },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  summaryLabel: { fontSize: 13, color: colors.onSurfaceTertiary, fontFamily: FONTS.medium },
  summaryValue: { fontSize: 13, color: colors.onSurface, fontFamily: FONTS.semiBold },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: 6, paddingTop: 8 },
  totalLabel: { fontSize: 15, color: colors.onSurface, fontFamily: FONTS.bold },
  totalValue: { fontSize: 18, color: colors.brandSecondary, fontFamily: FONTS.extraBold },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  paymentRowText: { color: colors.onSurfaceSecondary, fontSize: 13, fontFamily: FONTS.bold },
  modalFooter: { flexDirection: "row", gap: 10, padding: 16, paddingTop: 8 },
  footerBtnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  footerBtnPrimaryText: { color: colors.onBrandSecondary, fontSize: 13, fontFamily: FONTS.bold, textAlign: "center" },
  footerBtnSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  footerBtnSecondaryText: { color: colors.onBrandTertiary, fontSize: 13, fontFamily: FONTS.bold, textAlign: "center" },
  finalizedBox: { flex: 1, flexDirection: "row", height: 48, borderRadius: 12, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", gap: 6 },
  finalizedText: { color: colors.success, fontSize: 14, fontFamily: FONTS.bold },
}));
