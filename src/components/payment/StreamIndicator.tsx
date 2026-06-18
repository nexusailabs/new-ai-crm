"use client";

/**
 * Stream Indicator Component
 * Shows real-time stream status with controls
 * Created: 2025-12-29
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Radio, Pause, Play } from "lucide-react";

interface StreamIndicatorProps {
  isStreaming: boolean;
  onToggle: () => void;
  className?: string;
}

export function StreamIndicator({
  isStreaming,
  onToggle,
  className,
}: StreamIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-xl",
        "bg-white/5 border border-white/10",
        className
      )}
    >
      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        {isStreaming ? (
          <motion.div
            className="relative"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <motion.div
              className="absolute inset-0 rounded-full bg-emerald-500"
              animate={{ scale: [1, 2], opacity: [0.5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
          </motion.div>
        ) : (
          <div className="w-3 h-3 rounded-full bg-white/30" />
        )}
        <span
          className={cn(
            "text-sm font-medium",
            isStreaming ? "text-emerald-400" : "text-white/50"
          )}
        >
          {isStreaming ? "Live" : "Paused"}
        </span>
      </div>

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className={cn(
          "h-8 px-3",
          isStreaming
            ? "text-amber-400 hover:bg-amber-500/20"
            : "text-emerald-400 hover:bg-emerald-500/20"
        )}
      >
        {isStreaming ? (
          <>
            <Pause className="w-4 h-4 mr-1" />
            Pause
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-1" />
            Start
          </>
        )}
      </Button>

      {/* gRPC Label */}
      <div className="flex items-center gap-1.5 text-white/40 text-xs">
        <Radio className="w-3 h-3" />
        gRPC Stream
      </div>
    </div>
  );
}

export default StreamIndicator;
