"use client";

import { useState, useEffect, useMemo } from 'react';
import { Title, Text, Box, Paper, Table, Group, Button, ActionIcon, Menu, Switch, Tooltip, Badge, TextInput, Select } from '@mantine/core';
import { Plus, MoreVertical, Edit, Trash, Eye, CheckCircle, XCircle } from 'lucide-react';
import { strapiApi } from '../../../lib/strapi';
import { useRouter } from 'next/navigation';
import DeleteConfirmModal from '../../../components/DeleteConfirmModal';
import { notifications } from '@mantine/notifications';

interface Category {
  id: number;
  documentId: string;
  name: string;
  parent?: {
    documentId: string;
  } | null;
}

interface Tag {
  id: number;
  documentId: string;
  name: string;
}

interface UserOption {
  id: number;
  username?: string;
  email?: string;
}

interface Post {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  excerpt: string;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  categories?: Category[];
  tags?: Array<{ id: number; documentId: string; name: string }>;
  author?: {
    id: number;
    username?: string;
    email?: string;
  } | null;
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== 'object' || error === null) return fallback;
  const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
  return response?.data?.error?.message || fallback;
};

export default function PostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filters, setFilters] = useState({
    title: '',
    categoryDocumentId: '',
    tagDocumentId: '',
    userId: '',
  });
  const [draftFilters, setDraftFilters] = useState({
    title: '',
    categoryDocumentId: '',
    tagDocumentId: '',
    userId: '',
  });
  const [loading, setLoading] = useState(true);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [deletingPost, setDeletingPost] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const collectCategoryDescendants = (rootDocumentId: string) => {
    const childrenByParent = new Map<string, string[]>();
    for (const category of categories) {
      const parentId = category.parent?.documentId;
      if (!parentId) continue;
      const current = childrenByParent.get(parentId) || [];
      current.push(category.documentId);
      childrenByParent.set(parentId, current);
    }

    const collected = new Set<string>();
    const stack = [rootDocumentId];
    while (stack.length > 0) {
      const currentId = stack.pop() as string;
      if (collected.has(currentId)) continue;
      collected.add(currentId);
      const children = childrenByParent.get(currentId) || [];
      for (const childId of children) {
        if (!collected.has(childId)) {
          stack.push(childId);
        }
      }
    }

    return Array.from(collected);
  };

  const categoryOptions = useMemo(() => {
    if (categories.length === 0) return [];

    const childrenByParent = new Map<string | null, Category[]>();
    for (const category of categories) {
      const parentId = category.parent?.documentId || null;
      const siblings = childrenByParent.get(parentId) || [];
      siblings.push(category);
      childrenByParent.set(parentId, siblings);
    }

    for (const [, siblings] of childrenByParent.entries()) {
      siblings.sort((a, b) => a.name.localeCompare(b.name));
    }

    const visited = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];

    const walk = (parentId: string | null, depth: number) => {
      const nodes = childrenByParent.get(parentId) || [];
      for (const node of nodes) {
        if (visited.has(node.documentId)) continue;
        visited.add(node.documentId);
        options.push({
          value: node.documentId,
          label: `${depth > 0 ? `${'  '.repeat(depth)}- ` : ''}${node.name}`,
        });
        walk(node.documentId, depth + 1);
      }
    };

    walk(null, 0);

    const remaining = categories
      .filter((category) => !visited.has(category.documentId))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const category of remaining) {
      options.push({
        value: category.documentId,
        label: category.name,
      });
    }

    return options;
  }, [categories]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [filters]);

  const fetchFilterOptions = async () => {
    try {
      const [categoryRes, tagRes, userRes] = await Promise.all([
        strapiApi.get('/api/admin-categories', {
          params: {
            sort: ['sortOrder:asc', 'name:asc'],
            populate: ['parent'],
          },
        }),
        strapiApi.get('/api/admin-tags', {
          params: {
            sort: 'name:asc',
          },
        }),
        strapiApi.get('/api/admin-users', {
          params: {
            sort: 'username:asc',
          },
        }),
      ]);

      setCategories(categoryRes.data.data || []);
      setTags(tagRes.data.data || []);
      setUsers(userRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        sort: 'createdAt:desc',
        populate: ['categories', 'tags', 'author'],
      };

      const nextFilters: Record<string, unknown> = {};
      if (filters.title.trim()) {
        nextFilters.title = { $containsi: filters.title.trim() };
      }
      if (filters.categoryDocumentId) {
        const categoryDocumentIds = collectCategoryDescendants(filters.categoryDocumentId);
        nextFilters.categories = {
          documentId: { $in: categoryDocumentIds },
        };
      }
      if (filters.tagDocumentId) {
        nextFilters.tags = {
          documentId: { $eq: filters.tagDocumentId },
        };
      }
      if (filters.userId) {
        nextFilters.author = {
          id: { $eq: Number(filters.userId) },
        };
      }

      if (Object.keys(nextFilters).length > 0) {
        params.filters = nextFilters;
      }

      const response = await strapiApi.get('/api/admin-posts', {
        params,
      });
      setPosts(response.data.data);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (documentId: string, title: string) => {
    setDeletingPost({ id: documentId, title });
    setDeleteModalOpened(true);
  };

  const handleDelete = async () => {
    if (!deletingPost) return;

    setDeleting(true);
    try {
      await strapiApi.delete(`/api/admin-posts/${deletingPost.id}`);
      setDeleteModalOpened(false);
      setDeletingPost(null);
      fetchPosts();
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleToggleStatus = async (documentId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';

    try {
      await strapiApi.put(`/api/admin-posts/${documentId}`, {
        data: {
          status: newStatus,
        },
      });

      notifications.show({
        title: 'Success',
        message: `Post ${newStatus === 'published' ? 'published' : 'unpublished'} successfully`,
        color: 'green',
        icon: <CheckCircle size={18} />,
      });

      fetchPosts();
    } catch (error: unknown) {
      console.error('Failed to update post:', error);
      notifications.show({
        title: 'Error',
        message: getApiErrorMessage(error, 'Failed to update post status'),
        color: 'red',
        icon: <XCircle size={18} />,
      });
    }
  };

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={1} fw={700} mb="xs" c="#0f172a" style={{ fontSize: '2rem' }}>
            Posts
          </Title>
          <Group gap="xs" align="center">
            <Text size="md" c="#64748b">
              Manage your blog posts
            </Text>
            {filters.tagDocumentId && (
              <>
                <Badge variant="light" color="blue">
                  #{tags.find((tag) => tag.documentId === filters.tagDocumentId)?.name || 'tag'}
                </Badge>
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, tagDocumentId: '' }));
                    setDraftFilters((prev) => ({ ...prev, tagDocumentId: '' }));
                  }}
                >
                  Clear filter
                </Button>
              </>
            )}
          </Group>
        </Box>
        <Button
          leftSection={<Plus size={18} />}
          onClick={() => router.push('/dashboard/posts/create')}
          radius="xl"
          styles={{
            root: {
              backgroundColor: '#475569',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(71, 85, 105, 0.15)',
              '&:hover': {
                backgroundColor: '#334155',
                boxShadow: '0 4px 12px rgba(71, 85, 105, 0.25)',
                transform: 'translateY(-1px)',
              },
            },
          }}
        >
          Create Post
        </Button>
      </Group>

      <Paper shadow="xs" radius="lg" p="md" mb="md" style={{ border: '1px solid #e2e8f0' }}>
        <Group align="end">
          <TextInput
            placeholder="Search by title"
            value={draftFilters.title}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, title: e.currentTarget.value }))}
            style={{ minWidth: 220 }}
          />
          <Select
            placeholder="All categories"
            value={draftFilters.categoryDocumentId || null}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, categoryDocumentId: value || '' }))}
            data={categoryOptions}
            clearable
            searchable
            style={{ minWidth: 200 }}
          />
          <Select
            placeholder="All tags"
            value={draftFilters.tagDocumentId || null}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, tagDocumentId: value || '' }))}
            data={tags.map((tag) => ({
              value: tag.documentId,
              label: tag.name,
            }))}
            clearable
            searchable
            style={{ minWidth: 200 }}
          />
          <Select
            placeholder="All users"
            value={draftFilters.userId || null}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, userId: value || '' }))}
            data={users.map((user) => ({
              value: String(user.id),
              label: user.username || user.email || `User #${user.id}`,
            }))}
            clearable
            searchable
            style={{ minWidth: 220 }}
          />
          <Button onClick={() => setFilters(draftFilters)}>Apply</Button>
          <Button
            variant="light"
            color="gray"
            onClick={() => {
              const cleared = { title: '', categoryDocumentId: '', tagDocumentId: '', userId: '' };
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
              <Table.Th style={{ width: '42%' }}>Title</Table.Th>
              <Table.Th style={{ width: 140 }}>Categories</Table.Th>
              <Table.Th style={{ width: 180 }}>Author</Table.Th>
              <Table.Th style={{ width: 100, textAlign: 'center' }}>Status</Table.Th>
              <Table.Th style={{ width: 120 }}>Created</Table.Th>
              <Table.Th style={{ width: 80, textAlign: 'center' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
                <Table.Tr>
                <Table.Td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Text c="#64748b">Loading posts...</Text>
                </Table.Td>
              </Table.Tr>
            ) : posts.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                  <Text c="#64748b">No posts found. Create your first post!</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              posts.map((post) => (
                <Table.Tr key={post.id}>
                  <Table.Td>
                    <Text fw={600} c="#0f172a">{post.title}</Text>
                    {post.tags && post.tags.length > 0 && (
                      <Group gap={6} mt={4}>
                        {post.tags.map((tag) => (
                          <Button
                            key={tag.documentId}
                            size="compact-xs"
                            variant={filters.tagDocumentId === tag.documentId ? 'filled' : 'light'}
                            color={filters.tagDocumentId === tag.documentId ? 'blue' : 'gray'}
                            onClick={() => {
                              setFilters((prev) => ({ ...prev, tagDocumentId: tag.documentId }));
                              setDraftFilters((prev) => ({ ...prev, tagDocumentId: tag.documentId }));
                            }}
                          >
                            #{tag.name}
                          </Button>
                        ))}
                      </Group>
                    )}
                    {post.excerpt && (
                      <Text size="sm" c="#64748b" lineClamp={1} mt={4}>
                        {post.excerpt}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {post.categories && post.categories.length > 0 ? (
                      <Text size="sm" c="#475569" lineClamp={1}>
                        {post.categories.map((cat) => cat.name).join(', ')}
                      </Text>
                    ) : (
                      <Text size="sm" c="#94a3b8">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="#475569">
                      {post.author?.username || post.author?.email || 'Anonymous'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group justify="center">
                      <Tooltip label={post.status === 'published' ? 'Published' : post.status === 'archived' ? 'Archived' : 'Draft'} position="top">
                        <Switch
                          checked={post.status === 'published'}
                          onChange={() => handleToggleStatus(post.documentId, post.status)}
                          color="green"
                          size="sm"
                          disabled={post.status === 'archived'}
                          styles={{
                            root: { cursor: post.status === 'archived' ? 'not-allowed' : 'pointer' },
                            track: { cursor: post.status === 'archived' ? 'not-allowed' : 'pointer' },
                            thumb: { cursor: post.status === 'archived' ? 'not-allowed' : 'pointer' },
                          }}
                        />
                      </Tooltip>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="#64748b">{formatDate(post.createdAt)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="center">
                      <Menu shadow="md" width={160} radius="md">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <MoreVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<Edit size={14} />}
                            onClick={() => router.push(`/dashboard/posts/edit/${post.documentId}`)}
                          >
                            Edit
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<Eye size={14} />}
                            onClick={() => router.push(`/dashboard/posts/${post.documentId}`)}
                          >
                            View
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            color="red"
                            leftSection={<Trash size={14} />}
                            onClick={() => openDeleteModal(post.documentId, post.title)}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <DeleteConfirmModal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setDeletingPost(null);
        }}
        onConfirm={handleDelete}
        title="Delete Post"
        message={`Are you sure you want to delete "${deletingPost?.title}"? This action cannot be undone.`}
        loading={deleting}
      />
    </Box>
  );
}

