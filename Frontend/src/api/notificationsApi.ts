import apiClient from '@/lib/axios';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'alert';
}

export const notificationsApi = {
  async getNotifications(): Promise<NotificationItem[]> {
    const response = await apiClient.get<NotificationItem[]>('/notifications');
    return response.data;
  },

  async markAsRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${id}/read`);
  },
};

