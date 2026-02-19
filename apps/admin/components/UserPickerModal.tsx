"use client";

import { useState, useEffect, useRef } from 'react';
import { Modal, TextInput, Text, Box, Group, ScrollArea, Loader, UnstyledButton, NavLink } from '@mantine/core';
import { Search, User } from 'lucide-react';
import { strapiApi } from '../lib/strapi';

export interface PickedUser {
  id: number;
  username: string;
  email: string;
}

interface UserPickerModalProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (user: PickedUser) => void;
}

const PAGE_SIZE = 15;

export default function UserPickerModal({ opened, onClose, onSelect }: UserPickerModalProps) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<PickedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = async (q: string, p: number, append: boolean) => {
    setLoading(true);
    try {
      const response = await strapiApi.get('/api/admin-users', {
        params: {
          search: q || undefined,
          sort: 'username:asc',
          pagination: { page: p, pageSize: PAGE_SIZE },
        },
      });
      const data: PickedUser[] = response.data?.data || [];
      setUsers(prev => append ? [...prev, ...data] : data);
      setHasMore(data.length === PAGE_SIZE);
      setPage(p);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      setSearch('');
      setPage(1);
      setUsers([]);
      fetchUsers('', 1, false);
    }
  }, [opened]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchUsers(value, 1, false);
    }, 350);
  };

  const handleSelect = (user: PickedUser) => {
    onSelect(user);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="lg" c="#0f172a">Select Author</Text>}
      size="md"
      radius="lg"
    >
      <TextInput
        placeholder="Search by username or email..."
        leftSection={<Search size={16} />}
        value={search}
        onChange={(e) => handleSearchChange(e.currentTarget.value)}
        mb="sm"
        autoFocus
      />

      <ScrollArea h={360} type="auto">
        {loading && users.length === 0 ? (
          <Box style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader size="sm" />
          </Box>
        ) : users.length === 0 ? (
          <Box style={{ textAlign: 'center', padding: 40 }}>
            <User size={32} color="#94a3b8" style={{ margin: '0 auto 8px', display: 'block' }} />
            <Text size="sm" c="#94a3b8">No users found</Text>
          </Box>
        ) : (
          <Box>
            {users.map((user) => (
              <NavLink
                key={user.id}
                onClick={() => handleSelect(user)}
                label={
                  <Text fw={600} size="sm" c="#0f172a">{user.username}</Text>
                }
                description={
                  <Text size="xs" c="#64748b">{user.email}</Text>
                }
                leftSection={
                  <Box
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {(user.username || '?').charAt(0).toUpperCase()}
                  </Box>
                }
                style={{ borderRadius: 8, marginBottom: 2 }}
              />
            ))}

            {hasMore && (
              <Box style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                {loading ? (
                  <Loader size="xs" />
                ) : (
                  <UnstyledButton
                    onClick={() => fetchUsers(search, page + 1, true)}
                    style={{ color: '#2563eb', fontSize: 14, padding: '4px 12px' }}
                  >
                    Load more
                  </UnstyledButton>
                )}
              </Box>
            )}
          </Box>
        )}
      </ScrollArea>
    </Modal>
  );
}
