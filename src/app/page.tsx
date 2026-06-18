"use client";

import { useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { InsightPanel, StatCard } from "@/components/insights";
import { useInsightStore, useDashboardStats, useInsightLoading, useCriticalInsights } from "@/stores/insightStore";
import {
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  Search,
  Plus,
  CreditCard,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import Link from "next/link";

// ============================================================================
// Format Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// ============================================================================
// Main Component
// ============================================================================

export default function Home() {
  const { fetchStats } = useInsightStore();
  const stats = useDashboardStats();
  const isLoading = useInsightLoading();
  const criticalCount = useCriticalInsights().length;

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              AI CRM 대시보드
            </h1>
            <p className="text-white/60">
              실시간 데이터 기반 AI 인사이트를 확인하세요
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-64">
              <Input
                type="text"
                placeholder="검색..."
                variant="search"
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <Link href="/customers">
              <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                고객 관리
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Critical Alert Banner */}
      {criticalCount > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">
              <strong>{criticalCount}개</strong>의 긴급 처리가 필요한 항목이 있습니다
            </span>
          </div>
          <Button variant="ghost" className="text-red-300 hover:text-red-200">
            확인하기
          </Button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="전체 고객"
          value={isLoading ? "..." : formatNumber(stats?.totalCustomers || 0)}
          icon={Users}
          trend="up"
          trendValue={`+${stats?.newCustomersToday || 0}`}
          subtitle="오늘 신규 가입"
          iconColor="text-sky-400"
        />
        <StatCard
          title="활성 고객"
          value={isLoading ? "..." : formatNumber(stats?.activeCustomers || 0)}
          icon={Activity}
          trend={stats?.activeCustomers && stats?.totalCustomers
            ? (stats.activeCustomers / stats.totalCustomers > 0.5 ? "up" : "down")
            : "stable"
          }
          trendValue={stats?.totalCustomers
            ? `${((stats.activeCustomers || 0) / stats.totalCustomers * 100).toFixed(0)}%`
            : "-"
          }
          subtitle="활성 비율"
          iconColor="text-violet-400"
        />
        <StatCard
          title="대기 중 출금"
          value={isLoading ? "..." : String(stats?.pendingWithdrawals || 0)}
          icon={ArrowUpCircle}
          trend={stats?.pendingWithdrawals && stats.pendingWithdrawals > 5 ? "up" : "stable"}
          trendValue={formatCurrency(stats?.pendingWithdrawalsAmount || 0)}
          subtitle="총 대기 금액"
          iconColor="text-amber-400"
          onClick={() => window.location.href = '/withdrawals?status=PENDING'}
        />
        <StatCard
          title="오늘 입금"
          value={isLoading ? "..." : formatCurrency(stats?.todayDepositsAmount || 0)}
          icon={ArrowDownCircle}
          trend="up"
          trendValue={`${stats?.todayDeposits || 0}건`}
          subtitle="오늘 입금 건수"
          iconColor="text-emerald-400"
        />
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insights Panel */}
        <GlassCard className="lg:col-span-2" padding="lg">
          <InsightPanel
            title="AI 인사이트"
            showFilters={true}
            maxItems={6}
          />
        </GlassCard>

        {/* Quick Actions & Stats */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <GlassCard padding="lg">
            <h2 className="text-xl font-semibold text-white mb-4">빠른 실행</h2>
            <div className="space-y-3">
              <Link href="/customers" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  고객 목록
                </Button>
              </Link>
              <Link href="/withdrawals" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                  출금 관리
                </Button>
              </Link>
              <Link href="/deposits" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <ArrowDownCircle className="w-4 h-4 mr-2" />
                  입금 내역
                </Button>
              </Link>
            </div>
          </GlassCard>

          {/* Balance Summary */}
          <GlassCard padding="lg">
            <h2 className="text-xl font-semibold text-white mb-4">잔액 현황</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10">
                <p className="text-sm text-gray-400 mb-1">총 잔액</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? "..." : formatCurrency(stats?.totalBalance || 0)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-xs text-gray-500 mb-1">평균 잔액</p>
                  <p className="text-lg font-semibold text-white">
                    {isLoading ? "..." : formatCurrency(stats?.averageBalance || 0)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-xs text-gray-500 mb-1">이탈 위험</p>
                  <p className="text-lg font-semibold text-amber-400">
                    {isLoading ? "..." : formatNumber(stats?.churnRiskCustomers || 0)}명
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Today's Summary */}
          <GlassCard padding="lg">
            <h2 className="text-xl font-semibold text-white mb-4">오늘의 요약</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">입금</span>
                <span className="text-emerald-400 font-medium">
                  +{formatCurrency(stats?.todayDepositsAmount || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">출금</span>
                <span className="text-red-400 font-medium">
                  -{formatCurrency(stats?.todayWithdrawalsAmount || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-white/10">
                <span className="text-white font-medium">순유입</span>
                <span className={`font-bold ${
                  (stats?.todayDepositsAmount || 0) >= (stats?.todayWithdrawalsAmount || 0)
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}>
                  {formatCurrency(
                    (stats?.todayDepositsAmount || 0) - (stats?.todayWithdrawalsAmount || 0)
                  )}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Footer hint */}
      <div className="mt-8 text-center">
        <p className="text-white/30 text-sm">
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-xs">Cmd+K</kbd> to open Command Palette
        </p>
      </div>
    </div>
  );
}
