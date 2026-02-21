"use client";

import { useState, useEffect } from 'react';
import { Title, Text, Box, Paper, TextInput, Textarea, Select, Button, Group, LoadingOverlay } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowLeft, Save, CheckCircle, XCircle } from 'lucide-react';
import { strapiApi } from '../../../../../lib/strapi';
import { useRouter, useParams } from 'next/navigation';
import { usePageTitle } from '../../../../../hooks/usePageTitle';

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

export default function EditCategoryPage() {
  usePageTitle('Edit Category');
  const router = useRouter();
  const params = useParams();
  const categoryId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parent: null as string | null,
  });

  useEffect(() => {
    if (categoryId) {
      fetchCategory();
      fetchCategories();
    }
  }, [categoryId]);

  const fetchCategory = async () => {
    try {
      const response = await strapiApi.get(`/api/admin-categories/${categoryId}`, {
        params: {
          populate: 'parent',
        },
      });
      const cat = response.data.data;
      setFormData({
        name: cat.name || '',
        slug: cat.slug || '',
        description: cat.description || '',
        parent: cat.parent?.documentId || null,
      });
    } catch (error: any) {
      console.error('Failed to fetch category:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load category',
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
      // Filter out current category and its children to prevent circular references
      const allCategories = response.data.data;
      const currentCategory = allCategories.find((cat: Category) => cat.documentId === categoryId);

      // Get all descendant IDs
      const getDescendantIds = (cat: Category): string[] => {
        if (!cat.children || cat.children.length === 0) return [cat.documentId];
        const childIds = cat.children.flatMap((child: any) => {
          const fullChild = allCategories.find((c: Category) => c.id === child.id);
          return fullChild ? getDescendantIds(fullChild) : [];
        });
        return [cat.documentId, ...childIds];
      };

      const excludeIds = currentCategory ? getDescendantIds(currentCategory) : [categoryId];
      setCategories(allCategories.filter((cat: Category) => !excludeIds.includes(cat.documentId)));
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
    setSaving(true);

    try {
      const payload: any = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
      };

      if (formData.parent) {
        payload.parent = formData.parent;
      } else {
        payload.parent = null;
      }

      await strapiApi.put(`/api/admin-categories/${categoryId}`, {
        data: payload,
      });

      notifications.show({
        title: 'Success',
        message: 'Category updated successfully',
        color: 'green',
        icon: <CheckCircle size={18} />,
      });

      router.push('/dashboard/categories');
    } catch (error: any) {
      console.error('Failed to update category:', error);
      notifications.show({
        title: 'Error',
        message: error?.response?.data?.error?.message || 'Failed to update category. Please try again.',
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
          Edit Category
        </Title>
        <Text size="md" c="#64748b">
          Update category details
        </Text>
      </Box>

      <Paper shadow="xs" p="xl" radius="lg" style={{ border: '1px solid #e2e8f0', position: 'relative' }}>
        <LoadingOverlay visible={loading} />
        {!loading && (
          <form onSubmit={handleSubmit}>
            <TextInput
              label="Name"
              placeholder="Enter category name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
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

