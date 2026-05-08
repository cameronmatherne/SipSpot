import { useContext, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Spot } from "../data/spots";
import type { DealsAndHappyHourRow, DealsAndHappyHourSection } from "../types/deals";
import { AuthContext, FavoritesContext, useTheme } from "../contexts";
import DealsCard from "../components/DealsCard";
import AddSpotModal from "../modals/AddSpotModal";
import EditSpotModal from "../modals/EditSpotModal";
import ReportProblemModal from "../modals/ReportProblemModal";
import RequestSpotModal from "../modals/RequestSpotModal";
import { WEEKDAY_ORDER, isDealActive, isWindowActive, fullWeekdayLabel } from "../utils/time";
import { deleteSpot } from "../lib/api";
import type { Theme } from "../constants/theme";

// ─────────────────────────────────────────────────────────────────────────────
// DealsScreen
//
// The main "Deals" tab. Filters the full spot list down to spots that have
// either a daily deal or a happy hour window today, then splits them into two
// sections: "Live Now" (active right now) and "Not Live" (scheduled for later
// today or not currently active).
//
// State
//   expandedSpotIds – IDs of cards currently in their expanded state
//   showAddModal    – controls AddSpotModal visibility
//   editingSpot     – the spot currently open in EditSpotModal, or null
//   deletedIds      – optimistic local delete: hides spots immediately while
//                     the DELETE request is in flight; restored on failure
//   editedSpots     – optimistic local edit: overrides a spot's data after a
//                     successful PATCH so the list updates without re-fetching
// ─────────────────────────────────────────────────────────────────────────────

const makeStyles = (C: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: 16,
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
    color: C.textPri,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.textSec,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.accent,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.textPri,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: C.textSec,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.elevated,
    borderRadius: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.textPri,
    padding: 0,
  },
  noResultsState: {
    paddingTop: 40,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  filterModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  filterModalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  filterModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textPri,
    marginBottom: 16,
  },
  filterModalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  filterModalOptionText: {
    fontSize: 15,
    color: C.textPri,
  },
  filterModalOptionTextActive: {
    fontWeight: "700",
    color: C.accent,
  },
  liveEmptyText: {
    fontSize: 14,
    color: C.textSec,
    marginTop: 2,
    marginBottom: 8,
  },
});

function DealsScreen({ spots }: { spots: Spot[] }) {
  const { role } = useContext(AuthContext);
  const { favoriteIds } = useContext(FavoritesContext);
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const canEdit = role === "admin" || role === "owner";
  const [expandedSpotIds, setExpandedSpotIds] = useState<Set<string>>(() => new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);
  const [reportingSpot, setReportingSpot] = useState<Spot | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dealFilter, setDealFilter] = useState<"all" | "hh" | "specials" | "both">("all");
  const [filterIncludesFood, setFilterIncludesFood] = useState(false);
  // Spots removed optimistically while DELETE is in-flight; rolled back on error.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  // Spots patched optimistically after a successful PATCH response.
  const [editedSpots, setEditedSpots] = useState<Map<string, Spot>>(() => new Map());
  const now = new Date();
  const today = WEEKDAY_ORDER[now.getDay()];

  // Merge remote spots with local optimistic state before computing rows.
  const effectiveSpots = spots
    .filter((s) => !deletedIds.has(s.id))
    .map((s) => editedSpots.get(s.id) ?? s);

  const handleDelete = (spot: Spot) => {
    Alert.alert("Delete Spot", `Remove "${spot.name}" from the list?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletedIds((prev) => new Set([...prev, spot.id]));
          const err = await deleteSpot(spot.id);
          if (err) {
            setDeletedIds((prev) => { const next = new Set(prev); next.delete(spot.id); return next; });
            Alert.alert("Error", `Could not delete: ${err}`);
          }
        },
      },
    ]);
  };

  // Build the view-model rows: one row per spot that has something today.
  // Spots with no deals AND no HH windows today are filtered out entirely.
  // Sort priority (applied once before splitting into sections so the order is
  // preserved within both the Live and Not Live sections):
  //   1. Saved spots first
  //   2. Both HH + daily deal active → HH only active → daily deal only active → not live
  //   3. Alphabetical tiebreaker
  const rows: DealsAndHappyHourRow[] = effectiveSpots
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
      const aSaved = favoriteIds.has(a.spot.id) ? 0 : 1;
      const bSaved = favoriteIds.has(b.spot.id) ? 0 : 1;
      if (aSaved !== bSaved) return aSaved - bSaved;

      const activityRank = (hhActive: boolean, dailyActive: boolean) => {
        if (hhActive && dailyActive) return 0;
        if (hhActive) return 1;
        if (dailyActive) return 2;
        return 3;
      };
      const aRank = activityRank(Boolean(a.activeHappyHourWindow), a.activeDailySpecial);
      const bRank = activityRank(Boolean(b.activeHappyHourWindow), b.activeDailySpecial);
      if (aRank !== bRank) return aRank - bRank;

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

  const query = searchQuery.trim().toLowerCase();
  const filteredRows = query
    ? rows.filter((r) => r.item.name.toLowerCase().includes(query))
    : rows;

  const liveRows = filteredRows
    .filter((r) => Boolean(r.item.activeHappyHourWindow) || r.item.activeDailySpecial)
    .filter((r) => {
      if (dealFilter === "hh") return Boolean(r.item.activeHappyHourWindow);
      if (dealFilter === "specials") return r.item.activeDailySpecial;
      if (dealFilter === "both") return Boolean(r.item.activeHappyHourWindow) && r.item.activeDailySpecial;
      return true;
    })
    .filter((r) => !filterIncludesFood || Boolean(r.item.includesFood));
  const notLiveRows = filteredRows.filter((r) => !(Boolean(r.item.activeHappyHourWindow) || r.item.activeDailySpecial));

  const sections: DealsAndHappyHourSection[] = [
    {
      key: "live",
      title: `${fullWeekdayLabel(today)} Deals Live Now`,
      data: liveRows,
    },
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

  // Search bar rendered as part of the scrollable list so it scrolls out of
  // view when the user scrolls down. Keeping it inside ListHeaderComponent
  // (rather than a conditional outside the SectionList) means the TextInput
  // stays mounted even when the search query produces no results, preserving
  // keyboard focus so the user can keep editing their query.
  const filterOptions: { key: typeof dealFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "hh", label: "Happy Hour" },
    { key: "specials", label: "Specials" },
    { key: "both", label: "Both" },
  ];

  const searchHeader = (
    <View style={styles.searchRow}>
      <Ionicons name="search" size={16} color={C.textMuted} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search restaurants..."
        placeholderTextColor={C.textMuted}
        value={searchQuery}
        onChangeText={setSearchQuery}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
      />
      {searchQuery.length > 0 ? (
        <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={C.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      {showAddModal ? <AddSpotModal onClose={() => setShowAddModal(false)} /> : null}
      {editingSpot ? (
        <EditSpotModal
          spot={editingSpot}
          onClose={() => setEditingSpot(null)}
          onSaved={(updated) => {
            setEditedSpots((prev) => new Map(prev).set(updated.id, updated));
            setEditingSpot(null);
          }}
        />
      ) : null}
      {reportingSpot ? (
        <ReportProblemModal spot={reportingSpot} onClose={() => setReportingSpot(null)} />
      ) : null}
      {showRequestModal ? (
        <RequestSpotModal onClose={() => setShowRequestModal(false)} />
      ) : null}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <Pressable style={styles.filterModalOverlay} onPress={() => setShowFilterModal(false)}>
          <View style={styles.filterModalSheet}>
            <Text style={styles.filterModalTitle}>Filter</Text>
            {filterOptions.map(({ key, label }) => {
              const active = dealFilter === key;
              return (
                <Pressable
                  key={key}
                  style={styles.filterModalOption}
                  onPress={() => setDealFilter(key)}
                >
                  <Text style={[styles.filterModalOptionText, active && styles.filterModalOptionTextActive]}>
                    {label}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={18} color={C.accent} /> : null}
                </Pressable>
              );
            })}
            <View style={{ height: 1, backgroundColor: styles.filterModalOption.borderBottomColor, marginVertical: 8 }} />
            <Pressable
              style={[styles.filterModalOption, { borderBottomWidth: 0 }]}
              onPress={() => setFilterIncludesFood((v) => !v)}
            >
              <Text style={[styles.filterModalOptionText, filterIncludesFood && styles.filterModalOptionTextActive]}>
                Includes Food
              </Text>
              {filterIncludesFood ? <Ionicons name="checkmark" size={18} color={C.accent} /> : null}
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {rows.length === 0 ? (
        // No spots have deals today at all — no search bar needed.
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No deals today</Text>
          <Text style={styles.emptySubtitle}>
            Check back later for today's specials and happy hours.
          </Text>
          {canEdit ? (
            <Pressable style={styles.emptyAddBtn} onPress={() => setShowAddModal(true)}>
              <Ionicons name="add-circle-outline" size={20} color={C.accent} />
              <Text style={styles.emptyAddBtnText}>Add a Spot</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        // There are spots today. Always render the SectionList so the search
        // bar (ListHeaderComponent) stays mounted and keyboard focus is kept.
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={searchHeader}
          ListEmptyComponent={
            <View style={styles.noResultsState}>
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptySubtitle}>
                No restaurants match "{searchQuery}".
              </Text>
            </View>
          }
          renderItem={({ item, section }) => (
            <DealsCard
              item={item.item}
              expanded={expandedLookup.has(item.item.id)}
              isLiveSection={section.key === "live"}
              onToggleExpanded={() => toggleExpanded(item.item.id)}
              onEdit={() => setEditingSpot(item.item)}
              onDelete={() => handleDelete(item.item)}
              onReport={() => setReportingSpot(item.item)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.key === sections[0]?.key ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Pressable
                      onPress={() => setShowFilterModal(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Filter deals"
                      hitSlop={8}
                    >
                      <Ionicons
                        name="options-outline"
                        size={22}
                        color={dealFilter !== "all" || filterIncludesFood ? C.accent : C.textMuted}
                      />
                    </Pressable>
                    {canEdit ? (
                      <Pressable
                        onPress={() => setShowAddModal(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Add a new spot"
                        hitSlop={8}
                      >
                        <Ionicons name="add-circle-outline" size={26} color={C.accent} />
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => setShowRequestModal(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Request a new spot"
                        hitSlop={8}
                      >
                        <Ionicons name="add-circle-outline" size={26} color={C.accent} />
                      </Pressable>
                    )}
                  </View>
                ) : null}
              </View>
              {section.key === "live" && section.data.length === 0 ? (
                <Text style={styles.liveEmptyText}>
                  {dealFilter === "all" && !filterIncludesFood
                    ? "No deals currently active."
                    : "No deals currently active with selected filter."}
                </Text>
              ) : null}
              {section.subtitle ? (
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              ) : null}
            </View>
          )}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

export default DealsScreen;
