"use client";

import { useState, useEffect } from 'react';
import { Title, Text, Box, Paper, TextInput, Textarea, Select, Button, Group, LoadingOverlay, MultiSelect, Switch } from '@mantine/core';
import { ArrowLeft, Save, CheckCircle, XCircle } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { strapiApi } from '../../../../../lib/strapi';
import { uploadMedia } from '../../../../../lib/upload';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { PendingMediaItem } from '../../../../../components/TiptapEditor';

const TiptapEditor = dynamic(() => import('../../../../../components/TiptapEditor'), {
  ssr: false,
});

interface Category {
  id: number;
  documentId: string;
  name: string;
  parent?: {
    id: number;
    documentId: string;
    name: string;
  };
  children?: Category[];
}

interface Tag {
  id: number;
  documentId: string;
  name: string;
}

interface AdminUser {
  id: number;
  username?: string;
  email?: string;
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== 'object' || error === null) return fallback;
  const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
  return response?.data?.error?.message || fallback;
};

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([]);
  const [dropdownOpened, setDropdownOpened] = useState(false);
  const [tagDropdownOpened, setTagDropdownOpened] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    status: 'draft',
    moderationStatus: null as 'block-comment' | 'delete' | null,
    categories: [] as string[],
    tags: [] as string[],
    authorSelection: 'random',
  });

  useEffect(() => {
    if (postId) {
      fetchPost();
      fetchCategories();
      fetchTags();
      fetchUsers();
    }
  }, [postId]);

  const fetchPost = async () => {
    try {
      const response = await strapiApi.get(`/api/admin-posts/${postId}`, {
        params: {
          populate: ['categories', 'tags'],
        },
      });
      const post = response.data.data;
      setFormData({
        title: post.title || '',
        slug: post.slug || '',
        content: post.content || '',
        excerpt: post.excerpt || '',
        status: post.status || 'draft',
        moderationStatus: (post.moderationStatus && post.moderationStatus !== '') ? post.moderationStatus : null,
        categories: post.categories?.map((cat: { documentId: string }) => cat.documentId) || [],
        tags: post.tags?.map((tag: { documentId: string }) => tag.documentId) || [],
        authorSelection: post.author?.id ? String(post.author.id) : 'random',
      });
    } catch (error) {
      console.error('Failed to fetch post:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load post',
        color: 'red',
        icon: <XCircle size={18} />,
      });
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await strapiApi.get('/api/admin-categories', {
        params: {
          populate: ['parent', 'children'],
          sort: 'name:asc',
        },
      });
      setCategories(response.data.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await strapiApi.get('/api/admin-users', {
        params: {
          sort: 'username:asc',
        },
      });
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await strapiApi.get('/api/admin-tags', {
        params: {
          sort: 'name:asc',
        },
      });
      setTags(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  const resolveAuthorUserId = () => {
    if (users.length === 0) return null;
    if (formData.authorSelection === 'random') {
      const randomIndex = Math.floor(Math.random() * users.length);
      return users[randomIndex]?.id ?? null;
    }

    const authorId = Number(formData.authorSelection);
    return Number.isFinite(authorId) && authorId > 0 ? authorId : null;
  };

  const uploadDeferredMedia = async (rawContent: string) => {
    let nextContent = rawContent;

    for (const media of pendingMedia) {
      const uploaded = await uploadMedia(media.file, { folder: 'forgefeed/editor' });
      nextContent = nextContent.split(media.placeholderSrc).join(uploaded.url);
    }

    return nextContent;
  };

  const buildHierarchicalOptions = (): { value: string; label: string }[] => {
    const options: { value: string; label: string }[] = [];

    const addCategoryWithChildren = (cat: Category, level: number = 0) => {
      const prefix = level > 0 ? `${'  '.repeat(level)}- ` : '';
      options.push({
        value: cat.documentId,
        label: prefix + cat.name,
      });

      if (cat.children && cat.children.length > 0) {
        cat.children.forEach((child) => {
          const fullChild = categories.find((c) => c.id === child.id);
          if (fullChild) {
            addCategoryWithChildren(fullChild, level + 1);
          }
        });
      }
    };

    categories
      .filter((cat) => !cat.parent)
      .forEach((cat) => addCategoryWithChildren(cat));

    return options;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const contentWithUploadedMedia = await uploadDeferredMedia(formData.content);
      const authorUserId = resolveAuthorUserId();

      const payload: Record<string, unknown> = {
        title: formData.title,
        slug: formData.slug,
        content: contentWithUploadedMedia,
        excerpt: formData.excerpt,
        status: formData.status,
        categories: formData.categories,
        tags: formData.tags,
      };

      if (formData.moderationStatus) {
        payload.moderationStatus = formData.moderationStatus;
      }

      if (authorUserId) {
        payload.authorUserId = authorUserId;
      }

      await strapiApi.put(`/api/admin-posts/${postId}`, {
        data: payload,
      });

      notifications.show({
        title: 'Success',
        message: 'Post updated successfully',
        color: 'green',
        icon: <CheckCircle size={18} />,
      });
    } catch (error: unknown) {
      console.error('Failed to update post:', error);
      notifications.show({
        title: 'Error',
        message: getApiErrorMessage(error, 'Failed to update post'),
        color: 'red',
        icon: <XCircle size={18} />,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Group mb="xl">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<ArrowLeft size={18} />}
          onClick={() => router.back()}
          radius="xl"
          styles={{
            root: {
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-1px)',
              },
            },
          }}
        >
          Back
        </Button>
      </Group>

      <Box mb="xl">
        <Title order={1} fw={700} mb="xs" c="#0f172a" style={{ fontSize: '2rem' }}>
          Edit Post
        </Title>
        <Text size="md" c="#64748b">
          Update your blog post details
        </Text>
      </Box>

      <Paper shadow="xs" p="xl" radius="lg" style={{ border: '1px solid #e2e8f0', position: 'relative' }}>
        <LoadingOverlay visible={loading} />
        {!loading && (
          <form onSubmit={handleSubmit}>
            <TextInput
              label="Title"
              placeholder="Enter post title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.currentTarget.value })}
              mb="md"
              styles={{
                label: { fontWeight: 600, color: '#334155', marginBottom: 8 },
              }}
            />

            <TextInput
              label="Slug"
              placeholder="post-slug"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.currentTarget.value })}
              mb="md"
              styles={{
                label: { fontWeight: 600, color: '#334155', marginBottom: 8 },
              }}
            />

            <MultiSelect
              label="Categories"
              placeholder="Select categories"
              value={formData.categories}
              onChange={(value) => {
                setFormData({ ...formData, categories: value });
                setDropdownOpened(false);
              }}
              data={buildHierarchicalOptions()}
              mb="md"
              searchable
              comboboxProps={{
                transitionProps: { duration: 200, transition: 'pop' },
              }}
              onDropdownOpen={() => setDropdownOpened(true)}
              onDropdownClose={() => setDropdownOpened(false)}
              dropdownOpened={dropdownOpened}
              styles={{
                label: { fontWeight: 600, color: '#334155', marginBottom: 8 },
              }}
            />

            <MultiSelect
              label="Tags"
              placeholder="Select tags"
              value={formData.tags}
              onChange={(value) => {
                setFormData({ ...formData, tags: value });
                setTagDropdownOpened(false);
              }}
              data={tags.map((tag) => ({
                value: tag.documentId,
                label: tag.name,
              }))}
              mb="md"
              searchable
              comboboxProps={{
                transitionProps: { duration: 200, transition: 'pop' },
              }}
              onDropdownOpen={() => setTagDropdownOpened(true)}
              onDropdownClose={() => setTagDropdownOpened(false)}
              dropdownOpened={tagDropdownOpened}
              styles={{
                label: { fontWeight: 600, color: '#334155', marginBottom: 8 },
              }}
            />

            <Textarea
              label="Excerpt"
              placeholder="Brief description of the post"
              rows={3}
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.currentTarget.value })}
              mb="md"
              styles={{
                label: { fontWeight: 600, color: '#334155', marginBottom: 8 },
              }}
            />

            <Box mb="md">
              <Text fw={600} c="#334155" size="sm" mb={8}>
                Content <span style={{ color: 'red' }}>*</span>
              </Text>
              <TiptapEditor
                key={postId}
                content={formData.content}
                onChange={(content) => setFormData({ ...formData, content })}
                placeholder="Write your post content here..."
                deferUpload
                onPendingMediaChange={setPendingMedia}
              />
            </Box>

            <Select
              label="Author"
              value={formData.authorSelection}
              onChange={(value) => setFormData({ ...formData, authorSelection: value || 'random' })}
              data={[
                { value: 'random', label: 'Random user' },
                ...users.map((user) => ({
                  value: String(user.id),
                  label: user.username || user.email || `User #${user.id}`,
                })),
              ]}
              mb="md"
              styles={{
                label: { fontWeight: 600, color: '#334155', marginBottom: 8 },
              }}
            />

            <Select
              label="Moderation"
              value={formData.moderationStatus ?? ''}
              onChange={(value) =>
                setFormData({ ...formData, moderationStatus: (value as 'block-comment' | 'delete') || null })
              }
              data={[
                { value: '', label: 'None' },
                { value: 'block-comment', label: 'Block comments' },
                { value: 'delete', label: 'Delete' },
              ]}
              mb="md"
              styles={{ label: { fontWeight: 600, color: '#334155', marginBottom: 8 } }}
            />

            <Box mb="xl">
              <Text fw={600} c="#334155" size="sm" mb={8}>
                Status
              </Text>
              <Group gap="sm">
                <Switch
                  checked={formData.status === 'published'}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      status: event.currentTarget.checked ? 'published' : 'draft',
                    })
                  }
                  disabled={formData.status === 'archived'}
                  color="green"
                />
                <Text size="sm" c="#475569">
                  {formData.status === 'archived'
                    ? 'Archived'
                    : formData.status === 'published'
                    ? 'Published'
                    : 'Draft'}
                </Text>
              </Group>
              {formData.status === 'archived' && (
                <Text size="xs" c="#94a3b8" mt={6}>
                  Archived post cannot be changed by toggle.
                </Text>
              )}
            </Box>

            <Group justify="flex-end">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => router.back()}
                radius="xl"
                styles={{
                  root: {
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                    },
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                leftSection={<Save size={18} />}
                loading={saving}
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
                Save Changes
              </Button>
            </Group>
          </form>
        )}
      </Paper>
    </Box>
  );
}
