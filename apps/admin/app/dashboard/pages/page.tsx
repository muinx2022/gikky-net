"use client";

import { useEffect, useState } from "react";
import { Title, Text, Box, Paper, Table, Group, Button, ActionIcon, Menu, Switch, Tooltip, TextInput, Select } from "@mantine/core";
import { Plus, MoreVertical, Edit, Trash, CheckCircle, XCircle } from "lucide-react";
import { strapiApi } from "../../../lib/strapi";
import { useRouter } from "next/navigation";
import DeleteConfirmModal from "../../../components/DeleteConfirmModal";
import { notifications } from "@mantine/notifications";
import { usePageTitle } from '../../../hooks/usePageTitle';

interface PageItem {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string;
  ftType: "front" | "footer";
  isPublished: boolean;
}

const stripHtml = (input: string) =>
  input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasRichFormatting = (input: string) => {
  if (!input) return false;
  return /<(h[1-6]|ul|ol|li|blockquote|pre|code|strong|b|em|i|u|s|a|table|img|video|iframe)\b/i.test(input);
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== "object" || error === null) return fallback;
  const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
  return response?.data?.error?.message || fallback;
};

export default function PagesListPage() {
  usePageTitle('Pages');
  const router = useRouter();
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [deletingPage, setDeletingPage] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState({
    title: "",
    ftType: "",
    published: "",
  });
  const [draftFilters, setDraftFilters] = useState({
    title: "",
    ftType: "",
    published: "",
  });

  useEffect(() => {
    fetchPages();
  }, [filters]);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const apiFilters: Record<string, unknown> = {};
      if (filters.title.trim()) {
        apiFilters.title = { $containsi: filters.title.trim() };
      }
      if (filters.ftType) {
        apiFilters.ftType = { $eq: filters.ftType };
      }
      if (filters.published) {
        apiFilters.publishedAt = { $null: filters.published !== "published" };
      }

      const params: Record<string, unknown> = {
        sort: "updatedAt:desc",
      };
      if (Object.keys(apiFilters).length > 0) {
        params.filters = apiFilters;
      }

      const response = await strapiApi.get("/api/admin-pages", { params });
      setPages(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch pages:", error);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (documentId: string, title: string) => {
    setDeletingPage({ id: documentId, title });
    setDeleteModalOpened(true);
  };

  const handleDelete = async () => {
    if (!deletingPage) return;
    setDeleting(true);
    try {
      await strapiApi.delete(`/api/admin-pages/${deletingPage.id}`);
      setDeleteModalOpened(false);
      setDeletingPage(null);
      fetchPages();
    } catch (error) {
      console.error("Failed to delete page:", error);
      alert("Failed to delete page");
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePublish = async (documentId: string, currentPublished: boolean) => {
    try {
      await strapiApi.put(`/api/admin-pages/${documentId}`, {
        data: {
          isPublished: !currentPublished,
        },
      });

      notifications.show({
        title: "Success",
        message: `Page ${!currentPublished ? "published" : "moved to draft"} successfully`,
        color: "green",
        icon: <CheckCircle size={18} />,
      });

      setPages((prev) =>
        prev.map((item) => (item.documentId === documentId ? { ...item, isPublished: !currentPublished } : item))
      );
    } catch (error: unknown) {
      notifications.show({
        title: "Error",
        message: getApiErrorMessage(error, "Failed to update page status"),
        color: "red",
        icon: <XCircle size={18} />,
      });
    }
  };

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={1} fw={700} mb="xs" c="#0f172a" style={{ fontSize: "2rem" }}>
            Pages
          </Title>
          <Text size="md" c="#64748b">
            Manage static pages for front and footer
          </Text>
        </Box>
        <Button leftSection={<Plus size={18} />} onClick={() => router.push("/dashboard/pages/create")} radius="xl">
          Create Page
        </Button>
      </Group>

      <Paper shadow="xs" radius="lg" p="md" mb="md" style={{ border: "1px solid #e2e8f0" }}>
        <Group align="end">
          <TextInput
            placeholder="Search by title"
            value={draftFilters.title}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, title: e.currentTarget.value }))}
            style={{ minWidth: 260 }}
          />
          <Select
            placeholder="All types"
            value={draftFilters.ftType || null}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, ftType: value || "" }))}
            data={[
              { value: "front", label: "Front" },
              { value: "footer", label: "Footer" },
            ]}
            clearable
            style={{ minWidth: 160 }}
          />
          <Select
            placeholder="All status"
            value={draftFilters.published || null}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, published: value || "" }))}
            data={[
              { value: "published", label: "Published" },
              { value: "draft", label: "Draft" },
            ]}
            clearable
            style={{ minWidth: 160 }}
          />
          <Button onClick={() => setFilters(draftFilters)}>Apply</Button>
          <Button
            variant="light"
            color="gray"
            onClick={() => {
              const cleared = { title: "", ftType: "", published: "" };
              setDraftFilters(cleared);
              setFilters(cleared);
            }}
          >
            Reset
          </Button>
        </Group>
      </Paper>

      <Paper shadow="xs" radius="lg" style={{ border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <Table highlightOnHover>
          <Table.Thead style={{ background: "#fafafa" }}>
            <Table.Tr>
              <Table.Th style={{ width: "32%" }}>Title</Table.Th>
              <Table.Th style={{ width: "20%" }}>Slug</Table.Th>
              <Table.Th style={{ width: "12%" }}>Type</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th style={{ width: 110, textAlign: "center" }}>Status</Table.Th>
              <Table.Th style={{ width: 80, textAlign: "center" }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                  <Text c="#64748b">Loading pages...</Text>
                </Table.Td>
              </Table.Tr>
            ) : pages.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                  <Text c="#64748b">No pages found.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              pages.map((page) => (
                <Table.Tr key={page.id}>
                  <Table.Td>
                    <Text fw={600} c="#0f172a">
                      {page.title}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="#475569">
                      {page.slug}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="#475569">
                      {page.ftType}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {hasRichFormatting(page.content || "") ? (
                      <Box
                        style={{ maxHeight: 84, overflow: "hidden", color: "#475569", fontSize: "0.875rem", lineHeight: 1.45 }}
                        dangerouslySetInnerHTML={{ __html: page.content || "-" }}
                      />
                    ) : (
                      <Text size="sm" c="#64748b" lineClamp={1}>
                        {stripHtml(page.content || "") || "-"}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group justify="center">
                      <Tooltip label={page.isPublished ? "Published" : "Draft"} position="top">
                        <Switch
                          checked={page.isPublished}
                          onChange={() => handleTogglePublish(page.documentId, page.isPublished)}
                          color="green"
                          size="sm"
                        />
                      </Tooltip>
                    </Group>
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
                            onClick={() => router.push(`/dashboard/pages/edit/${page.documentId}`)}
                          >
                            Edit
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            color="red"
                            leftSection={<Trash size={14} />}
                            onClick={() => openDeleteModal(page.documentId, page.title)}
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
          setDeletingPage(null);
        }}
        onConfirm={handleDelete}
        title="Delete Page"
        message={`Are you sure you want to delete "${deletingPage?.title}"? This action cannot be undone.`}
        loading={deleting}
      />
    </Box>
  );
}
