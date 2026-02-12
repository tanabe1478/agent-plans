/**
 * React Query hooks for notifications operations via IPC
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ipcClient } from '../api/ipcClient';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: ipcClient.notifications.list,
    refetchInterval: 30_000, // Refetch every 30 seconds
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => ipcClient.notifications.markRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ipcClient.notifications.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
