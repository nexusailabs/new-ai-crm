/**
 * Withdrawal Audit Logging System
 * Records all withdrawal approve/reject actions for compliance tracking
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0737
 */

// ============================================================================
// Types
// ============================================================================

export interface WithdrawalAuditEntry {
  withdrawal_uuid: string;
  action: 'APPROVE' | 'REJECT';
  operator_id: string | null;
  reason: string | null;
  previous_status: string;
  new_status: string;
  match_trade_response: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
  metadata?: {
    amount?: number;
    currency?: string;
    account_email?: string;
  };
}

export interface CreateAuditEntryParams {
  withdrawal_uuid: string;
  action: 'APPROVE' | 'REJECT';
  previous_status: string;
  new_status: string;
  reason?: string;
  operator_id?: string;
  match_trade_response?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  amount?: number;
  currency?: string;
  account_email?: string;
}

// ============================================================================
// Audit Entry Creation
// ============================================================================

/**
 * Create a structured audit entry from action parameters
 */
export function createAuditEntry(params: CreateAuditEntryParams): WithdrawalAuditEntry {
  return {
    withdrawal_uuid: params.withdrawal_uuid,
    action: params.action,
    operator_id: params.operator_id ?? null,
    reason: params.reason ?? null,
    previous_status: params.previous_status,
    new_status: params.new_status,
    match_trade_response: params.match_trade_response ?? null,
    ip_address: params.ip_address ?? null,
    user_agent: params.user_agent ?? null,
    timestamp: new Date().toISOString(),
    metadata: {
      amount: params.amount,
      currency: params.currency,
      account_email: params.account_email,
    },
  };
}

// ============================================================================
// Audit Logging
// ============================================================================

/**
 * Log a withdrawal action to the audit trail
 * Currently logs to console, can be extended to persist to database
 */
export async function logWithdrawalAction(entry: WithdrawalAuditEntry): Promise<void> {
  // Structured logging for audit trail
  const logEntry = {
    level: 'AUDIT',
    category: 'WITHDRAWAL_ACTION',
    ...entry,
  };

  // Log to console (captured by logging infrastructure)
  console.log('[AUDIT] Withdrawal Action:', JSON.stringify(logEntry, null, 2));

  // Future: Persist to Supabase withdrawal_action_logs table
  // const supabase = createServerClient();
  // await supabase.from('withdrawal_action_logs').insert(entry);
}

/**
 * Helper to extract request metadata for audit logging
 */
export function extractRequestMetadata(request: Request): {
  ip_address: string | null;
  user_agent: string | null;
} {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip_address = forwardedFor?.split(',')[0]?.trim() ?? realIp ?? null;
  const user_agent = request.headers.get('user-agent') ?? null;

  return { ip_address, user_agent };
}

// ============================================================================
// Audit Query Types (for future DB integration)
// ============================================================================

export interface AuditQueryParams {
  withdrawal_uuid?: string;
  action?: 'APPROVE' | 'REJECT';
  operator_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  entries: WithdrawalAuditEntry[];
  total: number;
  hasMore: boolean;
}
