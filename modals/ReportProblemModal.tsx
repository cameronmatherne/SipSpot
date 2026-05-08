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
import type { Spot } from "../data/spots";
import { AuthContext, useTheme } from "../contexts";
import type { Theme } from "../constants/theme";

// ─────────────────────────────────────────────────────────────────────────────
// ReportProblemModal
//
// Available to all users (signed in or not). Submits a free-text description
// of the problem to the `spot_reports` table. user_id is included when signed
// in so admins can follow up; anonymous reports are accepted too.
// ─────────────────────────────────────────────────────────────────────────────

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

function ReportProblemModal({ spot, onClose }: { spot: Spot; onClose: () => void }) {
  const { user } = useContext(AuthContext);
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);

    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

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
          spot_id: spot.id,
          user_id: user?.id ?? null,
          message: trimmed,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(`Could not submit report${text ? `: ${text}` : ""}`);
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
              <Text style={styles.modalTitle}>Report Sent</Text>
              <Text style={styles.modalSuccess}>
                Thanks for the heads-up! We'll review the issue with {spot.name}.
              </Text>
              <Pressable style={styles.modalSubmitBtn} onPress={onClose}>
                <Text style={styles.modalSubmitText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>Report a Problem</Text>
              <Text style={[styles.modalSuccess, { marginBottom: 12 }]}>
                What's wrong with the info for {spot.name}?
              </Text>
              <TextInput
                style={[styles.modalInput, { height: 100, textAlignVertical: "top" }]}
                placeholder="Describe the issue (wrong hours, closed, etc.)"
                placeholderTextColor={C.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                autoFocus
              />
              {error ? <Text style={styles.modalError}>{error}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancelBtn} onPress={onClose}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSubmitBtn, (!message.trim() || loading) && styles.modalSubmitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!message.trim() || loading}
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

export default ReportProblemModal;
