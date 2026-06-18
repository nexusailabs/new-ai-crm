"use client";

/**
 * Deposits Page (Virtualized + Real-time)
 * High-performance dashboard with virtual scrolling for 10,000+ rows
 * Created: 2025-12-29
 * Updated: 2025-12-29 - Virtual scrolling optimization
 */

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { VirtualizedTable, type Column, type FilterOption } from "@/components/ui/VirtualizedTable";
import {
  ArrowDownRight,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useDeposits } from "@/hooks/useDeposits";
import type { DepositEvent, PaymentStatus, PaymentStats } from "@/types/payment";

// ============================================================================
// Types
// ============================================================================

interface EnrichedDeposit extends DepositEvent {
  // All fields from DepositEvent are available
}

// ============================================================================
// Status Configuration
// ============================================================================

const statusConfig: Record<PaymentStatus, { label: string; color: string; bgColor: string; Icon: typeof Clock }> = {
  PENDING: { label: "Pending", color: "text-amber-400", bgColor: "bg-amber-500/20", Icon: Clock },
  APPROVED: { label: "Approved", color: "text-emerald-400", bgColor: "bg-emerald-500/20", Icon: CheckCircle },
  REJECTED: { label: "Rejected", color: "text-red-400", bgColor: "bg-red-500/20", Icon: XCircle },
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
          <p className="text-white/50 text-xs font-medium uppercase tracking-wider truncate">{label}</p>
          <p className={`text-xl sm:text-2xl font-bold mt-1 ${color} truncate`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subValue && (
            <p className="text-white/40 text-xs mt-1 truncate">{subValue}</p>
          )}
        </div>
        <div className="shrink-0 p-2 rounded-lg bg-white/5">{icon}</div>
      </div>
    </GlassCard>
  );
}

// ============================================================================
// Connection Status Component
// ============================================================================

function ConnectionStatus({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {isOnline ? (
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
          <Wifi className="w-3 h-3" />
          Online
        </span>
      ) : (
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
          <WifiOff className="w-3 h-3" />
          Offline
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Filter Options
// ============================================================================

const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

// Dynamic method options generator
function getMethodOptions(data: EnrichedDeposit[]): FilterOption[] {
  const methodCounts: Record<string, number> = {};

  data.forEach(item => {
    const method = item.method || "Unknown";
    methodCounts[method] = (methodCounts[method] || 0) + 1;
  });

  return Object.entries(methodCounts)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .map(([method, count]) => ({
      value: method,
      label: method.replace(/_/g, " "),
      count,
    }));
}

// ============================================================================
// Table Column Definitions
// ============================================================================

function createColumns(): Column<EnrichedDeposit>[] {
  return [
    {
      key: "timestamp",
      header: "Date / ID",
      width: "180px",
      sortable: true,
      sortFn: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      searchFn: (item, query) =>
        item.uuid.toLowerCase().includes(query) ||
        new Date(item.timestamp).toLocaleString().toLowerCase().includes(query),
      render: (d) => (
        <div className="flex flex-col">
          <span className="text-sm text-white">
            {new Date(d.timestamp).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="text-xs text-white/40 font-mono truncate max-w-[150px]">
            {d.uuid.slice(0, 8)}...
          </span>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      width: "250px",
      sortable: true,
      sortFn: (a, b) => {
        const nameA = `${a.accountInfo?.name || ''} ${a.accountInfo?.surname || ''}`.toLowerCase();
        const nameB = `${b.accountInfo?.name || ''} ${b.accountInfo?.surname || ''}`.toLowerCase();
        return nameA.localeCompare(nameB);
      },
      searchFn: (item, query) =>
        item.accountInfo?.name?.toLowerCase().includes(query) ||
        item.accountInfo?.surname?.toLowerCase().includes(query) ||
        item.accountInfo?.email?.toLowerCase().includes(query) ||
        false,
      render: (d) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-medium text-sm shrink-0">
            {(d.accountInfo?.name?.[0] || "U")}
            {(d.accountInfo?.surname?.[0] || "")}
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate">
              {d.accountInfo?.name || "Unknown"} {d.accountInfo?.surname || ""}
            </p>
            <p className="text-white/40 text-xs truncate">
              {d.accountInfo?.email || "No email"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      width: "130px",
      align: "right",
      sortable: true,
      filterable: true,
      filter: {
        type: "multiselect",
        getOptions: (data) => getMethodOptions(data as EnrichedDeposit[]),
        placeholder: "All methods",
      },
      filterFn: (item, filterValue) => {
        const method = item.method || "Unknown";
        return method === filterValue;
      },
      sortFn: (a, b) => a.amount - b.amount,
      searchFn: (item, query) =>
        item.amount.toString().includes(query) ||
        item.currency?.toLowerCase().includes(query) ||
        false,
      render: (d) => (
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold text-emerald-400">
            +{new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: d.currency || "USD",
              minimumFractionDigits: 2,
            }).format(d.amount)}
          </span>
          <span className="text-xs text-white/40">
            {d.method || "Unknown"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      align: "center",
      sortable: true,
      filterable: true,
      filter: {
        type: "select",
        options: STATUS_FILTER_OPTIONS,
        placeholder: "All statuses",
      },
      filterFn: (item, filterValue) => item.status === filterValue,
      sortFn: (a, b) => a.status.localeCompare(b.status),
      searchFn: (item, query) => item.status.toLowerCase().includes(query),
      render: (d) => {
        const status = statusConfig[d.status] || statusConfig.PENDING;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-white/5 ${status.bgColor} ${status.color}`}
          >
            <status.Icon className="w-3 h-3" />
            {status.label}
          </span>
        );
      },
    },
  ];
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function DepositsPage() {
  const { deposits, stats, isLoading, error, refresh, isOnline, metadata } = useDeposits();

  // Create columns once
  const columns = useMemo(() => createColumns(), []);

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-500/20">
              <ArrowDownRight className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Deposits</h1>
              <p className="text-white/50 text-sm mt-0.5">
                Real-time deposit monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ConnectionStatus isOnline={isOnline} />
            <Button
              variant="secondary"
              onClick={refresh}
              leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="mb-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-red-200 text-sm font-medium">Failed to load deposits</p>
              <p className="text-red-300/70 text-xs mt-1">{error}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={refresh}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <StatsCard
            label="Total Amount"
            value={formatCurrency(stats.totalAmount)}
            icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            color="text-emerald-400"
          />
          <StatsCard
            label="Total Count"
            value={stats.totalCount}
            icon={<ArrowDownRight className="w-5 h-5 text-sky-400" />}
            color="text-white"
          />
          <StatsCard
            label="Pending"
            value={stats.pendingCount}
            subValue={formatCurrency(stats.pendingAmount)}
            icon={<Clock className="w-5 h-5 text-amber-400" />}
            color="text-amber-400"
          />
          <StatsCard
            label="Approved"
            value={stats.approvedCount}
            subValue={formatCurrency(stats.approvedAmount)}
            icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
            color="text-emerald-400"
          />
          <StatsCard
            label="Rejected"
            value={stats.rejectedCount}
            subValue={formatCurrency(stats.rejectedAmount)}
            icon={<XCircle className="w-5 h-5 text-red-400" />}
            color="text-red-400"
          />
        </div>
      )}

      {/* Main Table */}
      <GlassCard padding="none" className="overflow-hidden">
        {/* Table Header Info */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Deposit Transactions</h2>
            {metadata && (
              <p className="text-white/40 text-xs">
                Fetched at {new Date(metadata.fetchedAt || '').toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && deposits.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-400 border-t-transparent" />
              <p className="text-white/50 text-sm">Loading deposits...</p>
            </div>
          </div>
        ) : (
          <>
            <VirtualizedTable
              data={deposits}
              columns={columns}
              rowHeight={64}
              overscan={15}
              getRowKey={(item) => item.uuid}
              searchPlaceholder="Search by name, email, UUID, amount..."
              emptyMessage="No deposits found"
              maxHeight="calc(100vh - 380px)"
              showSearch={true}
              showRowCount={true}
              storageKey="deposits"
            />
          </>
        )}
      </GlassCard>
    </div>
  );
}
