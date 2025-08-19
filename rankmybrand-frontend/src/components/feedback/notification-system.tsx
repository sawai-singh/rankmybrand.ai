'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Loader2,
  Sparkles,
  Zap,
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Notification types
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'custom';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  customContent?: React.ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  hapticFeedback?: boolean;
}

// Context
interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// Provider
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? (notification.type === 'loading' ? 0 : 5000),
      position: notification.position ?? 'top-right',
      hapticFeedback: notification.hapticFeedback ?? true,
    };

    setNotifications(prev => [...prev, newNotification]);

    // Haptic feedback simulation
    if (newNotification.hapticFeedback && 'vibrate' in navigator) {
      if (newNotification.type === 'error') {
        navigator.vibrate([100, 50, 100]);
      } else if (newNotification.type === 'success') {
        navigator.vibrate(50);
      } else {
        navigator.vibrate(30);
      }
    }

    // Auto-remove after duration
    if (newNotification.duration && newNotification.duration > 0 && !newNotification.persistent) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearAll }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

// Container
function NotificationContainer() {
  const { notifications } = useNotifications();

  // Group notifications by position
  const groupedNotifications = React.useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    notifications.forEach(notification => {
      const position = notification.position || 'top-right';
      if (!groups[position]) {
        groups[position] = [];
      }
      groups[position].push(notification);
    });
    return groups;
  }, [notifications]);

  const positionClasses = {
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-center': 'top-6 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  };

  return (
    <>
      {Object.entries(groupedNotifications).map(([position, notifs]) => (
        <div
          key={position}
          className={cn(
            'fixed z-50 flex flex-col gap-3 max-w-md',
            positionClasses[position as keyof typeof positionClasses]
          )}
        >
          <AnimatePresence mode="sync">
            {notifs.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </AnimatePresence>
        </div>
      ))}
    </>
  );
}

// Individual Notification
function NotificationItem({ notification }: { notification: Notification }) {
  const { removeNotification } = useNotifications();
  const [isHovered, setIsHovered] = useState(false);

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    loading: <Loader2 className="w-5 h-5 animate-spin" />,
    custom: notification.icon || <Bell className="w-5 h-5" />,
  };

  const colors = {
    success: 'from-green-600 to-emerald-600',
    error: 'from-red-600 to-rose-600',
    warning: 'from-yellow-600 to-orange-600',
    info: 'from-blue-600 to-cyan-600',
    loading: 'from-violet-600 to-purple-600',
    custom: 'from-violet-600 to-pink-600',
  };

  const bgColors = {
    success: 'bg-green-50 dark:bg-green-900/20',
    error: 'bg-red-50 dark:bg-red-900/20',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20',
    info: 'bg-blue-50 dark:bg-blue-900/20',
    loading: 'bg-violet-50 dark:bg-violet-900/20',
    custom: 'bg-violet-50 dark:bg-violet-900/20',
  };

  const enterAnimation = {
    initial: { opacity: 0, scale: 0.8, y: -20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.8, x: 100 },
  };

  if (notification.customContent) {
    return (
      <motion.div
        layout
        {...enterAnimation}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        {notification.customContent}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      {...enterAnimation}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative glass-panel-floating rounded-2xl overflow-hidden shadow-2xl min-w-[320px]"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* Progress bar for auto-dismiss */}
      {notification.duration && notification.duration > 0 && !notification.persistent && (
        <motion.div
          className={cn('absolute top-0 left-0 h-1 bg-gradient-to-r', colors[notification.type])}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: notification.duration / 1000, ease: 'linear' }}
        />
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn('p-2 rounded-xl bg-gradient-to-r text-white', colors[notification.type])}>
            {icons[notification.type]}
          </div>

          {/* Content */}
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {notification.title}
            </h4>
            {notification.message && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {notification.message}
              </p>
            )}
            
            {/* Action button */}
            {notification.action && (
              <motion.button
                onClick={notification.action.onClick}
                className="mt-3 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {notification.action.label} →
              </motion.button>
            )}
          </div>

          {/* Close button */}
          {!notification.persistent && (
            <motion.button
              onClick={() => removeNotification(notification.id)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4 text-gray-500" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Hover effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-violet-600/5 to-pink-600/5 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Sparkle effect for success */}
      {notification.type === 'success' && (
        <motion.div
          className="absolute top-2 right-2"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        >
          <Sparkles className="w-4 h-4 text-yellow-500" />
        </motion.div>
      )}
    </motion.div>
  );
}

// Inline Validation Component
interface InlineValidationProps {
  isValid?: boolean;
  message?: string;
  show?: boolean;
}

export function InlineValidation({ isValid, message, show }: InlineValidationProps) {
  return (
    <AnimatePresence>
      {show && message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className={cn(
            'flex items-center gap-2 mt-2 text-sm',
            isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}>
            {isValid ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Confirmation Dialog
interface ConfirmationDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmationDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
}: ConfirmationDialogProps) {
  const colors = {
    danger: 'from-red-600 to-rose-600',
    warning: 'from-yellow-600 to-orange-600',
    info: 'from-blue-600 to-cyan-600',
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          
          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="glass-panel-floating rounded-3xl p-6 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className={cn('p-3 rounded-xl bg-gradient-to-r text-white', colors[variant])}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <motion.button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {cancelText}
                </motion.button>
                <motion.button
                  onClick={onConfirm}
                  className={cn('flex-1 px-4 py-2 rounded-xl text-white bg-gradient-to-r', colors[variant])}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {confirmText}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}