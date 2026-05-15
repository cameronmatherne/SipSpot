import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import type { Spot } from "../data/spots";
import type { MapSpot } from "../types/deals";
import MarkerDot from "../components/MarkerDot";
import { WEEKDAY_ORDER, isDealActive, isWindowActive, formatTime } from "../utils/time";
import { toTitleCase } from "../utils/text";
import { DARK_MAP_STYLE } from "../constants/map";
import { useTheme } from "../contexts";
import type { Theme } from "../constants/theme";

// ─────────────────────────────────────────────────────────────────────────────
// ExploreScreen (Map tab)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ExploreScreen — the "Explore" tab.
 *
 * On mount it requests foreground location permission and, if granted,
 * animates the map to the user's position. A "recenter" button in the
 * bottom-right corner re-animates back to their location at any time.
 *
 * Filter pills (All / Live Now) at the top toggle which markers are shown.
 * Tapping a marker opens a bottom card showing today's deals for that spot.
 *
 * Spots with coordinates 0,0 are excluded — they haven't been geocoded yet.
 * Add real lat/lng in the Supabase dashboard to make them appear.
 */

const makeStyles = (C: Theme) => StyleSheet.create({
  mapScreen: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapFilterRow: {
    position: "absolute",
    top: 14,
    left: 0,
    right: 0,
  },
  mapFilterRowContent: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  mapFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: `${C.surface}eb`,
    borderWidth: 1,
    borderColor: C.border,
  },
  mapFilterPillActive: {
    backgroundColor: C.accentDark,
    borderColor: C.accent,
  },
  mapFilterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSec,
  },
  mapFilterPillTextActive: {
    color: C.accent,
  },
  mapRecenterBtn: {
    position: "absolute",
    bottom: 20,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${C.surface}f2`,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  mapRecenterBtnRaised: {
    bottom: 296,
  },
  mapCard: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    maxHeight: 260,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
    padding: 16,
  },
  mapCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  mapCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: C.textPri,
    marginRight: 8,
  },
  mapCardBadgeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  mapCardBody: {
    flexShrink: 1,
  },
  mapCardSection: {
    marginBottom: 10,
  },
  mapCardSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textSec,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  mapCardTime: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSec,
    marginBottom: 2,
  },
  mapCardDealLine: {
    fontSize: 13,
    color: C.textPri,
    lineHeight: 19,
  },
  mapCardEmpty: {
    fontSize: 13,
    color: C.textMuted,
    fontStyle: "italic",
  },
  hhLiveBadge: {
    backgroundColor: C.greenBg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hhLiveBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.green,
    letterSpacing: 0.4,
  },
  hhNotLiveBadge: {
    backgroundColor: "rgba(248,113,113,0.12)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hhNotLiveBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.red,
    letterSpacing: 0.4,
  },
});

type MapFilter = "all" | "live";

function ExploreScreen({ spots }: { spots: Spot[] }) {
  const { C, mode } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const now = new Date();
  const today = WEEKDAY_ORDER[now.getDay()];
  const [selectedSpot, setSelectedSpot] = useState<MapSpot | null>(null);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationDenied(true);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 800);
    })();
  }, []);

  const recenterOnUser = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 500);
    }
  };

  const mapSpots: MapSpot[] = spots
    .filter((s) => s.location.latitude !== 0 || s.location.longitude !== 0)
    .map((spot) => {
      const hasActiveDailyDeal = spot.dailyDeals.some(
        (deal) => deal.day === today && isDealActive(deal, now),
      );
      const hasActiveHappyHour = spot.happyHours.some((w) => isWindowActive(w, now));
      const todayDeals = spot.dailyDeals.filter((deal) => deal.day === today);
      const todayHappyHours = spot.happyHours.filter((w) => w.days.includes(today));
      return { ...spot, hasActiveDailyDeal, hasActiveHappyHour, todayDeals, todayHappyHours };
    });

  const liveCount    = mapSpots.filter((s) => s.hasActiveDailyDeal || s.hasActiveHappyHour).length;
  const displaySpots = filter === "live"
    ? mapSpots.filter((s) => s.hasActiveDailyDeal || s.hasActiveHappyHour)
    : mapSpots;

  // Use dark map style in dark mode; empty array = default light map in light mode
  const mapStyle = mode === "dark" ? DARK_MAP_STYLE : [];

  return (
    <View style={styles.mapScreen}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ latitude: 30.2241, longitude: -92.0198, latitudeDelta: 0.07, longitudeDelta: 0.07 }}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={Platform.OS === "android" ? mapStyle : undefined}
        userInterfaceStyle={mode === "dark" ? "dark" : "light"}
        onPress={() => setSelectedSpot(null)}
      >
        {displaySpots.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={spot.location}
            tracksViewChanges={false}
            onPress={(e) => { e.stopPropagation(); setSelectedSpot(spot); }}
          >
            <MarkerDot
              live={spot.hasActiveDailyDeal || spot.hasActiveHappyHour}
              hasDeals={spot.todayDeals.length > 0 || spot.todayHappyHours.length > 0}
            />
          </Marker>
        ))}
      </MapView>

      <View style={styles.mapFilterRow}>
        <View style={styles.mapFilterRowContent}>
          {(
            [
              { key: "all",  label: "All",      count: mapSpots.length },
              { key: "live", label: "Live Now",  count: liveCount },
            ] as { key: MapFilter; label: string; count: number }[]
          ).map(({ key, label, count }) => (
            <Pressable
              key={key}
              style={[styles.mapFilterPill, filter === key && styles.mapFilterPillActive]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.mapFilterPillText, filter === key && styles.mapFilterPillTextActive]}>
                {label}  {count}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {userLocation && !locationDenied ? (
        <Pressable
          style={[styles.mapRecenterBtn, selectedSpot ? styles.mapRecenterBtnRaised : null]}
          onPress={recenterOnUser}
          hitSlop={8}
        >
          <Ionicons name="locate" size={20} color={C.accent} />
        </Pressable>
      ) : null}

      {selectedSpot ? (
        <View style={styles.mapCard}>
          <View style={styles.mapCardHeader}>
            <Text style={styles.mapCardTitle} numberOfLines={1}>{selectedSpot.name}</Text>
            <Pressable onPress={() => setSelectedSpot(null)} hitSlop={10}>
              <Ionicons name="close" size={20} color={C.textSec} />
            </Pressable>
          </View>
          <View style={styles.mapCardBadgeRow}>
            {selectedSpot.hasActiveDailyDeal ? (
              <View style={styles.hhLiveBadge}><Text style={styles.hhLiveBadgeText}>Deal Live</Text></View>
            ) : null}
            {selectedSpot.hasActiveHappyHour ? (
              <View style={styles.hhLiveBadge}><Text style={styles.hhLiveBadgeText}>Happy Hour Live</Text></View>
            ) : null}
            {!selectedSpot.hasActiveDailyDeal && !selectedSpot.hasActiveHappyHour ? (
              <View style={styles.hhNotLiveBadge}><Text style={styles.hhNotLiveBadgeText}>Not Live</Text></View>
            ) : null}
          </View>
          <ScrollView style={styles.mapCardBody} showsVerticalScrollIndicator={false}>
            {selectedSpot.todayDeals.length > 0 ? (
              <View style={styles.mapCardSection}>
                <Text style={styles.mapCardSectionTitle}>Daily Special</Text>
                {selectedSpot.todayDeals.map((deal, i) =>
                  deal.items.map((item, j) => (
                    <Text key={`d-${i}-${j}`} style={styles.mapCardDealLine}>{toTitleCase(item)}</Text>
                  )),
                )}
              </View>
            ) : null}
            {selectedSpot.todayHappyHours.length > 0 ? (
              <View style={styles.mapCardSection}>
                <Text style={styles.mapCardSectionTitle}>Happy Hour</Text>
                {selectedSpot.todayHappyHours.map((w, i) => (
                  <View key={i}>
                    <Text style={styles.mapCardTime}>{formatTime(w.start)}–{formatTime(w.end)}</Text>
                    {w.items.map((item, j) => (
                      <Text key={j} style={styles.mapCardDealLine}>{toTitleCase(item)}</Text>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
            {selectedSpot.todayDeals.length === 0 && selectedSpot.todayHappyHours.length === 0 ? (
              <Text style={styles.mapCardEmpty}>No deals today</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export default ExploreScreen;
