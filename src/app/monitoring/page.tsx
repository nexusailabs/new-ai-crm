"use client";

/**
 * Monitoring Dashboard Page
 * Combined view of deposits and withdrawals with real-time activity
 * Created: 2025-12-29
 * Updated: 2025-12-29 - Real API integration
 */

import { useEffect, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  ActivityFeed,
  StreamIndicator,
} from "@/components/payment";
import {
  usePaymentStore,
  useRecentActivity,
  useDepositStats,
  useWithdrawalStats,
  useIsStreaming,
} from "@/stores/paymentStore";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Users,
  Bell,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import type { DepositsApiResponse, WithdrawalsApiResponse, PaymentEvent } from "@/types/payment";

export default function MonitoringPage() {
  const { startStream, stopStream } = usePaymentStore();
  const recentActivity = useRecentActivity();
  const depositStats = useDepositStats();
  const withdrawalStats = useWithdrawalStats();
  const isStreaming = useIsStreaming();

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);

  // Fetch both deposits and withdrawals
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch deposits and withdrawals in parallel
      const [depositsRes, withdrawalsRes] = await Promise.all([
        fetch("/ai-crm/api/deposits"),
        fetch("/ai-crm/api/withdrawals"),
      ]);

      const depositsData: DepositsApiResponse & { error?: string } = await depositsRes.json();
      const withdrawalsData: WithdrawalsApiResponse & { error?: string } = await withdrawalsRes.json();

      if (depositsData.error || withdrawalsData.error) {
        setError(depositsData.error || withdrawalsData.error || "Failed to fetch data");
        return;
      }

      // Create activity feed from deposits and withdrawals
      const depositActivities: PaymentEvent[] = depositsData.deposits.map((d) => ({
        uuid: d.uuid,
        type: "DEPOSIT" as const,
        timestamp: d.timestamp,
        accountInfo: d.accountInfo,
        status: d.status,
        amount: d.amount,
        currency: d.currency,
      }));

      const withdrawalActivities: PaymentEvent[] = withdrawalsData.withdrawals.map((w) => ({
        uuid: w.uuid,
        type: "WITHDRAWAL" as const,
        timestamp: w.timestamp,
        accountInfo: w.accountInfo,
        status: w.status,
        amount: w.amount,
        currency: w.currency,
      }));

      // Combine and sort by timestamp
      const combinedActivity = [...depositActivities, ...withdrawalActivities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);

      // Generate alerts based on real data
      const pendingWithdrawals = withdrawalsData.withdrawals.filter((w) => w.status === "PENDING");
      const pendingDeposits = depositsData.deposits.filter((d) => d.status === "PENDING");
      const largeWithdrawals = withdrawalsData.withdrawals.filter((w) => w.amount > 10000);

      const newAlerts: string[] = [];
      if (largeWithdrawals.length > 0) {
        const largest = largeWithdrawals[0];
        newAlerts.push(
          `Large withdrawal request: $${largest.amount.toLocaleString()} from ${largest.accountInfo.name} ${largest.accountInfo.surname}`
        );
      }
      if (pendingDeposits.length > 0) {
        newAlerts.push(`${pendingDeposits.length} pending deposits awaiting confirmation`);
      }
      if (pendingWithdrawals.length > 0) {
        newAlerts.push(`${pendingWithdrawals.length} pending withdrawals awaiting review`);
      }
      if (newAlerts.length === 0) {
        newAlerts.push("All systems operating normally");
      }

      setAlerts(newAlerts);

      usePaymentStore.setState({
        deposits: depositsData.deposits,
        withdrawals: withdrawalsData.withdrawals,
        recentActivity: combinedActivity,
        depositStats: depositsData.stats,
        withdrawalStats: withdrawalsData.stats,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch data";
      setError(errorMessage);
      console.error("Failed to fetch monitoring data:", err);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const handleToggleStream = useCallback(() => {
    if (isStreaming) {
      stopStream();
    } else {
      startStream();
    }
  }, [isStreaming, startStream, stopStream]);

  const handleRefresh = useCallback(() => {
    setIsInitialLoading(true);
    fetchData();
  }, [fetchData]);

  // Calculate KPIs
  const totalVolume = depositStats.totalAmount + withdrawalStats.totalAmount;
  const netFlow = depositStats.approvedAmount - withdrawalStats.approvedAmount;
  const pendingTotal = depositStats.pendingCount + withdrawalStats.pendingCount;
  const totalTransactions = depositStats.totalCount + withdrawalStats.totalCount;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-500/20 to-violet-500/20">
              <Activity className="w-8 h-8 text-sky-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                Payment Monitor
              </h1>
              <p className="text-white/60">
                Real-time overview of all payment activity via Match-Trade API
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StreamIndicator
              isStreaming={isStreaming}
              onToggle={handleToggleStream}
            />
            <Button
              variant="secondary"
              onClick={handleRefresh}
              leftIcon={<RefreshCw className={`w-4 h-4 ${isInitialLoading ? 'animate-spin' : ''}`} />}
              disabled={isInitialLoading}
            >
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-red-200 text-sm font-medium">Failed to load monitoring data</p>
              <p className="text-red-300/70 text-xs mt-1">{error}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
            >
              Retry
            </Button>
          </div>
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlassCard hover padding="lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Total Volume</p>
                <p className="text-2xl font-bold text-white">
                  {isInitialLoading ? "..." : formatCurrency(totalVolume)}
                </p>
                <p className="text-sky-400 text-sm mt-1">
                  {totalTransactions} transactions
                </p>
              </div>
              <div className="p-3 rounded-xl bg-sky-500/20">
                <DollarSign className="w-6 h-6 text-sky-400" />
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard hover padding="lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Net Flow</p>
                <p
                  className={`text-2xl font-bold ${
                    netFlow >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {isInitialLoading ? "..." : `${netFlow >= 0 ? "+" : ""}${formatCurrency(netFlow)}`}
                </p>
                <p className="text-white/40 text-sm mt-1">Deposits - Withdrawals</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/20">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard hover padding="lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Pending Actions</p>
                <p className="text-2xl font-bold text-amber-400">
                  {isInitialLoading ? "..." : pendingTotal}
                </p>
                <p className="text-white/40 text-sm mt-1">
                  {depositStats.pendingCount} deposits, {withdrawalStats.pendingCount} withdrawals
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/20">
                <Users className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassCard hover padding="lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">Success Rate</p>
                <p className="text-2xl font-bold text-white">
                  {isInitialLoading
                    ? "..."
                    : `${Math.round(
                        ((depositStats.approvedCount + withdrawalStats.approvedCount) /
                          (depositStats.totalCount + withdrawalStats.totalCount || 1)) *
                          100
                      )}%`}
                </p>
                <p className="text-white/40 text-sm mt-1">Approval rate</p>
              </div>
              <div className="p-3 rounded-xl bg-violet-500/20">
                <Activity className="w-6 h-6 text-violet-400" />
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed - Takes 2 columns */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <GlassCard padding="lg" className="h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">
                Live Activity Feed
              </h2>
              {isStreaming && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-emerald-500"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  />
                  Live
                </div>
              )}
            </div>
            {isInitialLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-white/40 animate-spin" />
              </div>
            ) : (
              <ActivityFeed events={recentActivity} maxItems={15} />
            )}
          </GlassCard>
        </motion.div>

        {/* Right Column - Alerts & Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-6"
        >
          {/* Alerts */}
          <GlassCard padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Alerts</h2>
            </div>
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
                >
                  <p className="text-amber-200 text-sm">{alert}</p>
                </motion.div>
              ))}
            </div>
          </GlassCard>

          {/* Deposit Summary */}
          <GlassCard padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <ArrowDownRight className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Deposits</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-white/60">Total</span>
                <span className="text-white font-medium">
                  {isInitialLoading ? "..." : formatCurrency(depositStats.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Approved</span>
                <span className="text-emerald-400 font-medium">
                  {isInitialLoading ? "..." : formatCurrency(depositStats.approvedAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Pending</span>
                <span className="text-amber-400 font-medium">
                  {isInitialLoading ? "..." : formatCurrency(depositStats.pendingAmount)}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Withdrawal Summary */}
          <GlassCard padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpRight className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">Withdrawals</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-white/60">Total</span>
                <span className="text-white font-medium">
                  {isInitialLoading ? "..." : formatCurrency(withdrawalStats.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Approved</span>
                <span className="text-emerald-400 font-medium">
                  {isInitialLoading ? "..." : formatCurrency(withdrawalStats.approvedAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Pending</span>
                <span className="text-amber-400 font-medium">
                  {isInitialLoading ? "..." : formatCurrency(withdrawalStats.pendingAmount)}
                </span>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Live indicator */}
      {isStreaming && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed bottom-6 right-6"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm">
            <motion.div
              className="w-2 h-2 rounded-full bg-sky-500"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
            Monitoring active...
          </div>
        </motion.div>
      )}
    </div>
  );
}
