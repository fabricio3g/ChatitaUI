import React from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { cn } from "./cn";

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
};

export function Input({ label, hint, error, className, ...props }: Props) {
  return (
    <View className="mb-3">
      {label ? <Text className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.3px] text-muted">{label}</Text> : null}
      <TextInput
        className={cn(
          "h-11 rounded-xl border border-border bg-panel px-3 text-[15px] font-medium text-fg",
          error ? "border-error" : null,
          className,
        )}
        placeholderTextColor="rgb(148 163 184)"
        {...props}
      />
      {error ? <Text className="mt-1 text-[12px] text-error">{error}</Text> : hint ? <Text className="mt-1 text-[12px] text-muted">{hint}</Text> : null}
    </View>
  );
}
