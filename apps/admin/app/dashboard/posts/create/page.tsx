"use client";

import { useState, useEffect } from 'react';
import { Title, Text, Box, Paper, TextInput, Textarea, Button, Group, MultiSelect, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowLeft, Save, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { strapiApi } from '../../../../lib/strapi';
import { generateSlug } from '../../../../lib/utils';
import { uploadMedia } from '../../../../lib/upload';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { PendingMediaItem } from '../../../../components/TiptapEditor';
import UserPickerModal, { type PickedUser } from '../../../../components/UserPickerModal';

const TiptapEditor = dynamic(() => import('../../../../components/TiptapEditor'), {
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

export default function CreatePostPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<PickedUser | null>(null);
  const [userPickerOpened, setUserPickerOpened] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([]);
  const [dropdownOpened, setDropdownOpened] = useState(false);
  const [tagDropdownOpened, setTagDropdownOpened] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    status: 'draft',
    categories: [] as string[],
    tags: [] as string[],
  });

  useEffect(() => {
    fetchCategories();
    fetchTags();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const contentWithUploadedMedia = await uploadDeferredMedia(formData.content);
      const authorUserId = selectedAuthor?.id ?? null;

      const payload: Record<string, unknown> = {
        title: formData.title,
        slug: formData.slug,
        content: contentWithUploadedMedia,
        excerpt: formData.excerpt,
        status: formData.status,
      };

      if (formData.categories.length > 0) {
        payload.categories = formData.categories;
      }
      if (formData.tags.length > 0) {
        payload.tags = formData.tags;
      }

      if (authorUserId) {
        payload.authorUserId = authorUserId;
      }

      const response = await strapiApi.post('/api/admin-posts', {
        data: payload,
      });

      const createdPostDocumentId = response?.data?.data?.documentId as string | undefined;

      notifications.show({
        title: 'Success',
        message: 'Post created successfully',
        color: 'green',
        icon: <CheckCircle size={18} />,
      });
      if (createdPostDocumentId) {
        router.replace(`/dashboard/posts/edit/${createdPostDocumentId}`);
      }
    } catch (error: unknown) {
      console.error('Failed to create post:', error);
      notifications.show({
        title: 'Error',
        message: getApiErrorMessage(error, 'Failed to create post. Please try again.'),
        color: 'red',
        icon: <XCircle size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTitleChange = (value: string) => {
    setFormData({
      ...formData,
      title: value,
      slug: generateSlug(value),
    });
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
          Create New Post
        </Title>
        <Text size="md" c="#64748b">
          Fill in the details to create a new blog post
        </Text>
      </Box>

      <Paper shadow="xs" p="xl" radius="lg" style={{ border: '1px solid #e2e8f0' }}>
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Title"
            placeholder="Enter post title"
            required
            value={formData.title}
            onChange={(e) => handleTitleChange(e.currentTarget.value)}
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
                color="green"
              />
              <Text size="sm" c="#475569">
                {formData.status === 'published' ? 'Published' : 'Draft'}
              </Text>
            </Group>
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
              loading={loading}
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
        </form>
      </Paper>
    </Box>
  );
}
