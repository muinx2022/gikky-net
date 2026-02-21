"use client";

import { useEffect, useMemo, useState } from "react";
import { Title, Text, Box, Paper, Table, Group, Button, ActionIcon, Switch, Tooltip, TextInput, Select } from "@mantine/core";
import { Plus, Edit, Trash, CheckCircle, XCircle } from "lucide-react";
import { strapiApi } from "../../../lib/strapi";
import { useRouter } from "next/navigation";
import DeleteConfirmModal from "../../../components/DeleteConfirmModal";
import { notifications } from "@mantine/notifications";
import { usePageTitle } from '../../../hooks/usePageTitle';

interface TagItem {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string;
  published: boolean;
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== "object" || error === null) return fallback;
  const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
  return response?.data?.error?.message || fallback;
};

export default function TagsPage() {
  usePageTitle('Tags');
  const router = useRouter();
  const PAGE_SIZE = 10;
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [deletingTag, setDeletingTag] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState({
    name: "",
    published: "",
  });
  const [draftFilters, setDraftFilters] = useState({
    name: "",
    published: "",
  });

  useEffect(() => {
    fetchTags();
  }, [filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(tags.length / PAGE_SIZE));
  const pagedTags = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return tags.slice(start, start + PAGE_SIZE);
  }, [tags, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const apiFilters: Record<string, unknown> = {};
      if (filters.name.trim()) {
        apiFilters.name = { $containsi: filters.name.trim() };
      }
      if (filters.published) {
        apiFilters.published = { $eq: filters.published === "published" };
      }

      const params: Record<string, unknown> = {
        sort: "name:asc",
      };
      if (Object.keys(apiFilters).length > 0) {
        params.filters = apiFilters;
      }

      const response = await strapiApi.get("/api/admin-tags", {
        params,
      });
      setTags(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (documentId: string, name: string) => {
    setDeletingTag({ id: documentId, name });
    setDeleteModalOpened(true);
  };

  const handleDelete = async () => {
    if (!deletingTag) return;
    setDeleting(true);
    try {
      await strapiApi.delete(`/api/admin-tags/${deletingTag.id}`);
      setDeleteModalOpened(false);
      setDeletingTag(null);
      fetchTags();
    } catch (error) {
      console.error("Failed to delete tag:", error);
      alert("Failed to delete tag");
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePublish = async (documentId: string, currentStatus: boolean) => {
    try {
      await strapiApi.put(`/api/admin-tags/${documentId}`, {
        data: {
          published: !currentStatus,
        },
      });

      notifications.show({
        title: "Success",
        message: `Tag ${!currentStatus ? "published" : "hidden"} successfully`,
        color: "green",
        icon: <CheckCircle size={18} />,
      });

      setTags((prev) =>
        prev.map((tag) => (tag.documentId === documentId ? { ...tag, published: !currentStatus } : tag))
      );
    } catch (error: unknown) {
      notifications.show({
        title: "Error",
        message: getApiErrorMessage(error, "Failed to update tag status"),
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
            Tags
          </Title>
          <Text size="md" c="#64748b">
            Manage tags for posts
          </Text>
        </Box>
        <Button
          leftSection={<Plus size={18} />}
          onClick={() => router.push("/dashboard/tags/create")}
          radius="xl"
          styles={{
            root: {
              backgroundColor: "#475569",
              transition: "all 0.3s ease",
              boxShadow: "0 2px 8px rgba(71, 85, 105, 0.15)",
              "&:hover": {
                backgroundColor: "#334155",
                boxShadow: "0 4px 12px rgba(71, 85, 105, 0.25)",
                transform: "translateY(-1px)",
              },
            },
          }}
        >
          Create Tag
        </Button>
      </Group>

      <Paper shadow="xs" radius="lg" p="md" mb="md" style={{ border: "1px solid #e2e8f0" }}>
        <Group align="end">
          <TextInput
            placeholder="Search by name"
            value={draftFilters.name}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, name: e.currentTarget.value }))}
            style={{ minWidth: 240 }}
          />
          <Select
            placeholder="All status"
            value={draftFilters.published || null}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, published: value || "" }))}
            data={[
              { value: "published", label: "Published" },
              { value: "unpublished", label: "Unpublished" },
            ]}
            clearable
            style={{ minWidth: 180 }}
          />
          <Button onClick={() => setFilters(draftFilters)}>Apply</Button>
          <Button
            variant="light"
            color="gray"
            onClick={() => {
              const cleared = { name: "", published: "" };
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
              <Table.Th style={{ width: "28%" }}>Name</Table.Th>
              <Table.Th style={{ width: "24%" }}>Slug</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th style={{ width: 110, textAlign: "center" }}>Status</Table.Th>
              <Table.Th style={{ width: 80, textAlign: "center" }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                  <Text c="#64748b">Loading tags...</Text>
                </Table.Td>
              </Table.Tr>
            ) : tags.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                  <Text c="#64748b">No tags found. Create your first tag!</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              pagedTags.map((tag) => (
                <Table.Tr key={tag.id}>
                  <Table.Td>
                    <Text fw={600} c="#0f172a">
                      {tag.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="#475569">
                      {tag.slug}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="#64748b" lineClamp={1}>
                      {tag.description || "-"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group justify="center">
                      <Tooltip label={tag.published ? "Published" : "Hidden"} position="top">
                        <Switch
                          checked={tag.published}
                          onChange={() => handleTogglePublish(tag.documentId, tag.published)}
                          color="green"
                          size="sm"
                        />
                      </Tooltip>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="center" wrap="nowrap">
                      <Tooltip label="Edit" withArrow>
                        <ActionIcon variant="light" size="sm" onClick={() => router.push(`/dashboard/tags/edit/${tag.documentId}`)}>
                          <Edit size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete" withArrow color="red">
                        <ActionIcon variant="light" color="red" size="sm" onClick={() => openDeleteModal(tag.documentId, tag.name)}>
                          <Trash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
      {!loading && tags.length > 0 && (
        <Group justify="space-between" mt="md">
          <Text size="sm" c="#64748b">
            Page {currentPage}/{totalPages} · {tags.length} items
          </Text>
          <Group gap="xs">
            <Button size="xs" variant="light" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              Prev
            </Button>
            <Button size="xs" variant="light" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              Next
            </Button>
          </Group>
        </Group>
      )}

      <DeleteConfirmModal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setDeletingTag(null);
        }}
        onConfirm={handleDelete}
        title="Delete Tag"
        message={`Are you sure you want to delete "${deletingTag?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </Box>
  );
}
