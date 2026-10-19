import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/src/api";
import { FONTS } from "@/src/fonts";
import { fmtBRL } from "@/src/format";
import { useCart } from "@/src/cart"; // Importante para ler os itens do carrinho em tempo real
import { type Product } from "@/src/types";
import { makeStyles, useTheme } from "@/src/theme";

export default function StoreHome() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const { items } = useCart();
  const totalItems = useMemo(() => items.reduce((acc, i) => acc + i.qty, 0), [items]);

  const [search, setSearch] = useState("");

  const products = useQuery({
    queryKey: ["store-products"],
    queryFn: () => apiFetch<Product[]>("/products"),
  });

  const filtered = useMemo(() => {
    if (!products.data) return [];
    if (!search.trim()) return products.data;
    const q = search.toLowerCase();
    return products.data.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products.data, search]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Cabeçalho com o nome e o Botão do Carrinho em tempo real */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>A Sua Drogaria</Text>
          <Text style={styles.headerSubtitle}>Entrega rápida em Duque de Caxias, RJ</Text>
        </View>

        <Pressable 
          testID="header-cart-button" 
          style={({ pressed }) => [styles.cartButton, pressed && { opacity: 0.85 }]} 
          onPress={() => router.push("/carrinho")}
        >
          <View style={styles.cartDot} />
          <Text style={styles.cartButtonText}>Carrinho</Text>
          {totalItems > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalItems}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Barra de Pesquisa */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar remédios, perfumaria..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Lista de Produtos */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <Pressable 
            style={styles.productCard}
            onPress={() => router.push(`/produto/${item.id}`)}
          >
            <Image source={{ uri: item.image_url }} style={styles.productImage} contentFit="cover" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.productPrice}>{fmtBRL(item.price)}</Text>
            </View>
          </Pressable>
        )}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { color: colors.onBrand, fontSize: 18, fontFamily: FONTS.extraBold },
  headerSubtitle: { color: colors.onBrand, opacity: 0.8, fontSize: 11, fontFamily: FONTS.medium },
  cartButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    position: "relative",
  },
  cartDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.onBrandSecondary },
  cartButtonText: { color: colors.onBrandSecondary, fontSize: 13, fontFamily: FONTS.bold },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
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
  cartBadgeText: { color: colors.onError, fontSize: 9, fontFamily: FONTS.extraBold },
  searchContainer: { padding: 16, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, height: 40, fontSize: 14, color: colors.onSurface, fontFamily: FONTS.regular, borderWidth: 1, borderColor: colors.border },
  productCard: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 10, gap: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  productImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: colors.surfaceTertiary },
  productName: { color: colors.onSurface, fontSize: 14, fontFamily: FONTS.semiBold },
  productPrice: { color: colors.brandSecondary, fontSize: 15, fontFamily: FONTS.extraBold },
}));
