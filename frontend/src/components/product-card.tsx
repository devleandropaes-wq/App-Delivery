import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { resolveImageUrl } from "@/src/api";
import { useCart } from "@/src/context/cart";
import { FONTS } from "@/src/fonts";
import { fmtBRL } from "@/src/format";
import { CATEGORIES, discountPercentOf, unitPriceOf, type Product } from "@/src/types";
import { makeStyles, useTheme } from "@/src/theme";

export const ProductCard = memo(function ProductCard({ product }: { product: Product }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const cart = useCart();

  const discount = discountPercentOf(product);
  const unit = unitPriceOf(product);
  const soldOut = product.stock <= 0;
  const image = resolveImageUrl(product.image_url);
  const catLabel = CATEGORIES.find((c) => c.key === product.category)?.label ?? "Produto";

  return (
    <Pressable
      testID={`product-card-${product.id}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push(`/produto/${product.id}`)}
    >
      <View style={styles.imageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandPrimary }} />
          </View>
        )}
        {discount > 0 && !soldOut && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>-{discount}%</Text>
          </View>
        )}
        {soldOut && (
          <View style={styles.soldOutBadge}>
            <Text style={styles.soldOutText}>Esgotado</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.category}>{catLabel}</Text>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <View style={{ flexShrink: 1 }}>
            {discount > 0 && <Text style={styles.priceOld}>{fmtBRL(product.price)}</Text>}
            <Text style={styles.price}>{fmtBRL(unit)}</Text>
          </View>
          <Pressable
            testID={`product-add-${product.id}`}
            style={({ pressed }) => [
              styles.addBtn,
              soldOut && styles.addBtnDisabled,
              pressed && { opacity: 0.75 },
            ]}
            disabled={soldOut}
            onPress={() => cart.add(product, 1)}
            hitSlop={8}
          >
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: soldOut ? colors.muted : colors.onBrandPrimary }} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

const useStyles = makeStyles((colors) => ({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  imageWrap: {
    width: "100%",
    height: 110,
    backgroundColor: colors.surfaceTertiary,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  promoBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.brandSecondary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  promoBadgeText: {
    color: colors.onBrandSecondary,
    fontSize: 11,
    fontFamily: FONTS.bold,
  },
  soldOutBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: colors.surfaceInverse,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  soldOutText: {
    color: colors.onSurfaceInverse,
    fontSize: 11,
    fontFamily: FONTS.semiBold,
  },
  body: {
    padding: 10,
    gap: 2,
  },
  category: {
    fontSize: 11,
    color: colors.muted,
    fontFamily: FONTS.medium,
  },
  name: {
    fontSize: 13,
    color: colors.onSurface,
    fontFamily: FONTS.semiBold,
    minHeight: 34,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 4,
  },
  priceOld: {
    fontSize: 11,
    color: colors.muted,
    textDecorationLine: "line-through",
    fontFamily: FONTS.regular,
  },
  price: {
    fontSize: 15,
    color: colors.brandSecondary,
    fontFamily: FONTS.bold,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnDisabled: {
    backgroundColor: colors.surfaceTertiary,
  },
}));
