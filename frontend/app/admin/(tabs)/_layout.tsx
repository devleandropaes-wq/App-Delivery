import { Ionicons } from "@expo/vector-icons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

import { useAdminToken } from "@/src/auth/admin";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function AdminTabsLayout() {
  const { token, ready } = useAdminToken();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();

  useEffect(() => {
    if (ready && !token) router.replace("/admin");
  }, [ready, token]);

  if (!ready || !token) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="pedidos">
          <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" />
          <NativeTabs.Trigger.Label>Pedidos</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="estoque">
          <NativeTabs.Trigger.Icon sf="shippingbox" />
          <NativeTabs.Trigger.Label>Estoque</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: Platform.OS === "web" ? { height: 64 } : {},
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen
        name="pedidos"
        options={{
          title: "Pedidos",
          tabBarIcon: ({ color }) => <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />,
        }}
      />
      <Tabs.Screen
        name="estoque"
        options={{
          title: "Estoque",
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const useStyles = makeStyles(() => ({
  gate: { flex: 1, alignItems: "center", justifyContent: "center" },
}));
