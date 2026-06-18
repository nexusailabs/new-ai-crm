/**
 * Notifier Module
 * Handles notifications for withdrawal status changes
 * Supports email, webhook dispatch, and in-app notifications
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0737 - Phase 2
 */

// Re-export all notifier functionality
export * from './types';
export * from './email-notifier';
export * from './webhook-dispatcher';
export { notifyWithdrawalStatusChange } from './withdrawal-notifier';
