"use client";

/**
 * CustomerList Component with Virtual Scrolling
 * Ported from sep-crm-v2 with adaptations for new-ai-crm Customer type
 * Uses react-window v2 List for performance
 * Updated: 2025-12-28
 */

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  ReactNode,
  CSSProperties,
} from "react";
import { List } from "react-window";
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Customer, VerificationStatus } from "@/types/customer";

// Verification status options for filter dropdown
const VERIFICATION_STATUS_OPTIONS: {
  value: VerificationStatus | "ALL";
  label: string;
}[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "NEW", label: "New" },
  { value: "PENDING_VERIFICATION", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "UNVERIFIED", label: "Unverified" },
];

const statusColors: Record<
  VerificationStatus,
  { bg: string; text: string; icon: ReactNode }
> = {
  NEW: {
    bg: "bg-sky-500/20",
    text: "text-sky-400",
    icon: <Clock className="w-3 h-3" />,
  },
  PENDING_VERIFICATION: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    icon: <Clock className="w-3 h-3" />,
  },
  VERIFIED: {
    bg: "bg-green-500/20",
    text: "text-green-400",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  REJECTED: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    icon: <XCircle className="w-3 h-3" />,
  },
  BLOCKED: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  UNVERIFIED: {
    bg: "bg-gray-500/20",
    text: "text-gray-400",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc' | null;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "rowNumber", label: "#", visible: true },
  { key: "email", label: "Email", visible: true },
  { key: "name", label: "Name", visible: true },
  { key: "verificationStatus", label: "Status", visible: true },
  { key: "tradingAccountsCount", label: "Trading Accounts", visible: true },
  { key: "totalBalance", label: "Total Balance", visible: true },
  { key: "created", label: "Created", visible: true },
  { key: "type", label: "Type", visible: false },
  { key: "country", label: "Country", visible: false },
  { key: "city", label: "City", visible: false },
  { key: "phone", label: "Phone", visible: false },
  { key: "updated", label: "Updated", visible: false },
  { key: "citizenship", label: "Citizenship", visible: false },
  { key: "language", label: "Language", visible: false },
  { key: "dateOfBirth", label: "Birth Date", visible: false },
  { key: "accountManager", label: "Manager", visible: false },
  { key: "branchUuid", label: "Branch", visible: false },
  { key: "leadSource", label: "Lead Source", visible: false },
  { key: "leadStatus", label: "Lead Status", visible: false },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Get value from Customer object
function getValue(customer: Customer, key: string): string | number {
  switch (key) {
    case "email":
      return customer.email;
    case "name":
      return `${customer.personalDetails.firstname || ""} ${customer.personalDetails.lastname || ""}`.trim() ||
        "-";
    case "verificationStatus":
      return customer.verificationStatus;
    case "tradingAccountsCount":
      return customer.tradingAccounts?.length || 0;
    case "totalBalance":
      return customer.tradingAccounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0;
    case "type":
      return customer.type;
    case "country":
      return customer.addressDetails?.country || "-";
    case "city":
      return customer.addressDetails?.city || "-";
    case "phone":
      return customer.contactDetails?.phoneNumber || "-";
    case "created":
      return customer.created;
    case "updated":
      return customer.updated;
    case "citizenship":
      return customer.personalDetails?.citizenship || "-";
    case "language":
      return customer.personalDetails?.language || "-";
    case "dateOfBirth":
      return customer.personalDetails?.dateOfBirth || "-";
    case "accountManager":
      return customer.accountConfiguration?.accountManager?.name ||
             customer.accountConfiguration?.accountManager?.email || "-";
    case "branchUuid":
      return customer.accountConfiguration?.branchUuid || "-";
    case "leadSource":
      return customer.leadDetails?.source || "-";
    case "leadStatus":
      return customer.leadDetails?.statusUuid || "-";
    default:
      return "-";
  }
}

// Column width helper
function getColumnWidth(key: string): number {
  const widths: Record<string, number> = {
    rowNumber: 50,
    email: 220,
    name: 150,
    verificationStatus: 140,
    tradingAccountsCount: 130,
    totalBalance: 140,
    type: 100,
    country: 120,
    city: 100,
    phone: 130,
    created: 140,
    updated: 140,
    citizenship: 90,
    language: 80,
    dateOfBirth: 100,
    accountManager: 140,
    branchUuid: 100,
    leadSource: 110,
    leadStatus: 100,
  };
  return widths[key] || 100;
}

interface CustomerListProps {
  customers: Customer[];
  isLoading: boolean;
  error: string | null;
  onCustomerSelect?: (customerId: string) => void;
}

// Additional row props for react-window v2 (index and style are provided automatically)
interface CustomRowProps {
  customers: Customer[];
  visibleColumns: ColumnConfig[];
  onCustomerSelect?: (customerId: string) => void;
}

// Full row component props (includes auto-injected index/style plus our custom props)
interface RowComponentFullProps extends CustomRowProps {
  index: number;
  style: CSSProperties;
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
}

// Row Component for react-window v2
function RowComponent({
  index,
  style,
  customers,
  visibleColumns,
  onCustomerSelect,
}: RowComponentFullProps): React.ReactElement {
  const customer = customers[index];

  return (
    <div
      style={style}
      className="flex border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
      onClick={() => onCustomerSelect?.(customer.uuid)}
    >
      {visibleColumns.map((col) => {
        const value = getValue(customer, col.key);

        // Row number column
        if (col.key === "rowNumber") {
          return (
            <div
              key={col.key}
              className="flex-shrink-0 px-4 py-3 text-white/50 text-sm flex items-center justify-center font-mono"
              style={{ width: getColumnWidth(col.key) }}
            >
              {index + 1}
            </div>
          );
        }

        // Special rendering for status
        if (col.key === "verificationStatus") {
          const status = customer.verificationStatus;
          const config = statusColors[status] || statusColors.UNVERIFIED;
          return (
            <div
              key={col.key}
              className="flex-shrink-0 px-4 py-3 flex items-center"
              style={{ width: getColumnWidth(col.key) }}
            >
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
              >
                {config.icon}
                {status.replace(/_/g, " ")}
              </span>
            </div>
          );
        }

        // Type column (RETAIL, PROFESSIONAL, EXPERIENCED)
        if (col.key === "type") {
          const type = customer.type;
          const typeColors: Record<string, string> = {
            RETAIL: "bg-blue-500/20 text-blue-400",
            PROFESSIONAL: "bg-purple-500/20 text-purple-400",
            EXPERIENCED: "bg-indigo-500/20 text-indigo-400",
          };
          return (
            <div
              key={col.key}
              className="flex-shrink-0 px-4 py-3 flex items-center"
              style={{ width: getColumnWidth(col.key) }}
            >
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${typeColors[type] || "bg-gray-500/20 text-gray-400"}`}
              >
                {type}
              </span>
            </div>
          );
        }

        // Date formatting for created and updated
        if (col.key === "created" || col.key === "updated") {
          return (
            <div
              key={col.key}
              className="flex-shrink-0 px-4 py-3 text-white/60 text-sm flex items-center"
              style={{ width: getColumnWidth(col.key) }}
            >
              {formatDate(value as string)}
            </div>
          );
        }

        // Date formatting for dateOfBirth
        if (col.key === "dateOfBirth" && value !== "-") {
          return (
            <div
              key={col.key}
              className="flex-shrink-0 px-4 py-3 text-white/60 text-sm flex items-center"
              style={{ width: getColumnWidth(col.key) }}
            >
              {value}
            </div>
          );
        }

        // Email with avatar
        if (col.key === "email") {
          const fullName =
            `${customer.personalDetails.firstname || ""} ${customer.personalDetails.lastname || ""}`.trim();
          return (
            <div
              key={col.key}
              className="flex-shrink-0 px-4 py-3 flex items-center"
              style={{ width: getColumnWidth(col.key) }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-medium">
                    {fullName?.[0] ||
                      value.toString()[0]?.toUpperCase() ||
                      "?"}
                  </span>
                </div>
                <span className="text-white text-sm truncate max-w-[180px]">
                  {value}
                </span>
              </div>
            </div>
          );
        }

        // Trading Accounts count column - show count and total balance
        if (col.key === "tradingAccountsCount") {
          const accounts = customer.tradingAccounts || [];
          const count = accounts.length;
          const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
          const hasRealBalance = totalBalance > 0;

          return (
            <div
              key={col.key}
              className="flex-shrink-0 px-4 py-3 flex items-center gap-2"
              style={{ width: getColumnWidth(col.key) }}
            >
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  count > 0
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-gray-500/20 text-gray-400"
                }`}
              >
                {count}
              </span>
              {hasRealBalance && (
                <span className="text-xs text-emerald-400/70">
                  ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          );
        }

        // Total Balance column
        if (col.key === "totalBalance") {
          const totalBalance = customer.tradingAccounts?.reduce(
            (sum, acc) => sum + (acc.balance || 0),
            0
          ) || 0;
          return (
            <div
              key={col.key}
              className="flex-shrink-0 px-4 py-3 flex items-center justify-end"
              style={{ width: getColumnWidth(col.key) }}
            >
              <span
                className={`text-sm font-medium ${
                  totalBalance > 0 ? "text-emerald-400" : "text-white/50"
                }`}
              >
                {formatCurrency(totalBalance)}
              </span>
            </div>
          );
        }

        return (
          <div
            key={col.key}
            className="flex-shrink-0 px-4 py-3 text-white/70 text-sm flex items-center truncate"
            style={{ width: getColumnWidth(col.key) }}
          >
            {value}
          </div>
        );
      })}
    </div>
  );
}

export function CustomerList({
  customers,
  isLoading,
  error,
  onCustomerSelect,
}: CustomerListProps): React.ReactElement {
  const [columns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "ALL">(
    "ALL"
  );
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(600);

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible),
    [columns]
  );

  // Calculate available height for virtual list
  useEffect(() => {
    const updateHeight = (): void => {
      if (containerRef.current) {
        const availableHeight = window.innerHeight - 400;
        setListHeight(Math.max(400, availableHeight));
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Handle sort
  const handleSort = (key: string): void => {
    if (key === 'rowNumber') return; // Don't sort by row number
    setSortConfig(prev => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      if (prev.direction === 'desc') return { key: '', direction: null };
      return { key, direction: 'asc' };
    });
  };

  // Filter and sort customers
  const filteredAndSortedCustomers = useMemo(() => {
    let result = statusFilter === "ALL"
      ? customers
      : customers.filter((c) => c.verificationStatus === statusFilter);

    if (sortConfig.key && sortConfig.direction) {
      result = [...result].sort((a, b) => {
        const aVal = getValue(a, sortConfig.key);
        const bVal = getValue(b, sortConfig.key);
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [customers, statusFilter, sortConfig]);

  // Stats calculation
  const stats = useMemo(() => {
    return {
      total: customers.length,
      verified: customers.filter((c) => c.verificationStatus === "VERIFIED")
        .length,
      pending: customers.filter(
        (c) => c.verificationStatus === "PENDING_VERIFICATION"
      ).length,
      new: customers.filter((c) => c.verificationStatus === "NEW").length,
    };
  }, [customers]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <GlassCard key={i} padding="sm" className="text-center">
              <div className="animate-pulse">
                <div className="h-3 w-16 bg-white/10 rounded mx-auto mb-2" />
                <div className="h-8 w-12 bg-white/10 rounded mx-auto" />
              </div>
            </GlassCard>
          ))}
        </div>
        <GlassCard padding="none" className="overflow-hidden">
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 bg-white/10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-white/10 rounded" />
                  <div className="h-3 w-48 bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <GlassCard className="text-center py-12">
        <div className="text-red-400 text-lg font-medium mb-2">
          Error Loading Customers
        </div>
        <p className="text-white/60">{error}</p>
        <p className="text-white/40 text-sm mt-2">
          Please check your connection and try again.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <GlassCard padding="sm" className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-white/50 text-xs uppercase tracking-wide">
              Total
            </span>
          </div>
          <p className="text-white text-2xl font-bold">
            {stats.total.toLocaleString()}
          </p>
        </GlassCard>
        <GlassCard padding="sm" className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-white/50 text-xs uppercase tracking-wide">
              Verified
            </span>
          </div>
          <p className="text-green-400 text-2xl font-bold">{stats.verified}</p>
        </GlassCard>
        <GlassCard padding="sm" className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-white/50 text-xs uppercase tracking-wide">
              Pending
            </span>
          </div>
          <p className="text-yellow-400 text-2xl font-bold">{stats.pending}</p>
        </GlassCard>
        <GlassCard padding="sm" className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-sky-400" />
            <span className="text-white/50 text-xs uppercase tracking-wide">
              New
            </span>
          </div>
          <p className="text-sky-400 text-2xl font-bold">{stats.new}</p>
        </GlassCard>
      </div>

      {/* Toolbar: Filter Dropdown */}
      <div className="flex items-center justify-between gap-4">
        {/* Status Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-all"
          >
            {statusFilter === "ALL" ? (
              <Users className="w-4 h-4" />
            ) : (
              statusColors[statusFilter].icon
            )}
            <span className="text-sm">
              {VERIFICATION_STATUS_OPTIONS.find((o) => o.value === statusFilter)
                ?.label}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${filterDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {filterDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setFilterDropdownOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-2 z-50 w-56 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden"
                >
                  {VERIFICATION_STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setStatusFilter(option.value);
                        setFilterDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        statusFilter === option.value
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {option.value === "ALL" ? (
                        <Users className="w-4 h-4 text-blue-400" />
                      ) : (
                        <span className={statusColors[option.value].text}>
                          {statusColors[option.value].icon}
                        </span>
                      )}
                      <span className="text-sm">{option.label}</span>
                      {statusFilter === option.value && (
                        <CheckCircle className="w-4 h-4 ml-auto text-green-400" />
                      )}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="text-sm text-white/50">
          {filteredAndSortedCustomers.length.toLocaleString()} customers
        </div>
      </div>

      {/* Virtual Scroll Table */}
      <GlassCard padding="none" className="overflow-hidden">
        <div className="overflow-x-auto" ref={containerRef}>
          <div className="min-w-max">
            {/* Table Header */}
            <div className="flex border-b border-white/10 bg-slate-900/50 sticky top-0 z-10">
              {visibleColumns.map((col) => (
                <div
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`flex-shrink-0 px-4 py-3 text-white/50 text-xs uppercase tracking-wide font-medium whitespace-nowrap flex items-center gap-1 ${col.key !== 'rowNumber' ? 'cursor-pointer hover:text-white/80 hover:bg-white/5' : ''}`}
                  style={{ width: getColumnWidth(col.key) }}
                >
                  {col.label}
                  {sortConfig.key === col.key && sortConfig.direction === 'asc' && (
                    <ChevronUp className="w-3 h-3 text-sky-400" />
                  )}
                  {sortConfig.key === col.key && sortConfig.direction === 'desc' && (
                    <ChevronDown className="w-3 h-3 text-sky-400" />
                  )}
                </div>
              ))}
            </div>

            {/* Virtual List Body */}
            {filteredAndSortedCustomers.length === 0 ? (
              <div className="px-6 py-12 text-center text-white/60">
                No customers found
              </div>
            ) : (
              <List<CustomRowProps>
                defaultHeight={listHeight}
                rowCount={filteredAndSortedCustomers.length}
                rowHeight={56}
                rowComponent={RowComponent}
                rowProps={{
                  customers: filteredAndSortedCustomers,
                  visibleColumns,
                  onCustomerSelect,
                }}
                className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
              />
            )}
          </div>
        </div>

        {/* Info Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-slate-900/30">
          <div className="text-sm text-white/50">
            Showing {filteredAndSortedCustomers.length.toLocaleString()} customers
            {sortConfig.key && sortConfig.direction && (
              <span className="ml-2 text-sky-400">
                (sorted by {sortConfig.key} {sortConfig.direction})
              </span>
            )}
          </div>
          <div className="text-sm text-white/40">
            Virtual scroll enabled for smooth performance
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
