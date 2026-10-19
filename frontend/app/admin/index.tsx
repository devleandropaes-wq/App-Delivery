import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ADMIN_TOKEN_KEY, apiFetch } from "@/src/api";
import { useAdminToken } from "@/src/auth/admin";
import { FONTS } from "@/src/fonts";
import { storage } from "@/src/utils/storage";
import { makeStyles, useTheme } from "@/src/theme";

export default function AdminLogin() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { token, ready, setToken } = useAdminToken();

  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Já autenticado → vai direto para o painel
  useEffect(() => {
    if (ready && token) router.replace("/admin/pedidos");
  }, [ready, token]);

  const submit = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string }>("/admin/login", {
        method: "POST",
        body: { password },
      });
      await storage.secureSet(ADMIN_TOKEN_KEY, res.token);
      setToken(res.token);
      router.replace("/admin/pedidos");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.card}>
        <Image source={require("../../assets/images/brand/logo.png")} style={styles.logo} contentFit="contain" />
        <Text style={styles.title}>Painel da Farmácia</Text>
        <Text style={styles.subtitle}>Acesso restrito ao dono e funcionários</Text>

        <View style={styles.inputWrap}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.muted }} />
          <TextInput
            testID="admin-login-input"
            style={styles.input}
            placeholder="Senha de acesso"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={submit}
          />
          <Pressable testID="admin-login-visibility" onPress={() => setShow((s) => !s)} hitSlop={8}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.muted }} />
          </Pressable>
        </View>

        {error && (
          <View testID="admin-login-error" style={styles.errorBox}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onError }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          testID="admin-login-submit"
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
          onPress={submit}
          disabled={loading}
        >
          <Text style={styles.submitText}>{loading ? "Validando credenciais..." : "Entrar no painel"}</Text>
        </Pressable>

        <Pressable testID="admin-login-back-home" onPress={() => router.replace("/")} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Voltar para a loja</Text>
        </Pressable>
      </View>
      <Text style={styles.footerText}>A Sua Drogaria • Duque de Caxias, RJ</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 10,
    shadowColor: colors.surfaceInverse,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  logo: { width: 84, height: 84, borderRadius: 20 },
  title: { fontSize: 20, color: colors.onSurface, fontFamily: FONTS.extraBold, marginTop: 6 },
  subtitle: { fontSize: 13, color: colors.onSurfaceTertiary, fontFamily: FONTS.medium, marginBottom: 8 },
  inputWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  input: { flex: 1, fontSize: 15, color: colors.onSurface, fontFamily: FONTS.regular, paddingVertical: 0 },
  errorBox: {
    width: "100%",
    backgroundColor: colors.error,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
  },
  errorText: { color: colors.onError, fontSize: 13, fontFamily: FONTS.semiBold, flexShrink: 1 },
  submitBtn: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitText: { color: colors.onBrandSecondary, fontSize: 15, fontFamily: FONTS.extraBold },
  backLink: { height: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  backLinkText: { color: colors.brandPrimary, fontSize: 13, fontFamily: FONTS.semiBold },
  footerText: { color: colors.onBrand, opacity: 0.7, fontSize: 12, fontFamily: FONTS.medium, marginTop: 24 },
}));
