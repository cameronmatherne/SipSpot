import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, View } from "react-native";
import { useMemo } from "react";
import { useFonts, Poppins_700Bold } from "@expo-google-fonts/poppins";

import { useBusinesses } from "./data/useBusinesses";
import { useAuth } from "./data/useAuth";
import { useFavorites } from "./data/useFavorites";
import { AuthContext, FavoritesContext, ThemeProvider, useTheme } from "./contexts";
import ExploreScreen from "./screens/ExploreScreen";
import DealsScreen from "./screens/DealsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import type { Theme } from "./constants/theme";

const Tab = createBottomTabNavigator();

// ─────────────────────────────────────────────────────────────────────────────
// AppNavigator — inner component so it can consume the ThemeContext
// ─────────────────────────────────────────────────────────────────────────────

const makeStyles = (C: Theme) => StyleSheet.create({
  header: {
    backgroundColor: C.surface,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: C.textPri,
  },
  tabBar: {
    borderTopWidth: 0,
    backgroundColor: C.surface,
    height: 72,
    paddingBottom: 10,
    paddingTop: 8,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
});

function AppNavigator({ spotsWithDeals }: { spotsWithDeals: ReturnType<typeof useBusinesses>["businesses"] }) {
  const { C, mode } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <NavigationContainer>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Tab.Navigator
        initialRouteName="Deals"
        screenOptions={({ route }) => ({
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          tabBarActiveTintColor: C.accent,
          tabBarInactiveTintColor: C.textMuted,
          tabBarIcon: ({ color, size }) => {
            const iconName =
              route.name === "Explore"
                ? "map"
                : route.name === "Deals"
                  ? "pricetags"
                  : "person-circle";
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Explore">{() => <ExploreScreen spots={spotsWithDeals} />}</Tab.Screen>
        <Tab.Screen name="Deals">{() => <DealsScreen spots={spotsWithDeals} />}</Tab.Screen>
        <Tab.Screen name="Profile">{() => <ProfileScreen spots={spotsWithDeals} />}</Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// Renders the tab navigator and passes the live spot list down to each screen.
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [fontsLoaded] = useFonts({ Poppins_700Bold });
  const { businesses } = useBusinesses();
  const spotsWithDeals = businesses;

  // Auth and favorites are hoisted here so they're available app-wide via context.
  const auth = useAuth();
  const favorites = useFavorites(auth.user?.id ?? null);

  // Render nothing until the custom font is ready — avoids a flash of unstyled text
  if (!fontsLoaded) return <View style={{ flex: 1 }} />;

  return (
    <ThemeProvider>
      <AuthContext.Provider value={auth}>
        <FavoritesContext.Provider value={favorites}>
          <AppNavigator spotsWithDeals={spotsWithDeals} />
        </FavoritesContext.Provider>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}
