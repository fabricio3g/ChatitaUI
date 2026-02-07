import React from "react";
import { View } from "react-native";
import { vars } from "nativewind";
import { useTheme } from "../context/ThemeContext";

function hexToRgbTriplet(hex: string): string {
  const raw = String(hex || "").trim().replace(/^#/, "");
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (expanded.length !== 6) return "0 0 0";
  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return "0 0 0";
  return `${r} ${g} ${b}`;
}

export function NativeWindThemeBridge({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View
      style={[
        { flex: 1 },
        vars({
          "--bg": hexToRgbTriplet(c.background),
          "--fg": hexToRgbTriplet(c.text),
          "--card": hexToRgbTriplet(c.surface),
          "--panel": hexToRgbTriplet(c.surfaceHighlight),
          "--border": hexToRgbTriplet(c.border),
          "--muted": hexToRgbTriplet(c.textSecondary),
          "--primary": hexToRgbTriplet(c.primary),
          "--success": hexToRgbTriplet(c.success),
          "--warning": hexToRgbTriplet(c.warning),
          "--error": hexToRgbTriplet(c.error),
        }),
      ]}
    >
      {children}
    </View>
  );
}
