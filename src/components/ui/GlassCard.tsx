"use client";

import { ReactNode } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  variant?: "default" | "light" | "dark" | "glow";
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg" | "xl";
}

const variantStyles = {
  default: "bg-white/5 border-white/10",
  light: "bg-white/10 border-white/20",
  dark: "bg-black/20 border-white/5",
  glow: "bg-white/5 border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.3)]",
};

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
  xl: "p-8",
};

export function GlassCard({
  children,
  variant = "default",
  hover = false,
  padding = "md",
  className = "",
  ...motionProps
}: GlassCardProps) {
  const baseStyles = cn(
    "backdrop-blur-xl",
    "border",
    "rounded-2xl",
    "shadow-2xl",
    "shadow-purple-500/10"
  );

  const hoverStyles = hover
    ? "transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]"
    : "";

  return (
    <motion.div
      className={cn(
        baseStyles,
        variantStyles[variant],
        paddingStyles[padding],
        hoverStyles,
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
