/**
 * StatCard Component
 * Dashboard stat card with trend indicator
 * Created: 2025-12-29
 */

'use client';

import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Props
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  subtitle?: string;
  iconColor?: string;
  onClick?: () => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  subtitle,
  iconColor = 'text-purple-400',
  onClick,
  className,
}: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-gradient-to-br from-white/10 to-white/5',
        'border border-white/10 backdrop-blur-xl',
        'p-6 transition-all duration-300',
        onClick && 'cursor-pointer hover:scale-[1.02] hover:border-white/20',
        className
      )}
      onClick={onClick}
    >
      {/* Background Glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-2.5 rounded-xl bg-white/5', iconColor.replace('text-', 'bg-').replace('-400', '-500/20'))}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>

        {/* Trend Indicator */}
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              trend === 'up' && 'bg-emerald-500/20 text-emerald-400',
              trend === 'down' && 'bg-red-500/20 text-red-400',
              trend === 'stable' && 'bg-gray-500/20 text-gray-400'
            )}
          >
            <TrendIcon className="w-3 h-3" />
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative z-10">
        <p className="text-sm text-gray-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

export default StatCard;
