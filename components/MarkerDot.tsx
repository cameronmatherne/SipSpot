import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../contexts";
import type { Theme } from "../constants/theme";

/**
 * MarkerDot — custom map marker rendered inside a react-native-maps <Marker>.
 *
 * Colour legend:
 *   teal  → live right now (deal or happy hour active)
 *   steel → has deals today but not live yet
 *   grey  → no deals today
 *
 * `tracksViewChanges={false}` on the parent <Marker> is critical for
 * performance — without it, every render redraws every marker.
 */

const makeStyles = (C: Theme) => StyleSheet.create({
  markerOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${C.bg}b3`,
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

function MarkerDot({ live, hasDeals }: { live: boolean; hasDeals: boolean }) {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const color = live ? C.accent : hasDeals ? "#4e6a7a" : C.textMuted;
  return (
    <View style={[styles.markerOuter, { borderColor: color }]}>
      <View style={[styles.markerInner, { backgroundColor: color }]} />
    </View>
  );
}

export default MarkerDot;
