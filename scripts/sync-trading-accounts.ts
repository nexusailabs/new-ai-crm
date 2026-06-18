/**
 * Match-Trade Trading Accounts Sync Script
 * Syncs trading accounts from Match-Trade API to Supabase
 *
 * Usage: npx ts-node scripts/sync-trading-accounts.ts
 *
 * Created: 2025-12-28
 * Mission: MISSION-20251228-L7WFOB
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Environment Configuration
// ============================================================================

const MATCH_TRADE_BASE_URL = process.env.MATCH_TRADE_BASE_URL || 'https://broker-api-gudax.match-trade.com';
const MATCH_TRADE_API_KEY = process.env.MATCH_TRADE_API_KEY || '';
const MATCH_TRADE_BROKER_ID = process.env.MATCH_TRADE_BROKER_ID || '159';
const MATCH_TRADE_PARTNER_ID = process.env.MATCH_TRADE_PARTNER_ID || '159';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ============================================================================
// Types
// ============================================================================

interface MatchTradeTradingAccount {
  uuid: string;
  login: string;
  created: string;
  accountInfo: { uuid: string; email: string };
  offerUuid: string;
  systemUuid: string;
  commissionUuid: string | null;
  group: string;
  leverage: number;
  access: string;
  accountType: string;
  financeInfo: {
    balance: number | null;
    equity: number | null;
    profit: number | null;
    netProfit: number | null;
    margin: number | null;
    freeMargin: number | null;
    marginLevel: number | null;
    credit: number | null;
    currency: string;
    currencyPrecision: number;
  };
}

interface MatchTradePagedResponse {
  content: MatchTradeTradingAccount[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

interface TradingAccountRecord {
  uuid: string;
  login: string;
  account_uuid: string;
  offer_uuid: string;
  system_uuid: string;
  commission_uuid: string | null;
  group: string;
  leverage: number;
  access: string;
  account_type: string;
  finance_info: {
    balance: number | null;
    equity: number | null;
    profit: number | null;
    netProfit: number | null;
    margin: number | null;
    freeMargin: number | null;
    marginLevel: number | null;
    credit: number | null;
    currency: string;
    currencyPrecision: number;
  };
  created_at: string;
  synced_at: string;
}

// ============================================================================
// Match-Trade API Client
// ============================================================================

async function fetchTradingAccountsFromMatchTrade(
  page = 0,
  size = 100
): Promise<MatchTradePagedResponse> {
  const url = `${MATCH_TRADE_BASE_URL}/v1/trading-accounts?page=${page}&size=${size}&sort=created,desc`;

  console.log(`[Fetch] Requesting page ${page} from Match-Trade API...`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${MATCH_TRADE_API_KEY}`,
      'X-Broker-Id': MATCH_TRADE_BROKER_ID,
      'X-Partner-Id': MATCH_TRADE_PARTNER_ID,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Match-Trade API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// ============================================================================
// Transform Functions
// ============================================================================

function transformToRecord(acc: MatchTradeTradingAccount): TradingAccountRecord {
  return {
    uuid: acc.uuid,
    login: acc.login,
    account_uuid: acc.accountInfo.uuid,
    offer_uuid: acc.offerUuid,
    system_uuid: acc.systemUuid,
    commission_uuid: acc.commissionUuid,
    group: acc.group,
    leverage: acc.leverage,
    access: acc.access,
    account_type: acc.accountType,
    finance_info: acc.financeInfo,
    created_at: acc.created,
    synced_at: new Date().toISOString(),
  };
}

// ============================================================================
// Sync Logic
// ============================================================================

async function syncTradingAccounts(): Promise<void> {
  console.log('='.repeat(60));
  console.log('[Sync] Starting trading accounts sync...');
  console.log(`[Sync] Match-Trade URL: ${MATCH_TRADE_BASE_URL}`);
  console.log(`[Sync] Supabase URL: ${SUPABASE_URL}`);
  console.log('='.repeat(60));

  // Validate configuration
  if (!MATCH_TRADE_API_KEY) {
    throw new Error('MATCH_TRADE_API_KEY is not set');
  }

  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  let page = 0;
  let totalSynced = 0;
  let totalErrors = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const data = await fetchTradingAccountsFromMatchTrade(page, 100);
      const accounts = data.content || [];

      if (accounts.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`[Sync] Page ${page}: Received ${accounts.length} accounts`);

      // Transform to Supabase format
      const records = accounts.map(transformToRecord);

      // Upsert to Supabase
      const { error } = await supabase
        .from('trading_accounts')
        .upsert(records, {
          onConflict: 'uuid',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`[Sync] Upsert error on page ${page}:`, error);
        totalErrors++;

        // Try individual inserts for failed batch
        console.log(`[Sync] Attempting individual inserts for page ${page}...`);
        for (const record of records) {
          const { error: singleError } = await supabase
            .from('trading_accounts')
            .upsert(record, { onConflict: 'uuid' });

          if (singleError) {
            console.error(`[Sync] Failed to upsert ${record.uuid}:`, singleError.message);
            totalErrors++;
          } else {
            totalSynced++;
          }
        }
      } else {
        totalSynced += accounts.length;
        console.log(`[Sync] Page ${page}: Successfully synced ${accounts.length} accounts (total: ${totalSynced})`);
      }

      // Check if there are more pages
      page++;
      hasMore = accounts.length === 100 && page < (data.totalPages || 100);

      // Rate limiting - wait 100ms between pages
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error(`[Sync] Error on page ${page}:`, error);
      totalErrors++;

      // Skip to next page on error
      page++;
      if (page > 100) {
        console.log('[Sync] Max pages reached, stopping...');
        hasMore = false;
      }
    }
  }

  console.log('='.repeat(60));
  console.log(`[Sync] Complete!`);
  console.log(`[Sync] Total synced: ${totalSynced}`);
  console.log(`[Sync] Total errors: ${totalErrors}`);
  console.log('='.repeat(60));
}

// ============================================================================
// Main Entry Point
// ============================================================================

syncTradingAccounts()
  .then(() => {
    console.log('[Sync] Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Sync] Script failed:', error);
    process.exit(1);
  });
