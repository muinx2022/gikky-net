"use client";

import { useState, useEffect, useMemo } from 'react';
import { Title, Text, Box, Paper, TextInput, Select, Button, Group, LoadingOverlay, MultiSelect, Switch } from '@mantine/core';
import { ArrowLeft, Save, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { strapiApi } from '../../../../../lib/strapi';
import { uploadMedia } from '../../../../../lib/upload';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { PendingMediaItem } from '../../../../../components/TiptapEditor';
import UserPickerModal, { type PickedUser } from '../../../../../components/UserPickerModal';
import { usePageTitle } from '../../../../../hooks/usePageTitle';

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


const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== 'object' || error === null) return fallback;
  const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
  return response?.data?.error?.message || fallback;
};

export default function EditPostPage() {
  usePageTitle('Edit Post');
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<PickedUser | null>(null);
  const [userPickerOpened, setUserPickerOpened] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([]);
  const [dropdownOpened, setDropdownOpened] = useState(false);
  const [tagSearchValue, setTagSearchValue] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    status: 'draft',
    moderationStatus: null as 'block-comment' | 'delete' | null,
    categories: [] as string[],
    tags: [] as string[],
  });

  useEffect(() => {
    if (postId) {
      fetchPost();
      fetchCategories();
      fetchTags();
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
        status: post.status || 'draft',
        moderationStatus: (post.moderationStatus && post.moderationStatus !== '') ? post.moderationStatus : null,
        categories: post.categories?.map((cat: { documentId: string }) => cat.documentId) || [],
        tags: post.tags?.map((tag: { documentId: string }) => tag.documentId) || [],
      });
      if (post.author?.id) {
        setSelectedAuthor({
          id: post.author.id,
          username: post.author.username || post.author.email || `User #${post.author.id}`,
          email: post.author.email || '',
        });
      }
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

  const tagOptions = useMemo(() => {
    const options = tags.map((tag) => ({ value: tag.documentId, label: tag.name }));
    const trimmed = tagSearchValue.trim();
    if (trimmed && !tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      return [{ value: `__create__:${trimmed}`, label: `+ Tạo tag "${trimmed}"` }, ...options];
    }
    return options;
  }, [tags, tagSearchValue]);

  const handleTagsChange = async (values: string[]) => {
    const toCreate = values.find((v) => v.startsWith('__create__:'));
    if (!toCreate) {
      setFormData((prev) => ({ ...prev, tags: values }));
      setTagSearchValue('');
      return;
    }
    const name = toCreate.replace('__create__:', '');
    const existingValues = values.filter((v) => !v.startsWith('__create__:'));
    try {
      const res = await strapiApi.post('/api/admin-tags', { data: { name } });
      const newTag: Tag = res.data.data;
      setTags((prev) => [...prev, newTag]);
      setFormData((prev) => ({ ...prev, tags: [...existingValues, newTag.documentId] }));
    } catch (error) {
      notifications.show({ title: 'Error', message: `Failed to create tag "${name}"`, color: 'red', icon: <XCircle size={18} /> });
      setFormData((prev) => ({ ...prev, tags: existingValues }));
    }
    setTagSearchValue('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const contentWithUploadedMedia = await uploadDeferredMedia(formData.content);
      const authorUserId = selectedAuthor?.id ?? null;

      const payload: Record<string, unknown> = {
        title: formData.title,
        slug: formData.slug,
        content: contentWithUploadedMedia,
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
              placeholder="Chọn hoặc tạo tag..."
              value={formData.tags}
              onChange={handleTagsChange}
              data={tagOptions}
              searchValue={tagSearchValue}
              onSearchChange={setTagSearchValue}
              mb="md"
              searchable
              comboboxProps={{
                transitionProps: { duration: 200, transition: 'pop' },
              }}
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

            <Box mb="md">
              <Text fw={600} c="#334155" size="sm" mb={8}>Author</Text>
              <Button
                fullWidth
                variant="default"
                onClick={() => setUserPickerOpened(true)}
                justify="flex-start"
                rightSection={<ChevronDown size={14} color="#94a3b8" />}
                styles={{
                  root: {
                    color: selectedAuthor ? '#334155' : '#adb5bd',
                    fontWeight: selectedAuthor ? 500 : 400,
                  },
                }}
              >
                {selectedAuthor ? selectedAuthor.username : 'Select user...'}
              </Button>
            </Box>

            <UserPickerModal
              opened={userPickerOpened}
              onClose={() => setUserPickerOpened(false)}
              onSelect={(user) => setSelectedAuthor(user)}
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
