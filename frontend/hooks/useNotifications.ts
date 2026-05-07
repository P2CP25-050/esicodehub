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

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch {
      // Non-fatal: keep stale notifications if the request fails.
    }
  }, [isAuthenticated]);

  // Store the latest callback in a ref so the polling effect never
  // needs to re-register itself when isAuthenticated changes.
  // The assignment happens inside useEffect, not during render.
  const fetchRef = useRef(fetchNotifications);
  useEffect(() => {
    fetchRef.current = fetchNotifications;
  }, [fetchNotifications]);

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