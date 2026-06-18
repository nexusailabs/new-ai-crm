/**
 * Payment i18n Hook
 * Provides localized labels and formatters for payment-related pages
 * Created: 2025-12-29
 * Mission: MISSION-20251229-1847
 */

import { useCallback, useMemo } from "react";
import { useTranslation, type Language } from "@/stores/i18nStore";
import type { PaymentStatus } from "@/types/payment";

export function usePaymentI18n() {
  const { t, language } = useTranslation();
  const locale = language === "ko" ? "ko-KR" : "en-US";

  const formatCurrency = useCallback(
    (amount: number, currency: string = "USD") => {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(amount);
    },
    [locale]
  );

  const formatDate = useCallback(
    (timestamp: string) => {
      return new Date(timestamp).toLocaleString(locale, {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    },
    [locale]
  );

  const formatTimeAgo = useCallback(
    (timestamp: string) => {
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
    },
    [t]
  );

  const getStatusLabel = useCallback(
    (status: PaymentStatus): string => {
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
    },
    [t]
  );

  const labels = useMemo(
    () => ({
      // Withdrawals
      withdrawalsTitle: t("withdrawals.title"),
      withdrawalsSubtitle: t("withdrawals.subtitle"),
      totalVolume: t("withdrawals.totalVolume"),
      pendingReview: t("withdrawals.pendingReview"),
      processedToday: t("withdrawals.processedToday"),
      reqs: t("withdrawals.reqs"),
      userProfile: t("withdrawals.userProfile"),
      accountHealth: t("withdrawals.accountHealth"),
      equity: t("withdrawals.equity"),
      openOps: t("withdrawals.openOps"),
      orders: t("withdrawals.orders"),
      loadingWithdrawals: t("withdrawals.loadingWithdrawals"),
      noWithdrawalsFound: t("withdrawals.noWithdrawalsFound"),
      failedToLoadWithdrawals: t("withdrawals.failedToLoad"),
      withdrawalsSearchPlaceholder: t("withdrawals.searchPlaceholder"),
      approveWithdrawal: t("withdrawals.approveWithdrawal"),
      rejectWithdrawal: t("withdrawals.rejectWithdrawal"),

      // Deposits
      depositsTitle: t("deposits.title"),
      depositsSubtitle: t("deposits.subtitle"),
      totalAmount: t("deposits.totalAmount"),
      totalCount: t("deposits.totalCount"),
      depositTransactions: t("deposits.depositTransactions"),
      loadingDeposits: t("deposits.loadingDeposits"),
      noDepositsFound: t("deposits.noDepositsFound"),
      failedToLoadDeposits: t("deposits.failedToLoad"),
      depositsSearchPlaceholder: t("deposits.searchPlaceholder"),
      dateId: t("deposits.dateId"),

      // Common
      amount: t("payment.amount"),
      status: t("status.pending").replace(t("status.pending"), "Status"),
      customer: t("customers.customer"),
      actions: t("common.actions"),
      processed: t("common.processed"),
      refresh: t("common.refresh"),
      retry: t("common.retry"),
      sync: t("common.sync"),
      online: t("common.online"),
      offline: t("common.offline"),
      live: t("common.live"),
      allMethods: t("payment.allMethods"),
      allStatuses: t("customers.allStatuses"),
      rejected: t("status.rejected"),

      // Data source
      hybrid: t("dataSource.hybrid"),
      cache: t("dataSource.cache"),
      api: t("dataSource.api"),
      unknown: t("dataSource.unknown"),
      dbCount: t("dataSource.dbCount"),
      deltaCount: t("dataSource.deltaCount"),
    }),
    [t]
  );

  return {
    t,
    language,
    locale,
    formatCurrency,
    formatDate,
    formatTimeAgo,
    getStatusLabel,
    labels,
  };
}

export default usePaymentI18n;
