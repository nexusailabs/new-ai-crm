"use client";

/**
 * Payment Stats Card Component
 * Displays payment statistics with glass morphism design
 * Created: 2025-12-29
 */

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import type { PaymentStats } from "@/types/payment";
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

interface PaymentStatsCardProps {
  stats: PaymentStats;
  type: "deposit" | "withdrawal";
  className?: string;
}

export function PaymentStatsCard({
  stats,
  type,
  className,
}: PaymentStatsCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const statItems = [
    {
      label: "Total Amount",
      value: formatCurrency(stats.totalAmount),
      icon: DollarSign,
      color: type === "deposit" ? "text-emerald-400" : "text-orange-400",
      bgColor: type === "deposit" ? "bg-emerald-500/20" : "bg-orange-500/20",
    },
    {
      label: "Total Count",
      value: stats.totalCount.toString(),
      icon: type === "deposit" ? ArrowDownRight : ArrowUpRight,
      color: "text-sky-400",
      bgColor: "bg-sky-500/20",
    },
    {
      label: "Pending",
      value: `${stats.pendingCount} (${formatCurrency(stats.pendingAmount)})`,
      icon: Clock,
      color: "text-amber-400",
      bgColor: "bg-amber-500/20",
    },
    {
      label: "Approved",
      value: `${stats.approvedCount} (${formatCurrency(stats.approvedAmount)})`,
      icon: CheckCircle,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
    },
    {
      label: "Rejected",
      value: `${stats.rejectedCount} (${formatCurrency(stats.rejectedAmount)})`,
      icon: XCircle,
      color: "text-red-400",
      bgColor: "bg-red-500/20",
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-5 gap-4", className)}>
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <GlassCard hover padding="md" className="h-full">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-xs mb-1 truncate">
                  {item.label}
                </p>
                <p className="text-lg font-bold text-white truncate">
                  {item.value}
                </p>
              </div>
              <div className={cn("p-2 rounded-xl shrink-0", item.bgColor)}>
                <item.icon className={cn("w-4 h-4", item.color)} />
              </div>
            </div>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
}

export default PaymentStatsCard;
