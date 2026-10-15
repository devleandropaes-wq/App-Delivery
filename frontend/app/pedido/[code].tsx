import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { apiFetch, resolveImageUrl } from "@/src/api";
import { FONTS } from "@/src/fonts";
import { fmtBRL, fmtDateTime } from "@/src/format";
import { PAYMENT_LABELS, type Order, type StoreConfig } from "@/src/types";
import { StatusBadge } from "@/src/components/order-meta";
import { makeStyles, useTheme } from "@/src/theme";

export default function OrderConfirmation() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const order = useQuery({
    queryKey: ["order", code],
    queryFn: () => apiFetch<Order>(`/orders/${code}`),
  });
  const config = useQuery({ queryKey: ["config"], queryFn: () => apiFetch<StoreConfig>("/config") });

  const pixKey = config.data?.pix_key ?? "";

  const copyPix = async () => {
    await Clipboard.setStringAsync(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (order.isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="sync" size={26} color={colors.brandPrimary} />
        <Text style={styles.stateText}>Confirmando seu pedido...</Text>
      </View>
    );
  }

  if (order.isError || !order.data) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="cloud-offline-outline" size={26} color={colors.error} />
        <Text style={styles.stateText}>Não foi possível localizar o pedido #{code}.</Text>
        <Pressable testID="order-confirm-home-button" style={styles.secondaryBtn} onPress={() => router.replace("/")}>
          <Text style={styles.secondaryBtnText}>Voltar ao início</Text>
        </Pressable>
      </View>
    );
  }

  const o = order.data;
  const isPix = o.payment_method === "pix";
  const whatsMsg = isPix
    ? `Olá! Fiz o pedido #${o.code} no site da A Sua Drogaria e vou enviar o comprovante do Pix.`
    : `Olá! Fiz o pedido #${o.code} no site da A Sua Drogaria (${PAYMENT_LABELS[o.payment_method]}).`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={require("../../assets/images/brand/logo.png")} style={styles.logo} contentFit="contain" />
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.headerTitle}>A Sua Drogaria</Text>
          <Text style={styles.headerSub}>Pedido #{o.code}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={52} color={colors.success} />
          <Text style={styles.successTitle}>Pedido confirmado!</Text>
          <Text style={styles.successText}>A farmácia já recebeu seu pedido e vai prepará-lo. Acompanhe pelo resumo abaixo.</Text>
          <StatusBadge status={o.status} />
        </View>

        {isPix && (
          <View testID="pix-info-card" style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="qr-code-outline" size={20} color={colors.brandSecondary} />
              <Text style={styles.cardTitle}>Pague com Pix para finalizar</Text>
            </View>
            <Text style={styles.pixText}>
              Chave Pix ({config.data?.pix_name ?? "A Sua Drogaria"}) — valor {fmtBRL(o.total)}:
            </Text>
            <View style={styles.pixKeyRow}>
              <Text testID="pix-key-text" style={styles.pixKey} selectable>
                {pixKey || "Chave Pix não configurada — pague na entrega ou fale com a farmácia."}
              </Text>
              <Pressable testID="pix-copy-button" style={styles.copyBtn} onPress={copyPix}>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={15} color={colors.onBrandPrimary} />
                <Text style={styles.copyBtnText}>{copied ? "Copiada" : "Copiar"}</Text>
              </Pressable>
            </View>
            <Text style={styles.pixHelp}>
              Abra o app do seu banco → Pix → Pagar com chave → cole a chave acima. Depois envie o comprovante pelo
              WhatsApp {config.data?.phone ?? "21 97921-6950"}.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resumo do pedido</Text>
          {o.items.map((item) => (
            <View key={item.product_id} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.qty}×</Text>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.itemPrice}>{fmtBRL(item.price * item.qty)}</Text>
            </View>
          ))}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{fmtBRL(o.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxa de entrega</Text>
            <Text style={[styles.summaryValue, styles.freeText]}>{o.delivery_fee > 0 ? fmtBRL(o.delivery_fee) : "Grátis"}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{fmtBRL(o.total)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Ionicons name="cash-outline" size={15} color={colors.brandSecondary} />
              <Text style={styles.metaText}>{PAYMENT_LABELS[o.payment_method]}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Ionicons name="location-outline" size={15} color={colors.brandSecondary} />
              <Text style={styles.metaText}>
                {o.address} — {o.neighborhood}
                {o.complement ? ` (${o.complement})` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Ionicons name="time-outline" size={15} color={colors.brandSecondary} />
              <Text style={styles.metaText}>Feito em {fmtDateTime(o.created_at)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.helpText}>
          Entrega estimada em {config.data?.delivery_time ?? "30 a 60 minutos"} para {config.data?.city ?? "Duque de Caxias, RJ"}.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { bottom: insets.bottom + 12 }]}>
        <Pressable
          testID="order-whatsapp-button"
          style={({ pressed }) => [styles.whatsBtn, pressed && { opacity: 0.85 }]}
          onPress={() => Linking.openURL(`https://wa.me/55${(config.data?.phone ?? "21979216950").replace(/\D/g, "")}?text=${encodeURIComponent(whatsMsg)}`)}
        >
          <Ionicons name="logo-whatsapp" size={18} color={colors.onSuccess} />
          <Text style={styles.whatsBtnText}>{isPix ? "Enviar comprovante no WhatsApp" : "Falar com a farmácia"}</Text>
        </Pressable>
        <Pressable
          testID="order-back-home-button"
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.secondaryBtnText}>Voltar ao início</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  stateText: { color: colors.onSurfaceTertiary, fontSize: 14, textAlign: "center", fontFamily: FONTS.medium },
  header: {
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
  },
  logo: { width: 40, height: 40, borderRadius: 10 },
  headerTitle: { color: colors.onBrand, fontSize: 16, fontFamily: FONTS.extraBold },
  headerSub: { color: colors.onBrand, opacity: 0.8, fontSize: 12, fontFamily: FONTS.medium },
  successBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 8,
    padding: 20,
  },
  successTitle: { fontSize: 20, color: colors.onSurface, fontFamily: FONTS.extraBold },
  successText: { fontSize: 13, color: colors.onSurfaceTertiary, fontFamily: FONTS.medium, textAlign: "center" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 16, color: colors.onSurface, fontFamily: FONTS.extraBold },
  pixText: { fontSize: 13, color: colors.onSurfaceTertiary, fontFamily: FONTS.medium },
  pixKeyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    padding: 12,
  },
  pixKey: { flex: 1, fontSize: 15, color: colors.brandPrimary, fontFamily: FONTS.bold },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.brandPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
  },
  copyBtnText: { color: colors.onBrandPrimary, fontSize: 12, fontFamily: FONTS.bold },
  pixHelp: { fontSize: 12, color: colors.muted, fontFamily: FONTS.regular, lineHeight: 18 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  itemQty: { color: colors.brandSecondary, fontFamily: FONTS.bold, fontSize: 13, width: 28 },
  itemName: { flex: 1, color: colors.onSurface, fontSize: 13, fontFamily: FONTS.semiBold },
  itemPrice: { color: colors.onSurface, fontSize: 13, fontFamily: FONTS.semiBold },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  summaryLabel: { fontSize: 13, color: colors.onSurfaceTertiary, fontFamily: FONTS.medium },
  summaryValue: { fontSize: 13, color: colors.onSurface, fontFamily: FONTS.semiBold },
  freeText: { color: colors.success, fontFamily: FONTS.bold },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: 6, paddingTop: 8 },
  totalLabel: { fontSize: 15, color: colors.onSurface, fontFamily: FONTS.bold },
  totalValue: { fontSize: 18, color: colors.brandSecondary, fontFamily: FONTS.extraBold },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 8 },
  metaText: { flexShrink: 1, fontSize: 13, color: colors.onSurfaceSecondary, fontFamily: FONTS.medium },
  helpText: { fontSize: 12, color: colors.muted, fontFamily: FONTS.regular, textAlign: "center", lineHeight: 18 },
  footer: { position: "absolute", left: 16, right: 16, gap: 10 },
  whatsBtn: {
    backgroundColor: colors.success,
    borderRadius: 14,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  whatsBtnText: { color: colors.onSuccess, fontSize: 15, fontFamily: FONTS.bold },
  secondaryBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: colors.onBrandPrimary, fontSize: 14, fontFamily: FONTS.bold },
}));
