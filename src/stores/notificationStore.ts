/**
 * Notification Store
 * Zustand store for managing UI toast notifications
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0737
 */

import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  autoDismiss: boolean;
  dismissAfterMs: number;
}

interface NotificationState {
  notifications: Notification[];
}

interface NotificationActions {
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export type NotificationStore = NotificationState & NotificationActions;

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Store
// ============================================================================

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  // State
  notifications: [],

  // Actions
  addNotification: (notification) => {
    const id = generateId();
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      autoDismiss: notification.autoDismiss ?? true,
      dismissAfterMs: notification.dismissAfterMs ?? 5000,
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-dismiss if enabled
    if (newNotification.autoDismiss) {
      setTimeout(() => {
        get().removeNotification(id);
      }, newNotification.dismissAfterMs);
    }

    return id;
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));

// ============================================================================
// Convenience Functions
// ============================================================================

export function showSuccess(title: string, message: string): string {
  return useNotificationStore.getState().addNotification({
    type: 'success',
    title,
    message,
    autoDismiss: true,
    dismissAfterMs: 5000,
  });
}

export function showError(title: string, message: string): string {
  return useNotificationStore.getState().addNotification({
    type: 'error',
    title,
    message,
    autoDismiss: true,
    dismissAfterMs: 8000,
  });
}

export function showInfo(title: string, message: string): string {
  return useNotificationStore.getState().addNotification({
    type: 'info',
    title,
    message,
    autoDismiss: true,
    dismissAfterMs: 5000,
  });
}

export function showWarning(title: string, message: string): string {
  return useNotificationStore.getState().addNotification({
    type: 'warning',
    title,
    message,
    autoDismiss: true,
    dismissAfterMs: 6000,
  });
}
