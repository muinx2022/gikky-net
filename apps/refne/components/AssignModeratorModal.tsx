"use client";

import { useState, useEffect } from 'react';
import { Modal, Text, Box, Avatar, Group, Button, Select, ActionIcon, ScrollArea, Divider, Badge } from '@mantine/core';
import { Shield, UserPlus, Send, X, Trash2 } from 'lucide-react';
import { strapiApi } from '../lib/strapi';
import { notifications } from '@mantine/notifications';
import DeleteConfirmModal from './DeleteConfirmModal';

interface User {
  id: number;
  username: string;
  email: string;
  role?: {
    name: string;
  };
}

interface SelectedUser {
  id: number;
  username: string;
  email: string;
}

interface Moderator {
  id: number;
  documentId: string;
  createdAt: string;
  status: 'pending' | 'active' | 'removed';
  user: {
    id: number;
    username: string;
    email: string;
  };
}

interface AssignModeratorModalProps {
  opened: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
  onSuccess: () => void;
}

export default function AssignModeratorModal({
  opened,
  onClose,
  categoryId,
  categoryName,
  onSuccess,
}: AssignModeratorModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [loadingModerators, setLoadingModerators] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    opened: boolean;
    actionId: string;
    username: string;
    type: 'moderator' | 'invite';
  }>({
    opened: false,
    actionId: '',
    username: '',
    type: 'moderator',
  });

  useEffect(() => {
    if (opened) {
      fetchUsers();
      fetchModerators();
    }
  }, [opened, categoryId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await strapiApi.get('/api/admin-users', {
        params: {
          populate: ['role'],
        },
      });
      const rawUsers = response.data?.data || [];
      const filteredUsers = rawUsers.filter((u: User & { role?: { name?: string; type?: string } }) => {
        const roleName = (u.role?.name || u.role?.type || '').toLowerCase().trim();
        return roleName === 'authenticated';
      });
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModerators = async () => {
    try {
      setLoadingModerators(true);
      const response = await strapiApi.get(`/api/admin-categories/${categoryId}/moderators`);
      setModerators(response.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch moderators:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load current moderators',
        color: 'red',
      });
    } finally {
      setLoadingModerators(false);
    }
  };

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const handleSelectUser = (userId: string | null) => {
    if (!userId) return;

    const user = users.find((u) => u.id.toString() === userId);
    if (!user) return;

    // Check if user is already selected
    if (selectedUsers.some((u) => u.id === user.id)) {
      notifications.show({
        title: 'Already Selected',
        message: `${user.username} is already in the list`,
        color: 'yellow',
      });
      return;
    }

    setSelectedUsers([...selectedUsers, {
      id: user.id,
      username: user.username,
      email: user.email,
    }]);
    setCurrentSelection(null);
  };

  const handleRemoveUser = (userId: number) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  const openRemoveModeratorConfirm = (moderatorId: string, username: string) => {
    setConfirmRemove({
      opened: true,
      actionId: moderatorId,
      username,
      type: 'moderator',
    });
  };

  const openRemoveInviteConfirm = (moderatorId: string, username: string) => {
    setConfirmRemove({
      opened: true,
      actionId: moderatorId,
      username,
      type: 'invite',
    });
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemove.actionId) return;

    setRemovingId(confirmRemove.actionId);
    try {
      await strapiApi.delete(`/api/admin-categories/${categoryId}/moderators/${confirmRemove.actionId}`);
      notifications.show({
        title: 'Success',
        message:
          confirmRemove.type === 'moderator'
            ? `${confirmRemove.username} removed as moderator`
            : `Invitation removed for ${confirmRemove.username}`,
        color: 'green',
      });
      await fetchModerators();
    } catch (error: any) {
      console.error('Failed to remove moderator/invitation:', error);
      notifications.show({
        title: 'Error',
        message:
          error?.response?.data?.error?.message ||
          (confirmRemove.type === 'moderator' ? 'Failed to remove moderator' : 'Failed to remove invitation'),
        color: 'red',
      });
    } finally {
      setRemovingId(null);
      setConfirmRemove({
        opened: false,
        actionId: '',
        username: '',
        type: 'moderator',
      });
    }
  };

  const handleAssign = async () => {
    if (selectedUsers.length === 0) {
      notifications.show({
        title: 'No Users Selected',
        message: 'Please select at least one user',
        color: 'yellow',
      });
      return;
    }

    setAssigning(true);
    try {
      console.log('Assigning users as moderators:', selectedUsers.map(u => u.id));
      console.log('For category:', categoryId);

      // Assign moderators directly
      const results = await Promise.all(selectedUsers.map(user =>
        strapiApi.post(`/api/admin-categories/${categoryId}/moderators/assign`, {
          data: {
            userId: user.id,
          },
        })
      ));
      const createdCount = results.filter((r) => r.data?.data?.created).length;

      notifications.show({
        title: 'Success',
        message: createdCount > 0
          ? `Assigned ${selectedUsers.length} moderator(s) to ${categoryName}`
          : `All selected users already have moderator status`,
        color: 'green',
      });

      setSelectedUsers([]);
      setCurrentSelection(null);
      await fetchModerators();
      onSuccess();
    } catch (error: any) {
      console.error('Failed to assign moderators:', error);
      notifications.show({
        title: 'Error',
        message: error?.response?.data?.error?.message || 'Failed to assign moderators',
        color: 'red',
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleInvite = async () => {
    if (selectedUsers.length === 0) {
      notifications.show({
        title: 'No Users Selected',
        message: 'Please select at least one user',
        color: 'yellow',
      });
      return;
    }

    setInviting(true);
    try {
      console.log('Sending invitations to users:', selectedUsers.map(u => u.id));
      console.log('For category:', categoryId);

      // Invite users and create pending moderator actions
      const results = await Promise.all(selectedUsers.map(user =>
        strapiApi.post(`/api/admin-categories/${categoryId}/moderators/invite`, {
          data: {
            userId: user.id,
          },
        })
      ));

      const invitedCount = results.filter((r) => r.data?.data?.created).length;
      const skippedCount = selectedUsers.length - invitedCount;

      notifications.show({
        title: 'Invitations Sent',
        message:
          skippedCount > 0
            ? `Sent ${invitedCount} invite(s), skipped ${skippedCount} user(s) with existing status`
            : `Sent ${invitedCount} invitation(s) for ${categoryName}`,
        color: 'blue',
      });

      setSelectedUsers([]);
      setCurrentSelection(null);
      await fetchModerators();
      onSuccess();
    } catch (error) {
      console.error('Failed to send invitations:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to send invitations',
        color: 'red',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setCurrentSelection(null);
    onClose();
  };

  const getStatusColor = (status: Moderator['status']) => {
    if (status === 'active') return 'green';
    if (status === 'pending') return 'blue';
    return 'gray';
  };

  const getStatusLabel = (status: Moderator['status']) => {
    if (status === 'active') return 'Current Mod';
    if (status === 'pending') return 'Invited';
    return 'Rejected';
  };

  const currentMods = moderators.filter((mod) => mod.status === 'active');
  const invitedUsers = moderators.filter((mod) => mod.status !== 'active');

  const currentModeratorUserIds = new Set(moderators.map((mod) => mod.user?.id).filter(Boolean));

  const userOptions = users
    .filter((user) => !currentModeratorUserIds.has(user.id))
    .filter((user) => !selectedUsers.some((su) => su.id === user.id))
    .map((user) => ({
      value: user.id.toString(),
      label: `${user.username} (${user.email})`,
    }));

  return (
    <>
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Box>
          <Text size="lg" fw={700} c="#0f172a">
            Invite or Assign Moderator
          </Text>
          <Text size="sm" c="#64748b" mt={4}>
            Select users to moderate "{categoryName}"
          </Text>
        </Box>
      }
      size="lg"
      radius="lg"
    >
      <Box>
        <Box
          mb="xl"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <Box>
          <Group justify="space-between" mb="md">
            <Text size="sm" fw={600} c="#0f172a">
              Current Mods
            </Text>
            <Badge color="orange" variant="light">
              {currentMods.length}
            </Badge>
          </Group>

          {loadingModerators ? (
            <Text size="sm" c="#64748b">Loading moderators...</Text>
          ) : currentMods.length === 0 ? (
            <Text size="sm" c="#94a3b8">No current moderators yet</Text>
          ) : (
            <ScrollArea h={Math.min(currentMods.length * 74, 220)} type="auto">
              <Box>
                {currentMods.map((mod) => (
                  <Group
                    key={mod.id}
                    justify="space-between"
                    p="sm"
                    mb="xs"
                    style={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#fafafa',
                    }}
                  >
                    <Group gap="sm">
                      <Avatar
                        color="orange"
                        radius="xl"
                        size="sm"
                        styles={{
                          root: {
                            background: '#fff7ed',
                            color: '#f97316',
                          },
                        }}
                      >
                        {getInitials(mod.user.username)}
                      </Avatar>
                      <Box>
                        <Text fw={600} c="#0f172a" size="sm">
                          {mod.user.username}
                        </Text>
                        <Group gap={6}>
                          <Badge color={getStatusColor(mod.status)} size="xs" variant="light">
                            {getStatusLabel(mod.status)}
                          </Badge>
                        </Group>
                        <Text size="xs" c="#64748b">
                          {mod.user.email}
                        </Text>
                      </Box>
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => openRemoveModeratorConfirm(mod.documentId, mod.user.username)}
                      loading={removingId === mod.documentId}
                      size="md"
                    >
                      <Trash2 size={15} />
                    </ActionIcon>
                  </Group>
                ))}
              </Box>
            </ScrollArea>
          )}
          </Box>

          <Box>
          <Group justify="space-between" mb="md">
            <Text size="sm" fw={600} c="#0f172a">
              Invited Users
            </Text>
            <Badge color="blue" variant="light">
              {invitedUsers.length}
            </Badge>
          </Group>

          {loadingModerators ? (
            <Text size="sm" c="#64748b">Loading invited users...</Text>
          ) : invitedUsers.length === 0 ? (
            <Text size="sm" c="#94a3b8">No invited users yet</Text>
          ) : (
            <ScrollArea h={Math.min(invitedUsers.length * 74, 220)} type="auto">
              <Box>
                {invitedUsers.map((mod) => (
                  <Group
                    key={mod.id}
                    justify="space-between"
                    p="sm"
                    mb="xs"
                    style={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#fafafa',
                    }}
                  >
                    <Group gap="sm">
                      <Avatar
                        color="blue"
                        radius="xl"
                        size="sm"
                        styles={{
                          root: {
                            background: '#eff6ff',
                            color: '#2563eb',
                          },
                        }}
                      >
                        {getInitials(mod.user.username)}
                      </Avatar>
                      <Box>
                        <Text fw={600} c="#0f172a" size="sm">
                          {mod.user.username}
                        </Text>
                        <Group gap={6}>
                          <Badge color={getStatusColor(mod.status)} size="xs" variant="light">
                            {getStatusLabel(mod.status)}
                          </Badge>
                        </Group>
                        <Text size="xs" c="#64748b">
                          {mod.user.email}
                        </Text>
                      </Box>
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => openRemoveInviteConfirm(mod.documentId, mod.user.username)}
                      loading={removingId === mod.documentId}
                      size="md"
                    >
                      <Trash2 size={15} />
                    </ActionIcon>
                  </Group>
                ))}
              </Box>
            </ScrollArea>
          )}
          </Box>
        </Box>

        {/* User Selection */}
        <Select
          placeholder="Select a user to add..."
          data={userOptions}
          value={currentSelection}
          onChange={handleSelectUser}
          searchable
          clearable
          nothingFoundMessage="No users found"
          disabled={loading}
          radius="md"
          size="md"
          mb="xl"
          styles={{
            input: {
              fontSize: 14,
            },
          }}
        />

        {/* Selected Users List */}
        <Box mb="xl">
          <Group justify="space-between" mb="md">
            <Text size="sm" fw={600} c="#0f172a">
              Selected Users ({selectedUsers.length})
            </Text>
          </Group>

          {selectedUsers.length === 0 ? (
            <Box
              p="xl"
              style={{
                border: '2px dashed #e2e8f0',
                borderRadius: 8,
                textAlign: 'center',
              }}
            >
              <UserPlus size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <Text size="sm" c="#94a3b8">
                No users selected yet
              </Text>
              <Text size="xs" c="#cbd5e1" mt={4}>
                Use the dropdown above to add users
              </Text>
            </Box>
          ) : (
            <ScrollArea h={Math.min(selectedUsers.length * 70, 300)} type="auto">
              <Box>
                {selectedUsers.map((user) => (
                  <Group
                    key={user.id}
                    justify="space-between"
                    p="md"
                    mb="xs"
                    style={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#fafafa',
                    }}
                  >
                    <Group gap="sm">
                      <Avatar
                        color="orange"
                        radius="xl"
                        size="md"
                        styles={{
                          root: {
                            background: '#fff7ed',
                            color: '#f97316',
                          },
                        }}
                      >
                        {getInitials(user.username)}
                      </Avatar>
                      <Box>
                        <Text fw={600} c="#0f172a" size="sm">
                          {user.username}
                        </Text>
                        <Text size="xs" c="#64748b">
                          {user.email}
                        </Text>
                      </Box>
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleRemoveUser(user.id)}
                      size="lg"
                    >
                      <X size={18} />
                    </ActionIcon>
                  </Group>
                ))}
              </Box>
            </ScrollArea>
          )}
        </Box>

        <Divider mb="xl" />

        {/* Action Buttons */}
        <Group justify="space-between">
          <Button
            variant="subtle"
            color="gray"
            onClick={handleClose}
            disabled={assigning || inviting}
            radius="md"
          >
            Close
          </Button>

          <Group gap="sm">
            <Button
              leftSection={<Send size={16} />}
              onClick={handleInvite}
              disabled={selectedUsers.length === 0}
              loading={inviting}
              color="blue"
              radius="md"
              variant="light"
            >
              Invite ({selectedUsers.length})
            </Button>
            <Button
              leftSection={<Shield size={16} />}
              onClick={handleAssign}
              disabled={selectedUsers.length === 0}
              loading={assigning}
              color="orange"
              radius="md"
            >
              Assign ({selectedUsers.length})
            </Button>
          </Group>
        </Group>

        {/* Info Text */}
        <Box
          mt="md"
          p="sm"
          style={{
            background: '#f1f5f9',
            borderRadius: 8,
          }}
        >
          <Text size="xs" c="#64748b">
            <strong>Assign:</strong> Directly grant moderator permissions
            <br />
            <strong>Invite:</strong> Send notification to users (they must accept)
          </Text>
        </Box>
      </Box>
    </Modal>
    <DeleteConfirmModal
      opened={confirmRemove.opened}
      onClose={() =>
        setConfirmRemove({
          opened: false,
          actionId: '',
          username: '',
          type: 'moderator',
        })
      }
      onConfirm={handleConfirmRemove}
      loading={Boolean(removingId)}
      title={confirmRemove.type === 'moderator' ? 'Remove Moderator' : 'Remove Invitation'}
      message={
        confirmRemove.type === 'moderator'
          ? `Are you sure you want to remove ${confirmRemove.username} as moderator?`
          : `Are you sure you want to remove invitation for ${confirmRemove.username}?`
      }
    />
    </>
  );
}

