/**
 * AI Insight Types for AI CRM
 * Rule-based insights (Tier 1) - Zero LLM token cost
 * Created: 2025-12-29
 */

// ============================================================================
// Insight Severity & Category
// ============================================================================

export type InsightSeverity = 'info' | 'warning' | 'critical' | 'success';

export type InsightCategory =
  | 'payment'      // 입출금 관련
  | 'customer'     // 고객 관련
  | 'risk'         // 리스크 관련
  | 'opportunity'  // 기회 관련
  | 'system';      // 시스템 관련

// ============================================================================
// Insight Types
// ============================================================================

export interface Insight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  metric?: {
    value: number | string;
    label: string;
    change?: number; // percentage change
    trend?: 'up' | 'down' | 'stable';
  };
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  timestamp: string;
  expiresAt?: string; // TTL for cache invalidation
}

// ============================================================================
// Dashboard Stats (Real-time computed)
// ============================================================================

export interface DashboardStats {
  // Customer metrics
  totalCustomers: number;
  activeCustomers: number;
  newCustomersToday: number;
  newCustomersThisWeek: number;

  // Payment metrics
  pendingWithdrawals: number;
  pendingWithdrawalsAmount: number;
  todayDeposits: number;
  todayDepositsAmount: number;
  todayWithdrawals: number;
  todayWithdrawalsAmount: number;

  // Balance metrics
  totalBalance: number;
  averageBalance: number;

  // Risk metrics
  highRiskCustomers: number;
  churnRiskCustomers: number; // No activity in 30 days
}

// ============================================================================
// Rule Engine Types
// ============================================================================

export interface InsightRule {
  id: string;
  name: string;
  category: InsightCategory;
  severity: InsightSeverity;
  condition: (stats: DashboardStats) => boolean;
  generate: (stats: DashboardStats) => Omit<Insight, 'id' | 'timestamp'>;
}

// ============================================================================
// Insight Store State
// ============================================================================

export interface InsightState {
  insights: Insight[];
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export interface InsightActions {
  generateInsights: () => Promise<void>;
  fetchStats: () => Promise<void>;
  dismissInsight: (id: string) => void;
  clearInsights: () => void;
  setStats: (stats: DashboardStats) => void;
}

export type InsightStore = InsightState & InsightActions;

// ============================================================================
// API Response Types
// ============================================================================

export interface DashboardStatsResponse {
  stats: DashboardStats;
  insights: Insight[];
  generatedAt: string;
}
