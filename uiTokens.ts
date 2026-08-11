import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

export const UI_TOKENS = {
  colors: {
    canvas: "#EEF2EF",
    surface: "#F7F9F7",
    card: "#FFFFFF",
    ink: "#102820",
    muted: "#5D6D66",
    subtle: "#78867F",
    border: "#D9E2DD",
    borderStrong: "#C4D0CA",
    primary: "#0C4A3A",
    primaryDeep: "#0B1721",
    primarySoft: "#E7F1ED",
    accent: "#D8FF63",
    accentMuted: "#B9DB50",
  },
  status: {
    success: "#2D6A3B",
    successWash: "#EAF6EE",
    warning: "#8A6112",
    warningWash: "#FFF8E6",
    danger: "#8B4439",
    dangerWash: "#FFF0EC",
    neutral: "#52627F",
    neutralWash: "#E8ECF5",
  },
  radius: {
    small: 8,
    control: 12,
    card: 16,
    large: 22,
    sheet: 26,
    pill: 999,
  },
} as const;

type NamedStyle = ViewStyle | TextStyle | ImageStyle;

/**
 * Keeps intentionally compact badges compact while preventing production
 * labels from falling into unreadable 5–8 px sizes on mobile and desktop.
 */
export function normalizeUiStyles<T extends Record<string, NamedStyle>>(styles: T): T {
  const normalized = Object.fromEntries(Object.entries(styles).map(([name, style]) => {
    const textStyle = style as TextStyle;
    if (typeof textStyle.fontSize !== "number") return [name, style];
    const compactLabel = /(badge|eyebrow|marker|countlabel|teamBadge|ownerBadge|chipDetail)/i.test(name);
    const minimumSize = compactLabel ? 10 : 11;
    const fontSize = Math.max(textStyle.fontSize, minimumSize);
    const lineHeight = typeof textStyle.lineHeight === "number" && textStyle.lineHeight < fontSize * 1.15
      ? Math.ceil(fontSize * 1.2)
      : textStyle.lineHeight;
    return [name, { ...style, fontSize, ...(lineHeight == null ? {} : { lineHeight }) }];
  }));
  return normalized as T;
}

export const CARD_SHADOW = {
  shadowColor: "#10251F",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
} as const;
