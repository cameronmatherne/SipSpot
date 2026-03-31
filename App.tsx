import { useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import type { Spot, TimeWindow, Weekday } from "./data/spots";
import { useBusinesses } from "./data/useBusinesses";

const Tab = createBottomTabNavigator();

export default function App() {
  const { businesses } = useBusinesses();
  const spotsWithDeals = businesses;

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        initialRouteName="Deals"
        screenOptions={({ route }) => ({
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          tabBarActiveTintColor: "#1f6f78",
          tabBarInactiveTintColor: "#8a8f98",
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
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

type DealsAndHappyHourItem = Spot & {
  day: Weekday;
  dailySpecials: Spot["dailyDeals"];
  dailySpecialItems: string[];
  happyHourWindows: TimeWindow[];
  activeHappyHourWindow?: TimeWindow;
  activeDailySpecial: boolean;
};

type DealsAndHappyHourRow = {
  id: string;
  item: DealsAndHappyHourItem;
};

type DealsAndHappyHourSection = {
  key: "live" | "not_live";
  title: string;
  subtitle?: string;
  data: DealsAndHappyHourRow[];
};

function DealsCard({
  item,
  today,
  expanded,
  onToggleExpanded,
}: {
  item: DealsAndHappyHourItem;
  today: Weekday;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const isToday = item.day === today;
  const dayPillLabel = isToday ? "Today" : fullWeekdayLabel(item.day);

  const maxDealLines = 3;
  const maxHappyHourLines = 3;

  const collapsedDailySpecials = item.dailySpecials.slice(0, 1);
  const collapsedDailyItems = collapsedDailySpecials[0]?.items?.slice(0, maxDealLines) ?? [];
  const hiddenDailyItemCount = Math.max(0, item.dailySpecialItems.length - collapsedDailyItems.length);

  const collapsedHappyHourWindows = item.happyHourWindows.slice(0, 1);
  const hiddenHappyHourWindowCount = Math.max(
    0,
    item.happyHourWindows.length - collapsedHappyHourWindows.length,
  );

  const collapsedHappyHourItems = collapsedHappyHourWindows[0]?.items?.slice(0, maxHappyHourLines) ?? [];
  const hiddenHappyHourItemCount = Math.max(
    0,
    (collapsedHappyHourWindows[0]?.items?.length ?? 0) - collapsedHappyHourItems.length,
  );
  const hiddenHappyHourOtherWindowItemCount = item.happyHourWindows
    .slice(1)
    .reduce((sum, window) => sum + window.items.length, 0);
  const hiddenHappyHourTotalItemCount = hiddenHappyHourItemCount + hiddenHappyHourOtherWindowItemCount;
  const hiddenTotalItemCount = hiddenDailyItemCount + hiddenHappyHourTotalItemCount;

  const hasOverflow =
    hiddenDailyItemCount > 0 || hiddenHappyHourWindowCount > 0 || hiddenHappyHourItemCount > 0;

  return (
    <View style={[styles.card, !expanded && hasOverflow && styles.cardCollapsed]}>
      <View style={styles.cardRow}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.name}</Text>
        </View>
        <View style={styles.cardPill}>
          <Text style={styles.cardPillText}>{dayPillLabel}</Text>
        </View>
      </View>

      <View style={[styles.cardBody, !expanded && hasOverflow && styles.cardBodyCollapsed]}>
        {item.dailySpecials.length > 0 ? (
          <>
            <View style={styles.cardDivider} />
            {(expanded ? item.dailySpecials : collapsedDailySpecials).map((special, specialIndex) => {
              const timeLabel =
                special.start && special.end
                  ? `${formatTime(special.start)}-${formatTime(special.end)}`
                  : "All Day";

              const specialItems = expanded
                ? special.items
                : specialIndex === 0
                  ? collapsedDailyItems
                  : [];

              return (
                <View key={`daily-${item.id}-${specialIndex}`} style={styles.cardMetaBlock}>
                  <View style={styles.cardMetaRow}>
                    {specialIndex === 0 ? (
                      <Text style={styles.cardMetaTitle}>
                        {item.dailySpecials.length > 1 ? "Daily Specials" : "Daily Special"}
                        {item.activeDailySpecial ? " (Live)" : ""}
                      </Text>
                    ) : (
                      <View />
                    )}
                    <Text style={styles.cardMetaRightText}>{timeLabel}</Text>
                  </View>
                  {specialItems.map((specialItem, index) => (
                    <Text
                      key={`deal-${item.id}-${item.day}-${specialIndex}-${index}`}
                      style={styles.cardDealLine}
                      numberOfLines={expanded ? undefined : 1}
                      ellipsizeMode="tail"
                    >
                      {specialItem}
                    </Text>
                  ))}
                </View>
              );
            })}
          </>
        ) : null}

        {item.happyHourWindows.length > 0 ? (
          <>
            <View style={styles.cardDivider} />
            {(expanded ? item.happyHourWindows : collapsedHappyHourWindows).map((window, windowIndex) => {
              const isLive =
                Boolean(item.activeHappyHourWindow) &&
                window.start === item.activeHappyHourWindow?.start &&
                window.end === item.activeHappyHourWindow?.end;

              const windowItems = expanded
                ? window.items
                : windowIndex === 0
                  ? collapsedHappyHourItems
                  : [];

              return (
                <View key={`hh-${window.start}-${window.end}`} style={styles.cardMetaBlock}>
                  <View style={styles.cardMetaRow}>
                    {windowIndex === 0 ? (
                      <Text style={styles.cardMetaTitle}>
                        Happy Hour{item.activeHappyHourWindow ? " (Live)" : ""}
                      </Text>
                    ) : (
                      <View />
                    )}
                    <Text style={styles.cardMetaRightText}>
                      {formatTime(window.start)}-{formatTime(window.end)}
                    </Text>
                  </View>
                  {windowItems.map((hhItem, index) => (
                    <Text
                      key={`hh-${item.id}-${window.start}-${index}`}
                      style={styles.cardDealLine}
                      numberOfLines={expanded ? undefined : 1}
                      ellipsizeMode="tail"
                    >
                      {hhItem}
                    </Text>
                  ))}
                </View>
              );
            })}
          </>
        ) : null}

        {hasOverflow ? (
          <Pressable
            onPress={onToggleExpanded}
            style={({ pressed }) => [styles.cardFooterLink, pressed && styles.cardFooterLinkPressed]}
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Show less" : "View full list"}
          >
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color="#1f6f78"
            />
            <Text style={styles.cardFooterLinkText}>
              {expanded
                ? "Show less"
                : `View full list${hiddenTotalItemCount > 0 ? ` • ${hiddenTotalItemCount} more item${hiddenTotalItemCount === 1 ? "" : "s"}` : ""}`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function DealsScreen({ spots }: { spots: Spot[] }) {
  const [expandedSpotIds, setExpandedSpotIds] = useState<Set<string>>(() => new Set());
  const now = new Date();
  const today = WEEKDAY_ORDER[now.getDay()];

  const rows: DealsAndHappyHourRow[] = spots
    .map((spot) => {
      const dailySpecials = (spot.dailyDeals ?? [])
        .filter((deal) => deal.day === today)
        .map((deal) => deal);
      const dailySpecialItems = dailySpecials.flatMap((deal) => deal.items);
      const activeDailySpecial = dailySpecials.some((deal) => isDealActive(deal, now));

      const happyHourWindows = (spot.happyHours ?? []).filter((window) => window.days.includes(today));
      const activeHappyHourWindow = happyHourWindows.find((window) => isWindowActive(window, now));

      return {
        spot,
        dailySpecials,
        dailySpecialItems,
        activeDailySpecial,
        happyHourWindows,
        activeHappyHourWindow,
      };
    })
    .filter(({ dailySpecialItems, happyHourWindows }) => dailySpecialItems.length > 0 || happyHourWindows.length > 0)
    .sort((a, b) => {
      const aDealRank = a.dailySpecialItems.length > 0 ? 0 : 1;
      const bDealRank = b.dailySpecialItems.length > 0 ? 0 : 1;
      if (aDealRank !== bDealRank) return aDealRank - bDealRank;
      return a.spot.name.localeCompare(b.spot.name);
    })
    .map(({ spot, dailySpecials, dailySpecialItems, activeDailySpecial, happyHourWindows, activeHappyHourWindow }) => ({
      id: `${today}-${spot.id}`,
      item: {
        ...spot,
        day: today,
        dailySpecials,
        dailySpecialItems,
        activeDailySpecial,
        happyHourWindows,
        activeHappyHourWindow,
      },
    }));

  const liveRows = rows.filter((r) => Boolean(r.item.activeHappyHourWindow) || r.item.activeDailySpecial);
  const notLiveRows = rows.filter((r) => !(Boolean(r.item.activeHappyHourWindow) || r.item.activeDailySpecial));

  const sections: DealsAndHappyHourSection[] = [
    liveRows.length > 0
      ? {
          key: "live",
          title: "Live Now",
          data: liveRows,
        }
      : null,
    notLiveRows.length > 0
      ? {
          key: "not_live",
          title: "Not Live",
          data: notLiveRows,
        }
      : null,
  ].filter((s): s is DealsAndHappyHourSection => Boolean(s));

  const expandedLookup = useMemo(() => expandedSpotIds, [expandedSpotIds]);
  const toggleExpanded = (spotId: string) => {
    setExpandedSpotIds((prev) => {
      const next = new Set(prev);
      if (next.has(spotId)) next.delete(spotId);
      else next.add(spotId);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      {sections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No deals today</Text>
          <Text style={styles.emptySubtitle}>
            Check back later for today's specials and happy hours.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <DealsCard
              item={item.item}
              today={today}
              expanded={expandedLookup.has(item.item.id)}
              onToggleExpanded={() => toggleExpanded(item.item.id)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.subtitle ? (
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              ) : null}
            </View>
          )}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function ExploreScreen({ spots }: { spots: Spot[] }) {
  const now = new Date();
  const today = WEEKDAY_ORDER[now.getDay()];

  const mapSpots = spots.map((spot) => {
    const hasActiveDailyDeal = spot.dailyDeals.some((deal) => deal.day === today);
    const hasActiveHappyHour = spot.happyHours.some((window) => isWindowActive(window, now));
    return {
      ...spot,
      hasActiveDailyDeal,
      hasActiveHappyHour,
    };
  });

  const initialCenter = mapSpots[0]?.location ?? {
    latitude: 30.2241,
    longitude: -92.0198,
  };

  return (
    <View style={styles.mapScreen}>
      <MapView
        style={styles.map}
        initialRegion={{
          ...initialCenter,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {mapSpots.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={spot.location}
            title={spot.name}
            description={getMapMarkerDescription(spot.hasActiveDailyDeal, spot.hasActiveHappyHour)}
            pinColor={getMapMarkerColor(spot.hasActiveDailyDeal, spot.hasActiveHappyHour)}
          />
        ))}
      </MapView>
      <View style={styles.mapLegend}>
        <Text style={styles.mapLegendTitle}>Active Offers</Text>
        <Text style={styles.mapLegendText}>{mapSpots.length} spots on map</Text>
        <Text style={styles.mapLegendText}>Green: both active</Text>
        <Text style={styles.mapLegendText}>Blue: happy hour only</Text>
        <Text style={styles.mapLegendText}>Orange: daily deal only</Text>
        <Text style={styles.mapLegendText}>Gray: no active offer</Text>
      </View>
    </View>
  );
}

function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Save your favorite bars.</Text>
    </View>
  );
}

const WEEKDAY_ORDER: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const isWindowActive = (window: TimeWindow, now: Date) => {
  const dayLabel = WEEKDAY_ORDER[now.getDay()];
  if (!window.days.includes(dayLabel)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutes(window.start);
  const endMinutes = toMinutes(window.end);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

const isDealActive = (deal: Spot["dailyDeals"][number], now: Date) => {
  if (!deal.start || !deal.end) return true;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutes(deal.start);
  const endMinutes = toMinutes(deal.end);
  if (endMinutes >= startMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  // Cross-midnight window (e.g. 19:00-02:00)
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
};

const getNextWindow = (windows: TimeWindow[], now: Date) => {
  const currentDayIndex = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 7; offset += 1) {
    const dayIndex = (currentDayIndex + offset) % 7;
    const dayLabel = WEEKDAY_ORDER[dayIndex];

    for (const window of windows) {
      if (!window.days.includes(dayLabel)) continue;

      const startMinutes = toMinutes(window.start);
      if (offset === 0 && currentMinutes < startMinutes) {
        return { day: dayLabel, start: window.start };
      }

      if (offset > 0) {
        return { day: dayLabel, start: window.start };
      }
    }
  }

  return null;
};

const formatNextStartLabel = (day: Weekday, start: string) => {
  const nowDay = WEEKDAY_ORDER[new Date().getDay()];
  if (day === nowDay) return formatTime(start);
  return `${day} at ${formatTime(start)}`;
};

const joinDays = (days: Weekday[]) => {
  if (days.length === 7) return "Daily";

  const sorted = [...days].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
  );

  if (isWorkweek(sorted)) return "Mon-Fri";
  return sorted.join(", ");
};

const isWorkweek = (days: Weekday[]) => {
  const workweek: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return days.length === 5 && workweek.every((day) => days.includes(day));
};

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const formatTime = (value: string) => {
  const [rawHours, rawMinutes] = value.split(":").map(Number);
  const hours = rawHours % 12 === 0 ? 12 : rawHours % 12;
  const suffix = rawHours >= 12 ? "PM" : "AM";
  return `${hours}:${rawMinutes.toString().padStart(2, "0")} ${suffix}`;
};

const fullWeekdayLabel = (day: Weekday) => {
  const fullNames: Record<Weekday, string> = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  };
  return fullNames[day];
};

const getMapMarkerColor = (hasDaily: boolean, hasHappy: boolean) => {
  if (hasDaily && hasHappy) return "#1F7A37";
  if (hasHappy) return "#1F6F78";
  if (hasDaily) return "#B35C00";
  return "#8A8F98";
};

const getMapMarkerDescription = (hasDaily: boolean, hasHappy: boolean) => {
  if (hasDaily && hasHappy) return "Daily deal + happy hour active";
  if (hasHappy) return "Happy hour active";
  if (hasDaily) return "Daily deal active";
  return "No active offer";
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f5f2",
    paddingTop: 16,
  },
  header: {
    backgroundColor: "#ffffff",
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2933",
  },
  tabBar: {
    borderTopWidth: 0,
    backgroundColor: "#ffffff",
    height: 72,
    paddingBottom: 10,
    paddingTop: 8,
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1f2933",
  },
  subtitle: {
    fontSize: 14,
    color: "#52606d",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2933",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#52606d",
    textAlign: "center",
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2933",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6a7480",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  cardCollapsed: {
    maxHeight: 320,
    overflow: "hidden",
    position: "relative",
  },
  cardInactive: {
    opacity: 0.75,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2933",
    marginBottom: 2,
  },
  cardSoon: {
    fontSize: 12,
    fontWeight: "600",
    color: "#b35c00",
    marginTop: 6,
  },
  cardPill: {
    backgroundColor: "#e8f6ec",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cardPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1f7a37",
  },
  cardPillInactive: {
    backgroundColor: "#f1f1f1",
  },
  cardPillTextInactive: {
    color: "#5f6670",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#eef0f3",
    marginVertical: 10,
  },
  cardDealLine: {
    fontSize: 13,
    lineHeight: 18,
    color: "#324152",
    marginBottom: 4,
  },
  mapScreen: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapLegend: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "rgba(0,0,0,0.12)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  mapLegendTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2933",
    marginBottom: 4,
  },
  mapLegendText: {
    fontSize: 12,
    color: "#52606d",
  },
  cardMetaTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f2933",
    marginBottom: 0,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  cardMetaRightText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#52606d",
  },
  cardMetaBlock: {
    marginBottom: 8,
  },
  cardBody: {},
  cardBodyCollapsed: {
    paddingBottom: 0,
  },
  cardFooterLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
    paddingVertical: 6,
  },
  cardFooterLinkPressed: {
    opacity: 0.8,
  },
  cardFooterLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1f6f78",
  },
});
