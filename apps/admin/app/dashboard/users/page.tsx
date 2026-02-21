"use client";

import { useState, useEffect } from 'react';
import { Title, Text, Box, Paper, Table, Badge, Avatar, Group, TextInput, Select, Button } from '@mantine/core';
import { strapiApi } from '../../../lib/strapi';
import { usePageTitle } from '../../../hooks/usePageTitle';

interface UserData {
  id: number;
  username: string;
  email: string;
  confirmed: boolean;
  blocked: boolean;
  createdAt: string;
  role?: {
    id: number;
    name: string;
    type: string;
  };
}

export default function UsersPage() {
  usePageTitle('Users');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: '',
    role: '',
    status: '',
  });
  const [draftFilters, setDraftFilters] = useState({
    q: '',
    role: '',
    status: '',
  });

  useEffect(() => {
    fetchUsers();
  }, [filters]);

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

      if (filters.role) {
        apiFilters.role = {
          type: { $eq: filters.role },
        };
      }

      if (filters.status === 'active') {
        apiFilters.blocked = { $eq: false };
        apiFilters.confirmed = { $eq: true };
      } else if (filters.status === 'blocked') {
        apiFilters.blocked = { $eq: true };
      } else if (filters.status === 'pending') {
        apiFilters.blocked = { $eq: false };
        apiFilters.confirmed = { $eq: false };
      }

      const params: Record<string, unknown> = {
        populate: ['role'],
        sort: 'username:asc',
      };
      if (Object.keys(apiFilters).length > 0) {
        params.filters = apiFilters;
      }

      // Fetch users with role data
      const response = await strapiApi.get('/api/admin-users', {
        params,
      });

      console.log('=== DEBUG USERS ===');
      console.log('Raw response:', response.data);

      // Note: Users already have role populated, no need to fetch separately
      // const rolesResponse = await strapiApi.get('/api/users-permissions/roles');
      // console.log('Available roles:', rolesResponse.data);

      // Map users with full role info
      const usersWithRoles = (response.data?.data || []).map((user: any) => {
        console.log(`User ${user.username} - role data:`, user.role);
        return {
          ...user,
          role: user.role || { name: 'Unknown', type: 'unknown' }
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const getRoleName = (user: UserData) => {
    const role = user.role as unknown;
    if (role && typeof role === 'object') {
      const roleObj = role as { name?: string; type?: string };
      if (typeof roleObj.name === 'string') return roleObj.name;
      if (typeof roleObj.type === 'string') {
        return roleObj.type.charAt(0).toUpperCase() + roleObj.type.slice(1);
      }
    }
    if (typeof role === 'string') {
      return role;
    }
    return 'User';
  };

  const getRoleColor = (roleName: string) => {
    const lowerRole = roleName.toLowerCase();
    if (lowerRole.includes('admin') || lowerRole.includes('administrator')) {
      return 'purple';
    }
    if (lowerRole.includes('moderator') || lowerRole.includes('mod')) {
      return 'orange';
    }
    if (lowerRole.includes('editor')) {
      return 'cyan';
    }
    if (lowerRole.includes('author')) {
      return 'green';
    }
    return 'blue';
  };

  return (
    <Box>
      <Box mb="xl">
        <Title order={1} fw={700} mb="xs" c="#0f172a" style={{ fontSize: '2rem' }}>
          Users
        </Title>
        <Text size="md" c="#64748b">
          Manage user accounts
        </Text>
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
              <Table.Th style={{ width: 120, textAlign: 'center' }}>Status</Table.Th>
              <Table.Th style={{ width: 120 }}>Joined</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Text c="#64748b">Loading users...</Text>
                </Table.Td>
              </Table.Tr>
            ) : users.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Text c="#64748b">No users found.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              users.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar
                        color="blue"
                        radius="xl"
                        size="md"
                        styles={{
                          root: {
                            background: '#e0f2fe',
                            color: '#0369a1',
                          },
                        }}
                      >
                        {getInitials(user.username)}
                      </Avatar>
                      <Text fw={600} c="#0f172a">
                        {user.username}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="#64748b">
                      {user.email}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {(() => {
                      const roleName = getRoleName(user);
                      return (
                        <Badge
                          color={getRoleColor(roleName)}
                          variant="light"
                          radius="sm"
                          size="sm"
                        >
                          {roleName}
                        </Badge>
                      );
                    })()}
                  </Table.Td>
                  <Table.Td>
                    <Group justify="center" gap="xs">
                      {user.blocked ? (
                        <Badge color="red" variant="light" radius="sm" size="sm">
                          Blocked
                        </Badge>
                      ) : user.confirmed ? (
                        <Badge color="green" variant="light" radius="sm" size="sm">
                          Active
                        </Badge>
                      ) : (
                        <Badge color="yellow" variant="light" radius="sm" size="sm">
                          Pending
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="#64748b">
                      {formatDate(user.createdAt)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Box>
  );
}

