/**
 * InsightPanel Component
 * Displays AI insights grouped by severity
 * Created: 2025-12-29
 */

'use client';

import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Filter, ChevronDown, AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { InsightCard } from './InsightCard';
import { useInsightStore, useInsights, useCriticalInsights, useWarningInsights } from '@/stores/insightStore';
import type { InsightSeverity } from '@/types/insight';
import { cn } from '@/lib/utils';

// ============================================================================
// Filter Configuration
// ============================================================================

const severityFilters: { value: InsightSeverity | 'all'; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: '전체', icon: Sparkles },
  { value: 'critical', label: '긴급', icon: AlertCircle },
  { value: 'warning', label: '주의', icon: AlertTriangle },
  { value: 'success', label: '긍정', icon: CheckCircle },
  { value: 'info', label: '정보', icon: Info },
];

// ============================================================================
// Props
// ============================================================================

interface InsightPanelProps {
  title?: string;
  showFilters?: boolean;
  maxItems?: number;
  compact?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function InsightPanel({
  title = 'AI 인사이트',
  showFilters = true,
  maxItems,
  compact = false,
  className,
}: InsightPanelProps) {
  const [filter, setFilter] = useState<InsightSeverity | 'all'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const insights = useInsights();
  const criticalInsights = useCriticalInsights();
  const warningInsights = useWarningInsights();
  const { fetchStats, dismissInsight, isLoading, lastUpdated } = useInsightStore();

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Filter insights
  const filteredInsights = filter === 'all'
    ? insights
    : insights.filter((i) => i.severity === filter);

  // Limit items if maxItems is set
  const displayInsights = maxItems
    ? filteredInsights.slice(0, maxItems)
    : filteredInsights;

  // Count by severity
  const counts = {
    all: insights.length,
    critical: criticalInsights.length,
    warning: warningInsights.length,
    success: insights.filter((i) => i.severity === 'success').length,
    info: insights.filter((i) => i.severity === 'info').length,
  };

  const handleRefresh = () => {
    fetchStats();
  };

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {lastUpdated && (
              <p className="text-xs text-gray-500">
                마지막 업데이트: {new Date(lastUpdated).toLocaleTimeString('ko-KR')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Dropdown */}
          {showFilters && (
            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-white/5 hover:bg-white/10 transition-colors',
                  'text-sm text-gray-300'
                )}
              >
                <Filter className="w-4 h-4" />
                <span>{severityFilters.find((f) => f.value === filter)?.label}</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', isFilterOpen && 'rotate-180')} />
              </button>

              {isFilterOpen && (
                <div className="absolute top-full right-0 mt-2 py-2 w-40 rounded-lg bg-gray-800/95 border border-white/10 backdrop-blur-xl shadow-xl z-50">
                  {severityFilters.map((f) => {
                    const Icon = f.icon;
                    return (
                      <button
                        key={f.value}
                        onClick={() => {
                          setFilter(f.value);
                          setIsFilterOpen(false);
                        }}
                        className={cn(
                          'flex items-center justify-between w-full px-3 py-2',
                          'hover:bg-white/5 transition-colors',
                          filter === f.value && 'bg-white/10'
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm text-gray-300">
                          <Icon className="w-4 h-4" />
                          {f.label}
                        </span>
                        <span className="text-xs text-gray-500">{counts[f.value]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={cn(
              'p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label="Refresh insights"
          >
            <RefreshCw className={cn('w-4 h-4 text-gray-400', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {criticalInsights.length > 0 && filter === 'all' && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm text-red-300">
            <strong>{criticalInsights.length}개</strong>의 긴급 사항이 있습니다
          </span>
        </div>
      )}

      {/* Insights Grid */}
      {isLoading && insights.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
          <span className="ml-2 text-gray-500">인사이트 분석 중...</span>
        </div>
      ) : displayInsights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Sparkles className="w-10 h-10 text-gray-600 mb-3" />
          <p className="text-gray-500">표시할 인사이트가 없습니다</p>
          <p className="text-xs text-gray-600 mt-1">데이터를 불러오면 자동으로 생성됩니다</p>
        </div>
      ) : (
        <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2')}>
          {displayInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onDismiss={dismissInsight}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* View More */}
      {maxItems && filteredInsights.length > maxItems && (
        <button
          className="mt-4 py-2 text-center text-sm text-purple-400 hover:text-purple-300 transition-colors"
          onClick={() => {
            // Could navigate to full insights page
          }}
        >
          +{filteredInsights.length - maxItems}개 더 보기
        </button>
      )}
    </div>
  );
}

export default InsightPanel;
