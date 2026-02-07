import React from "react";
import { View, type ViewProps } from "react-native";
import { cn } from "./cn";

type Props = ViewProps & { className?: string };

export function Card({ className, style, ...props }: Props) {
  return (
    <View
      className={cn("rounded-2xl border border-border bg-card", className)}
      style={style}
      {...props}
    />
  );
}

