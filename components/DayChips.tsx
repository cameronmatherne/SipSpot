import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Weekday } from "../data/spots";
import { useTheme } from "../contexts";
import type { Theme } from "../constants/theme";

/**
 * DayChips — a row of toggleable day-of-week buttons.
 *
 * `multi` controls whether multiple days can be selected at once:
 *   - true  → used for happy hour windows (e.g. "Mon Tue Wed Thu Fri")
 *   - false → used for daily deals (one deal per weekday)
 */

const makeStyles = (C: Theme) => StyleSheet.create({
  dayChipsRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  dayChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSec,
  },
  dayChipTextActive: {
    color: C.bg,
  },
});

function DayChips({
  selected,
  multi,
  onChange,
}: {
  selected: Weekday[];
  multi: boolean;
  onChange: (days: Weekday[]) => void;
}) {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const days: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <View style={styles.dayChipsRow}>
      {days.map((d) => {
        const active = selected.includes(d);
        return (
          <Pressable
            key={d}
            style={[styles.dayChip, active && styles.dayChipActive]}
            onPress={() => {
              if (multi) {
                onChange(active ? selected.filter((x) => x !== d) : [...selected, d]);
              } else {
                onChange([d]);
              }
            }}
          >
            <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{d}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default DayChips;
