"use client";

import { useState, useEffect, useMemo } from 'react';
import { Title, Text, Box, Paper, Table, Badge, Avatar, Group, TextInput, Select, Button, Modal, Textarea, Stack } from '@mantine/core';
import { strapiApi } from '../../../lib/strapi';
import { usePageTitle } from '../../../hooks/usePageTitle';

interface UserData {
  id: number;
  username: string;
  email: string;
  confirmed: boolean;
  blocked: boolean;
  banned?: boolean;
  bannedUntil?: string | null;
  banReason?: string | null;
  strikeCount?: number;
  createdAt: string;
  role?: {
    id: number;
    name: string;
    type: string;
  };
}

export default function UsersPage() {
  usePageTitle('Users');
  const PAGE_SIZE = 10;
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [draftFilters, setDraftFilters] = useState({ q: '', role: '', status: '' });

  // Ban modal state
  const [banModal, setBanModal] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null });
  const [banDuration, setBanDuration] = useState<string>('permanent');
  const [banReason, setBanReason] = useState('');
  const [banLoading, setBanLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, [filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return users.slice(start, start + PAGE_SIZE);
  }, [users, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const apiFilters: Record<string, unknown> = {};

      if (filters.q.trim()) {
        apiFilters.$or = [
          { username: { $containsi: filters.q.trim() } },
          { email: { $containsi: filters.q.trim() } },
        ];
      }
      if (filters.role) apiFilters.role = { type: { $eq: filters.role } };

      if (filters.status === 'active') {
        apiFilters.blocked = { $eq: false };
        apiFilters.confirmed = { $eq: true };
      } else if (filters.status === 'blocked') {
        apiFilters.blocked = { $eq: true };
      } else if (filters.status === 'pending') {
        apiFilters.blocked = { $eq: false };
        apiFilters.confirmed = { $eq: false };
      } else if (filters.status === 'banned') {
        apiFilters.banned = { $eq: true };
      } else if (filters.status === 'high-strikes') {
        apiFilters.strikeCount = { $gte: 3 };
      }

      const params: Record<string, unknown> = { populate: ['role'], sort: 'username:asc' };
      if (Object.keys(apiFilters).length > 0) params.filters = apiFilters;

      const response = await strapiApi.get('/api/admin-users', { params });
      const usersWithRoles = (response.data?.data || []).map((user: any) => ({
        ...user,
        role: user.role || { name: 'Unknown', type: 'unknown' },
      }));
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async () => {
    if (!banModal.user) return;
    setBanLoading(true);
    try {
      await strapiApi.patch(`/api/admin-users/${banModal.user.id}/ban`, {
        duration: banDuration,
        reason: banReason || undefined,
      });
      setBanModal({ open: false, user: null });
      setBanReason('');
      setBanDuration('permanent');
      fetchUsers();
    } catch (error) {
      console.error('Ban failed:', error);
    } finally {
      setBanLoading(false);
    }
  };

  const handleUnban = async (user: UserData) => {
    if (!confirm(`Bỏ ban người dùng ${user.username}?`)) return;
    try {
      await strapiApi.patch(`/api/admin-users/${user.id}/unban`);
      fetchUsers();
    } catch (error) {
      console.error('Unban failed:', error);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const formatBanUntil = (user: UserData) => {
    if (!user.banned) return '-';
    if (!user.bannedUntil) return 'Vĩnh viễn';
    return new Date(user.bannedUntil).toLocaleDateString('vi-VN');
  };

  const getInitials = (username: string) => username.substring(0, 2).toUpperCase();

  const getRoleName = (user: UserData) => {
    const role = user.role as unknown;
    if (role && typeof role === 'object') {
      const roleObj = role as { name?: string; type?: string };
      if (typeof roleObj.name === 'string') return roleObj.name;
      if (typeof roleObj.type === 'string') return roleObj.type.charAt(0).toUpperCase() + roleObj.type.slice(1);
    }
    return 'User';
  };

  const getRoleColor = (roleName: string) => {
    const lowerRole = roleName.toLowerCase();
    if (lowerRole.includes('admin') || lowerRole.includes('administrator')) return 'purple';
    if (lowerRole.includes('moderator') || lowerRole.includes('mod')) return 'orange';
    if (lowerRole.includes('editor')) return 'cyan';
    if (lowerRole.includes('author')) return 'green';
    return 'blue';
  };

  const isHighStrikes = (user: UserData) => (user.strikeCount || 0) >= 3 && !user.banned;

  return (
    <Box>
      <Box mb="xl">
        <Title order={1} fw={700} mb="xs" c="#0f172a" style={{ fontSize: '2rem' }}>Users</Title>
        <Text size="md" c="#64748b">Manage user accounts</Text>
      </Box>

      <Paper shadow="xs" radius="lg" p="md" mb="md" style={{ border: '1px solid #e2e8f0' }}>
        <Group align="end">
          <TextInput
            placeholder="Search username or email"
            value={draftFilters.q}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, q: e.currentTarget.value }))}
            style={{ minWidth: 260 }}
          />
          <Select
            placeholder="All roles"
            value={draftFilters.role || null}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, role: value || '' }))}
            data={[
              { value: 'authenticated', label: 'Authenticated' },
              { value: 'author', label: 'Author' },
              { value: 'editor', label: 'Editor' },
              { value: 'moderator', label: 'Moderator' },
              { value: 'admin', label: 'Admin' },
            ]}
            clearable
            style={{ minWidth: 180 }}
          />
          <Select
            placeholder="All status"
            value={draftFilters.status || null}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value || '' }))}
            data={[
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'blocked', label: 'Blocked' },
              { value: 'banned', label: 'Banned' },
              { value: 'high-strikes', label: '≥3 Strikes' },
            ]}
            clearable
            style={{ minWidth: 160 }}
          />
          <Button onClick={() => setFilters(draftFilters)}>Apply</Button>
          <Button
            variant="light"
            color="gray"
            onClick={() => {
              const cleared = { q: '', role: '', status: '' };
              setDraftFilters(cleared);
              setFilters(cleared);
            }}
          >
            Reset
          </Button>
        </Group>
      </Paper>

      <Paper shadow="xs" radius="lg" style={{ border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Table highlightOnHover>
          <Table.Thead style={{ background: '#fafafa' }}>
            <Table.Tr>
              <Table.Th style={{ width: 200 }}>User</Table.Th>
              <Table.Th style={{ width: 220 }}>Email</Table.Th>
              <Table.Th style={{ width: 140 }}>Role</Table.Th>
              <Table.Th style={{ width: 80, textAlign: 'center' }}>Strikes</Table.Th>
              <Table.Th style={{ width: 120, textAlign: 'center' }}>Status</Table.Th>
              <Table.Th style={{ width: 120 }}>Ban đến</Table.Th>
              <Table.Th style={{ width: 120 }}>Joined</Table.Th>
              <Table.Th style={{ width: 140 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Text c="#64748b">Loading users...</Text>
                </Table.Td>
              </Table.Tr>
            ) : users.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Text c="#64748b">No users found.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              pagedUsers.map((user) => (
                <Table.Tr
                  key={user.id}
                  style={isHighStrikes(user) ? { background: '#fef9c3' } : undefined}
                >
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar color="blue" radius="xl" size="md" styles={{ root: { background: '#e0f2fe', color: '#0369a1' } }}>
                        {getInitials(user.username)}
                      </Avatar>
                      <Text fw={600} c="#0f172a">{user.username}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="#64748b">{user.email}</Text>
                  </Table.Td>
                  <Table.Td>
                    {(() => {
                      const roleName = getRoleName(user);
                      return <Badge color={getRoleColor(roleName)} variant="light" radius="sm" size="sm">{roleName}</Badge>;
                    })()}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    {(user.strikeCount || 0) >= 3 ? (
                      <Badge color="red" variant="filled" radius="sm" size="sm">{user.strikeCount}</Badge>
                    ) : (
                      <Text size="sm" c="#64748b">{user.strikeCount || 0}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group justify="center" gap="xs">
                      {user.banned ? (
                        <Badge color="red" variant="filled" radius="sm" size="sm">Banned</Badge>
                      ) : user.blocked ? (
                        <Badge color="red" variant="light" radius="sm" size="sm">Blocked</Badge>
                      ) : user.confirmed ? (
                        <Badge color="green" variant="light" radius="sm" size="sm">Active</Badge>
                      ) : (
                        <Badge color="yellow" variant="light" radius="sm" size="sm">Pending</Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={user.banned ? '#dc2626' : '#64748b'}>{formatBanUntil(user)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="#64748b">{formatDate(user.createdAt)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {user.banned ? (
                        <Button size="xs" variant="light" color="green" onClick={() => handleUnban(user)}>Unban</Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          onClick={() => {
                            setBanModal({ open: true, user });
                            setBanDuration('permanent');
                            setBanReason('');
                          }}
                        >
                          Ban
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
      {!loading && users.length > 0 && (
        <Group justify="space-between" mt="md">
          <Text size="sm" c="#64748b">
            Page {currentPage}/{totalPages} · {users.length} items
          </Text>
          <Group gap="xs">
            <Button size="xs" variant="light" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              Prev
            </Button>
            <Button size="xs" variant="light" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              Next
            </Button>
          </Group>
        </Group>
      )}

      {/* Ban Modal */}
      <Modal
        opened={banModal.open}
        onClose={() => setBanModal({ open: false, user: null })}
        title={`Ban người dùng: ${banModal.user?.username}`}
        centered
      >
        <Stack>
          <Select
            label="Thời hạn ban"
            value={banDuration}
            onChange={(v) => setBanDuration(v || 'permanent')}
            data={[
              { value: '1d', label: '1 ngày' },
              { value: '3d', label: '3 ngày' },
              { value: '7d', label: '7 ngày' },
              { value: 'permanent', label: 'Vĩnh viễn' },
            ]}
          />
          <Textarea
            label="Lý do (tuỳ chọn)"
            placeholder="Nhập lý do ban..."
            value={banReason}
            onChange={(e) => setBanReason(e.currentTarget.value)}
            rows={3}
          />
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setBanModal({ open: false, user: null })}>Hủy</Button>
            <Button color="red" loading={banLoading} onClick={handleBan}>Ban</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
