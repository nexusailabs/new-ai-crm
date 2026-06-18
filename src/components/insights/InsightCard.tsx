/**
 * InsightCard Component
 * Displays a single AI insight with severity-based styling
 * Created: 2025-12-29
 */

'use client';

import { AlertTriangle, TrendingUp, TrendingDown, Minus, X, ChevronRight, Info, CheckCircle, AlertCircle } from 'lucide-react';
import type { Insight } from '@/types/insight';
import { cn } from '@/lib/utils';

// ============================================================================
// Severity Configuration
// ============================================================================

const severityConfig = {
  critical: {
    icon: AlertCircle,
    bgClass: 'bg-red-500/10 border-red-500/30',
    iconClass: 'text-red-400',
    titleClass: 'text-red-300',
    badgeClass: 'bg-red-500/20 text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    iconClass: 'text-amber-400',
    titleClass: 'text-amber-300',
    badgeClass: 'bg-amber-500/20 text-amber-300',
  },
  success: {
    icon: CheckCircle,
    bgClass: 'bg-emerald-500/10 border-emerald-500/30',
    iconClass: 'text-emerald-400',
    titleClass: 'text-emerald-300',
    badgeClass: 'bg-emerald-500/20 text-emerald-300',
  },
  info: {
    icon: Info,
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    iconClass: 'text-blue-400',
    titleClass: 'text-blue-300',
    badgeClass: 'bg-blue-500/20 text-blue-300',
  },
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

// ============================================================================
// Props
// ============================================================================

interface InsightCardProps {
  insight: Insight;
  onDismiss?: (id: string) => void;
  compact?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function InsightCard({ insight, onDismiss, compact = false, className }: InsightCardProps) {
  const config = severityConfig[insight.severity];
  const Icon = config.icon;
  const TrendIcon = insight.metric?.trend ? trendIcons[insight.metric.trend] : null;

  return (
    <div
      className={cn(
        'group relative rounded-xl border backdrop-blur-sm transition-all duration-300',
        'hover:scale-[1.01] hover:shadow-lg',
        config.bgClass,
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      {/* Dismiss Button */}
      {onDismiss && (
        <button
          onClick={() => onDismiss(insight.id)}
          className="absolute top-2 right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
          aria-label="Dismiss insight"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn('p-2 rounded-lg bg-white/5', !compact && 'p-2.5')}>
          <Icon className={cn('w-5 h-5', config.iconClass, compact && 'w-4 h-4')} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn('font-semibold truncate', config.titleClass, compact ? 'text-sm' : 'text-base')}>
              {insight.title}
            </h4>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium uppercase', config.badgeClass)}>
              {insight.severity}
            </span>
          </div>

          {/* Description */}
          <p className={cn('text-gray-400 leading-relaxed', compact ? 'text-xs line-clamp-2' : 'text-sm')}>
            {insight.description}
          </p>

          {/* Metric & Action */}
          {(!compact || insight.metric || insight.action) && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
              {/* Metric */}
              {insight.metric && (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">
                    {insight.metric.value}
                  </span>
                  <span className="text-xs text-gray-500">{insight.metric.label}</span>
                  {TrendIcon && (
                    <TrendIcon
                      className={cn(
                        'w-4 h-4',
                        insight.metric.trend === 'up' && 'text-emerald-400',
                        insight.metric.trend === 'down' && 'text-red-400',
                        insight.metric.trend === 'stable' && 'text-gray-400'
                      )}
                    />
                  )}
                </div>
              )}

              {/* Action Button */}
              {insight.action && (
                <a
                  href={insight.action.href}
                  onClick={insight.action.onClick}
                  className={cn(
                    'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg',
                    'bg-white/5 hover:bg-white/10 transition-colors',
                    'text-xs font-medium text-white',
                    !insight.metric && 'ml-auto'
                  )}
                >
                  {insight.action.label}
                  <ChevronRight className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InsightCard;
