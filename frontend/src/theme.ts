// Design tokens for this app. Light theme only.
//
// The keys match the "color" block of /app/design_guidelines.json, filled with
// the brand palette of A Sua Drogaria: Azul Escuro (#0B2545), Vermelho Vivo
// (#D90429) e Branco (#F8FAFC).

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces: backgrounds, from the screen down to small fills.
  surface: "#F8FAFC", // primary canvas, most of every screen
  onSurface: "#0F172A", // text and icons on the canvas
  surfaceSecondary: "#FFFFFF", // cards, sheets, list rows
  onSurfaceSecondary: "#1E293B", // text and icons on cards, sheets, rows
  surfaceTertiary: "#F1F5F9", // input backgrounds, chips, deepest nesting
  onSurfaceTertiary: "#475569", // text on inputs and chips; also muted text
  surfaceInverse: "#0F172A", // tooltips, snackbars, anything popping against the theme
  onSurfaceInverse: "#F8FAFC", // text and icons on the inverse surface
  muted: "#64748B", // subdued text on surface: captions, timestamps, placeholders

  // Brand: the identity color and the fills built from it.
  brand: "#0B2545", // Azul Escuro — base hue, anchor
  onBrand: "#FFFFFF", // text and icons placed directly on brand
  brandPrimary: "#0B2545", // primary CTA, active tab indicator, selected states
  onBrandPrimary: "#FFFFFF", // text and icons on brandPrimary
  brandSecondary: "#D90429", // Vermelho Vivo — secondary CTA, promo accents
  onBrandSecondary: "#FFFFFF", // text and icons on brandSecondary
  brandTertiary: "#E2E8F0", // chips, tags, badges, subtle brand moments
  onBrandTertiary: "#0B2545", // text and icons on brandTertiary

  // Status: semantic only, never decorative.
  success: "#10B981",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  error: "#D90429",
  onError: "#FFFFFF",
  info: "#3B82F6",
  onInfo: "#FFFFFF",

  // Lines
  border: "#E2E8F0", // hairline outline, 0.5pt or 1pt max: inputs, cards
  borderStrong: "#CBD5E1", // focus rings, selected outlines, 1.5pt max
  divider: "#F1F5F9", // subtle list separators
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// In-app theme toggle, only after `dark` exists in `themes`.
export function setColorScheme(scheme: ColorScheme | null) {
  (Appearance.setColorScheme as ((v: string) => void) | undefined)?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme =
    system === "light" || system === "dark" ? (system as ColorScheme) : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
