/**
 * Supabase Client for AI CRM
 * Server-side and client-side database access
 * Updated: 2025-12-28
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// ============================================================================
// Environment Variables
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Runtime check for missing env vars
export const isSupabaseConfigured = (): boolean => {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// ============================================================================
// Supabase Clients (typed with Database schema)
// ============================================================================

// Browser client (uses anon key, respects RLS)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Server-side client (uses service role key, bypasses RLS)
export function createServerClient() {
  if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set, using anon key')
    return createClient<Database>(supabaseUrl!, supabaseAnonKey!)
  }
  return createClient<Database>(supabaseUrl!, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Helper type
export type SupabaseClient = ReturnType<typeof createServerClient>

// ============================================================================
// Re-export Types from types/supabase.ts
// ============================================================================

export type {
  Database,
  Customer,
  CustomerInsert,
  CustomerUpdate,
  TradingAccount as SupabaseTradingAccount,
  TradingAccountInsert,
  TradingAccountUpdate,
  CustomerWithTradingAccounts,
  PaginatedResponse,
  CustomerTier,
  KycStatus,
  CustomerStatus,
  Json,
} from '@/types/supabase'
