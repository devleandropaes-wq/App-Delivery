import { Platform } from "react-native";

// iOS 26+ renders NativeTabs (liquid glass); older iOS, Android and web use
// the classic JS Tabs. Define the gate once, import everywhere.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
