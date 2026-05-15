import { useContext, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DealsAndHappyHourItem } from "../types/deals";
import { AuthContext, FavoritesContext, useTheme } from "../contexts";
import { formatTime, isDealActive } from "../utils/time";
import { toTitleCase } from "../utils/text";
import type { Theme } from "../constants/theme";

// ─────────────────────────────────────────────────────────────────────────────
// DealsCard
// The main card component rendered for each spot in the Deals tab.
//
// Collapsed state: shows the spot name, first daily special (up to 3 items),
// and the happy hour header row. A "View full list" link appears when there
// is hidden content.
//
// Expanded state (toggled by the footer link): shows all deal windows and
// all happy hour windows with every item.
//
// The ⋯ menu (top-right) opens an alert with Edit / Delete actions.
//
// Props
//   item          – the enriched spot data for today
//   expanded      – whether the card is in its expanded state
//   isLiveSection – true when this card is in the "Live Now" section; used to
//                   show the Live / Not Live badge on the happy hour header
//   onToggleExpanded / onEdit / onDelete – callbacks into DealsScreen
// ─────────────────────────────────────────────────────────────────────────────

const makeStyles = (C: Theme) => StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
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
    color: C.textPri,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
    marginBottom: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSec,
  },
  ratingDot: {
    fontSize: 12,
    color: C.textMuted,
    marginHorizontal: 1,
  },
  cardBookmarkBtn: {
    padding: 4,
  },
  cardMenuBtn: {
    padding: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 10,
  },
  cardDealLine: {
    fontSize: 13,
    lineHeight: 18,
    color: C.textSec,
    marginBottom: 4,
  },
  cardMetaTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textPri,
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
    color: C.textSec,
  },
  cardMetaRightTextActive: {
    color: C.green,
  },
  cardHhToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardHhChevron: {
    marginTop: 1,
  },
  cardHhTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  cardMetaBlock: {
    marginBottom: 8,
  },
  cardBody: {},
  cardBodyCollapsed: {
    maxHeight: 300,
    overflow: "hidden",
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
    opacity: 0.7,
  },
  cardFooterLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.accent,
  },
});

function DealsCard({
  item,
  expanded,
  isLiveSection,
  onToggleExpanded,
  onEdit,
  onDelete,
  onReport,
}: {
  item: DealsAndHappyHourItem;
  expanded: boolean;
  isLiveSection: boolean;
  onToggleExpanded: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const { user, role } = useContext(AuthContext);
  const { favoriteIds, toggleFavorite } = useContext(FavoritesContext);
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const isSaved = favoriteIds.has(item.id);

  // Controls whether the happy hour items are visible. Starts expanded for
  // all cards so users immediately see both deal types.
  const [hhVisible, setHhVisible] = useState(true);

  // Max items shown per section before the "View full list" link appears.
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
  const hiddenTotalItemCount = hiddenDailyItemCount + (hhVisible ? hiddenHappyHourTotalItemCount : 0);

  const hasOverflow =
    hiddenDailyItemCount > 0 || (hhVisible && (hiddenHappyHourWindowCount > 0 || hiddenHappyHourItemCount > 0));

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          {(item.rating != null || item.priceLevel != null) ? (
            <View style={styles.ratingRow}>
              {item.rating != null ? (
                <>
                  <Ionicons name="star" size={11} color="#f59e0b" />
                  <Text style={styles.ratingText}>
                    {item.rating.toFixed(1)}
                    {item.reviewCount != null
                      ? ` (${item.reviewCount >= 1000
                          ? `${(item.reviewCount / 1000).toFixed(1)}k`
                          : item.reviewCount})`
                      : ""}
                  </Text>
                </>
              ) : null}
              {item.rating != null && item.priceLevel != null ? (
                <Text style={styles.ratingDot}>·</Text>
              ) : null}
              {item.priceLevel != null ? (
                <Text style={styles.ratingText}>{item.priceLevel}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
        {user ? (
          <Pressable
            onPress={() => toggleFavorite(item.id)}
            hitSlop={8}
            style={styles.cardBookmarkBtn}
            accessibilityLabel={isSaved ? "Remove from saved" : "Save spot"}
          >
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={18}
              color={isSaved ? C.accent : C.textSec}
            />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() =>
            Alert.alert(item.name, undefined, [
              ...(role === "admin" || role === "owner"
                ? [{ text: "Edit", onPress: onEdit }]
                : []),
              ...(role === "admin"
                ? [{ text: "Delete", style: "destructive" as const, onPress: onDelete }]
                : []),
              { text: "Report a Problem", onPress: onReport },
              { text: "Cancel", style: "cancel" },
            ])
          }
          hitSlop={8}
          style={styles.cardMenuBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={C.textSec} />
        </Pressable>
      </View>

      <View style={[styles.cardBody, !expanded && hasOverflow && styles.cardBodyCollapsed]} pointerEvents="box-none">
        {item.dailySpecials.length > 0 ? (
          <>
            <View style={styles.cardDivider} />
            {(expanded ? item.dailySpecials : collapsedDailySpecials).map((special, specialIndex) => {
              const timeLabel =
                special.start && special.end
                  ? `${formatTime(special.start)}-${formatTime(special.end)}`
                  : "All Day";

              const isSpecialActive = isDealActive(special, new Date());

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
                        {item.activeDailySpecial && item.dailySpecials.some((s) => s.start && s.end) ? " (Live)" : ""}
                      </Text>
                    ) : (
                      <View />
                    )}
                    <Text style={[styles.cardMetaRightText, isSpecialActive && styles.cardMetaRightTextActive]}>
                      {timeLabel}
                    </Text>
                  </View>
                  {specialItems.map((specialItem, index) => (
                    <Text
                      key={`deal-${item.id}-${item.day}-${specialIndex}-${index}`}
                      style={styles.cardDealLine}
                    >
                      {toTitleCase(specialItem)}
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
            <Pressable
              style={styles.cardMetaRow}
              onPress={() => setHhVisible((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={hhVisible ? "Hide happy hour" : "Show happy hour"}
            >
              <View style={styles.cardHhTitleRow}>
                <Text style={styles.cardMetaTitle}>Happy Hour</Text>
                {isLiveSection ? (
                  item.activeHappyHourWindow ? (
                    <View style={styles.hhLiveBadge}>
                      <Text style={styles.hhLiveBadgeText}>Live</Text>
                    </View>
                  ) : (
                    <View style={styles.hhNotLiveBadge}>
                      <Text style={styles.hhNotLiveBadgeText}>Not Live</Text>
                    </View>
                  )
                ) : null}
              </View>
              <View style={styles.cardHhToggleRow}>
                <Text style={[styles.cardMetaRightText, item.activeHappyHourWindow && styles.cardMetaRightTextActive]}>
                  {formatTime(item.happyHourWindows[0].start)}-{formatTime(item.happyHourWindows[0].end)}
                </Text>
                <Ionicons
                  name={hhVisible ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={C.textSec}
                  style={styles.cardHhChevron}
                />
              </View>
            </Pressable>
            {hhVisible
              ? (expanded ? item.happyHourWindows : collapsedHappyHourWindows).map((window, windowIndex) => {
                  const windowItems = expanded
                    ? window.items
                    : windowIndex === 0
                      ? collapsedHappyHourItems
                      : [];

                  return (
                    <View key={`hh-${window.start}-${window.end}`} style={styles.cardMetaBlock}>
                      {windowIndex > 0 ? (
                        <View style={styles.cardMetaRow}>
                          <View />
                          <Text style={styles.cardMetaRightText}>
                            {formatTime(window.start)}-{formatTime(window.end)}
                          </Text>
                        </View>
                      ) : null}
                      {windowItems.map((hhItem, index) => (
                        <Text
                          key={`hh-${item.id}-${window.start}-${index}`}
                          style={styles.cardDealLine}
                        >
                          {toTitleCase(hhItem)}
                        </Text>
                      ))}
                    </View>
                  );
                })
              : null}
          </>
        ) : null}

      </View>
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
            color={C.accent}
          />
          <Text style={styles.cardFooterLinkText}>
            {expanded
              ? "Show less"
              : `View full list${hiddenTotalItemCount > 0 ? ` • ${hiddenTotalItemCount} more item${hiddenTotalItemCount === 1 ? "" : "s"}` : ""}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default DealsCard;
