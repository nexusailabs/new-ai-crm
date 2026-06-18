/**
 * Insight Rule Engine
 * Tier 1: Rule-based insights with ZERO LLM token cost
 * Provides instant, real-time insights based on business rules
 * Created: 2025-12-29
 */

import type { DashboardStats, Insight, InsightRule } from '@/types/insight';

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// ============================================================================
// Insight Rules - Zero Token Cost
// ============================================================================

export const insightRules: InsightRule[] = [
  // =========================================
  // CRITICAL: Immediate Attention Required
  // =========================================
  {
    id: 'high-pending-withdrawals',
    name: 'High Pending Withdrawals Alert',
    category: 'payment',
    severity: 'critical',
    condition: (stats) => stats.pendingWithdrawals > 10,
    generate: (stats) => ({
      category: 'payment',
      severity: 'critical',
      title: 'High Pending Withdrawals',
      description: `${stats.pendingWithdrawals} withdrawal requests awaiting approval totaling ${formatCurrency(stats.pendingWithdrawalsAmount)}`,
      metric: {
        value: stats.pendingWithdrawals,
        label: 'Pending',
        trend: 'up',
      },
      action: {
        label: 'Review Now',
        href: '/withdrawals?status=PENDING',
      },
    }),
  },
  {
    id: 'large-pending-amount',
    name: 'Large Pending Amount Alert',
    category: 'payment',
    severity: 'critical',
    condition: (stats) => stats.pendingWithdrawalsAmount > 50000,
    generate: (stats) => ({
      category: 'payment',
      severity: 'critical',
      title: 'Large Withdrawal Queue',
      description: `${formatCurrency(stats.pendingWithdrawalsAmount)} in pending withdrawals requires immediate attention`,
      metric: {
        value: formatCurrency(stats.pendingWithdrawalsAmount),
        label: 'Amount',
      },
      action: {
        label: 'Process Withdrawals',
        href: '/withdrawals?status=PENDING',
      },
    }),
  },
  {
    id: 'high-risk-customers',
    name: 'High Risk Customers Alert',
    category: 'risk',
    severity: 'critical',
    condition: (stats) => stats.highRiskCustomers > 5,
    generate: (stats) => ({
      category: 'risk',
      severity: 'critical',
      title: 'High Risk Accounts Detected',
      description: `${stats.highRiskCustomers} customers flagged as high risk require review`,
      metric: {
        value: stats.highRiskCustomers,
        label: 'High Risk',
      },
      action: {
        label: 'Review Accounts',
        href: '/customers?risk=high',
      },
    }),
  },

  // =========================================
  // WARNING: Needs Attention Soon
  // =========================================
  {
    id: 'churn-risk',
    name: 'Churn Risk Alert',
    category: 'customer',
    severity: 'warning',
    condition: (stats) => stats.churnRiskCustomers > 10,
    generate: (stats) => ({
      category: 'customer',
      severity: 'warning',
      title: 'Potential Customer Churn',
      description: `${stats.churnRiskCustomers} customers inactive for 30+ days. Consider re-engagement campaign.`,
      metric: {
        value: stats.churnRiskCustomers,
        label: 'At Risk',
        trend: 'up',
      },
      action: {
        label: 'View Inactive',
        href: '/customers?status=INACTIVE',
      },
    }),
  },
  {
    id: 'withdrawal-deposit-ratio',
    name: 'Net Outflow Warning',
    category: 'payment',
    severity: 'warning',
    condition: (stats) =>
      stats.todayWithdrawalsAmount > stats.todayDepositsAmount * 1.5 &&
      stats.todayWithdrawalsAmount > 10000,
    generate: (stats) => ({
      category: 'payment',
      severity: 'warning',
      title: 'Net Fund Outflow Today',
      description: `Withdrawals (${formatCurrency(stats.todayWithdrawalsAmount)}) exceed deposits (${formatCurrency(stats.todayDepositsAmount)}) by 50%+`,
      metric: {
        value: formatCurrency(stats.todayWithdrawalsAmount - stats.todayDepositsAmount),
        label: 'Net Outflow',
        trend: 'down',
      },
    }),
  },
  {
    id: 'low-activity-ratio',
    name: 'Low Activity Warning',
    category: 'customer',
    severity: 'warning',
    condition: (stats) =>
      stats.totalCustomers > 100 &&
      (stats.activeCustomers / stats.totalCustomers) < 0.3,
    generate: (stats) => {
      const activityRate = ((stats.activeCustomers / stats.totalCustomers) * 100).toFixed(1);
      return {
        category: 'customer',
        severity: 'warning',
        title: 'Low Customer Activity',
        description: `Only ${activityRate}% of customers are active. ${stats.totalCustomers - stats.activeCustomers} dormant accounts.`,
        metric: {
          value: `${activityRate}%`,
          label: 'Active Rate',
          trend: 'down',
        },
      };
    },
  },

  // =========================================
  // SUCCESS: Positive Metrics
  // =========================================
  {
    id: 'new-signups',
    name: 'New Signups Today',
    category: 'customer',
    severity: 'success',
    condition: (stats) => stats.newCustomersToday > 0,
    generate: (stats) => ({
      category: 'customer',
      severity: 'success',
      title: 'New Customer Signups',
      description: `${stats.newCustomersToday} new customers joined today, ${stats.newCustomersThisWeek} this week`,
      metric: {
        value: stats.newCustomersToday,
        label: 'Today',
        change: stats.newCustomersThisWeek,
        trend: 'up',
      },
      action: {
        label: 'View New Customers',
        href: '/customers?sort=created_at&order=desc',
      },
    }),
  },
  {
    id: 'healthy-deposits',
    name: 'Healthy Deposit Activity',
    category: 'payment',
    severity: 'success',
    condition: (stats) =>
      stats.todayDepositsAmount > stats.todayWithdrawalsAmount * 1.2 &&
      stats.todayDepositsAmount > 5000,
    generate: (stats) => ({
      category: 'payment',
      severity: 'success',
      title: 'Positive Net Inflow',
      description: `Today's deposits (${formatCurrency(stats.todayDepositsAmount)}) exceed withdrawals by ${formatCurrency(stats.todayDepositsAmount - stats.todayWithdrawalsAmount)}`,
      metric: {
        value: formatCurrency(stats.todayDepositsAmount),
        label: 'Deposits',
        trend: 'up',
      },
    }),
  },
  {
    id: 'no-pending-withdrawals',
    name: 'All Withdrawals Processed',
    category: 'payment',
    severity: 'success',
    condition: (stats) => stats.pendingWithdrawals === 0,
    generate: () => ({
      category: 'payment',
      severity: 'success',
      title: 'Withdrawal Queue Clear',
      description: 'All withdrawal requests have been processed. Great job!',
      metric: {
        value: 0,
        label: 'Pending',
        trend: 'stable',
      },
    }),
  },

  // =========================================
  // INFO: General Information
  // =========================================
  {
    id: 'portfolio-overview',
    name: 'Portfolio Overview',
    category: 'system',
    severity: 'info',
    condition: (stats) => stats.totalCustomers > 0,
    generate: (stats) => ({
      category: 'system',
      severity: 'info',
      title: 'Portfolio Summary',
      description: `Managing ${formatNumber(stats.totalCustomers)} customers with ${formatCurrency(stats.totalBalance)} total balance`,
      metric: {
        value: formatCurrency(stats.averageBalance),
        label: 'Avg Balance',
      },
    }),
  },
  {
    id: 'daily-activity-summary',
    name: 'Daily Activity Summary',
    category: 'payment',
    severity: 'info',
    condition: (stats) => stats.todayDeposits > 0 || stats.todayWithdrawals > 0,
    generate: (stats) => ({
      category: 'payment',
      severity: 'info',
      title: "Today's Activity",
      description: `${stats.todayDeposits} deposits (${formatCurrency(stats.todayDepositsAmount)}) and ${stats.todayWithdrawals} withdrawals (${formatCurrency(stats.todayWithdrawalsAmount)})`,
      metric: {
        value: stats.todayDeposits + stats.todayWithdrawals,
        label: 'Transactions',
      },
    }),
  },
];

// ============================================================================
// Rule Engine Class
// ============================================================================

export class InsightRuleEngine {
  private rules: InsightRule[];

  constructor(rules: InsightRule[] = insightRules) {
    this.rules = rules;
  }

  /**
   * Generate insights based on current stats
   * Zero LLM token cost - pure rule-based logic
   */
  generateInsights(stats: DashboardStats): Insight[] {
    const insights: Insight[] = [];
    const now = new Date().toISOString();

    for (const rule of this.rules) {
      try {
        if (rule.condition(stats)) {
          const insightData = rule.generate(stats);
          insights.push({
            id: generateId(),
            timestamp: now,
            ...insightData,
          });
        }
      } catch (error) {
        console.warn(`Rule ${rule.id} failed:`, error);
      }
    }

    // Sort by severity: critical > warning > success > info
    const severityOrder = { critical: 0, warning: 1, success: 2, info: 3 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return insights;
  }

  /**
   * Get insights for a specific category
   */
  getInsightsByCategory(stats: DashboardStats, category: string): Insight[] {
    const allInsights = this.generateInsights(stats);
    return allInsights.filter((i) => i.category === category);
  }

  /**
   * Get critical insights only
   */
  getCriticalInsights(stats: DashboardStats): Insight[] {
    const allInsights = this.generateInsights(stats);
    return allInsights.filter((i) => i.severity === 'critical');
  }
}

// ============================================================================
// Default Instance
// ============================================================================

export const ruleEngine = new InsightRuleEngine();

export default ruleEngine;
