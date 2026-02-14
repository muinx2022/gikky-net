"use client";

import { Title, Text, Paper, Grid, Box, Group, Table, Badge, Avatar, Stack } from '@mantine/core';
import { getCookie } from 'cookies-next';
import { useEffect, useState } from 'react';
import { FolderTree, FileText, Users, Clock, TrendingUp } from 'lucide-react';
import { strapiApi } from '../../lib/strapi';
import { useRouter } from 'next/navigation';

const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
  trend
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  trend?: string;
}) => {
  return (
    <Paper
      shadow="xs"
      p="md"
      radius="lg"
      style={{
        background: 'white',
        border: '1px solid #e2e8f0',
      }}
    >
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Box
          style={{
            width: 40,
            height: 40,
            borderRadius: '8px',
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={20} color={color} strokeWidth={2} />
        </Box>
        {trend && (
          <Text
            size="xs"
            fw={600}
            style={{
              color: trend.startsWith('+') ? '#16a34a' : trend.startsWith('-') ? '#dc2626' : '#64748b',
            }}
          >
            {trend}
          </Text>
        )}
      </Group>
      <Text size="xs" c="#64748b" tt="uppercase" fw={600} mb={4}>
        {title}
      </Text>
      <Text fw={700} size="24px" c="#0f172a" style={{ lineHeight: 1.2 }}>
        {value}
      </Text>
    </Paper>
  );
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    categories: 0,
    posts: 0,
    users: 0,
    publishedPosts: 0,
    draftPosts: 0,
  });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [recentCategories, setRecentCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userCookie = getCookie('user');
    if (userCookie) {
      try {
        setUser(JSON.parse(userCookie as string));
      } catch (e) {
        console.error("Failed to parse user cookie", e);
      }
    }
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [categoriesRes, postsRes, usersRes] = await Promise.all([
        strapiApi.get('/api/admin-categories', {
          params: {
            sort: 'createdAt:desc',
            pagination: { limit: 5 },
          },
        }),
        strapiApi.get('/api/admin-posts', {
          params: {
            sort: 'createdAt:desc',
            populate: 'categories',
            pagination: { limit: 5 },
          },
        }),
        strapiApi.get('/api/admin-users'),
      ]);

      const allPosts = postsRes.data.data;
      const publishedCount = allPosts.filter((p: any) => p.status === 'published').length;
      const draftCount = allPosts.filter((p: any) => p.status === 'draft').length;

      setStats({
        categories: categoriesRes.data.data.length,
        posts: allPosts.length,
        users: usersRes.data?.data?.length || 0,
        publishedPosts: publishedCount,
        draftPosts: draftCount,
      });

      setRecentPosts(allPosts.slice(0, 5));
      setRecentCategories(categoriesRes.data.data.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'green';
      case 'draft':
        return 'gray';
      case 'archived':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Box>
      <Box mb="xl" className="animate-fade-in">
        <Title order={1} fw={700} mb="xs" c="#0f172a" style={{ fontSize: '2rem' }}>
          Dashboard
        </Title>
        <Text size="md" c="#64748b">
          Welcome back, <span style={{ color: '#0f172a', fontWeight: 600 }}>{user?.username || 'User'}</span>
        </Text>
      </Box>

      <Grid gutter="md" mb="lg">
        <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2.4 }} className="animate-slide-in" style={{ animationDelay: '0.1s' }}>
          <StatCard
            title="Total Categories"
            value={loading ? '...' : stats.categories}
            icon={FolderTree}
            color="#10b981"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2.4 }} className="animate-slide-in" style={{ animationDelay: '0.2s' }}>
          <StatCard
            title="Total Posts"
            value={loading ? '...' : stats.posts}
            icon={FileText}
            color="#3b82f6"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2.4 }} className="animate-slide-in" style={{ animationDelay: '0.3s' }}>
          <StatCard
            title="Total Users"
            value={loading ? '...' : stats.users}
            icon={Users}
            color="#8b5cf6"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2.4 }} className="animate-slide-in" style={{ animationDelay: '0.4s' }}>
          <StatCard
            title="Published Posts"
            value={loading ? '...' : stats.publishedPosts}
            icon={TrendingUp}
            color="#059669"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 2.4 }} className="animate-slide-in" style={{ animationDelay: '0.5s' }}>
          <StatCard
            title="Draft Posts"
            value={loading ? '...' : stats.draftPosts}
            icon={Clock}
            color="#f59e0b"
          />
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Paper
            shadow="xs"
            radius="lg"
            p="xl"
            style={{
              border: '1px solid #e2e8f0',
              background: 'white',
            }}
          >
            <Group justify="space-between" mb="lg">
              <Box>
                <Title order={3} fw={600} c="#0f172a" mb={4}>
                  Recent Posts
                </Title>
                <Text size="sm" c="#64748b">
                  Latest blog posts
                </Text>
              </Box>
            </Group>

            {loading ? (
              <Text c="#64748b" ta="center" py="xl">Loading posts...</Text>
            ) : recentPosts.length === 0 ? (
              <Text c="#64748b" ta="center" py="xl">No posts yet</Text>
            ) : (
              <Stack gap="md">
                {recentPosts.map((post: any) => (
                  <Paper
                    key={post.id}
                    p="md"
                    radius="md"
                    style={{
                      border: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    className="hover-lift"
                    onClick={() => router.push(`/dashboard/posts/edit/${post.documentId}`)}
                  >
                    <Group justify="space-between" align="start" wrap="nowrap">
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Text fw={600} c="#0f172a" lineClamp={1} mb={4}>
                          {post.title}
                        </Text>
                        <Group gap="xs" mb={6}>
                          <Badge
                            size="sm"
                            variant="light"
                            color={getStatusColor(post.status)}
                            radius="sm"
                          >
                            {post.status}
                          </Badge>
                          {post.categories && post.categories.length > 0 && (
                            <Text size="xs" c="#94a3b8">
                              {post.categories.length} {post.categories.length === 1 ? 'category' : 'categories'}
                            </Text>
                          )}
                        </Group>
                        <Text size="xs" c="#94a3b8">
                          {formatDate(post.createdAt)}
                        </Text>
                      </Box>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Paper
            shadow="xs"
            radius="lg"
            p="xl"
            style={{
              border: '1px solid #e2e8f0',
              background: 'white',
            }}
          >
            <Group justify="space-between" mb="lg">
              <Box>
                <Title order={3} fw={600} c="#0f172a" mb={4}>
                  Recent Categories
                </Title>
                <Text size="sm" c="#64748b">
                  Latest categories
                </Text>
              </Box>
            </Group>

            {loading ? (
              <Text c="#64748b" ta="center" py="xl">Loading categories...</Text>
            ) : recentCategories.length === 0 ? (
              <Text c="#64748b" ta="center" py="xl">No categories yet</Text>
            ) : (
              <Stack gap="sm">
                {recentCategories.map((category: any) => (
                  <Group
                    key={category.id}
                    p="sm"
                    style={{
                      borderRadius: '8px',
                      border: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    className="hover-lift"
                    onClick={() => router.push(`/dashboard/categories/edit/${category.documentId}`)}
                  >
                    <Box
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '8px',
                        background: '#f0fdf4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FolderTree size={18} color="#10b981" />
                    </Box>
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text fw={600} c="#0f172a" size="sm" lineClamp={1}>
                        {category.name}
                      </Text>
                      <Text size="xs" c="#94a3b8">
                        {formatDate(category.createdAt)}
                      </Text>
                    </Box>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Box>
  );
}

