'use client';

/**
 * Withdrawal Action Modal Component
 * Confirmation modal for approving/rejecting withdrawals
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0713
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { WithdrawalEvent } from '@/types/payment';

// ============================================================================
// Types
// ============================================================================

export interface WithdrawalActionModalProps {
  isOpen: boolean;
  type: 'approve' | 'reject' | null;
  withdrawal: WithdrawalEvent | null;
  onConfirm: (params: { uuid: string; reason?: string }) => Promise<void>;
  onCancel: () => void;
  isPending: boolean;
  error: Error | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

// ============================================================================
// Component
// ============================================================================

export function WithdrawalActionModal({
  isOpen,
  type,
  withdrawal,
  onConfirm,
  onCancel,
  isPending,
  error,
}: WithdrawalActionModalProps) {
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setLocalError(null);
      // Focus on input for reject modal
      if (type === 'reject') {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [isOpen, type]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isPending) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isPending, onCancel]);

  const handleConfirm = useCallback(async () => {
    if (!withdrawal) return;

    // Validate reason for rejections
    if (type === 'reject' && (!reason || reason.trim().length < 3)) {
      setLocalError('Please provide a reason for rejection (minimum 3 characters)');
      return;
    }

    setLocalError(null);

    try {
      await onConfirm({
        uuid: withdrawal.uuid,
        reason: type === 'reject' ? reason.trim() : undefined,
      });
    } catch (e) {
      // Error is handled by parent component
      console.error('Action failed:', e);
    }
  }, [withdrawal, type, reason, onConfirm]);

  if (!isOpen || !withdrawal) return null;

  const isApprove = type === 'approve';
  const displayError = localError || error?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isPending ? undefined : onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={`px-6 py-4 border-b border-white/10 flex items-center justify-between ${
            isApprove ? 'bg-emerald-500/10' : 'bg-red-500/10'
          }`}
        >
          <div className="flex items-center gap-3">
            {isApprove ? (
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400" />
            )}
            <h2 className="text-lg font-semibold text-white">
              {isApprove ? 'Approve Withdrawal' : 'Reject Withdrawal'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {/* Withdrawal Details */}
          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/50">Amount</span>
              <span className="text-lg font-bold text-orange-400">
                {formatCurrency(withdrawal.amount, withdrawal.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/50">Customer</span>
              <span className="text-sm text-white">
                {withdrawal.accountInfo?.name} {withdrawal.accountInfo?.surname}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/50">Email</span>
              <span className="text-xs text-white/60 font-mono">
                {withdrawal.accountInfo?.email}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/50">ID</span>
              <span className="text-xs text-white/40 font-mono">
                {withdrawal.uuid.slice(0, 16)}...
              </span>
            </div>
          </div>

          {/* Confirmation Message */}
          <div
            className={`flex items-start gap-3 p-3 rounded-lg ${
              isApprove ? 'bg-emerald-500/10' : 'bg-amber-500/10'
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                isApprove ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            <p className={`text-sm ${isApprove ? 'text-emerald-300' : 'text-amber-300'}`}>
              {isApprove
                ? 'This will mark the withdrawal as approved. The customer will be notified.'
                : 'This will reject the withdrawal request. Please provide a reason below.'}
            </p>
          </div>

          {/* Reason Input (for rejection) */}
          {!isApprove && (
            <div className="space-y-2">
              <label className="block text-sm text-white/70">
                Rejection Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                ref={inputRef}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                rows={3}
                disabled={isPending}
              />
              <p className="text-xs text-white/40">Minimum 3 characters required</p>
            </div>
          )}

          {/* Error Display */}
          {displayError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{displayError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={isApprove ? 'primary' : 'danger'}
            onClick={handleConfirm}
            disabled={isPending || (type === 'reject' && reason.trim().length < 3)}
            leftIcon={
              isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isApprove ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )
            }
          >
            {isPending
              ? 'Processing...'
              : isApprove
              ? 'Approve Withdrawal'
              : 'Reject Withdrawal'}
          </Button>
        </div>
      </div>
    </div>
  );
}
