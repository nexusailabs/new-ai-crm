"use client";

/**
 * Payment Table Component
 * Displays deposit or withdrawal events in a table format
 * Created: 2025-12-29
 * Updated: 2025-12-29 - i18n support (MISSION-20251229-1847)
 */

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/stores/i18nStore";
import type { DepositEvent, WithdrawalEvent, PaymentStatus } from "@/types/payment";
import { CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";

interface PaymentTableProps {
  data: (DepositEvent | WithdrawalEvent)[];
  type: "deposit" | "withdrawal";
  onApprove?: (uuid: string) => void;
  onReject?: (uuid: string) => void;
  showActions?: boolean;
  isLoading?: boolean;
}

const statusIcons: Record<PaymentStatus, React.ComponentType<{ className?: string }>> = {
  PENDING: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
};

const statusStyles: Record<PaymentStatus, { color: string; bgColor: string }> = {
  PENDING: { color: "text-amber-400", bgColor: "bg-amber-500/20" },
  APPROVED: { color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
  REJECTED: { color: "text-red-400", bgColor: "bg-red-500/20" },
};

export function PaymentTable({
  data,
  type,
  onApprove,
  onReject,
  showActions = false,
  isLoading = false,
}: PaymentTableProps) {
  const { t, language } = useTranslation();

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(language === "ko" ? "ko-KR" : "en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString(language === "ko" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t("payment.justNow");
    if (diffMins < 60) return `${diffMins}${t("payment.minutesAgo")}`;
    if (diffHours < 24) return `${diffHours}${t("payment.hoursAgo")}`;
    return `${diffDays}${t("payment.daysAgo")}`;
  };

  const getStatusLabel = (status: PaymentStatus): string => {
    switch (status) {
      case "PENDING":
        return t("status.pending");
      case "APPROVED":
        return t("status.approved");
      case "REJECTED":
        return t("status.rejected");
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-400" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-white/50">
          {type === "deposit" ? t("deposits.noDepositsFound") : t("withdrawals.noWithdrawalsFound")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-3 px-4 text-white/60 text-sm font-medium">
              {t("customers.customer")}
            </th>
            <th className="text-left py-3 px-4 text-white/60 text-sm font-medium">
              {t("payment.amount")}
            </th>
            <th className="text-left py-3 px-4 text-white/60 text-sm font-medium">
              {t("customers.type")}
            </th>
            <th className="text-left py-3 px-4 text-white/60 text-sm font-medium">
              {t("payment.time")}
            </th>
            {showActions && (
              <th className="text-right py-3 px-4 text-white/60 text-sm font-medium">
                {t("common.actions")}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence mode="popLayout">
            {data.map((item, index) => {
              const StatusIcon = statusIcons[item.status];
              const statusStyle = statusStyles[item.status];

              return (
                <motion.tr
                  key={item.uuid}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn(
                    "border-b border-white/5",
                    "hover:bg-white/5 transition-colors"
                  )}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-white font-medium text-sm">
                        {(item.accountInfo?.name || "U")[0]}
                        {(item.accountInfo?.surname || "U")[0]}
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {item.accountInfo?.name || "Unknown"} {item.accountInfo?.surname || "User"}
                        </p>
                        <p className="text-white/50 text-sm">
                          {item.accountInfo?.email || "No email"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <p
                      className={cn(
                        "font-semibold text-lg",
                        type === "deposit" ? "text-emerald-400" : "text-orange-400"
                      )}
                    >
                      {type === "deposit" ? "+" : "-"}
                      {formatCurrency(item.amount, item.currency)}
                    </p>
                    <p className="text-white/40 text-xs">{item.method}</p>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm",
                        statusStyle.bgColor,
                        statusStyle.color
                      )}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-white text-sm">{formatDate(item.timestamp)}</p>
                    <p className="text-white/40 text-xs">
                      {formatTimeAgo(item.timestamp)}
                    </p>
                  </td>
                  {showActions && (
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === "PENDING" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onApprove?.(item.uuid)}
                              className="text-emerald-400 hover:bg-emerald-500/20"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {t("payment.approve")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onReject?.(item.uuid)}
                              className="text-red-400 hover:bg-red-500/20"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              {t("payment.reject")}
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

export default PaymentTable;
