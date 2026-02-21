"use client";

import { useState, useEffect } from 'react';
import { Title, Text, Box, Paper, TextInput, Textarea, Select, Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowLeft, Save, CheckCircle, XCircle } from 'lucide-react';
import { strapiApi } from '../../../../lib/strapi';
import { generateSlug } from '../../../../lib/utils';
import { useRouter } from 'next/navigation';
import { usePageTitle } from '../../../../hooks/usePageTitle';

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

export default function CreateCategoryPage() {
  usePageTitle('Create Category');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parent: null as string | null,
  });

  useEffect(() => {
    fetchCategories();
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

  const buildHierarchicalOptions = (): any[] => {
    const options: any[] = [];

    const addCategoryWithChildren = (cat: Category, level: number = 0) => {
      const prefix = level > 0 ? '  '.repeat(level) + '└─ ' : '';
      options.push({
        value: cat.documentId,
        label: prefix + cat.name,
      });

      // Add children recursively
      if (cat.children && cat.children.length > 0) {
        cat.children.forEach((child) => {
          const fullChild = categories.find((c) => c.id === child.id);
          if (fullChild) {
            addCategoryWithChildren(fullChild, level + 1);
          }
        });
      }
    };

    // Start with root categories (those without parent)
    categories
      .filter((cat) => !cat.parent)
      .forEach((cat) => addCategoryWithChildren(cat));

    return options;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
      };

      if (formData.parent) {
        payload.parent = formData.parent;
      }

      await strapiApi.post('/api/admin-categories', {
        data: payload,
      });

      notifications.show({
        title: 'Success',
        message: 'Category created successfully',
        color: 'green',
        icon: <CheckCircle size={18} />,
      });

      router.push('/dashboard/categories');
    } catch (error: any) {
      console.error('Failed to create category:', error);

      notifications.show({
        title: 'Error',
        message: error?.response?.data?.error?.message || 'Failed to create category. Please try again.',
        color: 'red',
        icon: <XCircle size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (value: string) => {
    setFormData({
      ...formData,
      name: value,
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
          Create New Category
        </Title>
        <Text size="md" c="#64748b">
          Create a new category for organizing posts
        </Text>
      </Box>

      <Paper shadow="xs" p="xl" radius="lg" style={{ border: '1px solid #e2e8f0' }}>
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Name"
            placeholder="Enter category name"
            required
            value={formData.name}
            onChange={(e) => handleNameChange(e.currentTarget.value)}
            mb="md"
            styles={{
              label: { fontWeight: 600, color: '#334155', marginBottom: 8 },
            }}
          />

          <TextInput
            label="Slug"
            placeholder="category-slug"
            required
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.currentTarget.value })}
            mb="md"
            styles={{
              label: { fontWeight: 600, color: '#334155', marginBottom: 8 },
            }}
          />

          <Textarea
            label="Description"
            placeholder="Brief description of the category"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
            mb="md"
            styles={{
              label: { fontWeight: 600, color: '#334155', marginBottom: 8 },
            }}
          />

          <Select
            label="Parent Category (Optional)"
            placeholder="Select parent category"
            value={formData.parent}
            onChange={(value) => setFormData({ ...formData, parent: value })}
            data={[
              { value: '', label: 'None (Root Category)' },
              ...buildHierarchicalOptions(),
            ]}
            mb="xl"
            clearable
            searchable
            styles={{
              label: { fontWeight: 600, color: '#334155', marginBottom: 8 },
            }}
          />

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
              Create Category
            </Button>
          </Group>
        </form>
      </Paper>
    </Box>
  );
}

