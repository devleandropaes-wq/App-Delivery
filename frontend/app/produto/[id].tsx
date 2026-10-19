import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { apiFetch, resolveImageUrl } from "@/src/api";
import { useCart } from "@/src/context/cart";
import { FONTS } from "@/src/fonts";
import { fmtBRL } from "@/src/format";
import { CATEGORIES, discountPercentOf, unitPriceOf, type Product } from "@/src/types";
import { makeStyles, useTheme } from "@/src/theme";

export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const cart = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const product = useQuery({
    queryKey: ["product", id],
    queryFn: () => apiFetch<Product>(`/products/${id}`),
  });

  if (product.isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandPrimary }} />
        <Text style={styles.stateText}>Carregando detalhes do medicamento...</Text>
      </View>
    );
  }

  if (product.isError || !product.data) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.error }} />
        <Text style={styles.stateText}>Erro ao carregar detalhes do produto.</Text>
      </View>
    );
  }

  const p = product.data;
  const discount = discountPercentOf(p);
  const unit = unitPriceOf(p);
  const soldOut = p.stock <= 0;
  const image = resolveImageUrl(p.image_url);
  const catLabel = CATEGORIES.find((c) => c.key === p.category)?.label ?? "Produto";

  const handleAdd = () => {
    cart.add(p, qty);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho com botão de voltar, título e Botão de Carrinho no topo */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="product-back-button"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => (router.canDismiss?.() ? router.back() : router.replace("/"))}
          hitSlop={8}
        >
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.onBrandPrimary }} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Detalhes do produto</Text>

        {/* Botão de Carrinho no Topo em tempo real */}
        <Pressable
          testID="header-cart-button"
          style={styles.headerCartPill}
          onPress={() => router.push("/carrinho")}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onBrandSecondary }} />
          <Text style={styles.headerCartText}>Carrinho</Text>
          {cart.count > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{cart.count}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        <View style={styles.imageBox}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={200} />
          ) : (
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandPrimary }} />
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.catPill}>
            <Text style={styles.catText}>{catLabel}</Text>
          </View>
          <Text style={styles.name}>{p.name}</Text>
          <View style={styles.priceRow}>
            <View style={{ flexShrink: 1 }}>
              {discount > 0 && <Text style={styles.priceOld}>{fmtBRL(p.price)}</Text>}
              <Text style={styles.price}>{fmtBRL(unit)}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>-{discount}% OFF</Text>
              </View>
            )}
          </View>
          <Text style={styles.stockText}>
            {soldOut ? "Produto esgotado no momento" : p.stock <= 5 ? `Últimas ${p.stock} unidades em estoque` : `${p.stock} unidades em estoque`}
          </Text>
          {p.description.length > 0 && (
            <View style={styles.descBox}>
              <Text style={styles.descTitle}>Descrição</Text>
              <Text style={styles.descText}>{p.description}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Rodapé fixo: quantidade + adicionar ao carrinho */}
      <View style={[styles.footer, { bottom: insets.bottom + 12 }]}>
        <View style={styles.stepper}>
          <Pressable testID="product-qty-minus" style={styles.stepBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
            <View style={{ width: 12, height: 4, borderRadius: 2, backgroundColor: colors.onBrandPrimary }} />
          </Pressable>
          <Text style={styles.stepQty}>{qty}</Text>
          <Pressable testID="product-qty-plus" style={styles.stepBtn} onPress={() => setQty((q) => Math.min(20, q + 1))}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.onBrandPrimary }} />
          </Pressable>
        </View>
        <Pressable
          testID="product-add-cart-button"
          disabled={soldOut}
          style={({ pressed }) => [styles.addCartBtn, soldOut && styles.addCartDisabled, pressed && { opacity: 0.85 }, added && styles.addCartSuccess]}
          onPress={handleAdd}
        >
          <Text style={styles.addCartText} numberOfLines={1}>
            {soldOut ? "Esgotado" : added ? "Adicionado ✓" : `Adicionar • ${fmtBRL(unit * qty)}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  stateText: { color: colors.onSurfaceTertiary, fontSize: 14, textAlign: "center", fontFamily: FONTS.medium },
  header: {
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  headerTitle: { flex: 1, color: colors.onBrand, fontSize: 16, fontFamily: FONTS.bold },
  headerCartPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandSecondary,
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 32,
    position: "relative",
  },
  headerCartText: {
    color: colors.onBrandSecondary,
    fontSize: 11,
    fontFamily: FONTS.bold,
  },
  headerBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  headerBadgeText: {
    color: colors.onError,
    fontSize: 9,
    fontFamily: FONTS.extraBold,
  },
  imageBox: {
    height: 240,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  content: { padding: 20, gap: 10 },
  catPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandTertiary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  catText: { color: colors.onBrandTertiary, fontSize: 12, fontFamily: FONTS.semiBold },
  name: { fontSize: 22, color: colors.onSurface, fontFamily: FONTS.extraBold },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  priceOld: { fontSize: 14, color: colors.muted, textDecorationLine: "line-through", fontFamily: FONTS.regular },
  price: { fontSize: 28, color: colors.brandSecondary, fontFamily: FONTS.extraBold },
  promoBadge: { backgroundColor: colors.brandSecondary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  promoBadgeText: { color: colors.onBrandSecondary, fontSize: 12, fontFamily: FONTS.bold },
  stockText: { color: colors.onSurfaceTertiary, fontSize: 13, fontFamily: FONTS.medium },
  descBox: { backgroundColor: colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6, marginTop: 4 },
  descTitle: { color: colors.onSurface, fontSize: 14, fontFamily: FONTS.bold },
  descText: { color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 20, fontFamily: FONTS.regular },
  footer: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.surfaceInverse,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  stepper: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandPrimary, borderRadius: 12, overflow: "hidden" },
  stepBtn: { width: 40, height: 48, alignItems: "center", justifyContent: "center" },
  stepQty: { width: 30, textAlign: "center", color: colors.onBrandPrimary, fontSize: 16, fontFamily: FONTS.bold },
  addCartBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  addCartDisabled: { backgroundColor: colors.surfaceTertiary },
  addCartSuccess: { backgroundColor: colors.success },
  addCartText: { color: colors.onBrandSecondary, fontSize: 15, fontFamily: FONTS.bold },
}));
