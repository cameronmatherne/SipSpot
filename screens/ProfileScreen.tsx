import { useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import type { Spot } from "../data/spots";
import { AuthContext, FavoritesContext, useTheme } from "../contexts";
import type { Theme } from "../constants/theme";

// ─────────────────────────────────────────────────────────────────────────────
// ProfileScreen
//
// Two states:
//   Signed out — shows a Sign In / Sign Up form.
//   Signed in  — shows the user's email, a Sign Out button, and their saved spots.
//
// Receives the full spot list so it can resolve saved IDs → full Spot objects
// without an extra network call.
// ─────────────────────────────────────────────────────────────────────────────

const makeStyles = (C: Theme) => StyleSheet.create({
  profileContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  profileCenter: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  profileScrollContent: {
    padding: 28,
    paddingTop: 60,
  },
  profileLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  profileLogoIconBg: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#0f1117",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileLogoIcon: {
    width: 56,
    height: 56,
  },
  profileLogoText: {
    fontSize: 40,
    fontFamily: "Raleway_800ExtraBold",
    color: C.accent,
    letterSpacing: 2,
  },
  profileTagline: {
    fontSize: 15,
    color: C.textSec,
    marginBottom: 36,
  },
  authToggleRow: {
    flexDirection: "row",
    backgroundColor: C.elevated,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  authToggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
  },
  authToggleBtnActive: {
    backgroundColor: C.surface,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  authToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.textSec,
  },
  authToggleTextActive: {
    color: C.textPri,
  },
  authSuccessBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: C.greenBg,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  authSuccessText: {
    flex: 1,
    fontSize: 14,
    color: C.green,
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
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 14,
  },
  profileAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileAvatarIcon: {
    width: 52,
    height: 52,
  },
  profileHeaderText: {
    flex: 1,
  },
  profileEmail: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textPri,
  },
  profileSubtext: {
    fontSize: 12,
    color: C.textSec,
    marginTop: 2,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.elevated,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSec,
  },
  profileDivider: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 20,
  },
  // Appearance row
  appearanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  appearanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appearanceLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textPri,
  },
  themeToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accent,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  themeToggleLight: {
    backgroundColor: C.border,
  },
  themeToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.surface,
    alignSelf: "flex-end",
  },
  themeToggleThumbLight: {
    alignSelf: "flex-start",
  },
  profileSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  profileSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.textPri,
  },
  profileBadge: {
    backgroundColor: C.accentDark,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.accent,
  },
  profileEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 10,
  },
  profileEmptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: C.textSec,
    textAlign: "center",
  },
  profileEmptySubtext: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  profileSpotList: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 2,
  },
  profileSpotRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  profileSpotInfo: {
    flex: 1,
  },
  profileSpotName: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textPri,
  },
  profileSpotMeta: {
    fontSize: 12,
    color: C.textSec,
    marginTop: 3,
  },
  savedSection: {
    flex: 1,
  },
  profileBottom: {
    paddingBottom: 16,
  },
  profileBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  profileBottomLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: C.textPri,
  },
  // General report modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.textPri,
    marginBottom: 2,
  },
  modalHint: {
    fontSize: 13,
    color: C.textSec,
  },
  modalSuccess: {
    fontSize: 14,
    color: C.textSec,
    lineHeight: 20,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: C.elevated,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.textSec,
  },
});

function ProfileScreen({ spots }: { spots: Spot[] }) {
  const { user, role, loading: authLoading, signIn, signUp, signOut } = useContext(AuthContext);
  const { favoriteIds, toggleFavorite } = useContext(FavoritesContext);
  const { C, mode, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  // "signin" | "signup" — toggles which form is shown when logged out.
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);

  const handleSubmitReport = async () => {
    const trimmed = reportMessage.trim();
    if (!trimmed) return;
    setReportLoading(true);
    setReportError(null);
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
        body: JSON.stringify({ spot_id: null, user_id: user?.id ?? null, message: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setReportError(`Could not submit${text ? `: ${text}` : ""}`);
        setReportLoading(false);
        return;
      }
      setReportSuccess(true);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Unknown error");
      setReportLoading(false);
    }
  };

  const closeReport = () => {
    setShowReport(false);
    setReportMessage("");
    setReportError(null);
    setReportSuccess(false);
    setReportLoading(false);
  };

  const savedSpots = spots.filter((s) => favoriteIds.has(s.id));

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) return;
    setSubmitting(true);
    setError(null);
    if (authMode === "signin") {
      const err = await signIn(trimmedEmail, trimmedPassword);
      if (err) setError(err);
    } else {
      const err = await signUp(trimmedEmail, trimmedPassword);
      if (err) setError(err);
      else setSignUpSuccess(true);
    }
    setSubmitting(false);
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  if (authLoading) {
    return (
      <View style={styles.profileCenter}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  // ── Signed out ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <KeyboardAvoidingView
        style={styles.profileContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={styles.profileScrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.profileLogoRow}>
            <View style={styles.profileLogoIconBg}>
              <Image
                source={require("../assets/app-icon-transparent.png")}
                style={styles.profileLogoIcon}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.profileLogoText}>SipSpot</Text>
          </View>
          <Text style={styles.profileTagline}>Save your favorite happy hours.</Text>

          {/* Mode toggle */}
          <View style={styles.authToggleRow}>
            <Pressable
              style={[styles.authToggleBtn, authMode === "signin" && styles.authToggleBtnActive]}
              onPress={() => { setAuthMode("signin"); setError(null); setSignUpSuccess(false); }}
            >
              <Text style={[styles.authToggleText, authMode === "signin" && styles.authToggleTextActive]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={[styles.authToggleBtn, authMode === "signup" && styles.authToggleBtnActive]}
              onPress={() => { setAuthMode("signup"); setError(null); setSignUpSuccess(false); }}
            >
              <Text style={[styles.authToggleText, authMode === "signup" && styles.authToggleTextActive]}>
                Create Account
              </Text>
            </Pressable>
          </View>

          {signUpSuccess ? (
            <View style={styles.authSuccessBox}>
              <Ionicons name="checkmark-circle" size={22} color={C.green} />
              <Text style={styles.authSuccessText}>
                Check your email to confirm your account, then sign in.
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.modalInput}
                placeholder="Email"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
              <TextInput
                style={[styles.modalInput, { marginTop: 10 }]}
                placeholder="Password"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              {error ? <Text style={styles.modalError}>{error}</Text> : null}
              <Pressable
                style={[styles.modalSubmitBtn, { marginTop: 16 }, (submitting || !email.trim() || !password.trim()) && styles.modalSubmitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting || !email.trim() || !password.trim()}
              >
                {submitting
                  ? <ActivityIndicator color={C.bg} size="small" />
                  : <Text style={styles.modalSubmitText}>{authMode === "signin" ? "Sign In" : "Create Account"}</Text>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Signed in ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.profileContainer}>
      {/* General report modal */}
      <Modal visible={showReport} animationType="slide" transparent onRequestClose={closeReport}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalSheet}>
            {reportSuccess ? (
              <>
                <Text style={styles.modalTitle}>Report Sent</Text>
                <Text style={styles.modalSuccess}>Thanks for the feedback — we'll look into it.</Text>
                <Pressable style={styles.modalSubmitBtn} onPress={closeReport}>
                  <Text style={styles.modalSubmitText}>Done</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Report a Problem</Text>
                <Text style={styles.modalHint}>Describe the issue and we'll follow up.</Text>
                <TextInput
                  style={[styles.modalInput, { height: 100, textAlignVertical: "top", marginTop: 12 }]}
                  placeholder="What's going wrong?"
                  placeholderTextColor={C.textMuted}
                  value={reportMessage}
                  onChangeText={setReportMessage}
                  multiline
                  autoFocus
                />
                {reportError ? <Text style={styles.modalError}>{reportError}</Text> : null}
                <View style={styles.modalActions}>
                  <Pressable style={styles.modalCancelBtn} onPress={closeReport}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalSubmitBtn, (!reportMessage.trim() || reportLoading) && styles.modalSubmitBtnDisabled]}
                    onPress={handleSubmitReport}
                    disabled={!reportMessage.trim() || reportLoading}
                  >
                    {reportLoading
                      ? <ActivityIndicator color={C.bg} size="small" />
                      : <Text style={styles.modalSubmitText}>Submit</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* User info header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatarCircle}>
          <Image
            source={require("../assets/app-icon-transparent.png")}
            style={styles.profileAvatarIcon}
            resizeMode="contain"
          />
        </View>
        <View style={styles.profileHeaderText}>
          <Text style={styles.profileEmail} numberOfLines={1}>{user.email}</Text>
          <Text style={styles.profileSubtext}>
            {role === "admin" ? "Administrator" : role === "owner" ? "Owner" : "Member"}
          </Text>
        </View>
        <Pressable onPress={handleSignOut} style={styles.signOutBtn} hitSlop={8}>
          <Ionicons name="log-out-outline" size={20} color={C.textSec} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      <View style={styles.profileDivider} />

      {/* Saved spots — flex:1 so it fills space above the fixed bottom section */}
      <View style={styles.savedSection}>
        <View style={styles.profileSectionHeader}>
          <Text style={styles.profileSectionTitle}>Saved Spots</Text>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>{savedSpots.length}</Text>
          </View>
        </View>

        {savedSpots.length === 0 ? (
          <View style={styles.profileEmpty}>
            <Ionicons name="bookmark-outline" size={36} color={C.textMuted} />
            <Text style={styles.profileEmptyText}>No saved spots yet.</Text>
            <Text style={styles.profileEmptySubtext}>
              Tap the bookmark icon on any deal card to save it here.
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileSpotList}>
            {savedSpots.map((spot) => (
              <View key={spot.id} style={styles.profileSpotRow}>
                <View style={styles.profileSpotInfo}>
                  <Text style={styles.profileSpotName}>{spot.name}</Text>
                  {spot.happyHours.length > 0 || spot.dailyDeals.length > 0 ? (
                    <Text style={styles.profileSpotMeta}>
                      {[
                        spot.happyHours.length > 0 && "Happy Hour",
                        spot.dailyDeals.length > 0 && "Daily Deals",
                      ].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => toggleFavorite(spot.id)}
                  hitSlop={12}
                  accessibilityLabel="Remove from saved"
                >
                  <Ionicons name="bookmark" size={18} color={C.accent} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Bottom settings — always pinned to the bottom */}
      <View style={styles.profileBottom}>
        <View style={styles.profileDivider} />
        <Pressable style={styles.profileBottomRow} onPress={() => setShowReport(true)}>
          <Ionicons name="flag-outline" size={18} color={C.textSec} />
          <Text style={styles.profileBottomLabel}>Report a Problem</Text>
          <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
        </Pressable>
        <View style={styles.profileDivider} />
        <View style={styles.appearanceRow}>
          <View style={styles.appearanceLeft}>
            <Ionicons name={mode === "dark" ? "moon" : "sunny"} size={18} color={C.textSec} />
            <Text style={styles.appearanceLabel}>{mode === "dark" ? "Dark Mode" : "Light Mode"}</Text>
          </View>
          <Pressable onPress={toggleTheme} style={[styles.themeToggle, mode === "light" && styles.themeToggleLight]}>
            <View style={[styles.themeToggleThumb, mode === "light" && styles.themeToggleThumbLight]} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default ProfileScreen;
