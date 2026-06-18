/**
 * NotificationToast Component
 * Animated toast notifications for user feedback
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0737
 */

'use client';

import type { ReactElement, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useNotificationStore, type Notification, type NotificationType } from '@/stores/notificationStore';

// ============================================================================
// Icon Mapping
// ============================================================================

const iconMap: Record<NotificationType, ReactNode> = {
  success: <CheckCircle className="w-5 h-5" />,
  error: <XCircle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
};

const colorMap: Record<NotificationType, string> = {
  success: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
  error: 'bg-red-500/20 border-red-500/50 text-red-400',
  info: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
  warning: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
};

const iconColorMap: Record<NotificationType, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-blue-400',
  warning: 'text-amber-400',
};

// ============================================================================
// Single Toast Component
// ============================================================================

interface ToastItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

function ToastItem({ notification, onDismiss }: ToastItemProps): ReactElement {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`
        relative flex items-start gap-3 p-4 rounded-lg border backdrop-blur-md
        shadow-lg min-w-[320px] max-w-[420px]
        ${colorMap[notification.type]}
      `}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${iconColorMap[notification.type]}`}>
        {iconMap[notification.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-white text-sm">
          {notification.title}
        </h4>
        <p className="text-sm text-white/70 mt-0.5 break-words">
          {notification.message}
        </p>
      </div>

      {/* Dismiss Button */}
      <button
        onClick={() => onDismiss(notification.id)}
        className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4 text-white/50 hover:text-white/80" />
      </button>

      {/* Progress Bar for Auto-dismiss */}
      {notification.autoDismiss && (
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-white/30 rounded-b-lg"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: notification.dismissAfterMs / 1000, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}

// ============================================================================
// Main Toast Container
// ============================================================================

export function NotificationToast(): ReactElement {
  const { notifications, removeNotification } = useNotificationStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <ToastItem
            key={notification.id}
            notification={notification}
            onDismiss={removeNotification}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Provider Component (wraps app to enable notifications)
// ============================================================================

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps): ReactElement {
  return (
    <>
      {children}
      <NotificationToast />
    </>
  );
}

export default NotificationToast;
