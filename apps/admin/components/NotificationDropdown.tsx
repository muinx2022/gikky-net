"use client";

import { useState, useEffect } from 'react';
import { Menu, ActionIcon, Badge, Text, Box, ScrollArea, Group, Button, Divider } from '@mantine/core';
import { Bell, Check, X, Shield, MessageSquare } from 'lucide-react';
import { strapiApi } from '../lib/strapi';
import { notifications as mantineNotifications } from '@mantine/notifications';
import { io, Socket } from 'socket.io-client';

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
    postId?: string;
    postTitle?: string;
  };
}

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const userCookie = localStorage.getItem('user');
      if (!userCookie) return;

      const currentUser = JSON.parse(userCookie);

      const response = await strapiApi.get('/api/notifications', {
        params: {
          filters: {
            user: {
              id: {
                $eq: currentUser.id,
              },
            },
          },
          sort: 'createdAt:desc',
          pagination: {
            limit: 20,
          },
        },
      });

      const notificationData = response.data.data || [];
      setNotifications(notificationData);
      setUnreadCount(notificationData.filter((n: Notification) => !n.read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await strapiApi.put(`/api/notifications/${notificationId}`, {
        data: { read: true },
      });

      setNotifications(notifications.map(n =>
        n.documentId === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setLoading(true);

      await Promise.all(
        notifications
          .filter(n => !n.read)
          .map(n => strapiApi.put(`/api/notifications/${n.documentId}`, {
            data: { read: true },
          }))
      );

      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);

      mantineNotifications.show({
        title: 'Success',
        message: 'All notifications marked as read',
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      mantineNotifications.show({
        title: 'Error',
        message: 'Failed to mark all as read',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptModeratorInvite = async (notificationId: string, categoryId: string) => {
    try {
      console.log('Accepting moderator invite for category:', categoryId);

      // Get current user ID
      const userCookie = localStorage.getItem('user');
      if (!userCookie) {
        throw new Error('User not logged in');
      }
      const currentUser = JSON.parse(userCookie);

      // Create category moderator action
      await strapiApi.post('/api/category-actions', {
        data: {
          category: categoryId,
          user: currentUser.id,
          actionType: 'moderator',
          status: 'active',
        },
      });

      // Mark notification as read
      await handleMarkAsRead(notificationId);

      mantineNotifications.show({
        title: 'Success',
        message: 'You are now a moderator',
        color: 'green',
      });

      // Remove notification from list
      setNotifications(notifications.filter(n => n.documentId !== notificationId));
    } catch (error: any) {
      console.error('Failed to accept invite:', error);
      mantineNotifications.show({
        title: 'Error',
        message: error?.response?.data?.error?.message || 'Failed to accept invitation',
        color: 'red',
      });
    }
  };

  const handleDeclineModeratorInvite = async (notificationId: string) => {
    try {
      // Just mark as read and remove
      await handleMarkAsRead(notificationId);
      setNotifications(notifications.filter(n => n.documentId !== notificationId));

      mantineNotifications.show({
        message: 'Invitation declined',
        color: 'gray',
      });
    } catch (error) {
      console.error('Failed to decline invite:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'moderator_invite':
        return <Shield size={18} color="#f97316" />;
      case 'comment':
        return <MessageSquare size={18} color="#3b82f6" />;
      default:
        return <Bell size={18} />;
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
    <Menu
      opened={opened}
      onChange={setOpened}
      width={400}
      position="bottom-end"
      shadow="xl"
      radius="lg"
    >
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          radius="xl"
          style={{ position: 'relative' }}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <Badge
              size="xs"
              circle
              color="red"
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 18,
                height: 18,
                padding: 0,
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown p={0}>
        {/* Header */}
        <Box p="md" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <Group justify="space-between">
            <Text fw={700} size="sm" c="#0f172a">
              Notifications
            </Text>
            {unreadCount > 0 && (
              <Button
                size="xs"
                variant="subtle"
                onClick={handleMarkAllAsRead}
                loading={loading}
                compact
              >
                Mark all read
              </Button>
            )}
          </Group>
        </Box>

        {/* Notifications List */}
        <ScrollArea h={Math.min(notifications.length * 100, 400)} type="auto">
          {notifications.length === 0 ? (
            <Box p="xl" ta="center">
              <Bell size={48} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
              <Text size="sm" c="#94a3b8">
                No notifications yet
              </Text>
            </Box>
          ) : (
            notifications.map((notification) => (
              <Box
                key={notification.id}
                p="md"
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  background: notification.read ? 'transparent' : '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <Group gap="sm" align="flex-start" wrap="nowrap">
                  <Box mt={4}>
                    {getNotificationIcon(notification.type)}
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" c="#0f172a" lineClamp={2}>
                      {notification.message}
                    </Text>
                    <Text size="xs" c="#94a3b8" mt={4}>
                      {formatTimeAgo(notification.createdAt)}
                    </Text>

                    {/* Moderator Invite Actions */}
                    {notification.type === 'moderator_invite' && !notification.read && (
                      <Group gap="xs" mt="sm">
                        <Button
                          size="xs"
                          color="orange"
                          leftSection={<Check size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptModeratorInvite(
                              notification.documentId,
                              notification.data?.categoryId || ''
                            );
                          }}
                          radius="md"
                        >
                          Accept
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="gray"
                          leftSection={<X size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeclineModeratorInvite(notification.documentId);
                          }}
                          radius="md"
                        >
                          Decline
                        </Button>
                      </Group>
                    )}
                  </Box>
                  {!notification.read && (
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="blue"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notification.documentId);
                      }}
                    >
                      <Check size={14} />
                    </ActionIcon>
                  )}
                </Group>
              </Box>
            ))
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Divider />
            <Box p="sm" ta="center">
              <Button
                variant="subtle"
                size="xs"
                fullWidth
                onClick={() => {
                  setOpened(false);
                  // TODO: Navigate to notifications page
                }}
              >
                View all notifications
              </Button>
            </Box>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
