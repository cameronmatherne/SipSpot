import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { toSpotId } from "../utils/text";
import { useTheme } from "../contexts";
import type { Theme } from "../constants/theme";

/**
 * AddSpotModal — minimal modal for adding a new spot by name only.
 *
 * After a successful POST to Supabase the modal shows a success state
 * prompting the user to add coordinates and deals via the dashboard.
 * The spot will appear on the Deals tab once it has active specials.
 */

const makeStyles = (C: Theme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 14,
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
  modalSuccess: {
    fontSize: 14,
    color: C.textSec,
    lineHeight: 20,
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
});

function AddSpotModal({ onClose }: { onClose: () => void }) {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);

    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
    const market = process.env.EXPO_PUBLIC_MARKET ?? "lafayette";

    try {
      const res = await fetch(`${url}/rest/v1/spots`, {
        method: "POST",
        headers: {
          apikey: key!,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          id: toSpotId(trimmed),
          name: trimmed,
          market,
          latitude: 0,
          longitude: 0,
          daily_deals: [],
          happy_hours: [],
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(`Could not add spot${text ? `: ${text}` : ""}`);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalSheet}>
          {success ? (
            <>
              <Text style={styles.modalTitle}>Spot Added!</Text>
              <Text style={styles.modalSuccess}>
                Add deals and hours for this spot in the Supabase dashboard — it'll show up here once it has active specials.
              </Text>
              <Pressable style={styles.modalSubmitBtn} onPress={onClose}>
                <Text style={styles.modalSubmitText}>Ok</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>Add a Spot</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Restaurant or bar name"
                placeholderTextColor={C.textMuted}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              {error ? <Text style={styles.modalError}>{error}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancelBtn} onPress={onClose}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSubmitBtn, (!name.trim() || loading) && styles.modalSubmitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!name.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator color={C.bg} size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Add Spot</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default AddSpotModal;
