import { useContext, useMemo, useState } from "react";
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
import { AuthContext, useTheme } from "../contexts";
import type { Theme } from "../constants/theme";

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
  modalHint: {
    fontSize: 14,
    color: C.textSec,
    lineHeight: 20,
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

function RequestSpotModal({ onClose }: { onClose: () => void }) {
  const { user } = useContext(AuthContext);
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setLoading(true);
    setError(null);

    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

    const message = `[Spot Request] ${trimmedName}`;

    try {
      const res = await fetch(`${url}/rest/v1/spot_reports`, {
        method: "POST",
        headers: {
          apikey: key!,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          spot_id: null,
          user_id: user?.id ?? null,
          message,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(`Could not submit request${text ? `: ${text}` : ""}`);
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
              <Text style={styles.modalTitle}>Request Sent</Text>
              <Text style={styles.modalSuccess}>
                Thanks! We'll review your request and look into adding that spot.
              </Text>
              <Pressable style={styles.modalSubmitBtn} onPress={onClose}>
                <Text style={styles.modalSubmitText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>Request a Spot</Text>
              <Text style={styles.modalHint}>
                Know a place with great happy hours or deals? Let us know and we'll add it.
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Restaurant or bar name"
                placeholderTextColor={C.textMuted}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="next"
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
                    <Text style={styles.modalSubmitText}>Submit</Text>
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

export default RequestSpotModal;
