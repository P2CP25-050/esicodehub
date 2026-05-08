import apiClient from '@/lib/axios';

export interface Notification {
  id: number;
  title: string;
  message?: string;
  type: 'info' | 'success' | 'warning' | 'error' | string;
  link: string;
  is_read: boolean;
  created_at: string; // ISO 8601
}

export const getNotifications = () =>
  apiClient.get<Notification[]>('/notifications/').then(r => r.data);

export const markAllNotificationsRead = () =>
  apiClient.patch('/notifications/read/');

export const markNotificationRead = (id: number) =>
  apiClient.patch(`/notifications/${id}/read/`);