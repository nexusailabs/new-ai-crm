'use client';

/**
 * useWithdrawalActions Hook
 * React Query mutations for approving/rejecting withdrawals
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0713
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { WITHDRAWALS_QUERY_KEY } from './useWithdrawals';
import type { WithdrawalEvent } from '@/types/payment';

// ============================================================================
// Types
// ============================================================================

export interface WithdrawalActionResult {
  success: boolean;
  uuid: string;
  newStatus: 'APPROVED' | 'REJECTED';
  matchTradeStatus?: string;
  message: string;
  timestamp: string;
}

export interface ApproveParams {
  uuid: string;
  reason?: string;
  operatorId?: string;
}

export interface RejectParams {
  uuid: string;
  reason: string;
  operatorId?: string;
}

export interface ModalState {
  isOpen: boolean;
  type: 'approve' | 'reject' | null;
  withdrawal: WithdrawalEvent | null;
}

export interface UseWithdrawalActionsReturn {
  // Approve mutation
  approve: (params: ApproveParams) => Promise<WithdrawalActionResult>;
  isApproving: boolean;
  approveError: Error | null;

  // Reject mutation
  reject: (params: RejectParams) => Promise<WithdrawalActionResult>;
  isRejecting: boolean;
  rejectError: Error | null;

  // Combined state
  isPending: boolean;

  // Modal state management
  modalState: ModalState;
  openApproveModal: (withdrawal: WithdrawalEvent) => void;
  openRejectModal: (withdrawal: WithdrawalEvent) => void;
  closeModal: () => void;

  // Reset errors
  clearErrors: () => void;
}

// ============================================================================
// API Functions
// ============================================================================

async function approveWithdrawal(params: ApproveParams): Promise<WithdrawalActionResult> {
  const response = await fetch(`/ai-crm/api/withdrawals/${params.uuid}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: params.reason,
      operatorId: params.operatorId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to approve withdrawal');
  }

  return data;
}

async function rejectWithdrawal(params: RejectParams): Promise<WithdrawalActionResult> {
  const response = await fetch(`/ai-crm/api/withdrawals/${params.uuid}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: params.reason,
      operatorId: params.operatorId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to reject withdrawal');
  }

  return data;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useWithdrawalActions(): UseWithdrawalActionsReturn {
  const queryClient = useQueryClient();

  // Modal state
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    type: null,
    withdrawal: null,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: approveWithdrawal,
    onSuccess: (data) => {
      // Invalidate withdrawals query to refetch
      queryClient.invalidateQueries({ queryKey: WITHDRAWALS_QUERY_KEY });

      // Optimistic update - update the specific withdrawal in cache
      queryClient.setQueriesData(
        { queryKey: WITHDRAWALS_QUERY_KEY },
        (oldData: { withdrawals: WithdrawalEvent[] } | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            withdrawals: oldData.withdrawals.map((w) =>
              w.uuid === data.uuid ? { ...w, status: 'APPROVED' as const } : w
            ),
          };
        }
      );

      // Close modal
      setModalState({ isOpen: false, type: null, withdrawal: null });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: rejectWithdrawal,
    onSuccess: (data) => {
      // Invalidate withdrawals query to refetch
      queryClient.invalidateQueries({ queryKey: WITHDRAWALS_QUERY_KEY });

      // Optimistic update
      queryClient.setQueriesData(
        { queryKey: WITHDRAWALS_QUERY_KEY },
        (oldData: { withdrawals: WithdrawalEvent[] } | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            withdrawals: oldData.withdrawals.map((w) =>
              w.uuid === data.uuid ? { ...w, status: 'REJECTED' as const } : w
            ),
          };
        }
      );

      // Close modal
      setModalState({ isOpen: false, type: null, withdrawal: null });
    },
  });

  // Modal handlers
  const openApproveModal = useCallback((withdrawal: WithdrawalEvent) => {
    setModalState({ isOpen: true, type: 'approve', withdrawal });
  }, []);

  const openRejectModal = useCallback((withdrawal: WithdrawalEvent) => {
    setModalState({ isOpen: true, type: 'reject', withdrawal });
  }, []);

  const closeModal = useCallback(() => {
    setModalState({ isOpen: false, type: null, withdrawal: null });
  }, []);

  // Clear errors
  const clearErrors = useCallback(() => {
    approveMutation.reset();
    rejectMutation.reset();
  }, [approveMutation, rejectMutation]);

  return {
    approve: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    approveError: approveMutation.error,

    reject: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
    rejectError: rejectMutation.error,

    isPending: approveMutation.isPending || rejectMutation.isPending,

    modalState,
    openApproveModal,
    openRejectModal,
    closeModal,

    clearErrors,
  };
}
