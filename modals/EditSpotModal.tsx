import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Spot, Weekday } from "../data/spots";
import DayChips from "../components/DayChips";
import { patchSpot } from "../lib/api";
import { useTheme } from "../contexts";
import type { Theme } from "../constants/theme";

// Internal editable representations — items are stored as a single newline-
// separated string so they fit naturally into a multiline TextInput, then
// split back into arrays on save.
type EditableHappyHour = { days: Weekday[]; start: string; end: string; items: string };
type EditableDeal = { day: Weekday; allDay: boolean; start: string; end: string; items: string };

/**
 * EditSpotModal — bottom-sheet modal for editing a spot's name, happy hours,
 * and daily deals. Opens when the user taps "Edit" from the ⋯ menu on a card.
 *
 * On save it calls patchSpot() then fires onSaved() with the updated Spot
 * so DealsScreen can optimistically update the list without re-fetching.
 */

const makeStyles = (C: Theme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.textPri,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.textPri,
    backgroundColor: C.elevated,
  },
  modalError: {
    fontSize: 13,
    color: C.red,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textSec,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: "center",
  },
  modalSubmitBtnDisabled: {
    backgroundColor: C.accentDark,
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.bg,
  },
  // Edit modal specific
  editSheetWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  editSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  editSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  editScrollView: {
    flexGrow: 0,
  },
  editSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  editBlock: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 10,
    backgroundColor: C.elevated,
  },
  editBlockHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editBlockLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSec,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeInput: {
    flex: 1,
    textAlign: "center",
  },
  timeSeparator: {
    fontSize: 16,
    color: C.textMuted,
  },
  itemsInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  addRowBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.accent,
  },
  dealTimingToggle: {
    flexDirection: "row",
    backgroundColor: C.elevated,
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  dealTimingOption: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dealTimingOptionActive: {
    backgroundColor: C.surface,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  dealTimingOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: C.textSec,
  },
  dealTimingOptionTextActive: {
    color: C.textPri,
    fontWeight: "600",
  },
  foodToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.elevated,
    marginBottom: 24,
  },
  foodToggleLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textPri,
  },
});

function EditSpotModal({ spot, onClose, onSaved }: { spot: Spot; onClose: () => void; onSaved: (updated: Spot) => void }) {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [name, setName] = useState(spot.name);
  const [includesFood, setIncludesFood] = useState(spot.includesFood ?? false);
  const [happyHours, setHappyHours] = useState<EditableHappyHour[]>(() =>
    spot.happyHours.map((h) => ({ days: [...h.days], start: h.start, end: h.end, items: h.items.join("\n") })),
  );
  const [dailyDeals, setDailyDeals] = useState<EditableDeal[]>(() =>
    spot.dailyDeals.map((d) => ({
      day: d.day,
      allDay: !d.start || !d.end,
      start: d.start ?? "",
      end: d.end ?? "",
      items: d.items.join("\n"),
    })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateHH = (i: number, patch: Partial<EditableHappyHour>) =>
    setHappyHours((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));

  const updateDeal = (i: number, patch: Partial<EditableDeal>) =>
    setDailyDeals((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const cleanUpFormatting = () => {
    const normalize = (s: string) =>
      s.split(/,|\n/).map((t) => t.trim()).filter(Boolean).join("\n");
    setHappyHours((prev) => prev.map((h) => ({ ...h, items: normalize(h.items) })));
    setDailyDeals((prev) => prev.map((d) => ({ ...d, items: normalize(d.items) })));
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setLoading(true);
    setError(null);

    const happy_hours = happyHours
      .filter((h) => h.days.length > 0)
      .map((h) => ({
        days: h.days,
        start: h.start,
        end: h.end,
        items: h.items.split("\n").map((s) => s.trim()).filter(Boolean),
      }));

    const daily_deals = dailyDeals
      .filter((d) => d.day)
      .map((d) => ({
        day: d.day,
        ...(d.allDay ? {} : { start: d.start, end: d.end }),
        items: d.items.split("\n").map((s) => s.trim()).filter(Boolean),
      }));

    const err = await patchSpot(spot.id, {
      name: trimmedName,
      happy_hours,
      daily_deals,
      includes_food: includesFood,
    });

    if (err) {
      setError(err);
      setLoading(false);
      return;
    }

    onSaved({ ...spot, name: trimmedName, happyHours: happy_hours as Spot["happyHours"], dailyDeals: daily_deals as Spot["dailyDeals"], includesFood });
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.editSheetWrapper}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.editSheet}>
            {/* Header */}
            <View style={styles.editSheetHeader}>
              <Text style={styles.modalTitle}>Edit Spot</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={C.textSec} />
              </Pressable>
            </View>

            <ScrollView style={styles.editScrollView} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Name */}
              <Text style={styles.editSectionLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                value={name}
                onChangeText={setName}
                placeholder="Spot name"
                placeholderTextColor={C.textMuted}
              />

              {/* Includes Food */}
              <Pressable
                style={[styles.foodToggleRow, { marginTop: 16 }]}
                onPress={() => setIncludesFood((v) => !v)}
              >
                <Text style={styles.foodToggleLabel}>Includes Food</Text>
                <Ionicons
                  name={includesFood ? "checkbox" : "square-outline"}
                  size={22}
                  color={includesFood ? C.accent : C.textMuted}
                />
              </Pressable>

              {/* Happy Hours */}
              {happyHours.length > 0 ? (
                <>
                  <Text style={[styles.editSectionLabel, { marginTop: 20 }]}>Happy Hours</Text>
                  {happyHours.map((h, i) => (
                    <View key={i} style={styles.editBlock}>
                      <View style={styles.editBlockHeaderRow}>
                        <Text style={styles.editBlockLabel}>Window {i + 1}</Text>
                        <Pressable onPress={() => setHappyHours((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={8}>
                          <Ionicons name="trash-outline" size={16} color="#c0392b" />
                        </Pressable>
                      </View>
                      <DayChips multi selected={h.days} onChange={(days) => updateHH(i, { days })} />
                      <View style={styles.timeRow}>
                        <TextInput
                          style={[styles.modalInput, styles.timeInput]}
                          value={h.start}
                          onChangeText={(v) => updateHH(i, { start: v })}
                          placeholder="16:00"
                          placeholderTextColor={C.textMuted}
                        />
                        <Text style={styles.timeSeparator}>–</Text>
                        <TextInput
                          style={[styles.modalInput, styles.timeInput]}
                          value={h.end}
                          onChangeText={(v) => updateHH(i, { end: v })}
                          placeholder="18:00"
                          placeholderTextColor={C.textMuted}
                        />
                      </View>
                      <TextInput
                        style={[styles.modalInput, styles.itemsInput]}
                        value={h.items}
                        onChangeText={(v) => updateHH(i, { items: v })}
                        placeholder={"One deal per line\n$5 cocktails\n$3 domestic beer"}
                        placeholderTextColor={C.textMuted}
                        multiline
                      />
                    </View>
                  ))}
                </>
              ) : null}
              <Pressable
                style={styles.addRowBtn}
                onPress={() => setHappyHours((prev) => [...prev, { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], start: "16:00", end: "18:00", items: "" }])}
              >
                <Ionicons name="add-circle-outline" size={18} color={C.accent} />
                <Text style={styles.addRowBtnText}>Add Happy Hour Window</Text>
              </Pressable>

              {/* Daily Deals */}
              {dailyDeals.length > 0 ? (
                <>
                  <Text style={[styles.editSectionLabel, { marginTop: 20 }]}>Daily Deals</Text>
                  {dailyDeals.map((d, i) => (
                    <View key={i} style={styles.editBlock}>
                      <View style={styles.editBlockHeaderRow}>
                        <Text style={styles.editBlockLabel}>Deal {i + 1}</Text>
                        <Pressable onPress={() => setDailyDeals((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={8}>
                          <Ionicons name="trash-outline" size={16} color="#c0392b" />
                        </Pressable>
                      </View>
                      <DayChips multi={false} selected={[d.day]} onChange={([day]) => updateDeal(i, { day })} />
                      {/* All Day / Timed toggle */}
                      <View style={styles.dealTimingToggle}>
                        <Pressable
                          style={[styles.dealTimingOption, d.allDay && styles.dealTimingOptionActive]}
                          onPress={() => updateDeal(i, { allDay: true })}
                        >
                          <Text style={[styles.dealTimingOptionText, d.allDay && styles.dealTimingOptionTextActive]}>
                            All Day
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.dealTimingOption, !d.allDay && styles.dealTimingOptionActive]}
                          onPress={() => updateDeal(i, { allDay: false })}
                        >
                          <Text style={[styles.dealTimingOptionText, !d.allDay && styles.dealTimingOptionTextActive]}>
                            Timed
                          </Text>
                        </Pressable>
                      </View>
                      {!d.allDay ? (
                        <View style={styles.timeRow}>
                          <TextInput
                            style={[styles.modalInput, styles.timeInput]}
                            value={d.start}
                            onChangeText={(v) => updateDeal(i, { start: v })}
                            placeholder="16:00"
                            placeholderTextColor={C.textMuted}
                          />
                          <Text style={styles.timeSeparator}>–</Text>
                          <TextInput
                            style={[styles.modalInput, styles.timeInput]}
                            value={d.end}
                            onChangeText={(v) => updateDeal(i, { end: v })}
                            placeholder="21:00"
                            placeholderTextColor={C.textMuted}
                          />
                        </View>
                      ) : null}
                      <TextInput
                        style={[styles.modalInput, styles.itemsInput]}
                        value={d.items}
                        onChangeText={(v) => updateDeal(i, { items: v })}
                        placeholder={"One deal per line\n$8.99 burger & fries"}
                        placeholderTextColor={C.textMuted}
                        multiline
                      />
                    </View>
                  ))}
                </>
              ) : null}
              <Pressable
                style={[styles.addRowBtn, { marginBottom: 24 }]}
                onPress={() => setDailyDeals((prev) => [...prev, { day: "Mon", allDay: true, start: "", end: "", items: "" }])}
              >
                <Ionicons name="add-circle-outline" size={18} color={C.accent} />
                <Text style={styles.addRowBtnText}>Add Daily Deal</Text>
              </Pressable>
            </ScrollView>

            <Pressable style={[styles.addRowBtn, { justifyContent: "center", marginBottom: 8 }]} onPress={cleanUpFormatting}>
              <Ionicons name="sparkles-outline" size={16} color={C.textSec} />
              <Text style={[styles.addRowBtnText, { color: C.textSec }]}>Clean Up Formatting</Text>
            </Pressable>

            {error ? <Text style={styles.modalError}>{error}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={onClose}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmitBtn, (!name.trim() || loading) && styles.modalSubmitBtnDisabled]}
                onPress={handleSave}
                disabled={!name.trim() || loading}
              >
                {loading ? <ActivityIndicator color={C.bg} size="small" /> : <Text style={styles.modalSubmitText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default EditSpotModal;
