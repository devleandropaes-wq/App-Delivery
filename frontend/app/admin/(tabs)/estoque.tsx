import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, resolveImageUrl, uploadFile } from "@/src/api";
import { adminLogout, useAdminToken } from "@/src/auth/admin";
import { FONTS } from "@/src/fonts";
import { fmtBRL, parsePrice } from "@/src/format";
import { CATEGORIES, type ImportSummary, type Product } from "@/src/types";
import { makeStyles, useTheme } from "@/src/theme";

interface FormState {
  name: string;
  category: string;
  price: string;
  promo_price: string;
  stock: string;
  barcode: string;
  description: string;
  image_url: string | null;
}

const EMPTY_FORM: FormState = {
  name: "",
  category: "medicamentos",
  price: "",
  promo_price: "",
  stock: "0",
  barcode: "",
  description: "",
  image_url: null,
};

export default function AdminStock() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { token } = useAdminToken();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importBanner, setImportBanner] = useState<ImportSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [photoDenied, setPhotoDenied] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const products = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => apiFetch<Product[]>("/admin/products", { token }),
    enabled: !!token,
  });

  const filtered = useMemo(() => {
    const list = products.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q),
    );
  }, [products.data, search]);

  const saveProduct = useMutation({
    mutationFn: async ({ id, body }: { id: string | null; body: Record<string, unknown> }) =>
      id
        ? apiFetch<Product>(`/admin/products/${id}`, { method: "PUT", body, token })
        : apiFetch<Product>("/admin/products", { method: "POST", body, token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      closeForm();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/products/${id}`, { method: "DELETE", token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      closeForm();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const openForm = (product?: Product) => {
    setFormError(null);
    setConfirmDelete(false);
    if (product) {
      setEditingId(product.id);
      setForm({
        name: product.name,
        category: product.category,
        price: String(product.price),
        promo_price: product.promo_price != null ? String(product.promo_price) : "",
        stock: String(product.stock),
        barcode: product.barcode ?? "",
        description: product.description ?? "",
        image_url: product.image_url,
      });
    } else {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setPhotoDenied(false);
  };

  const submitForm = () => {
    setFormError(null);
    const price = parsePrice(form.price);
    if (form.name.trim().length < 2) return setFormError("Informe o nome do produto.");
    if (price == null) return setFormError("Informe um preço válido.");
    const promo = form.promo_price.trim() ? parsePrice(form.promo_price) : null;
    if (form.promo_price.trim() && promo == null) return setFormError("Preço promocional inválido.");
    if (promo != null && price > 0 && promo >= price) return setFormError("O preço promocional deve ser menor que o preço original.");
    const stock = parseInt(form.stock || "0", 10);
    if (Number.isNaN(stock) || stock < 0) return setFormError("Estoque inválido.");

    saveProduct.mutate({
      id: editingId,
      body: {
        name: form.name.trim(),
        category: form.category,
        price,
        promo_price: promo,
        stock,
        barcode: form.barcode.trim() || null,
        description: form.description.trim(),
        image_url: form.image_url,
      },
    });
  };

  const pickImportFile = async () => {
    if (importing) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "text/comma-separated-values",
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setImporting(true);
      setImportBanner(null);
      const summary = await uploadFile<ImportSummary>(
        "/admin/import",
        asset.uri,
        asset.name ?? "planilha.csv",
        asset.mimeType ?? "text/csv",
        token,
      );
      setImportBanner(summary);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (e) {
      setImportBanner({ error: e instanceof Error ? e.message : "Falha ao importar a planilha." });
    } finally {
      setImporting(false);
    }
  };

  const pickPhoto = async () => {
    if (uploadingPhoto) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPhotoDenied(true);
      return;
    }
    setPhotoDenied(false);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setUploadingPhoto(true);
    try {
      const result = await uploadFile<{ url: string }>(
        "/upload",
        asset.uri,
        asset.fileName ?? "foto.jpg",
        asset.mimeType ?? "image/jpeg",
        token,
      );
      setForm((f) => ({ ...f, image_url: result.url }));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Falha ao enviar a foto.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    router.replace("/admin");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.headerTitle}>Estoque</Text>
          <Text style={styles.headerSub}>{products.data?.length ?? 0} produtos no catálogo</Text>
        </View>
        <Pressable testID="admin-logout-estoque" style={styles.logoutBtn} onPress={handleLogout} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          gap: 10,
          paddingBottom: (usesNativeTabsFallback(insets) ? insets.bottom : 0) + 24,
        }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Pressable
              testID="estoque-import-button"
              style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.85 }]}
              onPress={pickImportFile}
              disabled={importing}
            >
              {importing ? (
                <ActivityIndicator size="small" color={colors.onBrandSecondary} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={18} color={colors.onBrandSecondary} />
              )}
              <Text style={styles.importBtnText}>
                {importing ? "Importando planilha..." : "Importar Planilha do Sistema (Excel/CSV)"}
              </Text>
            </Pressable>

            {importBanner && (
              <View testID="estoque-import-banner" style={[styles.banner, importBanner.error ? styles.bannerError : styles.bannerOk]}>
                <View style={{ flex: 1, flexShrink: 1 }}>
                  {importBanner.error ? (
                    <Text style={styles.bannerErrorText}>{importBanner.error}</Text>
                  ) : (
                    <Text style={styles.bannerOkText}>
                      Planilha importada: {importBanner.updated ?? 0} atualizados, {importBanner.created ?? 0} criados,{" "}
                      {importBanner.skipped ?? 0} ignorados.
                    </Text>
                  )}
                </View>
                <Pressable testID="estoque-import-banner-close" onPress={() => setImportBanner(null)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={importBanner.error ? colors.onError : colors.onSuccess} />
                </Pressable>
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={16} color={colors.muted} />
                <TextInput
                  testID="estoque-search-input"
                  style={styles.searchInput}
                  placeholder="Buscar por nome ou código de barras"
                  placeholderTextColor={colors.muted}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              <Pressable testID="estoque-new-product" style={styles.newBtn} onPress={() => openForm()}>
                <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable testID={`estoque-row-${item.id}`} style={styles.productRow} onPress={() => openForm(item)}>
            {item.image_url ? (
              <Image source={{ uri: resolveImageUrl(item.image_url) ?? "" }} style={styles.rowImage} contentFit="cover" />
            ) : (
              <View style={[styles.rowImage, styles.rowImagePlaceholder]}>
                <Ionicons name="medkit-outline" size={18} color={colors.brandPrimary} />
              </View>
            )}
            <View style={styles.rowInfo}>
              <Text style={styles.rowName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.rowMeta}>
                {CATEGORIES.find((c) => c.key === item.category)?.label ?? item.category}
                {item.barcode ? ` • ${item.barcode}` : ""}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                <Text style={styles.rowPrice}>{fmtBRL(item.promo_price ?? item.price)}</Text>
                {item.promo_price != null && item.promo_price < item.price && (
                  <Text style={styles.rowPriceOld}>{fmtBRL(item.price)}</Text>
                )}
                <View style={[styles.stockPill, item.stock <= 3 && { backgroundColor: colors.error }]}>
                  <Text style={[styles.stockPillText, item.stock <= 3 && { color: colors.onError }]}>
                    {item.stock} em estoque
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons name="create-outline" size={20} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          products.isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color={colors.brandPrimary} />
              <Text style={styles.stateText}>Carregando tabela de estoque...</Text>
            </View>
          ) : (
            <View style={styles.stateBox}>
              <Ionicons name="cube-outline" size={28} color={colors.muted} />
              <Text style={styles.stateText}>Nenhum produto cadastrado no estoque.</Text>
            </View>
          )
        }
      />

      {/* Formulário de produto */}
      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={closeForm}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? "Editar produto" : "Novo produto"}</Text>
              <Pressable testID="product-form-close" style={styles.modalClose} onPress={closeForm} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 10, padding: 16 }} keyboardShouldPersistTaps="handled">
              {/* Foto */}
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                {form.image_url ? (
                  <Image source={{ uri: resolveImageUrl(form.image_url) ?? "" }} style={styles.photoPreview} contentFit="cover" />
                ) : (
                  <View style={[styles.photoPreview, styles.photoPlaceholder]}>
                    <Ionicons name="image-outline" size={26} color={colors.muted} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 8 }}>
                  <Pressable testID="product-photo-pick-button" style={styles.photoBtn} onPress={pickPhoto} disabled={uploadingPhoto}>
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color={colors.onBrandPrimary} />
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={16} color={colors.onBrandPrimary} />
                        <Text style={styles.photoBtnText}>{uploadingPhoto ? "Enviando foto..." : "Escolher foto da galeria"}</Text>
                      </>
                    )}
                  </Pressable>
                  {photoDenied && (
                    <View style={styles.deniedBox}>
                      <Text style={styles.deniedText}>Permissão da galeria negada.</Text>
                      <Pressable testID="product-photo-open-settings" onPress={() => Linking.openSettings()}>
                        <Text style={styles.deniedBtn}>Abrir Configurações</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.fieldLabel}>Nome do produto *</Text>
              <TextInput
                testID="product-form-name"
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Ex.: Dipirona 500mg 20 comprimidos"
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.fieldLabel}>Categoria *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CATEGORIES.map((cat) => {
                  const active = form.category === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      testID={`category-chip-${cat.key}`}
                      onPress={() => setForm((f) => ({ ...f, category: cat.key }))}
                      style={[styles.catChip, active && styles.catChipActive]}
                    >
                      <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{cat.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Preço original (R$) *</Text>
                  <TextInput
                    testID="product-form-price"
                    style={styles.input}
                    value={form.price}
                    onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                    placeholder="9,90"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Preço promocional (R$)</Text>
                  <TextInput
                    testID="product-form-promo"
                    style={styles.input}
                    value={form.promo_price}
                    onChangeText={(v) => setForm((f) => ({ ...f, promo_price: v }))}
                    placeholder="Opcional"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Quantidade em estoque *</Text>
                  <TextInput
                    testID="product-form-stock"
                    style={styles.input}
                    value={form.stock}
                    onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Código de barras</Text>
                  <TextInput
                    testID="product-form-barcode"
                    style={styles.input}
                    value={form.barcode}
                    onChangeText={(v) => setForm((f) => ({ ...f, barcode: v }))}
                    placeholder="Opcional"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput
                testID="product-form-description"
                style={[styles.input, styles.textArea]}
                value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                placeholder="Descrição do produto, modo de uso..."
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
              />

              {formError && (
                <View testID="product-form-error" style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={15} color={colors.onError} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

              {editingId && (
                <Pressable
                  testID="product-delete-button"
                  style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    if (confirmDelete) deleteProduct.mutate(editingId);
                    else setConfirmDelete(true);
                  }}
                  disabled={deleteProduct.isPending}
                >
                  <Text style={styles.deleteBtnText}>
                    {deleteProduct.isPending
                      ? "Excluindo..."
                      : confirmDelete
                        ? "Toque novamente para confirmar a exclusão"
                        : "Excluir produto do catálogo"}
                  </Text>
                </Pressable>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                testID="product-save-button"
                style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
                onPress={submitForm}
                disabled={saveProduct.isPending}
              >
                <Text style={styles.saveBtnText}>
                  {saveProduct.isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar produto"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function usesNativeTabsFallback(_insets: { bottom: number }): boolean {
  // Placeholder para manter clareza: no web/JS Tabs a barra fica fora da viewport.
  return false;
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
  headerSub: { color: colors.onBrand, opacity: 0.8, fontSize: 12, fontFamily: FONTS.medium, marginTop: 2 },
  logoutBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)" },
  importBtn: {
    backgroundColor: colors.brandSecondary,
    borderRadius: 12,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  importBtnText: { color: colors.onBrandSecondary, fontSize: 13, fontFamily: FONTS.bold, flexShrink: 1 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1.5, padding: 10 },
  bannerOk: { borderColor: colors.success, backgroundColor: colors.surfaceSecondary },
  bannerError: { borderColor: colors.error, backgroundColor: colors.surfaceSecondary },
  bannerOkText: { color: colors.success, fontSize: 12, fontFamily: FONTS.semiBold },
  bannerErrorText: { color: colors.error, fontSize: 12, fontFamily: FONTS.semiBold },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.onSurface, fontFamily: FONTS.regular, paddingVertical: 0 },
  newBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  rowImage: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.surfaceTertiary },
  rowImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, flexShrink: 1, gap: 2 },
  rowName: { color: colors.onSurface, fontSize: 13, fontFamily: FONTS.semiBold },
  rowMeta: { color: colors.onSurfaceTertiary, fontSize: 11, fontFamily: FONTS.medium },
  rowPrice: { color: colors.brandSecondary, fontSize: 14, fontFamily: FONTS.extraBold },
  rowPriceOld: { color: colors.muted, fontSize: 11, textDecorationLine: "line-through", fontFamily: FONTS.regular },
  stockPill: { backgroundColor: colors.brandTertiary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  stockPillText: { color: colors.onBrandTertiary, fontSize: 10, fontFamily: FONTS.bold },
  stateBox: { alignItems: "center", gap: 10, padding: 32 },
  stateText: { color: colors.onSurfaceTertiary, fontSize: 13, fontFamily: FONTS.medium, textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.divider },
  modalTitle: { color: colors.onSurface, fontSize: 18, fontFamily: FONTS.extraBold },
  modalClose: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  photoPreview: { width: 92, height: 92, borderRadius: 14, backgroundColor: colors.surfaceTertiary },
  photoPlaceholder: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandPrimary,
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 12,
  },
  photoBtnText: { color: colors.onBrandPrimary, fontSize: 12, fontFamily: FONTS.bold },
  deniedBox: { flexDirection: "row", alignItems: "center", gap: 8 },
  deniedText: { color: colors.error, fontSize: 12, fontFamily: FONTS.semiBold, flexShrink: 1 },
  deniedBtn: { color: colors.info, fontSize: 12, fontFamily: FONTS.bold, textDecorationLine: "underline" },
  fieldLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontFamily: FONTS.semiBold },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: colors.onSurface,
    fontFamily: FONTS.regular,
  },
  textArea: { height: 84, paddingTop: 10 },
  catChip: {
    flexShrink: 0,
    height: 36,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  catChipActive: { borderColor: colors.brandSecondary, backgroundColor: colors.surfaceSecondary },
  catChipText: { color: colors.onSurfaceTertiary, fontSize: 12, fontFamily: FONTS.semiBold },
  catChipTextActive: { color: colors.brandSecondary, fontFamily: FONTS.bold },
  errorBox: { backgroundColor: colors.error, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 6, padding: 10 },
  errorText: { color: colors.onError, fontSize: 12, fontFamily: FONTS.semiBold, flexShrink: 1 },
  deleteBtn: { height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  deleteBtnText: { color: colors.error, fontSize: 12, fontFamily: FONTS.bold, textAlign: "center" },
  modalFooter: { padding: 16, paddingTop: 8 },
  saveBtn: {
    backgroundColor: colors.brandSecondary,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { color: colors.onBrandSecondary, fontSize: 15, fontFamily: FONTS.extraBold },
}));
