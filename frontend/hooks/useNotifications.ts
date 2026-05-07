import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '@/services/notifications/notifications';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { isAuthenticated } = useAuth();

  // Keep a stable ref so the effect never needs to redeclare itself when
  // isAuthenticated changes, avoiding the set-state-in-effect lint rule.
  const fetchRef = useRef<() => Promise<void>>(async () => {});

  fetchRef.current = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch {
      // Non-fatal: keep stale notifications if the request fails.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const run = () => fetchRef.current();
    run();
    const interval = setInterval(run, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      // Non-fatal: keep current state if the request fails.
    }
  };

  const markOneRead = async (id: number) => {
    await markNotificationRead(id);
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n)),
    );
  };

  const refresh = () => fetchRef.current();

  return { notifications, unreadCount, markAllRead, markOneRead, refresh };
}