"use client";

/**
 * VirtualizedTable Component
 * High-performance table with virtual scrolling for 10,000+ rows
 * Uses @tanstack/react-virtual for efficient rendering
 * Created: 2025-12-29
 * Updated: 2025-12-29 - Added column filters with localStorage persistence
 * Updated: 2025-12-29 - Progressive loading for mobile optimization
 */

import { useRef, useMemo, useState, useCallback, useEffect, ReactNode, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X, Filter, ChevronDown, Loader2 } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface ColumnFilter {
  type: "select" | "multiselect" | "range";
  options?: FilterOption[];
  getOptions?: <T>(data: T[]) => FilterOption[];
  placeholder?: string;
}

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  filterable?: boolean;
  filter?: ColumnFilter;
  render: (item: T, index: number) => ReactNode;
  sortFn?: (a: T, b: T) => number;
  searchFn?: (item: T, query: string) => boolean;
  filterFn?: (item: T, filterValue: string | string[]) => boolean;
}

export interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  overscan?: number;
  searchPlaceholder?: string;
  emptyMessage?: string;
  getRowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  className?: string;
  maxHeight?: string;
  showSearch?: boolean;
  showRowCount?: boolean;
  stickyHeader?: boolean;
  storageKey?: string; // Key for localStorage persistence
  // Progressive loading options
  progressiveLoading?: boolean; // Enable progressive loading (default: true for >1000 rows)
  initialLoadCount?: number;    // Initial rows to load (default: 1000)
  loadMoreCount?: number;       // Rows to load on scroll (default: 1000)
  loadMoreThreshold?: number;   // Pixels from bottom to trigger load (default: 500)
}

type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

interface FilterState {
  [columnKey: string]: string | string[];
}

// ============================================================================
// Filter Dropdown Component
// ============================================================================

interface FilterDropdownProps {
  column: Column<unknown>;
  options: FilterOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  onClear: () => void;
}

function FilterDropdown({ column, options, value, onChange, onClear }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isMulti = column.filter?.type === "multiselect";
  const hasValue = isMulti
    ? Array.isArray(value) && value.length > 0
    : value && value !== "";

  const handleSelect = (optionValue: string) => {
    if (isMulti) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(optionValue)) {
        onChange(currentValues.filter(v => v !== optionValue));
      } else {
        onChange([...currentValues, optionValue]);
      }
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  const getDisplayValue = () => {
    if (!hasValue) return column.filter?.placeholder || "All";
    if (isMulti && Array.isArray(value)) {
      if (value.length === 1) {
        return options.find(o => o.value === value[0])?.label || value[0];
      }
      return `${value.length} selected`;
    }
    return options.find(o => o.value === value)?.label || value;
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
          hasValue
            ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
            : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
        }`}
      >
        <Filter className="w-3 h-3" />
        <span className="max-w-[80px] truncate">{getDisplayValue()}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[160px] max-h-[240px] overflow-auto bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl z-50">
          {/* Clear option */}
          {hasValue && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
                if (!isMulti) setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 border-b border-white/10"
            >
              Clear filter
            </button>
          )}

          {/* Options */}
          {options.map((option) => {
            const isSelected = isMulti
              ? Array.isArray(value) && value.includes(option.value)
              : value === option.value;

            return (
              <button
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(option.value);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-white/5 ${
                  isSelected ? "bg-sky-500/10 text-sky-400" : "text-white/70"
                }`}
              >
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-white/30">{option.count.toLocaleString()}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Active Filters Bar
// ============================================================================

interface ActiveFiltersBarProps {
  columns: Column<unknown>[];
  filters: FilterState;
  onClearFilter: (columnKey: string) => void;
  onClearAll: () => void;
}

function ActiveFiltersBar({ columns, filters, onClearFilter, onClearAll }: ActiveFiltersBarProps) {
  const activeFilters = Object.entries(filters).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value && value !== "";
  });

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-sky-500/5 border-b border-sky-500/20">
      <span className="text-xs text-white/40">Active filters:</span>
      <div className="flex flex-wrap gap-2">
        {activeFilters.map(([columnKey, value]) => {
          const column = columns.find(c => c.key === columnKey);
          const displayValue = Array.isArray(value)
            ? `${value.length} selected`
            : column?.filter?.options?.find(o => o.value === value)?.label || value;

          return (
            <span
              key={columnKey}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-500/20 text-sky-400 text-xs rounded"
            >
              <span className="text-white/50">{column?.header}:</span>
              <span>{displayValue}</span>
              <button
                onClick={() => onClearFilter(columnKey)}
                className="ml-1 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
      </div>
      <button
        onClick={onClearAll}
        className="ml-auto text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}

// ============================================================================
// Progressive Loading Constants
// ============================================================================

const DEFAULT_INITIAL_LOAD = 1000;
const DEFAULT_LOAD_MORE = 1000;
const DEFAULT_THRESHOLD = 500;
const PROGRESSIVE_THRESHOLD = 1000; // Auto-enable when data > this

// ============================================================================
// Main Component
// ============================================================================

export function VirtualizedTable<T>({
  data,
  columns,
  rowHeight = 56,
  overscan = 10,
  searchPlaceholder = "Search...",
  emptyMessage = "No data found",
  getRowKey,
  onRowClick,
  className = "",
  maxHeight = "calc(100vh - 320px)",
  showSearch = true,
  showRowCount = true,
  stickyHeader = true,
  storageKey,
  progressiveLoading,
  initialLoadCount = DEFAULT_INITIAL_LOAD,
  loadMoreCount = DEFAULT_LOAD_MORE,
  loadMoreThreshold = DEFAULT_THRESHOLD,
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<FilterState>({});

  // Progressive loading state
  const [loadedCount, setLoadedCount] = useState(initialLoadCount);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Auto-enable progressive loading for large datasets
  const enableProgressive = progressiveLoading ?? data.length > PROGRESSIVE_THRESHOLD;

  // Load filters from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(`table-filters-${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setColumnFilters(parsed.filters || {});
        if (parsed.sort) {
          setSortState(parsed.sort);
        }
      }
    } catch (e) {
      console.warn("Failed to load table filters from localStorage:", e);
    }
  }, [storageKey]);

  // Save filters to localStorage on change
  useEffect(() => {
    if (!storageKey) return;
    try {
      const hasFilters = Object.values(columnFilters).some(v =>
        Array.isArray(v) ? v.length > 0 : v && v !== ""
      );
      const hasSort = sortState.column !== null;

      if (hasFilters || hasSort) {
        localStorage.setItem(`table-filters-${storageKey}`, JSON.stringify({
          filters: columnFilters,
          sort: sortState,
        }));
      } else {
        localStorage.removeItem(`table-filters-${storageKey}`);
      }
    } catch (e) {
      console.warn("Failed to save table filters to localStorage:", e);
    }
  }, [columnFilters, sortState, storageKey]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate filter options with counts
  const filterOptionsMap = useMemo(() => {
    const map: Record<string, FilterOption[]> = {};

    columns.forEach(column => {
      if (!column.filterable || !column.filter) return;

      if (column.filter.getOptions) {
        map[column.key] = column.filter.getOptions(data);
      } else if (column.filter.options) {
        // Calculate counts for static options
        const counts: Record<string, number> = {};
        column.filter.options.forEach(opt => { counts[opt.value] = 0; });

        data.forEach(item => {
          if (column.filterFn) {
            column.filter!.options!.forEach(opt => {
              if (column.filterFn!(item, opt.value)) {
                counts[opt.value]++;
              }
            });
          }
        });

        map[column.key] = column.filter.options.map(opt => ({
          ...opt,
          count: counts[opt.value] || 0,
        }));
      }
    });

    return map;
  }, [data, columns]);

  // Filter data by column filters
  const columnFilteredData = useMemo(() => {
    return data.filter(item => {
      return Object.entries(columnFilters).every(([columnKey, filterValue]) => {
        if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) {
          return true;
        }

        const column = columns.find(c => c.key === columnKey);
        if (!column?.filterFn) return true;

        if (Array.isArray(filterValue)) {
          return filterValue.some(v => column.filterFn!(item, v));
        }
        return column.filterFn(item, filterValue);
      });
    });
  }, [data, columnFilters, columns]);

  // Filter by search query
  const filteredData = useMemo(() => {
    if (!debouncedSearch.trim()) return columnFilteredData;

    const query = debouncedSearch.toLowerCase();
    return columnFilteredData.filter((item) => {
      return columns.some((col) => {
        if (col.searchFn) {
          return col.searchFn(item, query);
        }
        return false;
      });
    });
  }, [columnFilteredData, debouncedSearch, columns]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!sortState.column || !sortState.direction) return filteredData;

    const column = columns.find((c) => c.key === sortState.column);
    if (!column?.sortFn) return filteredData;

    const sorted = [...filteredData].sort(column.sortFn);
    return sortState.direction === "desc" ? sorted.reverse() : sorted;
  }, [filteredData, sortState, columns]);

  // Reset loaded count when filters/search change
  useEffect(() => {
    setLoadedCount(initialLoadCount);
  }, [debouncedSearch, columnFilters, sortState, initialLoadCount]);

  // Progressive loading: slice data based on loadedCount
  const displayData = useMemo(() => {
    if (!enableProgressive) return sortedData;
    return sortedData.slice(0, loadedCount);
  }, [sortedData, loadedCount, enableProgressive]);

  // Check if there's more data to load
  const hasMoreData = enableProgressive && loadedCount < sortedData.length;
  const remainingCount = sortedData.length - loadedCount;

  // Load more data handler
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMoreData) return;

    setIsLoadingMore(true);
    // Use requestAnimationFrame for smooth loading
    requestAnimationFrame(() => {
      setLoadedCount(prev => Math.min(prev + loadMoreCount, sortedData.length));
      setIsLoadingMore(false);
    });
  }, [isLoadingMore, hasMoreData, loadMoreCount, sortedData.length]);

  // Scroll handler for progressive loading
  useEffect(() => {
    if (!enableProgressive || !parentRef.current) return;

    const handleScroll = () => {
      const element = parentRef.current;
      if (!element || isLoadingMore || !hasMoreData) return;

      const { scrollTop, scrollHeight, clientHeight } = element;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < loadMoreThreshold) {
        loadMore();
      }
    };

    const element = parentRef.current;
    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [enableProgressive, isLoadingMore, hasMoreData, loadMoreThreshold, loadMore]);

  // Virtual row calculation - use displayData instead of sortedData
  const virtualizer = useVirtualizer({
    count: displayData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Handle sort
  const handleSort = useCallback((columnKey: string) => {
    setSortState((prev) => {
      if (prev.column !== columnKey) {
        return { column: columnKey, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { column: columnKey, direction: "desc" };
      }
      return { column: null, direction: null };
    });
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback((columnKey: string, value: string | string[]) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value,
    }));
  }, []);

  // Clear single filter
  const handleClearFilter = useCallback((columnKey: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
  }, []);

  // Clear all filters
  const handleClearAllFilters = useCallback(() => {
    setColumnFilters({});
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearch("");
  }, []);

  // Get sort icon
  const getSortIcon = (columnKey: string) => {
    if (sortState.column !== columnKey) {
      return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    }
    if (sortState.direction === "asc") {
      return <ArrowUp className="w-3 h-3 text-sky-400" />;
    }
    return <ArrowDown className="w-3 h-3 text-sky-400" />;
  };

  // Check if any filters are active
  const hasActiveFilters = Object.values(columnFilters).some(v =>
    Array.isArray(v) ? v.length > 0 : v && v !== ""
  );

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Search & Stats Bar */}
      {(showSearch || showRowCount) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-64 pl-9 pr-8 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-sky-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-white/40" />
                </button>
              )}
            </div>
          )}
          {showRowCount && (
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span>
                {enableProgressive ? (
                  <>
                    Loaded{" "}
                    <span className="text-white/70 font-medium">
                      {displayData.length.toLocaleString()}
                    </span>{" "}
                    of{" "}
                    <span className="text-white/70 font-medium">
                      {sortedData.length.toLocaleString()}
                    </span>
                    {sortedData.length !== data.length && (
                      <>
                        {" "}(filtered from {data.length.toLocaleString()})
                      </>
                    )}
                  </>
                ) : (
                  <>
                    Showing{" "}
                    <span className="text-white/70 font-medium">
                      {sortedData.length.toLocaleString()}
                    </span>{" "}
                    of{" "}
                    <span className="text-white/70 font-medium">
                      {data.length.toLocaleString()}
                    </span>{" "}
                    rows
                  </>
                )}
              </span>
              {(debouncedSearch || hasActiveFilters) && (
                <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 rounded">
                  Filtered
                </span>
              )}
              {enableProgressive && hasMoreData && (
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
                  +{remainingCount.toLocaleString()} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Filters Bar */}
      <ActiveFiltersBar
        columns={columns as Column<unknown>[]}
        filters={columnFilters}
        onClearFilter={handleClearFilter}
        onClearAll={handleClearAllFilters}
      />

      {/* Table Header (Sticky) */}
      <div
        className={`${stickyHeader ? "sticky top-0 z-10" : ""} bg-[#0a0a0f] border-b border-white/5`}
      >
        <div className="flex bg-white/[0.02]">
          {columns.map((column) => (
            <div
              key={column.key}
              className={`py-2 px-4 flex flex-col gap-1 ${
                column.align === "right"
                  ? "items-end"
                  : column.align === "center"
                  ? "items-center"
                  : "items-start"
              }`}
              style={{ width: column.width, minWidth: column.width }}
            >
              {/* Header Label + Sort */}
              <div
                className={`flex items-center gap-1 text-white/40 text-[11px] font-bold uppercase tracking-wider ${
                  column.sortable ? "cursor-pointer hover:text-white/60 select-none" : ""
                }`}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                {column.header}
                {column.sortable && getSortIcon(column.key)}
              </div>

              {/* Column Filter */}
              {column.filterable && column.filter && filterOptionsMap[column.key] && (
                <FilterDropdown
                  column={column as Column<unknown>}
                  options={filterOptionsMap[column.key]}
                  value={columnFilters[column.key] || (column.filter.type === "multiselect" ? [] : "")}
                  onChange={(value) => handleFilterChange(column.key, value)}
                  onClear={() => handleClearFilter(column.key)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Virtualized Table Body */}
      <div
        ref={parentRef}
        className="overflow-auto flex-1"
        style={{ height: maxHeight, minHeight: "400px" }}
      >
        <div
          style={{
            height: `${totalSize + (hasMoreData ? 60 : 0)}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualRows.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center py-12">
              <span className="text-white/40">{emptyMessage}</span>
            </div>
          ) : (
            <>
              {virtualRows.map((virtualRow) => {
                const item = displayData[virtualRow.index];
                const key = getRowKey(item);

                return (
                  <div
                    key={key}
                    className={`absolute top-0 left-0 w-full flex items-center border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                      onRowClick ? "cursor-pointer" : ""
                    }`}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((column) => (
                      <div
                        key={column.key}
                        className={`px-4 ${
                          column.align === "right"
                            ? "text-right"
                            : column.align === "center"
                            ? "text-center"
                            : "text-left"
                        }`}
                        style={{ width: column.width, minWidth: column.width }}
                      >
                        {column.render(item, virtualRow.index)}
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Progressive Loading Indicator */}
              {hasMoreData && (
                <div
                  className="absolute left-0 w-full flex items-center justify-center gap-2 py-4"
                  style={{ top: `${totalSize}px` }}
                >
                  {isLoadingMore ? (
                    <div className="flex items-center gap-2 text-white/40 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading more...</span>
                    </div>
                  ) : (
                    <button
                      onClick={loadMore}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/60 hover:text-white/80 transition-colors"
                    >
                      <span>Load {Math.min(loadMoreCount, remainingCount).toLocaleString()} more</span>
                      <span className="text-white/30">({remainingCount.toLocaleString()} remaining)</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedTable;
