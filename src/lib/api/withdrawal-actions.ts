/**
 * Match-Trade Withdrawal Action API Client
 * Functions for approving/rejecting withdrawals via Match-Trade Broker API
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0713
 */

// ============================================================================
// Types
// ============================================================================

export interface WithdrawalActionRequest {
  uuid: string;
  action: 'APPROVE' | 'REJECT';
  reason?: string;
  operatorId?: string;
}

export interface WithdrawalActionResult {
  success: boolean;
  uuid: string;
  newStatus: 'APPROVED' | 'REJECTED';
  matchTradeStatus?: string;
  message: string;
  timestamp: string;
}

export interface MatchTradeWithdrawalActionResponse {
  uuid: string;
  created: string;
  status: string;
  transactionInfo?: {
    amount: number | null;
    netAmount: number | null;
    currency: string;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const MATCH_TRADE_BASE_URL = process.env.MATCH_TRADE_BASE_URL || 'https://broker-api-gudax.match-trade.com';
const MATCH_TRADE_API_KEY = process.env.MATCH_TRADE_API_KEY || '';

// ============================================================================
// Match-Trade API Functions
// ============================================================================

/**
 * Execute manual withdrawal in Match-Trade (for approval flow)
 * This processes the withdrawal through the payment gateway
 */
export async function executeManualWithdrawal(params: {
  systemUuid: string;
  login: string;
  paymentGatewayUuid: string;
  amount: number;
  comment?: string;
}): Promise<MatchTradeWithdrawalActionResponse> {
  const url = `${MATCH_TRADE_BASE_URL}/v1/withdrawals/manual`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': MATCH_TRADE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemUuid: params.systemUuid,
      login: params.login,
      paymentGatewayUuid: params.paymentGatewayUuid,
      amount: params.amount,
      comment: params.comment || 'CRM Approved Withdrawal',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Match-Trade API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get withdrawal details by UUID from Match-Trade API
 */
export async function getWithdrawalByUuid(uuid: string): Promise<{
  uuid: string;
  accountInfo: {
    accountUuid: string;
    tradingAccount?: {
      uuid: string;
      login: string;
    };
  };
  paymentRequestInfo: {
    financialDetails: {
      status: string;
      amount: number;
      currency: string;
    };
    paymentGatewayDetails?: {
      uuid: string;
      name: string;
    };
  };
} | null> {
  const url = `${MATCH_TRADE_BASE_URL}/v1/withdrawals?query=${uuid}&size=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': MATCH_TRADE_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Match-Trade API error: ${response.status}`);
  }

  const data = await response.json();
  const withdrawal = data.content?.find((w: { uuid: string }) => w.uuid === uuid);
  return withdrawal || null;
}

// ============================================================================
// Action Log Types
// ============================================================================

export interface WithdrawalActionLog {
  id?: string;
  withdrawal_uuid: string;
  action: 'APPROVE' | 'REJECT';
  operator_id: string | null;
  reason: string | null;
  previous_status: string;
  new_status: string;
  match_trade_response: Record<string, unknown> | null;
  created_at: string;
}
