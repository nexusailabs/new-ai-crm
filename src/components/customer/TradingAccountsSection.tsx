"use client";

import { ReactElement } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { TradingAccountFull } from "@/types";
import {
  TrendingUp,
  Wallet,
  DollarSign,
  Activity,
  BarChart3,
} from "lucide-react";

interface TradingAccountsSectionProps {
  // Support both TradingAccountFull (from API) and any legacy format
  tradingAccounts?: TradingAccountFull[] | unknown[];
}

// Normalize account to common format
interface NormalizedAccount {
  uuid: string;
  login: string;
  type: string;
  status: string;
  balance: number;
  equity: number;
  currency: string;
}

function normalizeAccount(acc: unknown): NormalizedAccount {
  const account = acc as Record<string, unknown>;

  // Handle TradingAccountFull format (from API)
  if (account.financeInfo && typeof account.financeInfo === "object") {
    const fi = account.financeInfo as Record<string, unknown>;
    return {
      uuid: String(account.uuid || ""),
      login: String(account.login || ""),
      type: String(account.accountType || "DEMO"),
      status: account.access === "FULL" ? "ACTIVE" : String(account.access || "INACTIVE"),
      balance: Number(fi.balance) || 0,
      equity: Number(fi.equity) || 0,
      currency: String(fi.currency || "USD"),
    };
  }

  // Handle legacy TradingAccount format
  return {
    uuid: String(account.uuid || ""),
    login: String(account.login || ""),
    type: String(account.type || account.accountType || "DEMO"),
    status: String(account.status || "ACTIVE"),
    balance: Number(account.balance) || 0,
    equity: Number(account.equity) || 0,
    currency: String(account.currency || "USD"),
  };
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getTypeBadgeClass(type: string): string {
  switch ((type || "").toUpperCase()) {
    case "LIVE":
    case "REAL":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "DEMO":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    default:
      return "bg-white/10 text-white/60 border-white/20";
  }
}

function getStatusBadgeClass(status: string): string {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
    case "FULL":
      return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    case "INACTIVE":
    case "TRADING_DISABLED":
    case "TRADING_AND_LOGIN_DISABLED":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-white/10 text-white/60 border-white/20";
  }
}

export function TradingAccountsSection({
  tradingAccounts = [],
}: TradingAccountsSectionProps): ReactElement {
  // Normalize all accounts to common format
  const accounts = tradingAccounts.map(normalizeAccount);

  // Calculate summary stats
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalEquity = accounts.reduce((sum, acc) => sum + acc.equity, 0);
  const liveAccounts = accounts.filter(
    (acc) => acc.type.toUpperCase() === "LIVE" || acc.type.toUpperCase() === "REAL"
  );
  const demoAccounts = accounts.filter(
    (acc) => acc.type.toUpperCase() === "DEMO"
  );
  const activeAccounts = accounts.filter(
    (acc) => acc.status.toUpperCase() === "ACTIVE" || acc.status.toUpperCase() === "FULL"
  );

  // Get primary currency (most common)
  const currencies = accounts.map((acc) => acc.currency);
  const primaryCurrency = currencies.length > 0
    ? currencies.sort((a, b) =>
        currencies.filter((c) => c === a).length -
        currencies.filter((c) => c === b).length
      ).pop() || "USD"
    : "USD";

  return (
    <GlassCard padding="lg" className="col-span-1 lg:col-span-2">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-white/5 text-violet-400">
          <TrendingUp className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-white">Trading Accounts</h2>
        <span className="ml-auto text-sm text-white/50">
          {accounts.length} account{accounts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Summary Cards */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
              <Wallet className="w-4 h-4" />
              <span>Total Balance</span>
            </div>
            <p className="text-xl font-bold text-white">
              {formatCurrency(totalBalance, primaryCurrency)}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              <span>Total Equity</span>
            </div>
            <p className="text-xl font-bold text-white">
              {formatCurrency(totalEquity, primaryCurrency)}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
              <Activity className="w-4 h-4" />
              <span>Live / Demo</span>
            </div>
            <p className="text-xl font-bold text-white">
              <span className="text-emerald-400">{liveAccounts.length}</span>
              <span className="text-white/30"> / </span>
              <span className="text-amber-400">{demoAccounts.length}</span>
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
              <BarChart3 className="w-4 h-4" />
              <span>Active</span>
            </div>
            <p className="text-xl font-bold text-sky-400">
              {activeAccounts.length}
            </p>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      {accounts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-white/50 text-sm font-medium">
                  Login
                </th>
                <th className="text-left py-3 px-4 text-white/50 text-sm font-medium">
                  Type
                </th>
                <th className="text-left py-3 px-4 text-white/50 text-sm font-medium">
                  Status
                </th>
                <th className="text-right py-3 px-4 text-white/50 text-sm font-medium">
                  Balance
                </th>
                <th className="text-right py-3 px-4 text-white/50 text-sm font-medium">
                  Equity
                </th>
                <th className="text-center py-3 px-4 text-white/50 text-sm font-medium">
                  Currency
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account.uuid}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="py-4 px-4">
                    <span className="text-white font-mono font-medium">
                      {account.login}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium border ${getTypeBadgeClass(
                        account.type
                      )}`}
                    >
                      {account.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium border ${getStatusBadgeClass(
                        account.status
                      )}`}
                    >
                      {account.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-white font-medium">
                      {formatCurrency(account.balance, account.currency)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span
                      className={`font-medium ${
                        account.equity >= account.balance
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {formatCurrency(account.equity, account.currency)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-white/70 text-sm">
                      {account.currency}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-white/30" />
          </div>
          <h3 className="text-white/70 font-medium mb-2">No Trading Accounts</h3>
          <p className="text-white/40 text-sm">
            This customer does not have any trading accounts yet.
          </p>
        </div>
      )}
    </GlassCard>
  );
}
