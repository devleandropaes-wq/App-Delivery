import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, resolveImageUrl } from "@/src/api";
import { useCart } from "@/src/context/cart";
import { FONTS } from "@/src/fonts";
import { fmtBRL } from "@/src/format";
import { type Order, type PaymentMethod, type StoreConfig } from "@/src/types";
import { makeStyles, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const PAYMENTS: { key: PaymentMethod; label: string; desc: string; icon: string }[] = [
  { key: "pix", label: "Pagar com Pix no site", desc: "Mostramos a chave Pix da farmácia na confirmação", icon: "qr-code-outline" },
  { key: "dinheiro", label: "Dinheiro na entrega", desc: "Pague em dinheiro ao receber o pedido", icon: "cash-outline" },
  { key: "cartao", label: "Máquina de cartão na entrega", desc: "Débito ou crédito na hora da entrega", icon: "card-outline" },
];

export default function CartCheckout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const cart = useCart();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [complement, setComplement] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const config = useQuery({ queryKey: ["config"], queryFn: () => apiFetch<StoreConfig>("/config") });

  // Pré-preenche com dados do último pedido
  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>("checkout_data", "");
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setName(data.customer_name ?? "");
          setPhone(data.customer_phone ?? "");
          setAddress(data.address ?? "");
          setNeighborhood(data.neighborhood ?? "");
          setComplement(data.complement ?? "");
        } catch {}
      }
    })();
  }, []);

  const createOrder = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<Order>("/orders", { method: "POST", body }),
    onSuccess: async (order) => {
      await storage.setItem(
        "checkout_data",
        JSON.stringify({
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          address: address.trim(),
          neighborhood: neighborhood.trim(),
          complement: complement.trim(),
        }),
      );
      cart.clear();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      router.replace(`/pedido/${order.code}`);
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const submit = () => {
    setFormError(null);
    const miss = new Set<string>();
    if (name.trim().length < 3) miss.add("name");
    if (phone.replace(/\D/g, "").length < 8) miss.add("phone");
    if (address.trim().length < 5) miss.add("address");
    if (neighborhood.trim().length < 2) miss.add("neighborhood");
    if (miss.size > 0) {
      setMissing(miss);
      setFormError("Preencha os campos destacados para concluir o pedido.");
      return;
    }
    setMissing(new Set());
    createOrder.mutate({
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      address: address.trim(),
      neighborhood: neighborhood.trim(),
      complement: complement.trim(),
      payment_method: payment,
      items: cart.items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
    });
  };

  if (cart.ready && cart.items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable testID="cart-back-button" style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.onBrandPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Carrinho</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={[styles.center, { paddingBottom: insets.bottom + 60 }]}>
          <Ionicons name="cart-outline" size={44} color={colors.borderStrong} />
          <Text style={styles.emptyTitle}>Seu carrinho está vazio</Text>
          <Text style={styles.emptyText}>Adicione itens da vitrine para prosseguir.</Text>
          <Pressable testID="cart-go-home" style={styles.homeBtn} onPress={() => router.replace("/")}>
            <Text style={styles.homeBtnText}>Ver produtos</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable testID="cart-back-button" style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.onBrandPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Finalizar pedido</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAwareScrollView bottomOffset={140} contentContainerStyle={{ paddingBottom: 180 }}>
        {/* Itens */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Seu carrinho ({cart.count} itens)</Text>
          {cart.items.map((item) => (
            <View key={item.product_id} style={styles.itemRow}>
              {item.image_url ? (
                <Image source={{ uri: resolveImageUrl(item.image_url) ?? "" }} style={styles.itemImage} contentFit="cover" />
              ) : (
                <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                  <Ionicons name="medkit-outline" size={18} color={colors.brandPrimary} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.itemPrice}>{fmtBRL(item.price)}</Text>
              </View>
              <View style={styles.itemActions}>
                <View style={styles.itemStepper}>
                  <Pressable
                    testID={`cart-item-minus-${item.product_id}`}
                    style={styles.itemStepBtn}
                    onPress={() => cart.setQty(item.product_id, item.qty - 1)}
                  >
                    <Ionicons name="remove" size={14} color={colors.onBrandPrimary} />
                  </Pressable>
                  <Text style={styles.itemStepQty}>{item.qty}</Text>
                  <Pressable
                    testID={`cart-item-plus-${item.product_id}`}
                    style={styles.itemStepBtn}
                    onPress={() => cart.setQty(item.product_id, item.qty + 1)}
                  >
                    <Ionicons name="add" size={14} color={colors.onBrandPrimary} />
                  </Pressable>
                </View>
                <Pressable
                  testID={`cart-item-remove-${item.product_id}`}
                  style={styles.itemRemove}
                  hitSlop={8}
                  onPress={() => cart.remove(item.product_id)}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {/* Dados de entrega */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Seus dados de entrega</Text>
          <Text style={styles.cardSub}>Entregamos em Duque de Caxias e região</Text>
          <FieldLabel>Nome completo *</FieldLabel>
          <TextInput
            testID="checkout-field-name"
            style={[styles.input, missing.has("name") && styles.inputError]}
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Maria Silva"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
          />
          <FieldLabel>Telefone / WhatsApp *</FieldLabel>
          <TextInput
            testID="checkout-field-phone"
            style={[styles.input, missing.has("phone") && styles.inputError]}
            value={phone}
            onChangeText={setPhone}
            placeholder="(21) 90000-0000"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
          />
          <FieldLabel>Rua e número *</FieldLabel>
          <TextInput
            testID="checkout-field-address"
            style={[styles.input, missing.has("address") && styles.inputError]}
            value={address}
            onChangeText={setAddress}
            placeholder="Ex.: Rua das Flores, 123"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
          />
          <FieldLabel>Bairro *</FieldLabel>
          <TextInput
            testID="checkout-field-neighborhood"
            style={[styles.input, missing.has("neighborhood") && styles.inputError]}
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="Ex.: Jardim Primavera"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
          />
          <FieldLabel>Complemento / Ponto de referência</FieldLabel>
          <TextInput
            testID="checkout-field-complement"
            style={styles.input}
            value={complement}
            onChangeText={setComplement}
            placeholder="Opcional — ex.: perto do mercado"
            placeholderTextColor={colors.muted}
            autoCapitalize="sentences"
          />
        </View>

        {/* Forma de pagamento */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Forma de pagamento</Text>
          {PAYMENTS.map((opt) => {
            const active = payment === opt.key;
            return (
              <Pressable
                key={opt.key}
                testID={`payment-${opt.key}`}
                style={[styles.paymentOption, active && styles.paymentOptionActive]}
                onPress={() => setPayment(opt.key)}
              >
                <View style={[styles.paymentIcon, active && { backgroundColor: colors.brandSecondary }]}>
                  <Ionicons name={opt.icon as any} size={20} color={active ? colors.onBrandSecondary : colors.brandPrimary} />
                </View>
                <View style={{ flex: 1, flexShrink: 1 }}>
                  <Text style={styles.paymentLabel}>{opt.label}</Text>
                  <Text style={styles.paymentDesc}>{opt.desc}</Text>
                </View>
                <Ionicons
                  name={active ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={active ? colors.brandSecondary : colors.borderStrong}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Resumo */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resumo do pedido</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{fmtBRL(cart.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxa de entrega</Text>
            <Text style={[styles.summaryValue, styles.freeText]}>Grátis</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{fmtBRL(cart.subtotal + (config.data?.delivery_fee ?? 0))}</Text>
          </View>
        </View>
      </KeyboardAwareScrollView>

      {formError && (
        <View testID="checkout-error" style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={colors.onError} />
          <Text style={styles.errorText}>{formError}</Text>
        </View>
      )}

      <KeyboardStickyView style={[styles.stickyWrap, { bottom: insets.bottom + 12 }]}>
        <Pressable
          testID="checkout-submit"
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
          onPress={submit}
          disabled={createOrder.isPending}
        >
          {createOrder.isPending ? (
            <Text style={styles.submitText}>Enviando pedido...</Text>
          ) : (
            <Text style={styles.submitText} numberOfLines={1}>
              Finalizar pedido • {fmtBRL(cart.subtotal + (config.data?.delivery_fee ?? 0))}
            </Text>
          )}
        </Pressable>
      </KeyboardStickyView>
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 14,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  headerTitle: { flex: 1, color: colors.onBrand, fontSize: 16, fontFamily: FONTS.bold, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyTitle: { fontSize: 18, color: colors.onSurface, fontFamily: FONTS.extraBold, marginTop: 8 },
  emptyText: { fontSize: 14, color: colors.onSurfaceTertiary, fontFamily: FONTS.medium, textAlign: "center" },
  homeBtn: {
    marginTop: 12,
    backgroundColor: colors.brandPrimary,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  homeBtnText: { color: colors.onBrandPrimary, fontFamily: FONTS.bold, fontSize: 14 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 16,
    gap: 6,
  },
  cardTitle: { fontSize: 16, color: colors.onSurface, fontFamily: FONTS.extraBold, marginBottom: 4 },
  cardSub: { fontSize: 12, color: colors.muted, fontFamily: FONTS.medium, marginBottom: 6 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemImage: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surfaceTertiary },
  itemImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  itemInfo: { flex: 1, flexShrink: 1, gap: 2 },
  itemName: { fontSize: 13, color: colors.onSurface, fontFamily: FONTS.semiBold },
  itemPrice: { fontSize: 13, color: colors.brandSecondary, fontFamily: FONTS.bold },
  itemActions: { alignItems: "flex-end", gap: 6 },
  itemStepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandPrimary,
    borderRadius: 8,
    overflow: "hidden",
  },
  itemStepBtn: { width: 28, height: 26, alignItems: "center", justifyContent: "center" },
  itemStepQty: { width: 24, textAlign: "center", color: colors.onBrandPrimary, fontSize: 13, fontFamily: FONTS.bold },
  itemRemove: { width: 30, height: 26, alignItems: "center", justifyContent: "center" },
  fieldLabel: { fontSize: 12, color: colors.onSurfaceTertiary, fontFamily: FONTS.semiBold, marginTop: 8 },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: colors.onSurface,
    fontFamily: FONTS.regular,
  },
  inputError: { borderColor: colors.error, borderWidth: 1.5 },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: 8,
  },
  paymentOptionActive: { borderColor: colors.brandSecondary, backgroundColor: colors.surface },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentLabel: { fontSize: 14, color: colors.onSurface, fontFamily: FONTS.bold },
  paymentDesc: { fontSize: 12, color: colors.onSurfaceTertiary, fontFamily: FONTS.regular },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  summaryLabel: { fontSize: 13, color: colors.onSurfaceTertiary, fontFamily: FONTS.medium },
  summaryValue: { fontSize: 13, color: colors.onSurface, fontFamily: FONTS.semiBold },
  freeText: { color: colors.success, fontFamily: FONTS.bold },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: 6, paddingTop: 10 },
  totalLabel: { fontSize: 15, color: colors.onSurface, fontFamily: FONTS.bold },
  totalValue: { fontSize: 18, color: colors.brandSecondary, fontFamily: FONTS.extraBold },
  errorBox: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 96,
    backgroundColor: colors.error,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
  },
  errorText: { color: colors.onError, fontSize: 13, fontFamily: FONTS.semiBold, flexShrink: 1 },
  stickyWrap: { position: "absolute", left: 16, right: 16 },
  submitBtn: {
    backgroundColor: colors.brandSecondary,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.surfaceInverse,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  submitText: { color: colors.onBrandSecondary, fontSize: 16, fontFamily: FONTS.extraBold },
}));
