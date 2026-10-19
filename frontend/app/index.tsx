import { Image } from "expo-image";
import { Linking, Pressable, RefreshControl, ScrollView, SectionList, Text, TextInput, View } from "react-native";
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/src/api";
import { ProductCard } from "@/src/components/product-card";
import { useCart } from "@/src/context/cart";
import { useDebouncedValue } from "@/src/hooks/use-debounced-value";
import { FONTS } from "@/src/fonts";
import { fmtBRL } from "@/src/format";
import { CATEGORIES, type Product, type StoreConfig } from "@/src/types";
import { makeStyles, useTheme } from "@/src/theme";

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as string[];

function chunkRows(list: Product[], size = 2): Product[][] {
  const rows: Product[][] = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const cart = useCart();

  const [category, setCategory] = useState<string>("todos");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 300);

  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => apiFetch<StoreConfig>("/config"),
  });

  const products = useQuery({
    queryKey: ["products", category, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (category !== "todos") params.set("category", category);
      if (search) params.set("search", search);
      const qs = params.toString();
      return apiFetch<Product[]>(`/products${qs ? `?${qs}` : ""}`);
    },
  });

  const sections = useMemo(() => {
    const list = products.data ?? [];
    if (search) {
      return [{ key: "busca", label: `Resultados para “${search}”`, count: list.length, data: chunkRows(list) }];
    }
    if (category !== "todos") {
      const label = CATEGORIES.find((c) => c.key === category)?.label ?? "Produtos";
      return [{ key: category, label, count: list.length, data: chunkRows(list) }];
    }
    return CATEGORY_KEYS.map((key) => {
      const catProducts = list.filter((p) => p.category === key);
      const label = CATEGORIES.find((c) => c.key === key)?.label ?? key;
      return { key, label, count: catProducts.length, data: chunkRows(catProducts) };
    }).filter((s) => s.data.length > 0);
  }, [products.data, category, search]);

  const callStore = () => {
    const phone = config.data?.phone ?? "21 97921-6950";
    Linking.openURL(`tel:+55${phone.replace(/\D/g, "")}`).catch(() => {});
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho fixo: marca + telefone + botão de carrinho no topo + busca + categorias */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <Image source={require("../assets/images/brand/logo.png")} style={styles.logo} contentFit="contain" />
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>A Sua Drogaria</Text>
            <Text style={styles.brandSub}>
              {config.data ? `Delivery em ${config.data.city}` : "Delivery em Duque de Caxias, RJ"}
            </Text>
          </View>
          
          {/* Botão de Carrinho no Topo com contador em tempo real */}
          <PressableV
            testID="header-cart-button"
            style={styles.headerCartPill}
            onPress={() => router.push("/carrinho")}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onBrandPrimary }} />
            <Text style={styles.headerCartText}>Carrinho</Text>
            {cart.count > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{cart.count}</Text>
              </View>
            )}
          </PressableV>
        </View>

        <View style={styles.searchWrap}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.muted }} />
          <TextInput
            testID="search-input"
            style={styles.searchInput}
            placeholder="Buscar medicamentos e produtos..."
            placeholderTextColor={colors.muted}
            value={searchInput}
            onChangeText={setSearchInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchInput.length > 0 && (
            <PressableV testID="search-clear" onPress={() => setSearchInput("")} hitSlop={8}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.borderStrong }} />
            </PressableV>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          testID="category-chips"
          keyboardShouldPersistTaps="handled"
        >
          {[{ key: "todos", label: "Todos" }, ...CATEGORIES].map((chip) => {
            const active = category === chip.key;
            return (
              <PressableV
                key={chip.key}
                testID={`chip-${chip.key}`}
                onPress={() => setCategory(chip.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
              </PressableV>
            );
          })}
        </ScrollView>
      </View>

      {/* Vitrine agrupada por categorias */}
      {products.isLoading ? (
        <View style={styles.stateBox}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandPrimary }} />
          <Text style={styles.stateText}>Carregando produtos e ofertas...</Text>
        </View>
      ) : products.isError ? (
        <View style={styles.stateBox}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.error }} />
          <Text style={styles.stateText}>Não foi possível carregar o catálogo. Verifique sua conexão.</Text>
          <PressableV testID="catalog-retry" style={styles.retryBtn} onPress={() => products.refetch()}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </PressableV>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(_, index) => `row-${index}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.map((product: Product) => (
                <View key={product.id} style={styles.cell}>
                  <ProductCard product={product} />
                </View>
              ))}
              {item.length === 1 && <View style={styles.cell} />}
            </View>
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              <View style={styles.sectionCount}>
                <Text style={styles.sectionCountText}>{section.count} itens</Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          refreshControl={
            <RefreshControl
              refreshing={products.isRefetching}
              onRefresh={() => products.refetch()}
              tintColor={colors.brandPrimary}
              colors={[colors.brandPrimary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.stateBox}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.muted }} />
              <Text style={styles.stateText}>
                {search
                  ? `Nenhum produto encontrado para “${search}”.`
                  : "Nenhum produto encontrado nesta categoria."}
              </Text>
            </View>
          }
        />
      )}

      {/* Carrinho flutuante */}
      {cart.count > 0 && (
        <PressableV
          testID="cart-fab"
          style={[styles.cartFab, { bottom: insets.bottom + 16 }]}
          onPress={() => router.push("/carrinho")}
        >
          <View style={styles.cartFabIcon}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.onBrandPrimary }} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.cartFabCount}>
              {cart.count} {cart.count === 1 ? "item" : "itens"}
            </Text>
            <Text style={styles.cartFabTotal}>{fmtBRL(cart.subtotal)}</Text>
          </View>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.onBrandPrimary }} />
        </PressableV>
      )}
    </View>
  );
}

// Pressable estilizável reutilizável (evita inline styles)
function PressableV(props: any) {
  const { style, ...rest } = props;
  return <Pressable {...rest} style={typeof style === "function" ? style({ pressed: false }) : style} />;
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    backgroundColor: colors.brand,
    paddingBottom: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  brandBlock: {
    flex: 1,
    flexShrink: 1,
  },
  brandName: {
    color: colors.onBrand,
    fontSize: 18,
    fontFamily: FONTS.extraBold,
  },
  brandSub: {
    color: colors.onBrand,
    opacity: 0.8,
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.onSurface,
    fontFamily: FONTS.regular,
    paddingVertical: 0,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexShrink: 0,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.surfaceSecondary,
  },
  chipText: {
    color: colors.onBrand,
    fontSize: 13,
    fontFamily: FONTS.semiBold,
  },
  chipTextActive: {
    color: colors.brandPrimary,
    fontFamily: FONTS.bold,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  cell: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    color: colors.onSurface,
    fontFamily: FONTS.extraBold,
    flexShrink: 1,
  },
  sectionCount: {
    backgroundColor: colors.brandTertiary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionCountText: {
    color: colors.onBrandTertiary,
    fontSize: 11,
    fontFamily: FONTS.semiBold,
  },
  stateBox: {
    alignItems: "center",
    gap: 10,
    padding: 40,
  },
  stateText: {
    color: colors.onSurfaceTertiary,
    fontSize: 14,
    textAlign: "center",
    fontFamily: FONTS.medium,
  },
  retryBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: colors.onBrandPrimary,
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  cartFab: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: colors.brandPrimary,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    shadowColor: colors.surfaceInverse,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cartFabIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  cartFabCount: {
    color: colors.onBrandPrimary,
    fontSize: 12,
    fontFamily: FONTS.medium,
    opacity: 0.85,
  },
  cartFabTotal: {
    color: colors.onBrandPrimary,
    fontSize: 15,
    fontFamily: FONTS.extraBold,
  },
}));
