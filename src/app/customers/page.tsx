"use client";

/**
 * Customers Page (Virtualized)
 * High-performance dashboard with virtual scrolling for 10,000+ rows
 * Created: 2025-12-28
 * Updated: 2025-12-29 - Unified with VirtualizedTable component
 * Updated: 2025-12-29 - i18n support (MISSION-20251229-1847)
 */

import { useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { VirtualizedTable, type Column, type FilterOption } from "@/components/ui/VirtualizedTable";
import { useCustomerStore } from "@/stores/customerStore";
import { useTranslation } from "@/stores/i18nStore";
import type { Customer, VerificationStatus, AccountType } from "@/types/customer";
import {
  Users,
  RefreshCw,
  Database,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  UserCheck,
  UserPlus,
  TrendingUp,
} from "lucide-react";

// ============================================================================
// Status Configuration (styling only - labels via i18n)
// ============================================================================

const statusStyles: Record<
  VerificationStatus,
  { color: string; bgColor: string; Icon: typeof Clock }
> = {
  NEW: { color: "text-sky-400", bgColor: "bg-sky-500/20", Icon: Clock },
  PENDING_VERIFICATION: { color: "text-amber-400", bgColor: "bg-amber-500/20", Icon: Clock },
  VERIFIED: { color: "text-emerald-400", bgColor: "bg-emerald-500/20", Icon: CheckCircle },
  REJECTED: { color: "text-red-400", bgColor: "bg-red-500/20", Icon: XCircle },
  BLOCKED: { color: "text-red-400", bgColor: "bg-red-500/20", Icon: AlertTriangle },
  UNVERIFIED: { color: "text-gray-400", bgColor: "bg-gray-500/20", Icon: AlertTriangle },
};

const accountTypeStyles: Record<AccountType, { color: string; bgColor: string }> = {
  RETAIL: { color: "text-blue-400", bgColor: "bg-blue-500/20" },
  PROFESSIONAL: { color: "text-purple-400", bgColor: "bg-purple-500/20" },
  EXPERIENCED: { color: "text-indigo-400", bgColor: "bg-indigo-500/20" },
};

// ============================================================================
// Stats Card Component
// ============================================================================

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  subValue?: string;
}

function StatsCard({ label, value, icon, color = "text-white", subValue }: StatsCardProps) {
  return (
    <GlassCard hover padding="md" className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-white/50 text-xs font-medium uppercase tracking-wider truncate">
            {label}
          </p>
          <p className={`text-xl sm:text-2xl font-bold mt-1 ${color} truncate`}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subValue && <p className="text-white/40 text-xs mt-1 truncate">{subValue}</p>}
        </div>
        <div className="shrink-0 p-2 rounded-lg bg-white/5">{icon}</div>
      </div>
    </GlassCard>
  );
}

// ============================================================================
// Filter Options (dynamic based on i18n)
// ============================================================================

function getStatusFilterOptions(t: (key: string) => string): FilterOption[] {
  return [
    { value: "NEW", label: t("status.new") },
    { value: "PENDING_VERIFICATION", label: t("status.pendingVerification") },
    { value: "VERIFIED", label: t("status.verified") },
    { value: "REJECTED", label: t("status.rejected") },
    { value: "BLOCKED", label: t("status.blocked") },
    { value: "UNVERIFIED", label: t("status.unverified") },
  ];
}

function getTypeFilterOptions(t: (key: string) => string): FilterOption[] {
  return [
    { value: "RETAIL", label: t("customerTypes.retail") },
    { value: "PROFESSIONAL", label: t("customerTypes.professional") },
    { value: "EXPERIENCED", label: t("customerTypes.experienced") },
  ];
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getCustomerName(customer: Customer): string {
  const first = customer.personalDetails?.firstname || "";
  const last = customer.personalDetails?.lastname || "";
  return `${first} ${last}`.trim() || "Unknown";
}

function getTotalBalance(customer: Customer): number {
  return customer.tradingAccounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0;
}

// ============================================================================
// Table Column Definitions
// ============================================================================

function createColumns(
  onCustomerSelect: (id: string) => void,
  t: (key: string) => string,
  language: string
): Column<Customer>[] {
  const locale = language === "ko" ? "ko-KR" : "en-US";

  return [
    {
      key: "created",
      header: t("customers.registered"),
      width: "150px",
      sortable: true,
      sortFn: (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
      searchFn: (item, query) =>
        new Date(item.created).toLocaleDateString().toLowerCase().includes(query),
      render: (c) => (
        <div className="flex flex-col">
          <span className="text-sm text-white">
            {new Date(c.created).toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="text-xs text-white/40">
            {new Date(c.created).toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      ),
    },
    {
      key: "customer",
      header: t("customers.customer"),
      width: "280px",
      sortable: true,
      sortFn: (a, b) => getCustomerName(a).localeCompare(getCustomerName(b)),
      searchFn: (item, query) =>
        getCustomerName(item).toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.uuid.toLowerCase().includes(query),
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-white font-medium text-sm shrink-0">
            {(c.personalDetails?.firstname?.[0] || c.email[0] || "U").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate">{getCustomerName(c)}</p>
            <p className="text-white/40 text-xs truncate">{c.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: t("customers.type"),
      width: "100px",
      align: "center",
      sortable: true,
      filterable: true,
      filter: {
        type: "select",
        options: getTypeFilterOptions(t),
        placeholder: t("customers.allTypes"),
      },
      filterFn: (item, filterValue) => item.type === filterValue,
      sortFn: (a, b) => a.type.localeCompare(b.type),
      render: (c) => {
        const style = accountTypeStyles[c.type] || accountTypeStyles.RETAIL;
        const typeLabel =
          c.type === "RETAIL"
            ? t("customerTypes.retail")
            : c.type === "PROFESSIONAL"
              ? t("customerTypes.professional")
              : t("customerTypes.experienced");
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-white/5 ${style.bgColor} ${style.color}`}
          >
            {typeLabel}
          </span>
        );
      },
    },
    {
      key: "tradingAccounts",
      header: t("customers.accounts"),
      width: "100px",
      align: "center",
      sortable: true,
      sortFn: (a, b) => (a.tradingAccounts?.length || 0) - (b.tradingAccounts?.length || 0),
      render: (c) => {
        const count = c.tradingAccounts?.length || 0;
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              count > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-500/20 text-gray-400"
            }`}
          >
            {count}
          </span>
        );
      },
    },
    {
      key: "balance",
      header: t("customers.balance"),
      width: "130px",
      align: "right",
      sortable: true,
      sortFn: (a, b) => getTotalBalance(a) - getTotalBalance(b),
      searchFn: (item, query) => getTotalBalance(item).toString().includes(query),
      render: (c) => {
        const balance = getTotalBalance(c);
        return (
          <span
            className={`text-sm font-medium ${balance > 0 ? "text-emerald-400" : "text-white/50"}`}
          >
            {formatCurrency(balance)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("status.pending").replace(t("status.pending"), "Status"), // Header uses generic
      width: "130px",
      align: "center",
      sortable: true,
      filterable: true,
      filter: {
        type: "multiselect",
        options: getStatusFilterOptions(t),
        placeholder: t("customers.allStatuses"),
      },
      filterFn: (item, filterValue) => item.verificationStatus === filterValue,
      sortFn: (a, b) => a.verificationStatus.localeCompare(b.verificationStatus),
      searchFn: (item, query) =>
        item.verificationStatus.toLowerCase().replace(/_/g, " ").includes(query),
      render: (c) => {
        const style = statusStyles[c.verificationStatus] || statusStyles.UNVERIFIED;
        const statusLabel =
          c.verificationStatus === "NEW"
            ? t("status.new")
            : c.verificationStatus === "PENDING_VERIFICATION"
              ? t("status.pendingVerification")
              : c.verificationStatus === "VERIFIED"
                ? t("status.verified")
                : c.verificationStatus === "REJECTED"
                  ? t("status.rejected")
                  : c.verificationStatus === "BLOCKED"
                    ? t("status.blocked")
                    : t("status.unverified");
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-white/5 ${style.bgColor} ${style.color}`}
          >
            <style.Icon className="w-3 h-3" />
            {statusLabel}
          </span>
        );
      },
    },
    {
      key: "country",
      header: t("customers.location"),
      width: "140px",
      sortable: true,
      sortFn: (a, b) =>
        (a.addressDetails?.country || "").localeCompare(b.addressDetails?.country || ""),
      searchFn: (item, query) =>
        item.addressDetails?.country?.toLowerCase().includes(query) ||
        item.addressDetails?.city?.toLowerCase().includes(query) ||
        false,
      render: (c) => (
        <div className="flex flex-col">
          <span className="text-sm text-white">{c.addressDetails?.country || "-"}</span>
          <span className="text-xs text-white/40">{c.addressDetails?.city || ""}</span>
        </div>
      ),
    },
  ];
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function CustomersPage() {
  const router = useRouter();
  const { customers, isLoading, error, fetchAllCustomers, clearError } = useCustomerStore();
  const { t, language } = useTranslation();

  // Fetch all customers on initial load
  useEffect(() => {
    fetchAllCustomers();
  }, [fetchAllCustomers]);

  // Handle customer selection
  const handleCustomerSelect = useCallback(
    (customer: Customer) => {
      router.push(`/customers/${customer.uuid}`);
    },
    [router]
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    clearError();
    fetchAllCustomers();
  }, [fetchAllCustomers, clearError]);

  // Create columns with click handler
  const columns = useMemo(
    () => createColumns((id) => router.push(`/customers/${id}`), t, language),
    [router, t, language]
  );

  // Calculate stats
  const stats = useMemo(() => {
    const verified = customers.filter((c) => c.verificationStatus === "VERIFIED").length;
    const pending = customers.filter((c) => c.verificationStatus === "PENDING_VERIFICATION").length;
    const newCount = customers.filter((c) => c.verificationStatus === "NEW").length;
    const totalBalance = customers.reduce((sum, c) => sum + getTotalBalance(c), 0);

    return { verified, pending, newCount, totalBalance };
  }, [customers]);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-500/30 to-violet-500/30 border border-sky-500/20">
              <Users className="w-7 h-7 text-sky-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{t("customers.title")}</h1>
              <p className="text-white/50 text-sm mt-0.5">{t("customers.subtitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-white/50">Supabase</span>
            </div>
            <Button
              variant="secondary"
              onClick={handleRefresh}
              leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />}
              disabled={isLoading}
            >
              {t("common.refresh")}
            </Button>
          </div>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="mb-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-red-200 text-sm font-medium">{t("customers.failedToLoad")}</p>
              <p className="text-red-300/70 text-xs mt-1">{error}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleRefresh}>
              {t("common.retry")}
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <StatsCard
          label={t("customers.totalCustomers")}
          value={customers.length}
          icon={<Users className="w-5 h-5 text-sky-400" />}
          color="text-white"
        />
        <StatsCard
          label={t("customers.totalBalance")}
          value={formatCurrency(stats.totalBalance)}
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          color="text-emerald-400"
        />
        <StatsCard
          label={t("status.verified")}
          value={stats.verified}
          icon={<UserCheck className="w-5 h-5 text-emerald-400" />}
          color="text-emerald-400"
        />
        <StatsCard
          label={t("status.pending")}
          value={stats.pending}
          icon={<Clock className="w-5 h-5 text-amber-400" />}
          color="text-amber-400"
        />
        <StatsCard
          label={t("status.new")}
          value={stats.newCount}
          icon={<UserPlus className="w-5 h-5 text-sky-400" />}
          color="text-sky-400"
        />
      </div>

      {/* Main Table */}
      <GlassCard padding="none" className="overflow-hidden">
        {/* Loading State */}
        {isLoading && customers.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-sky-400 border-t-transparent" />
              <p className="text-white/50 text-sm">{t("customers.loadingCustomers")}</p>
            </div>
          </div>
        ) : (
          <VirtualizedTable
            data={customers}
            columns={columns}
            rowHeight={64}
            overscan={15}
            getRowKey={(item) => item.uuid}
            onRowClick={handleCustomerSelect}
            searchPlaceholder={t("customers.searchPlaceholder")}
            emptyMessage={t("customers.noCustomersFound")}
            maxHeight="calc(100vh - 380px)"
            showSearch={true}
            showRowCount={true}
            storageKey="customers"
          />
        )}
      </GlassCard>
    </div>
  );
}
