"use client";

/**
 * Activity Feed Component
 * Real-time feed of deposit and withdrawal events
 * Created: 2025-12-29
 */

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { PaymentEvent } from "@/types/payment";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface ActivityFeedProps {
  events: PaymentEvent[];
  maxItems?: number;
  className?: string;
}

export function ActivityFeed({
  events,
  maxItems = 10,
  className,
}: ActivityFeedProps) {
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle className="w-3 h-3 text-emerald-400" />;
      case "REJECTED":
        return <XCircle className="w-3 h-3 text-red-400" />;
      default:
        return <Clock className="w-3 h-3 text-amber-400" />;
    }
  };

  const displayEvents = events.slice(0, maxItems);

  return (
    <div className={cn("space-y-3", className)}>
      <AnimatePresence mode="popLayout">
        {displayEvents.map((event, index) => (
          <motion.div
            key={event.uuid}
            initial={{ opacity: 0, x: -20, height: 0 }}
            animate={{ opacity: 1, x: 0, height: "auto" }}
            exit={{ opacity: 0, x: 20, height: 0 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              delay: index * 0.05,
            }}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl",
              "bg-white/5 hover:bg-white/10 transition-all duration-200",
              "border border-white/5 hover:border-white/10"
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                event.type === "DEPOSIT"
                  ? "bg-emerald-500/20"
                  : "bg-orange-500/20"
              )}
            >
              {event.type === "DEPOSIT" ? (
                <ArrowDownRight className="w-5 h-5 text-emerald-400" />
              ) : (
                <ArrowUpRight className="w-5 h-5 text-orange-400" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white font-medium truncate">
                  {event.accountInfo.name} {event.accountInfo.surname}
                </p>
                {getStatusIcon(event.status)}
              </div>
              <p className="text-white/50 text-sm truncate">
                {event.type === "DEPOSIT" ? "Deposited" : "Withdrew"}{" "}
                <span
                  className={cn(
                    "font-medium",
                    event.type === "DEPOSIT"
                      ? "text-emerald-400"
                      : "text-orange-400"
                  )}
                >
                  {formatCurrency(event.amount, event.currency)}
                </span>
              </p>
            </div>

            {/* Time */}
            <div className="text-right shrink-0">
              <p className="text-white/40 text-xs">
                {formatTimeAgo(event.timestamp)}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {events.length === 0 && (
        <div className="text-center py-8">
          <p className="text-white/40">No recent activity</p>
        </div>
      )}
    </div>
  );
}

export default ActivityFeed;
