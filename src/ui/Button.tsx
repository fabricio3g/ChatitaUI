import React from "react";
import { Pressable, Text, type PressableProps } from "react-native";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

export type ButtonProps = PressableProps & {
  variant?: Variant;
  size?: Size;
  title: string;
  className?: string;
};

const base = "items-center justify-center rounded-xl";
const sizeClasses: Record<Size, string> = {
  sm: "h-10 px-4",
  md: "h-12 px-5",
  lg: "h-14 px-6",
};
const variantClasses: Record<Variant, string> = {
  primary: "bg-primary",
  secondary: "bg-card border border-border",
  ghost: "bg-transparent",
  destructive: "bg-error",
};
const textVariantClasses: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-fg",
  ghost: "text-fg",
  destructive: "text-white",
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(base, sizeClasses[size], variantClasses[variant], disabled && "opacity-50", className)}
      disabled={disabled}
      {...props}
    >
      <Text className={cn("text-[15px] font-bold", textVariantClasses[variant])}>{title}</Text>
    </Pressable>
  );
}

