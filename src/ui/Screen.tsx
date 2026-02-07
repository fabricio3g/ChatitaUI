import React from "react";
import { View, type ViewProps } from "react-native";
import { SafeAreaView, type SafeAreaViewProps } from "react-native-safe-area-context";
import { cn } from "./cn";

type Props = SafeAreaViewProps & {
  className?: string;
};

export function Screen({ className, children, ...props }: Props) {
  return (
    <SafeAreaView className={cn("flex-1 bg-bg", className)} {...props}>
      {children}
    </SafeAreaView>
  );
}

export function ScreenContent({ className, children, ...props }: ViewProps & { className?: string }) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <View className={cn("flex-1 px-5", className)} {...(props as any)}>
      {children}
    </View>
  );
}
