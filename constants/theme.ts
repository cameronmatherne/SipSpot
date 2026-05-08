// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
//
// Every colour in the app comes from these objects. Change a value here and it
// propagates everywhere. Do NOT hard-code hex strings in StyleSheets.
// ─────────────────────────────────────────────────────────────────────────────

export type Theme = {
  bg: string;
  surface: string;
  elevated: string;
  border: string;
  textPri: string;
  textSec: string;
  textMuted: string;
  accent: string;
  accentDark: string;
  green: string;
  greenBg: string;
  red: string;
  shadow: string;
};

export const darkTheme: Theme = {
  bg:         "#0f1117",
  surface:    "#1a1d27",
  elevated:   "#22253a",
  border:     "#2c2f45",
  textPri:    "#e8edf4",
  textSec:    "#8892a8",
  textMuted:  "#4e566a",
  accent:     "#2dd4bf",
  accentDark: "#0e4d47",
  green:      "#4ade80",
  greenBg:    "#052e16",
  red:        "#f87171",
  shadow:     "#000000",
};

export const lightTheme: Theme = {
  bg:         "#f7f5f1",
  surface:    "#ffffff",
  elevated:   "#eeece8",
  border:     "#dedad3",
  textPri:    "#1a1d27",
  textSec:    "#52606d",
  textMuted:  "#9aa5b1",
  accent:     "#0d9488",
  accentDark: "#ccfbf1",
  green:      "#15803d",
  greenBg:    "#dcfce7",
  red:        "#dc2626",
  shadow:     "#000000",
};

// Keep the default export as darkTheme for any file that hasn't migrated yet
export default darkTheme;
