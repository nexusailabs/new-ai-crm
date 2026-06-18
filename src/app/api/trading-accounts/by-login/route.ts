/**
 * API Route: /api/trading-accounts/by-login
 * Get Trading Account by Login
 * Based on Match-Trade Broker API v1.25
 *
 * Created: 2025-12-28
 * Mission: MISSION-20251228-153251
 */

import { NextRequest, NextResponse } from "next/server";
import type {
  TradingAccountFull,
  TradingAccountAccess,
  TradingAccountType,
  TradingAccountFinanceInfo,
} from "@/types";

// ============================================================================
// Environment Configuration
// ============================================================================

const MATCH_TRADE_BASE_URL =
  process.env.MATCH_TRADE_BASE_URL || "https://broker-api-gudax.match-trade.com";
const MATCH_TRADE_API_KEY = process.env.MATCH_TRADE_API_KEY || "";
const MATCH_TRADE_BROKER_ID = process.env.MATCH_TRADE_BROKER_ID || "159";
const MATCH_TRADE_PARTNER_ID = process.env.MATCH_TRADE_PARTNER_ID || "159";

function isMatchTradeConfigured(): boolean {
  return !!(MATCH_TRADE_BASE_URL && MATCH_TRADE_API_KEY && MATCH_TRADE_API_KEY.length > 0);
}

// ============================================================================
// Match-Trade API Response Types
// ============================================================================

interface MatchTradeTradingAccount {
  uuid?: string;
  login?: string;
  created?: string;
  accountInfo?: {
    uuid?: string;
    email?: string;
  };
  offerUuid?: string;
  systemUuid?: string;
  commissionUuid?: string | null;
  group?: string;
  leverage?: number;
  access?: string;
  accountType?: string;
  financeInfo?: {
    balance?: number | null;
    equity?: number | null;
    profit?: number | null;
    netProfit?: number | null;
    margin?: number | null;
    freeMargin?: number | null;
    marginLevel?: number | null;
    credit?: number | null;
    currency?: string;
    currencyPrecision?: number;
  };
}

// ============================================================================
// Transform Functions
// ============================================================================

function transformToTradingAccount(raw: MatchTradeTradingAccount): TradingAccountFull {
  const financeInfo: TradingAccountFinanceInfo = {
    balance: raw.financeInfo?.balance ?? null,
    equity: raw.financeInfo?.equity ?? null,
    profit: raw.financeInfo?.profit ?? null,
    netProfit: raw.financeInfo?.netProfit ?? null,
    margin: raw.financeInfo?.margin ?? null,
    freeMargin: raw.financeInfo?.freeMargin ?? null,
    marginLevel: raw.financeInfo?.marginLevel ?? null,
    credit: raw.financeInfo?.credit ?? null,
    currency: raw.financeInfo?.currency || "USD",
    currencyPrecision: raw.financeInfo?.currencyPrecision ?? 2,
  };

  return {
    uuid: raw.uuid || "",
    login: raw.login || "",
    created: raw.created || new Date().toISOString(),
    accountInfo: {
      uuid: raw.accountInfo?.uuid || "",
      email: raw.accountInfo?.email || "",
    },
    offerUuid: raw.offerUuid || "",
    systemUuid: raw.systemUuid || "",
    commissionUuid: raw.commissionUuid ?? null,
    group: raw.group || "",
    leverage: raw.leverage ?? 1,
    access: (raw.access as TradingAccountAccess) || "FULL",
    accountType: (raw.accountType as TradingAccountType) || "DEMO",
    financeInfo,
  };
}

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET /api/trading-accounts/by-login?systemUuid=&login=
 * Get trading account by login
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<TradingAccountFull | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const systemUuid = searchParams.get("systemUuid");
  const login = searchParams.get("login");

  if (!systemUuid || !login) {
    return NextResponse.json(
      { error: "Missing required parameters: systemUuid and login" },
      { status: 400 }
    );
  }

  if (!isMatchTradeConfigured()) {
    return NextResponse.json(
      { error: "Match-Trade API not configured" },
      { status: 503 }
    );
  }

  try {
    const params = new URLSearchParams({
      systemUuid,
      login,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `${MATCH_TRADE_BASE_URL}/v1/trading-account?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MATCH_TRADE_API_KEY}`,
          "X-Broker-Id": MATCH_TRADE_BROKER_ID,
          "X-Partner-Id": MATCH_TRADE_PARTNER_ID,
        },
        cache: "no-store",
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Trading Accounts API] Get by login error:", response.status, errorText);
      return NextResponse.json(
        { error: `Match-Trade API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data: MatchTradeTradingAccount = await response.json();
    const tradingAccount = transformToTradingAccount(data);

    return NextResponse.json(tradingAccount);
  } catch (error) {
    console.error("[Trading Accounts API] Get by login failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch trading account" },
      { status: 500 }
    );
  }
}
