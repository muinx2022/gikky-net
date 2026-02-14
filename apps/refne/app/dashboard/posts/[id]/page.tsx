"use client";

import { useState, useEffect } from 'react';
import { Title, Text, Box, Paper, Badge, Group, Button, LoadingOverlay } from '@mantine/core';
import { ArrowLeft, Edit, Calendar, User } from 'lucide-react';
import { strapiApi } from '../../../../lib/strapi';
import { useRouter, useParams } from 'next/navigation';

interface Post {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  author?: {
    username: string;
    email: string;
  };
  tags?: Array<{ id: number; documentId: string; name: string }>;
}

const statusColors: Record<string, string> = {
  draft: 'gray',
  published: 'green',
  archived: 'red',
};

export default function ViewPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (postId) {
      fetchPost();
    }
  }, [postId]);

  const fetchPost = async () => {
    try {
      const response = await strapiApi.get(`/api/admin-posts/${postId}`, {
        params: {
          populate: ['author', 'tags'],
        },
      });
      setPost(response.data.data);
    } catch (error) {
      console.error('Failed to fetch post:', error);
      alert('Failed to load post');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<ArrowLeft size={18} />}
          onClick={() => router.back()}
        >
          Back
        </Button>
        {post && (
          <Button
            leftSection={<Edit size={18} />}
            onClick={() => router.push(`/dashboard/posts/edit/${post.documentId}`)}
            styles={{
              root: {
                backgroundColor: '#475569',
                '&:hover': {
                  backgroundColor: '#334155',
                },
              },
            }}
          >
            Edit Post
          </Button>
        )}
      </Group>

      <Paper shadow="xs" p="xl" radius="lg" style={{ border: '1px solid #e2e8f0', position: 'relative' }}>
        <LoadingOverlay visible={loading} />

        {post && (
          <Box>
            {/* Header */}
            <Group justify="space-between" mb="xl">
              <Badge color={statusColors[post.status]} size="lg" radius="sm" variant="light">
                {post.status}
              </Badge>
            </Group>

            {/* Title */}
            <Title order={1} fw={700} mb="md" c="#0f172a">
              {post.title}
            </Title>

            {/* Meta Info */}
            <Group gap="xl" mb="xl" c="#64748b">
              <Group gap="xs">
                <Calendar size={16} />
                <Text size="sm">
                  {formatDate(post.createdAt)}
                </Text>
              </Group>
              {post.author && (
                <Group gap="xs">
                  <User size={16} />
                  <Text size="sm">
                    {post.author.username}
                  </Text>
                </Group>
              )}
            </Group>

            {/* Excerpt */}
            {post.excerpt && (
              <Box
                p="md"
                mb="xl"
                style={{
                  background: '#f8fafc',
                  borderLeft: '3px solid #cbd5e1',
                  borderRadius: '4px',
                }}
              >
                <Text c="#475569" fs="italic">
                  {post.excerpt}
                </Text>
              </Box>
            )}

            {post.tags && post.tags.length > 0 && (
              <Group gap="xs" mb="xl">
                {post.tags.map((tag) => (
                  <Badge key={tag.documentId} variant="light" color="blue" radius="sm">
                    {tag.name}
                  </Badge>
                ))}
              </Group>
            )}

            {/* Content */}
            <Box
              style={{
                color: '#334155',
                lineHeight: 1.7,
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: post.content }}
                style={{
                  fontSize: '1rem',
                }}
              />
            </Box>

            {/* Footer */}
            <Box
              mt="xl"
              pt="xl"
              style={{
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <Text size="sm" c="#64748b">
                Last updated: {formatDate(post.updatedAt)}
              </Text>
            </Box>
          </Box>
        )}
      </Paper>

      <style jsx global>{`
        .post-content h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 1.5rem 0 1rem;
        }
        .post-content h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 1.25rem 0 0.875rem;
        }
        .post-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1rem 0 0.75rem;
        }
        .post-content p {
          margin: 0.75rem 0;
        }
        .post-content ul,
        .post-content ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
        }
        .post-content blockquote {
          border-left: 3px solid #e2e8f0;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #64748b;
        }
        .post-content code {
          background: #f1f5f9;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.875rem;
        }
        .post-content pre {
          background: #0f172a;
          color: white;
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .post-content pre code {
          background: none;
          padding: 0;
          color: white;
        }
        .post-content a {
          color: #3b82f6;
          text-decoration: underline;
        }
      `}</style>
    </Box>
  );
}

