"use client";

import { useState, useEffect } from 'react';
import { AppShell, Burger, Group, NavLink, Text, Avatar, Menu, UnstyledButton, rem } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { LayoutDashboard, Users, Settings, LogOut, ChevronDown, FileText, FolderTree, Tag, User, BookOpenText, ChartCandlestick, Flag } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { getCookie } from 'cookies-next/client';
import NotificationDropdown from '../../components/NotificationDropdown';

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [opened, { toggle }] = useDisclosure();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userCookie = getCookie('user');
    if (userCookie) {
      try {
        setUser(JSON.parse(userCookie as string));
      } catch (e) {
        console.error("Failed to parse user cookie", e);
      }
    }
  }, []);

  const handleLogout = () => {
    document.cookie = "token=; max-age=0; path=/";
    document.cookie = "user=; max-age=0; path=/";
    router.push('/');
  };

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="xl"
      styles={{
        main: {
          background: '#fafafa',
        },
      }}
    >
      <AppShell.Header
        style={{
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Group h="100%" px="xl" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              color="#0f172a"
            />
            <Group gap="sm">
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: '#475569',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: 'white',
                  }}
                >
                  A
                </div>
                <Text fw={700} size="lg" style={{ color: '#334155' }}>
                  Administration
                </Text>
            </Group>
          </Group>

          {/* User Info & Logout */}
          <Group gap="md">
            <NotificationDropdown />
             <Menu shadow="md" width={200} radius="lg">
                <Menu.Target>
                    <UnstyledButton
                      style={{
                        padding: '6px 10px',
                        borderRadius: '10px',
                        background: '#fafafa',
                        border: '1px solid #e2e8f0',
                        transition: 'all 0.2s ease',
                      }}
                    >
                        <Group gap={8}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: '#e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <User size={16} color="#64748b" />
                            </div>
                            <Text fw={500} size="sm" lh={1} style={{ color: '#334155' }}>
                                {user?.username || 'User'}
                            </Text>
                            <ChevronDown style={{ width: rem(14), height: rem(14), color: '#64748b' }} strokeWidth={2} />
                        </Group>
                    </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown style={{ border: '1px solid #e2e8f0' }}>
                    <Menu.Label style={{ color: '#64748b' }}>Account</Menu.Label>
                    <Menu.Item
                      leftSection={<Settings style={{ width: rem(16), height: rem(16) }} />}
                    >
                        Settings
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                        color="red"
                        leftSection={<LogOut style={{ width: rem(16), height: rem(16) }} />}
                        onClick={handleLogout}
                    >
                        Logout
                    </Menu.Item>
                </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        p="lg"
        style={{
          background: 'white',
          borderRight: '1px solid #e2e8f0',
        }}
      >
        <div style={{ marginBottom: '1rem' }}>
          <Text size="xs" fw={600} c="#64748b" tt="uppercase" mb="sm" px="xs">
            Menu
          </Text>
        </div>
        <NavLink
          href="/dashboard"
          label="Dashboard"
          leftSection={<LayoutDashboard size={18} />}
          active={pathname === '/dashboard'}
          style={{
            borderRadius: '8px',
            marginBottom: '2px',
            fontWeight: pathname === '/dashboard' ? 600 : 500,
            background: pathname === '/dashboard' ? '#e2e8f0' : 'transparent',
            color: pathname === '/dashboard' ? '#334155' : '#64748b',
          }}
          styles={{
            root: {
              '&:hover': {
                background: pathname === '/dashboard' ? '#e2e8f0' : '#fafafa',
              },
            },
          }}
        />
        <NavLink
          href="/dashboard/categories"
          label="Categories"
          leftSection={<FolderTree size={18} />}
          active={pathname?.startsWith('/dashboard/categories')}
          style={{
            borderRadius: '8px',
            marginBottom: '2px',
            fontWeight: pathname?.startsWith('/dashboard/categories') ? 600 : 500,
            background: pathname?.startsWith('/dashboard/categories') ? '#e2e8f0' : 'transparent',
            color: pathname?.startsWith('/dashboard/categories') ? '#334155' : '#64748b',
          }}
          styles={{
            root: {
              '&:hover': {
                background: pathname?.startsWith('/dashboard/categories') ? '#e2e8f0' : '#fafafa',
              },
            },
          }}
        />
        <NavLink
          href="/dashboard/posts"
          label="Posts"
          leftSection={<FileText size={18} />}
          active={pathname?.startsWith('/dashboard/posts')}
          style={{
            borderRadius: '8px',
            marginBottom: '2px',
            fontWeight: pathname?.startsWith('/dashboard/posts') ? 600 : 500,
            background: pathname?.startsWith('/dashboard/posts') ? '#e2e8f0' : 'transparent',
            color: pathname?.startsWith('/dashboard/posts') ? '#334155' : '#64748b',
          }}
          styles={{
            root: {
              '&:hover': {
                background: pathname?.startsWith('/dashboard/posts') ? '#e2e8f0' : '#fafafa',
              },
            },
          }}
        />
        <NavLink
          href="/dashboard/tags"
          label="Tags"
          leftSection={<Tag size={18} />}
          active={pathname?.startsWith('/dashboard/tags')}
          style={{
            borderRadius: '8px',
            marginBottom: '2px',
            fontWeight: pathname?.startsWith('/dashboard/tags') ? 600 : 500,
            background: pathname?.startsWith('/dashboard/tags') ? '#e2e8f0' : 'transparent',
            color: pathname?.startsWith('/dashboard/tags') ? '#334155' : '#64748b',
          }}
          styles={{
            root: {
              '&:hover': {
                background: pathname?.startsWith('/dashboard/tags') ? '#e2e8f0' : '#fafafa',
              },
            },
          }}
        />
        <NavLink
          href="/dashboard/pages"
          label="Pages"
          leftSection={<BookOpenText size={18} />}
          active={pathname?.startsWith('/dashboard/pages')}
          style={{
            borderRadius: '8px',
            marginBottom: '2px',
            fontWeight: pathname?.startsWith('/dashboard/pages') ? 600 : 500,
            background: pathname?.startsWith('/dashboard/pages') ? '#e2e8f0' : 'transparent',
            color: pathname?.startsWith('/dashboard/pages') ? '#334155' : '#64748b',
          }}
          styles={{
            root: {
              '&:hover': {
                background: pathname?.startsWith('/dashboard/pages') ? '#e2e8f0' : '#fafafa',
              },
            },
          }}
        />
        <NavLink
          href="/dashboard/journal-trades"
          label="Journal Trades"
          leftSection={<ChartCandlestick size={18} />}
          active={pathname?.startsWith('/dashboard/journal-trades')}
          style={{
            borderRadius: '8px',
            marginBottom: '2px',
            fontWeight: pathname?.startsWith('/dashboard/journal-trades') ? 600 : 500,
            background: pathname?.startsWith('/dashboard/journal-trades') ? '#e2e8f0' : 'transparent',
            color: pathname?.startsWith('/dashboard/journal-trades') ? '#334155' : '#64748b',
          }}
          styles={{
            root: {
              '&:hover': {
                background: pathname?.startsWith('/dashboard/journal-trades') ? '#e2e8f0' : '#fafafa',
              },
            },
          }}
        />
        <NavLink
          href="/dashboard/reports"
          label="Reports"
          leftSection={<Flag size={18} />}
          active={pathname?.startsWith('/dashboard/reports')}
          style={{
            borderRadius: '8px',
            marginBottom: '2px',
            fontWeight: pathname?.startsWith('/dashboard/reports') ? 600 : 500,
            background: pathname?.startsWith('/dashboard/reports') ? '#e2e8f0' : 'transparent',
            color: pathname?.startsWith('/dashboard/reports') ? '#334155' : '#64748b',
          }}
          styles={{
            root: {
              '&:hover': {
                background: pathname?.startsWith('/dashboard/reports') ? '#e2e8f0' : '#fafafa',
              },
            },
          }}
        />
        <NavLink
          href="/dashboard/users"
          label="Users"
          leftSection={<Users size={18} />}
          active={pathname?.startsWith('/dashboard/users')}
          style={{
            borderRadius: '8px',
            marginBottom: '2px',
            fontWeight: pathname?.startsWith('/dashboard/users') ? 600 : 500,
            background: pathname?.startsWith('/dashboard/users') ? '#e2e8f0' : 'transparent',
            color: pathname?.startsWith('/dashboard/users') ? '#334155' : '#64748b',
          }}
          styles={{
            root: {
              '&:hover': {
                background: pathname?.startsWith('/dashboard/users') ? '#e2e8f0' : '#fafafa',
              },
            },
          }}
        />
        <NavLink
          href="/dashboard/settings"
          label="Settings"
          leftSection={<Settings size={18} />}
          active={pathname?.startsWith('/dashboard/settings')}
          style={{
            borderRadius: '8px',
            marginBottom: '2px',
            fontWeight: pathname?.startsWith('/dashboard/settings') ? 600 : 500,
            background: pathname?.startsWith('/dashboard/settings') ? '#e2e8f0' : 'transparent',
            color: pathname?.startsWith('/dashboard/settings') ? '#334155' : '#64748b',
          }}
          styles={{
            root: {
              '&:hover': {
                background: pathname?.startsWith('/dashboard/settings') ? '#e2e8f0' : '#fafafa',
              },
            },
          }}
        />
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
