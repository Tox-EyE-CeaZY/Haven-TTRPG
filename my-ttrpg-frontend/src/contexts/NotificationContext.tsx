// src/contexts/NotificationContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface NotificationSchema {
  id: number;
  user_id: number;
  type: string; // e.g., "new_dm", "game_invite"
  content: string;
  link?: string | null;
  is_read: boolean;
  timestamp: string; // ISO date string
}

interface NotificationContextType {
  notifications: NotificationSchema[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationSchema[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    setIsAuthenticated(!!token);
  }, []); // Re-check on mount or when token might change (e.g. after login/logout)

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('accessToken');
    try {
      const cacheBuster = `&_cb=${new Date().getTime()}`; // Cache buster
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/me?include_read=true&limit=20${cacheBuster}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.status === 401) {
        localStorage.removeItem('accessToken');
        setIsAuthenticated(false);
        router.push('/login?message=Session expired. Please login again.');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data: NotificationSchema[] = await response.json();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      // Optional: Set up polling or WebSocket connection for real-time updates here
      const intervalId = setInterval(fetchNotifications, 60000); // Poll every 60 seconds
      return () => clearInterval(intervalId);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, fetchNotifications]);

  const markAsRead = async (notificationId: number) => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1)); // Ensure count doesn't go below 0
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const newToast: ToastMessage = { id: Date.now(), message, type };
    setToasts(prevToasts => [...prevToasts, newToast]);
    setTimeout(() => {
      setToasts(prevToasts => prevToasts.filter(toast => toast.id !== newToast.id));
    }, 5000); // Auto-dismiss after 5 seconds
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, isLoading, error, fetchNotifications, markAsRead, markAllAsRead, showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 space-y-2">
        {toasts.map(toast => (
          <div key={toast.id} className={`p-4 rounded-md shadow-lg text-white
            ${toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};