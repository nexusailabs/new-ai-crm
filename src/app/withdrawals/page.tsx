"use client";

/**
 * Withdrawals Page (Virtualized + Real-time)
 * High-performance dashboard with virtual scrolling for 10,000+ rows
 * Created: 2025-12-29
 * Updated: 2025-12-29 - Virtual scrolling optimization
 * Updated: 2025-12-29 - Withdrawal action buttons (MISSION-20251229-0713)
 */

import { useMemo, useCallback, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { VirtualizedTable, type Column, type FilterOption } from "@/components/ui/VirtualizedTable";
import {
  ArrowUpRight,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Database,
  Wifi,
  WifiOff,
  Radio,
  Zap,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useWithdrawals } from "@/hooks/useWithdrawals";
import { useRealtimeWithdrawals } from "@/hooks/useRealtimeWithdrawals";
import { useWithdrawalAction } from "@/hooks/useWithdrawalAction";
import type { WithdrawalEvent, PaymentStatus } from "@/types/payment";

// ============================================================================
// Types
// ============================================================================

interface EnrichedWithdrawal extends WithdrawalEvent {
  verificationStatus?: "VERIFIED" | "PENDING" | "REJECTED" | "NEW";
  accountHealth?: {
    balance: number;
    equity: number;
    openPositionsCount: number;
  };
}

// ============================================================================
// Action Buttons Component (uses hook internally)
// ============================================================================

interface ActionButtonsProps {
  uuid: string;
  status: PaymentStatus;
  onActionStart?: () => void;
  onActionComplete?: (success: boolean) => void;
}

function WithdrawalActionButtons({ uuid, status, onActionStart, onActionComplete }: ActionButtonsProps) {
  const [processingAction, setProcessingAction] = useState<'APPROVE' | 'REJECT' | null>(null);

  const { approve, reject, isLoading } = useWithdrawalAction({
    onSuccess: (data) => {
      setProcessingAction(null);
      onActionComplete?.(data.success);
    },
    onError: () => {
      setProcessingAction(null);
      onActionComplete?.(false);
    },
  });

  const isPending = status === "PENDING";

  const handleApprove = useCallback(() => {
    setProcessingAction('APPROVE');
    onActionStart?.();
    approve(uuid, 'Approved via AI CRM Dashboard');
  }, [uuid, approve, onActionStart]);

  const handleReject = useCallback(() => {
    setProcessingAction('REJECT');
    onActionStart?.();
    reject(uuid, 'Rejected via AI CRM Dashboard');
  }, [uuid, reject, onActionStart]);

  if (!isPending) {
    return <span className="text-[10px] text-white/20 italic">Processed</span>;
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        onClick={handleApprove}
        disabled={isLoading}
        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Approve withdrawal"
      >
        {processingAction === 'APPROVE' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle className="w-4 h-4" />
        )}
      </button>
      <button
        onClick={handleReject}
        disabled={isLoading}
        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Reject withdrawal"
      >
        {processingAction === 'REJECT' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <XCircle className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

// ============================================================================
// Constants
// ============================================================================

const statusConfig: Record<
  PaymentStatus,
  { label: string; color: string; bgColor: string; Icon: typeof Clock }
> = {
  PENDING: {
    label: "Pending",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    Icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    Icon: CheckCircle,
  },
  REJECTED: {
    label: "Rejected",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    Icon: XCircle,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (amount: number, currency: string = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (timestamp: string) => {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// ============================================================================
// Sub Components
// ============================================================================

function DataSourceBadge({
  source,
  apiAvailable,
  duration,
  dbCount,
  deltaCount,
}: {
  source: string;
  apiAvailable: boolean;
  duration: number;
  dbCount: number;
  deltaCount: number;
}) {
  const getSourceInfo = () => {
    switch (source) {
      case "hybrid":
        return {
          icon: <Database className="w-3 h-3" />,
          label: "Hybrid",
          color: "text-emerald-400",
          bgColor: "bg-emerald-500/10",
        };
      case "cache-only":
        return {
          icon: <Database className="w-3 h-3" />,
          label: "Cache",
          color: "text-amber-400",
          bgColor: "bg-amber-500/10",
        };
      case "api-only":
        return {
          icon: <Wifi className="w-3 h-3" />,
          label: "API",
          color: "text-sky-400",
          bgColor: "bg-sky-500/10",
        };
      default:
        return {
          icon: <WifiOff className="w-3 h-3" />,
          label: "Unknown",
          color: "text-white/50",
          bgColor: "bg-white/5",
        };
    }
  };

  const info = getSourceInfo();

  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${info.bgColor} ${info.color}`}
      >
        {info.icon}
        {info.label}
      </span>
      <span className="text-white/30">{duration}ms</span>
      {source === "hybrid" && (
        <span className="text-white/30">
          DB:{dbCount} Delta:{deltaCount}
        </span>
      )}
      {!apiAvailable && (
        <span className="text-amber-400 flex items-center gap-0.5">
          <WifiOff className="w-2.5 h-2.5" />
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
function getMethodOptions(data: EnrichedWithdrawal[]): FilterOption[] {
  const methodCounts: Record<string, number> = {};

  data.forEach(item => {
    const method = item.method || "BANK_WIRE";
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

function createColumns(): Column<EnrichedWithdrawal>[] {
  return [
    {
      key: "timestamp",
      header: "Date / ID",
      width: "140px",
      sortable: true,
      sortFn: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      searchFn: (item, query) =>
        item.uuid.toLowerCase().includes(query) ||
        item.transactionId?.toLowerCase().includes(query) ||
        false,
      render: (w) => (
        <div className="flex flex-col">
          <span className="text-xs font-mono text-white/70 mb-0.5">
            {w.uuid.slice(0, 8)}...
          </span>
          <span className="text-[10px] text-white/40">
            {formatDate(w.timestamp)}
          </span>
        </div>
      ),
    },
    {
      key: "user",
      header: "User Profile",
      width: "220px",
      sortable: true,
      sortFn: (a, b) =>
        (a.accountInfo?.name || "").localeCompare(b.accountInfo?.name || ""),
      searchFn: (item, query) =>
        item.accountInfo?.name?.toLowerCase().includes(query) ||
        item.accountInfo?.surname?.toLowerCase().includes(query) ||
        item.accountInfo?.email?.toLowerCase().includes(query) ||
        false,
      render: (w) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {w.accountInfo?.name?.[0]}
            {w.accountInfo?.surname?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white truncate">
                {w.accountInfo?.name} {w.accountInfo?.surname}
              </span>
              {w.verificationStatus === "VERIFIED" ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-white/40 truncate">
              {w.accountInfo?.email}
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
        getOptions: (data) => getMethodOptions(data as EnrichedWithdrawal[]),
        placeholder: "All methods",
      },
      filterFn: (item, filterValue) => {
        const method = item.method || "BANK_WIRE";
        return method === filterValue;
      },
      sortFn: (a, b) => a.amount - b.amount,
      searchFn: (item, query) =>
        item.amount.toString().includes(query) ||
        item.currency?.toLowerCase().includes(query) ||
        false,
      render: (w) => (
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold text-orange-400">
            {formatCurrency(w.amount, w.currency)}
          </span>
          <span className="text-[10px] text-white/40 uppercase bg-white/5 px-1.5 rounded">
            {w.method || "BANK_WIRE"}
          </span>
        </div>
      ),
    },
    {
      key: "health",
      header: "Account Health",
      width: "150px",
      sortable: true,
      sortFn: (a, b) => (a.accountHealth?.equity || 0) - (b.accountHealth?.equity || 0),
      render: (w) => (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] gap-4">
            <span className="text-white/40">Equity</span>
            <span
              className={`font-mono ${
                w.accountHealth?.equity && w.accountHealth.equity < w.amount
                  ? "text-red-400 font-bold"
                  : "text-emerald-400"
              }`}
            >
              ${w.accountHealth?.equity?.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] gap-4">
            <span className="text-white/40">Open Ops</span>
            <span className="text-white/70">
              {w.accountHealth?.openPositionsCount} orders
            </span>
          </div>
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
      render: (w) => {
        const status = statusConfig[w.status] || statusConfig.PENDING;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-white/5 ${status.bgColor} ${status.color}`}
          >
            {status.label}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      width: "100px",
      align: "right",
      render: (w) => (
        <WithdrawalActionButtons
          uuid={w.uuid}
          status={w.status}
        />
      ),
    },
  ];
}

// ============================================================================
// Main Component
// ============================================================================

export default function WithdrawalsPage() {
  const {
    withdrawals: rawWithdrawals,
    stats,
    isLoading,
    isFetching,
    isError,
    error,
    metadata,
    refresh,
    triggerSync,
    isSyncing,
  } = useWithdrawals({
    limit: 10000,
    refetchInterval: 30 * 1000,
  });

  // Supabase Realtime subscription
  const { isConnected: isRealtimeConnected, stats: realtimeStats } =
    useRealtimeWithdrawals({ enabled: true });

  // Memoized enriched data - computed once, used for search/sort
  const withdrawals = useMemo<EnrichedWithdrawal[]>(() => {
    return rawWithdrawals.map((w) => ({
      ...w,
      verificationStatus: w.accountInfo?.email?.includes("admin")
        ? "VERIFIED"
        : "PENDING",
      accountHealth: {
        balance: w.amount * 2.5,
        equity: w.amount * 2.1,
        openPositionsCount: Math.floor(Math.random() * 5),
      },
    }));
  }, [rawWithdrawals]);

  // Memoized columns
  const columns = useMemo(() => createColumns(), []);

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Compact Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/20">
            <ArrowUpRight className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-none">
              Withdrawals
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-white/50 text-xs">
                Global Transaction Monitoring
              </p>
              {metadata && (
                <DataSourceBadge
                  source={metadata.source}
                  apiAvailable={metadata.apiAvailable}
                  duration={metadata.duration}
                  dbCount={metadata.dbCount}
                  deltaCount={metadata.deltaCount}
                />
              )}
              {/* Realtime Connection Status */}
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                  isRealtimeConnected
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                <Radio
                  className={`w-2.5 h-2.5 ${isRealtimeConnected ? "animate-pulse" : ""}`}
                />
                {isRealtimeConnected ? "Live" : "Offline"}
              </span>
              {realtimeStats.lastEventAt && (
                <span className="text-[10px] text-white/30 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  {realtimeStats.insertCount + realtimeStats.updateCount} events
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={triggerSync}
            leftIcon={
              <Database
                className={`w-3.5 h-3.5 ${isSyncing ? "animate-pulse" : ""}`}
              />
            }
            disabled={isSyncing}
          >
            Sync
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refresh()}
            leftIcon={
              <RefreshCw
                className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
              />
            }
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </header>

      {/* Error State */}
      {isError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm flex-1">
            {error?.message || "Failed to load withdrawals"}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refresh()}>
            Retry
          </Button>
        </div>
      )}

      {/* API Warning */}
      {metadata?.warning && !isError && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-amber-300 text-xs">{metadata.warning}</p>
        </div>
      )}

      {/* KPI Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassCard padding="sm" className="flex flex-col justify-center">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">
              Total Volume
            </p>
            <p className="text-lg font-bold text-orange-400">
              {formatCurrency(stats.totalAmount)}
            </p>
          </GlassCard>
          <GlassCard padding="sm" className="flex flex-col justify-center">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">
              Pending Review
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-bold text-amber-400">
                {stats.pendingCount}
              </p>
              <span className="text-xs text-white/30">reqs</span>
            </div>
          </GlassCard>
          <GlassCard padding="sm" className="flex flex-col justify-center">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">
              Processed Today
            </p>
            <p className="text-lg font-bold text-emerald-400">
              {stats.approvedCount}
            </p>
          </GlassCard>
          <GlassCard padding="sm" className="flex flex-col justify-center">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">
              Rejected
            </p>
            <p className="text-lg font-bold text-red-400">
              {stats.rejectedCount}
            </p>
          </GlassCard>
        </div>
      )}

      {/* Main Data Table with Virtual Scrolling */}
      <GlassCard padding="none" className="overflow-hidden relative">
        {isLoading && withdrawals.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-400" />
          </div>
        ) : (
          <>
            {/* Background fetch indicator */}
            {isFetching && !isLoading && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent animate-pulse z-20" />
            )}
            <VirtualizedTable
              data={withdrawals}
              columns={columns}
              rowHeight={64}
              overscan={15}
              getRowKey={(item) => item.uuid}
              searchPlaceholder="Search by name, email, UUID, amount..."
              emptyMessage="No withdrawals found"
              maxHeight="calc(100vh - 380px)"
              showSearch={true}
              showRowCount={true}
              storageKey="withdrawals"
            />
          </>
        )}
      </GlassCard>
    </div>
  );
}
