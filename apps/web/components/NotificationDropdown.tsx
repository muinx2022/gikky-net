"use client";

import { useState, useEffect } from 'react';
import { Bell, Shield, MessageSquare, Heart, UserPlus } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { getAuthToken } from '../lib/auth-storage';
import { useAuth } from './AuthContext';

interface Notification {
  id: number;
  documentId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: {
    categoryId?: string;
    categoryName?: string;
    inviteStatus?: 'pending' | 'active' | 'removed';
    postId?: string;
    postTitle?: string;
    commentId?: string;
    parentCommentId?: string;
  };
}

export default function NotificationDropdown() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;

      const response = await api.get('/api/notifications/me', {
        params: { limit: 20 },
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const notificationData = response.data?.data || [];
      setNotifications(notificationData);
      setUnreadCount(notificationData.filter((n: Notification) => !n.read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    if (!currentUser?.id) return;

    let activeSocket: Socket | null = null;

    fetchNotifications();

    const jwt = getAuthToken();
    if (!jwt) return;

    const newSocket = io('http://localhost:1337', {
      transports: ['websocket', 'polling'],
    });
    activeSocket = newSocket;

    newSocket.on('connect', () => {
      console.log('Connected to notification server');
      newSocket.emit('join', currentUser.id);
      fetchNotifications();
    });

    newSocket.on('notification:new', (notification: Notification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.documentId === notification.documentId)) return prev;
        if (!notification.read) setUnreadCount((count) => count + 1);
        return [notification, ...prev];
      });

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Notification', { body: notification.message, icon: '/favicon.ico' });
      }
    });

    newSocket.on('notification:update', (data: { documentId: string; read: boolean }) => {
      setNotifications((prev) => prev.map((n) => (n.documentId === data.documentId ? { ...n, read: data.read } : n)));
      if (data.read) setUnreadCount((prev) => Math.max(0, prev - 1));
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from notification server');
    });

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      activeSocket?.disconnect();
    };
  }, [currentUser?.id]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const jwt = getAuthToken();
      await fetch(`http://localhost:1337/api/notifications/${notificationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          data: { read: true },
        }),
      });

      setNotifications(notifications.map((n) => (n.documentId === notificationId ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.type === 'moderator_invite') {
      router.push(`/notifications/${notification.documentId}`);
      setIsOpen(false);
      return;
    }

    if (!notification.read) {
      await handleMarkAsRead(notification.documentId);
    }

    const postId = notification.data?.postId;
    const commentId = notification.data?.commentId || notification.data?.parentCommentId;

    if (postId) {
      const query = commentId ? `?comment=${encodeURIComponent(commentId)}` : '';
      router.push(`/p/notification--${postId}${query}`);
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const jwt = getAuthToken();
      await Promise.all(
        notifications
          .filter((n) => !n.read)
          .map((n) =>
            fetch(`http://localhost:1337/api/notifications/${n.documentId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
              },
              body: JSON.stringify({
                data: { read: true },
              }),
            })
          )
      );

      setNotifications(notifications.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;

      await api.delete('/api/notifications/clear-all', {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'moderator_invite':
        return <Shield size={18} className="text-orange-500" />;
      case 'comment':
        return <MessageSquare size={18} className="text-blue-500" />;
      case 'like':
        return <Heart size={18} className="text-red-500" />;
      case 'follow':
        return <UserPlus size={18} className="text-green-500" />;
      default:
        return <Bell size={18} className="text-slate-500" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
      >
        <Bell size={20} className="text-current" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 z-20 mt-2 flex max-h-[600px] w-96 flex-col rounded-xl border border-slate-300 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-300 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllAsRead} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button onClick={handleClearAll} className="text-xs text-red-600 hover:text-red-700 dark:text-red-400">
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`cursor-pointer border-b border-slate-100 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                      !notification.read ? 'bg-blue-50 dark:bg-blue-950' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-900 dark:text-white">{notification.message}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatTimeAgo(notification.createdAt)}</p>
                      </div>
                      {!notification.read && <div className="mt-2 h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
