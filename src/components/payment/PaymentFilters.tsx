"use client";

/**
 * Payment Filters Component
 * Filter controls for payment tables
 * Created: 2025-12-29
 */

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { PaymentFilterStatus } from "@/types/payment";
import { Search, X, Filter } from "lucide-react";

interface PaymentFiltersProps {
  status: PaymentFilterStatus;
  search: string;
  onStatusChange: (status: PaymentFilterStatus) => void;
  onSearchChange: (search: string) => void;
  onClear: () => void;
  className?: string;
}

const statusOptions: { value: PaymentFilterStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

export function PaymentFilters({
  status,
  search,
  onStatusChange,
  onSearchChange,
  onClear,
  className,
}: PaymentFiltersProps) {
  const hasFilters = status !== "ALL" || search !== "";

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center gap-4",
        className
      )}
    >
      {/* Search */}
      <div className="w-full sm:w-64">
        <Input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          variant="search"
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onStatusChange(option.value)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              status === option.value
                ? "bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border border-white/10"
                : "text-white/60 hover:text-white hover:bg-white/5"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="w-4 h-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

export default PaymentFilters;
