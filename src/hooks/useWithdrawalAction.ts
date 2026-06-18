/**
 * useWithdrawalAction Hook
 * React Query mutation hook for withdrawal approve/reject actions
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0713 - Withdrawal Pending Action API
 * Updated: 2025-12-29
 * Mission: MISSION-20251229-0737 - Added notification integration
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PaymentActionResponse } from '@/types/payment';
import { showSuccess, showError } from '@/stores/notificationStore';

// ============================================================================
// Types
// ============================================================================

export interface WithdrawalActionParams {
  uuid: string;
  action: 'APPROVE' | 'REJECT';
  reason?: string;
}

export interface UseWithdrawalActionOptions {
  onSuccess?: (data: PaymentActionResponse) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// API Function
// ============================================================================

async function executeWithdrawalAction(
  params: WithdrawalActionParams
): Promise<PaymentActionResponse> {
  const { uuid, action, reason } = params;

  // Use separate endpoints for approve/reject actions
  const endpoint = action === 'APPROVE'
    ? `/ai-crm/api/withdrawals/${uuid}/approve`
    : `/ai-crm/api/withdrawals/${uuid}/reject`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Failed to ${action.toLowerCase()} withdrawal`);
  }

  return response.json();
}

// ============================================================================
// Hook
// ============================================================================

export function useWithdrawalAction(options: UseWithdrawalActionOptions = {}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: executeWithdrawalAction,

    onSuccess: (data, variables) => {
      // Invalidate withdrawals query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });

      // Show success notification
      const actionText = variables.action === 'APPROVE' ? 'Approved' : 'Rejected';
      showSuccess(
        `Withdrawal ${actionText}`,
        data.message || `Withdrawal has been ${actionText.toLowerCase()} successfully`
      );

      // Call custom success handler
      options.onSuccess?.(data);
    },

    onError: (error: Error, variables) => {
      console.error('[useWithdrawalAction] Error:', error);

      // Show error notification
      const actionText = variables.action === 'APPROVE' ? 'approve' : 'reject';
      showError(
        `Failed to ${actionText}`,
        error.message || `Could not ${actionText} the withdrawal`
      );

      options.onError?.(error);
    },
  });

  return {
    // Action functions
    approve: (uuid: string, reason?: string) =>
      mutation.mutate({ uuid, action: 'APPROVE', reason }),

    reject: (uuid: string, reason?: string) =>
      mutation.mutate({ uuid, action: 'REJECT', reason }),

    // Direct mutate for custom usage
    executeAction: mutation.mutate,

    // State
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,

    // Reset state
    reset: mutation.reset,
  };
}

// ============================================================================
// Batch Action Hook (for multiple withdrawals)
// ============================================================================

export interface BatchWithdrawalActionParams {
  uuids: string[];
  action: 'APPROVE' | 'REJECT';
  reason?: string;
}

export function useWithdrawalBatchAction(options: UseWithdrawalActionOptions = {}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: BatchWithdrawalActionParams) => {
      const { uuids, action, reason } = params;

      // Execute all actions in parallel
      const results = await Promise.allSettled(
        uuids.map((uuid) => executeWithdrawalAction({ uuid, action, reason }))
      );

      // Count successes and failures
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failCount = results.filter((r) => r.status === 'rejected').length;

      if (failCount > 0) {
        throw new Error(`${failCount} of ${uuids.length} withdrawals failed to process`);
      }

      return {
        success: true,
        processedCount: successCount,
        action,
      };
    },

    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });

      // Show success notification for batch action
      const actionText = variables.action === 'APPROVE' ? 'approved' : 'rejected';
      showSuccess(
        'Batch Action Complete',
        `Successfully ${actionText} ${data.processedCount} withdrawal(s)`
      );
    },

    onError: (error: Error, variables) => {
      console.error('[useWithdrawalBatchAction] Error:', error);

      // Show error notification
      const actionText = variables.action === 'APPROVE' ? 'approve' : 'reject';
      showError(
        'Batch Action Failed',
        error.message || `Failed to ${actionText} some withdrawals`
      );

      options.onError?.(error);
    },
  });

  return {
    batchApprove: (uuids: string[], reason?: string) =>
      mutation.mutate({ uuids, action: 'APPROVE', reason }),

    batchReject: (uuids: string[], reason?: string) =>
      mutation.mutate({ uuids, action: 'REJECT', reason }),

    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
