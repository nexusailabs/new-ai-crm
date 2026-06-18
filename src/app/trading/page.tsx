"use client";

/**
 * Trading Page
 * Displays trading accounts with real-time data
 */

import { useEffect, useState, useCallback, ReactElement } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useCustomerStore } from "@/stores/customerStore";
import type { TradingAccount } from "@/types";
import {
  Wallet,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface AggregatedStats {
  totalBalance: number;
  totalEquity: number;
  totalAccounts: number;
  liveAccounts: number;
  demoAccounts: number;
  currencies: Record<string, number>;
}

export default function TradingPage(): ReactElement {
  const { customers, isLoading, fetchAllCustomers } = useCustomerStore();
  const [stats, setStats] = useState<AggregatedStats>({
    totalBalance: 0,
    totalEquity: 0,
    totalAccounts: 0,
    liveAccounts: 0,
    demoAccounts: 0,
    currencies: {},
  });
  const [allTradingAccounts, setAllTradingAccounts] = useState<
    (TradingAccount & { customerName: string; customerEmail: string })[]
  >([]);

  // Aggregate trading accounts from all customers
  useEffect(() => {
    const accounts: (TradingAccount & {
      customerName: string;
      customerEmail: string;
    })[] = [];
    let totalBalance = 0;
    let totalEquity = 0;
    let liveCount = 0;
    let demoCount = 0;
    const currencies: Record<string, number> = {};

    customers.forEach((customer) => {
      if (customer.tradingAccounts) {
        customer.tradingAccounts.forEach((ta) => {
          accounts.push({
            ...ta,
            customerName: `${customer.personalDetails.firstname} ${customer.personalDetails.lastname}`,
            customerEmail: customer.email,
          });
          totalBalance += ta.balance || 0;
          totalEquity += ta.equity || 0;

          if (ta.type === "LIVE") liveCount++;
          else demoCount++;

          currencies[ta.currency] = (currencies[ta.currency] || 0) + 1;
        });
      }
    });

    setAllTradingAccounts(accounts);
    setStats({
      totalBalance,
      totalEquity,
      totalAccounts: accounts.length,
      liveAccounts: liveCount,
      demoAccounts: demoCount,
      currencies,
    });
  }, [customers]);

  const handleRefresh = useCallback(() => {
    fetchAllCustomers();
  }, [fetchAllCustomers]);

  // Load data on mount
  useEffect(() => {
    if (customers.length === 0) {
      fetchAllCustomers();
    }
  }, [customers.length, fetchAllCustomers]);

  const formatCurrency = (value: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const profitLoss = stats.totalEquity - stats.totalBalance;
  const profitLossPercent =
    stats.totalBalance > 0 ? (profitLoss / stats.totalBalance) * 100 : 0;

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Trading Accounts</h1>
              <p className="text-white/60">
                Overview of all trading accounts and performance
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleRefresh}
            leftIcon={
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
            }
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Balance */}
        <GlassCard hover padding="lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/60 text-sm mb-1">Total Balance</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(stats.totalBalance)}
              </p>
              <p className="text-white/40 text-sm mt-1">
                Across {stats.totalAccounts} accounts
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </GlassCard>

        {/* Total Equity */}
        <GlassCard hover padding="lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/60 text-sm mb-1">Total Equity</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(stats.totalEquity)}
              </p>
              <p
                className={`text-sm mt-1 flex items-center gap-1 ${
                  profitLoss >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {profitLoss >= 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {formatCurrency(Math.abs(profitLoss))} (
                {profitLossPercent.toFixed(2)}%)
              </p>
            </div>
            <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </GlassCard>

        {/* Live Accounts */}
        <GlassCard hover padding="lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/60 text-sm mb-1">Live Accounts</p>
              <p className="text-2xl font-bold text-white">
                {stats.liveAccounts}
              </p>
              <p className="text-emerald-400 text-sm mt-1">Active Trading</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </GlassCard>

        {/* Demo Accounts */}
        <GlassCard hover padding="lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/60 text-sm mb-1">Demo Accounts</p>
              <p className="text-2xl font-bold text-white">
                {stats.demoAccounts}
              </p>
              <p className="text-amber-400 text-sm mt-1">Practice Mode</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Trading Accounts Table */}
      <GlassCard padding="none">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">All Trading Accounts</h2>
          <p className="text-white/60 text-sm mt-1">
            Detailed view of all trading accounts with balances
          </p>
        </div>

        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
          </div>
        ) : allTradingAccounts.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">No trading accounts found</p>
            <p className="text-white/40 text-sm mt-1">
              Trading accounts will appear here once customers have them
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-white/60 text-sm font-medium">
                    Login
                  </th>
                  <th className="text-left p-4 text-white/60 text-sm font-medium">
                    Customer
                  </th>
                  <th className="text-left p-4 text-white/60 text-sm font-medium">
                    Type
                  </th>
                  <th className="text-right p-4 text-white/60 text-sm font-medium">
                    Balance
                  </th>
                  <th className="text-right p-4 text-white/60 text-sm font-medium">
                    Equity
                  </th>
                  <th className="text-right p-4 text-white/60 text-sm font-medium">
                    P/L
                  </th>
                  <th className="text-left p-4 text-white/60 text-sm font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {allTradingAccounts.map((account) => {
                  const pl = (account.equity || 0) - (account.balance || 0);
                  const plPercent =
                    account.balance > 0 ? (pl / account.balance) * 100 : 0;
                  return (
                    <tr
                      key={account.uuid}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="p-4">
                        <span className="font-mono text-white">
                          {account.login}
                        </span>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">
                            {account.customerName}
                          </p>
                          <p className="text-white/40 text-sm">
                            {account.customerEmail}
                          </p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            account.type === "LIVE"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {account.type}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-white font-medium">
                          {formatCurrency(account.balance, account.currency)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-white font-medium">
                          {formatCurrency(account.equity, account.currency)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span
                          className={`font-medium ${
                            pl >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {pl >= 0 ? "+" : ""}
                          {formatCurrency(pl, account.currency)}
                          <span className="text-xs ml-1">
                            ({plPercent.toFixed(1)}%)
                          </span>
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            account.status === "ACTIVE"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {account.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
