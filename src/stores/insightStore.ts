/**
 * Insight Store
 * Zustand store for managing AI-powered insights
 * Uses Rule Engine for Tier 1 (zero token cost) insights
 * Created: 2025-12-29
 */

import { create } from 'zustand';
import type { DashboardStats, Insight, InsightStore } from '@/types/insight';
import { ruleEngine } from '@/lib/insights/rule-engine';

// ============================================================================
// API Configuration
// ============================================================================

const BASE_PATH = '/ai-crm';

// ============================================================================
// Initial State
// ============================================================================

const initialStats: DashboardStats = {
  totalCustomers: 0,
  activeCustomers: 0,
  newCustomersToday: 0,
  newCustomersThisWeek: 0,
  pendingWithdrawals: 0,
  pendingWithdrawalsAmount: 0,
  todayDeposits: 0,
  todayDepositsAmount: 0,
  todayWithdrawals: 0,
  todayWithdrawalsAmount: 0,
  totalBalance: 0,
  averageBalance: 0,
  highRiskCustomers: 0,
  churnRiskCustomers: 0,
};

const initialState = {
  insights: [] as Insight[],
  stats: null as DashboardStats | null,
  isLoading: false,
  error: null as string | null,
  lastUpdated: null as string | null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useInsightStore = create<InsightStore>()((set, get) => ({
  ...initialState,

  // ==========================================================================
  // Fetch Stats from API
  // ==========================================================================

  fetchStats: async () => {
    set({ isLoading: true, error: null });

    try {
      // Fetch stats from multiple endpoints in parallel
      const [customersRes, withdrawalsRes, depositsRes] = await Promise.all([
        fetch(`${BASE_PATH}/api/customers?size=1`),
        fetch(`${BASE_PATH}/api/withdrawals`),
        fetch(`${BASE_PATH}/api/deposits`),
      ]);

      if (!customersRes.ok || !withdrawalsRes.ok || !depositsRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [customersData, withdrawalsData, depositsData] = await Promise.all([
        customersRes.json(),
        withdrawalsRes.json(),
        depositsRes.json(),
      ]);

      // Calculate stats from responses
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const withdrawals = withdrawalsData.withdrawals || [];
      const deposits = depositsData.deposits || [];

      // Filter today's transactions
      const todayWithdrawals = withdrawals.filter((w: { created_at?: string }) =>
        w.created_at && w.created_at >= todayStart
      );
      const todayDeposits = deposits.filter((d: { timestamp?: string }) =>
        d.timestamp && d.timestamp >= todayStart
      );

      // Calculate pending withdrawals
      const pendingWithdrawals = withdrawals.filter(
        (w: { mapped_status?: string }) => w.mapped_status === 'PENDING'
      );

      // Estimate customer metrics (from pagination info)
      const totalCustomers = customersData.totalElements || 0;

      const stats: DashboardStats = {
        totalCustomers,
        activeCustomers: Math.floor(totalCustomers * 0.65), // Estimate 65% active
        newCustomersToday: Math.floor(Math.random() * 10) + 1, // Mock for now
        newCustomersThisWeek: Math.floor(Math.random() * 50) + 10, // Mock for now
        pendingWithdrawals: pendingWithdrawals.length,
        pendingWithdrawalsAmount: pendingWithdrawals.reduce(
          (sum: number, w: { amount?: number }) => sum + (w.amount || 0),
          0
        ),
        todayDeposits: todayDeposits.length,
        todayDepositsAmount: todayDeposits.reduce(
          (sum: number, d: { amount?: number }) => sum + (d.amount || 0),
          0
        ),
        todayWithdrawals: todayWithdrawals.length,
        todayWithdrawalsAmount: todayWithdrawals.reduce(
          (sum: number, w: { amount?: number }) => sum + (w.amount || 0),
          0
        ),
        totalBalance: withdrawalsData.stats?.totalAmount || 0,
        averageBalance: totalCustomers > 0
          ? (withdrawalsData.stats?.totalAmount || 0) / totalCustomers
          : 0,
        highRiskCustomers: Math.floor(totalCustomers * 0.02), // Estimate 2%
        churnRiskCustomers: Math.floor(totalCustomers * 0.1), // Estimate 10%
      };

      set({
        stats,
        isLoading: false,
        lastUpdated: new Date().toISOString(),
      });

      // Auto-generate insights after fetching stats
      get().generateInsights();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch stats';
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  // ==========================================================================
  // Generate Insights (Tier 1: Rule-based, 0 tokens)
  // ==========================================================================

  generateInsights: async () => {
    const { stats } = get();

    if (!stats) {
      console.warn('No stats available for insight generation');
      return;
    }

    try {
      // Use rule engine - ZERO LLM TOKEN COST
      const insights = ruleEngine.generateInsights(stats);

      set({
        insights,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to generate insights:', error);
    }
  },

  // ==========================================================================
  // Dismiss Insight
  // ==========================================================================

  dismissInsight: (id: string) => {
    set((state) => ({
      insights: state.insights.filter((i) => i.id !== id),
    }));
  },

  // ==========================================================================
  // Clear All Insights
  // ==========================================================================

  clearInsights: () => {
    set({ insights: [] });
  },

  // ==========================================================================
  // Set Stats Manually (for testing or SSR)
  // ==========================================================================

  setStats: (stats: DashboardStats) => {
    set({ stats });
    get().generateInsights();
  },
}));

// ============================================================================
// Selector Hooks
// ============================================================================

export function useInsights(): Insight[] {
  return useInsightStore((state) => state.insights);
}

export function useCriticalInsights(): Insight[] {
  return useInsightStore((state) =>
    state.insights.filter((i) => i.severity === 'critical')
  );
}

export function useWarningInsights(): Insight[] {
  return useInsightStore((state) =>
    state.insights.filter((i) => i.severity === 'warning')
  );
}

export function useDashboardStats(): DashboardStats | null {
  return useInsightStore((state) => state.stats);
}

export function useInsightLoading(): boolean {
  return useInsightStore((state) => state.isLoading);
}

export function useInsightsByCategory(category: string): Insight[] {
  return useInsightStore((state) =>
    state.insights.filter((i) => i.category === category)
  );
}

export default useInsightStore;
