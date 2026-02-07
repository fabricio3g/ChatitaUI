import React from "react";
import { View, type ViewProps } from "react-native";
import { cn } from "./cn";

export function Divider({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("h-px bg-border", className)} {...props} />;
}

