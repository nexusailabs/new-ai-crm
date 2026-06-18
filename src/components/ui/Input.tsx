"use client";

import { InputHTMLAttributes, forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  variant?: "default" | "search";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, icon, variant = "default", className = "", ...props },
    ref
  ) => {
    const baseStyles = cn(
      "w-full",
      "bg-white/5",
      "backdrop-blur-sm",
      "border",
      "border-white/10",
      "rounded-xl",
      "text-white",
      "placeholder-white/40",
      "transition-all",
      "duration-200",
      "focus:outline-none",
      "focus:border-sky-500/50",
      "focus:ring-2",
      "focus:ring-sky-500/20",
      "focus:bg-white/10",
      "disabled:opacity-50",
      "disabled:cursor-not-allowed"
    );

    const variantStyles = {
      default: "px-4 py-3",
      search: "pl-10 pr-4 py-2",
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-white/70 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              baseStyles,
              variantStyles[variant],
              error ? "border-red-500/50 focus:border-red-500/70 focus:ring-red-500/20" : "",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
