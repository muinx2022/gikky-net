"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Title, Text, Box, Paper, Group, Button, ActionIcon, Switch, Tooltip, TextInput, Select } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Plus, Edit, Trash, FolderTree, CheckCircle, XCircle, Shield, GripVertical } from "lucide-react";
import { strapiApi } from "../../../lib/strapi";
import { useRouter } from "next/navigation";
import DeleteConfirmModal from "../../../components/DeleteConfirmModal";
import AssignModeratorModal from "../../../components/AssignModeratorModal";
import { usePageTitle } from '../../../hooks/usePageTitle';

interface CategoryItem {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description: string;
  published: boolean;
  sortOrder: number;
  parentDocumentId: string | null;
}

export default function CategoriesPage() {
  usePageTitle('Categories');
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTree, setSavingTree] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ mode: "before" | "after" | "child" | "root-end"; targetId?: string } | null>(null);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [assignModModalOpened, setAssignModModalOpened] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);
  const [filters, setFilters] = useState({
    name: "",
    published: "",
    level: "",
  });
  const [draftFilters, setDraftFilters] = useState({
    name: "",
    published: "",
    level: "",
  });

  useEffect(() => {
    fetchCategories();
  }, [filters]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const apiFilters: Record<string, unknown> = {};
      if (filters.name.trim()) {
        apiFilters.name = { $containsi: filters.name.trim() };
      }
      if (filters.published) {
        apiFilters.published = { $eq: filters.published === "published" };
      }
      if (filters.level) {
        if (filters.level === "root") {
          apiFilters.parent = { documentId: { $null: true } };
        }
        if (filters.level === "child") {
          apiFilters.parent = { documentId: { $notNull: true } };
        }
      }

      const params: Record<string, unknown> = {
        populate: ["parent"],
        sort: ["sortOrder:asc", "name:asc"],
      };
      if (Object.keys(apiFilters).length > 0) {
        params.filters = apiFilters;
      }

      const response = await strapiApi.get("/api/admin-categories", {
        params,
      });
      const mapped: CategoryItem[] = (response.data?.data || []).map((c: any) => ({
        id: c.id,
        documentId: c.documentId,
        name: c.name,
        slug: c.slug,
        description: c.description || "",
        published: !!c.published,
        sortOrder: Number.isFinite(Number(c.sortOrder)) ? Number(c.sortOrder) : 0,
        parentDocumentId: c.parent?.documentId || null,
      }));
      setCategories(mapped);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const byParent = useMemo(() => {
    const map = new Map<string | null, CategoryItem[]>();
    for (const cat of categories) {
      const key = cat.parentDocumentId;
      const arr = map.get(key) || [];
      arr.push(cat);
      map.set(key, arr);
    }
    for (const [key, arr] of map.entries()) {
      arr.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
      map.set(key, arr);
    }
    return map;
  }, [categories]);

  const collectDescendants = (documentId: string, all: CategoryItem[]): Set<string> => {
    const out = new Set<string>();
    const walk = (parentId: string) => {
      const children = all.filter((c) => c.parentDocumentId === parentId);
      for (const c of children) {
        if (!out.has(c.documentId)) {
          out.add(c.documentId);
          walk(c.documentId);
        }
      }
    };
    walk(documentId);
    return out;
  };

  const persistTree = async (next: CategoryItem[]) => {
    setSavingTree(true);
    try {
      await strapiApi.post("/api/admin-categories/reorder-tree", {
        data: {
          items: next.map((c) => ({
            documentId: c.documentId,
            parentDocumentId: c.parentDocumentId,
            sortOrder: c.sortOrder,
          })),
        },
      });
      setCategories(next);
    } catch (error: any) {
      console.error("Failed to reorder categories:", error);
      notifications.show({
        title: "Error",
        message: error?.response?.data?.error?.message || "Failed to save category order",
        color: "red",
        icon: <XCircle size={18} />,
      });
      fetchCategories();
    } finally {
      setSavingTree(false);
      setDraggedId(null);
      setDropHint(null);
    }
  };

  const applyMove = async (mode: "before" | "after" | "child" | "root-end", targetId?: string) => {
    if (!draggedId) return;
    if (mode !== "root-end" && !targetId) return;
    if (targetId === draggedId) return;

    const all = categories.map((c) => ({ ...c }));
    const dragged = all.find((c) => c.documentId === draggedId);
    if (!dragged) return;

    if (mode === "child" && targetId) {
      const descendants = collectDescendants(draggedId, all);
      if (descendants.has(targetId)) {
        notifications.show({
          title: "Invalid move",
          message: "Cannot move a category into its own descendant.",
          color: "yellow",
        });
        return;
      }
    }

    const oldParent = dragged.parentDocumentId;
    let newParent: string | null = oldParent;

    if (mode === "root-end") {
      newParent = null;
    } else {
      const target = all.find((c) => c.documentId === targetId);
      if (!target) return;
      newParent = mode === "child" ? target.documentId : target.parentDocumentId;
    }

    dragged.parentDocumentId = newParent;

    const normalizeParent = (parentDocumentId: string | null, preferredOrder?: string[]) => {
      const siblings = all
        .filter((c) => c.parentDocumentId === parentDocumentId)
        .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));

      let ordered = siblings;
      if (preferredOrder && preferredOrder.length > 0) {
        const orderMap = new Map(preferredOrder.map((id, idx) => [id, idx]));
        ordered = [...siblings].sort((a, b) => {
          const ai = orderMap.has(a.documentId) ? (orderMap.get(a.documentId) as number) : Number.MAX_SAFE_INTEGER;
          const bi = orderMap.has(b.documentId) ? (orderMap.get(b.documentId) as number) : Number.MAX_SAFE_INTEGER;
          return ai - bi;
        });
      }

      ordered.forEach((item, index) => {
        item.sortOrder = index;
      });
    };

    normalizeParent(oldParent);

    if (mode === "before" || mode === "after") {
      const siblings = all
        .filter((c) => c.parentDocumentId === newParent && c.documentId !== draggedId)
        .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name))
        .map((c) => c.documentId);

      const targetIndex = siblings.findIndex((id) => id === targetId);
      const insertIndex = mode === "before" ? targetIndex : targetIndex + 1;
      siblings.splice(Math.max(0, insertIndex), 0, draggedId);
      normalizeParent(newParent, siblings);
    } else if (mode === "child") {
      const siblings = all
        .filter((c) => c.parentDocumentId === newParent && c.documentId !== draggedId)
        .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name))
        .map((c) => c.documentId);
      siblings.push(draggedId);
      normalizeParent(newParent, siblings);
    } else {
      normalizeParent(newParent);
    }

    await persistTree(all);
  };

  const setDropHintStable = (next: { mode: "before" | "after" | "child" | "root-end"; targetId?: string } | null) => {
    setDropHint((prev) => {
      if (!prev && !next) return prev;
      if (
        prev &&
        next &&
        prev.mode === next.mode &&
        (prev.targetId || "") === (next.targetId || "")
      ) {
        return prev;
      }
      return next;
    });
  };

  const openDeleteModal = (documentId: string, name: string) => {
    setDeletingCategory({ id: documentId, name });
    setDeleteModalOpened(true);
  };

  const openAssignModModal = (documentId: string, name: string) => {
    setSelectedCategory({ id: documentId, name });
    setAssignModModalOpened(true);
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;

    setDeleting(true);
    try {
      await strapiApi.delete(`/api/admin-categories/${deletingCategory.id}`);
      setDeleteModalOpened(false);
      setDeletingCategory(null);

      notifications.show({
        title: "Success",
        message: "Category deleted successfully",
        color: "green",
        icon: <CheckCircle size={18} />,
      });

      fetchCategories();
    } catch (error: any) {
      console.error("Failed to delete category:", error);
      notifications.show({
        title: "Error",
        message: error?.response?.data?.error?.message || "Failed to delete category",
        color: "red",
        icon: <XCircle size={18} />,
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePublish = async (documentId: string, currentStatus: boolean) => {
    try {
      await strapiApi.put(`/api/admin-categories/${documentId}`, {
        data: { published: !currentStatus },
      });
      setCategories((prev) =>
        prev.map((c) => (c.documentId === documentId ? { ...c, published: !currentStatus } : c))
      );
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error?.response?.data?.error?.message || "Failed to update category status",
        color: "red",
        icon: <XCircle size={18} />,
      });
    }
  };

  const renderTree = (parentDocumentId: string | null, level = 0): React.ReactNode => {
    const indent = level * 26;
    const dropZoneIndent = indent + 10;
    const nodes = byParent.get(parentDocumentId) || [];
    return nodes.map((category) => (
      <React.Fragment key={category.documentId}>
        <Box
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => {
            e.preventDefault();
            if (draggedId && draggedId !== category.documentId) {
              setDropHintStable({ mode: "before", targetId: category.documentId });
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            applyMove("before", category.documentId);
          }}
          style={{
            height: 4,
            marginLeft: dropZoneIndent,
            borderTop:
              dropHint?.mode === "before" && dropHint?.targetId === category.documentId
                ? "2px solid #2563eb"
                : draggedId
                ? "1px dashed #cbd5e1"
                : "none",
            background:
              dropHint?.mode === "before" && dropHint?.targetId === category.documentId
                ? "rgba(37,99,235,0.08)"
                : "transparent",
            borderRadius: 6,
          }}
        />

        <Paper
          withBorder
          p={8}
          radius="sm"
          mb={2}
          draggable={!savingTree}
          onDragStart={() => setDraggedId(category.documentId)}
          onDragEnd={() => {
            setDraggedId(null);
            setDropHintStable(null);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => {
            e.preventDefault();
            if (draggedId && draggedId !== category.documentId) {
              setDropHintStable({ mode: "child", targetId: category.documentId });
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            applyMove("child", category.documentId);
          }}
          style={{
            marginLeft: indent,
            borderColor:
              draggedId === category.documentId
                ? "#94a3b8"
                : dropHint?.mode === "child" && dropHint?.targetId === category.documentId
                ? "#2563eb"
                : "#e2e8f0",
            background:
              dropHint?.mode === "child" && dropHint?.targetId === category.documentId
                ? "rgba(37,99,235,0.06)"
                : "#fff",
            opacity: draggedId === category.documentId ? 0.65 : 1,
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <GripVertical size={16} color="#94a3b8" />
              <FolderTree size={16} color={level === 0 ? "#475569" : "#94a3b8"} />
              <Box style={{ minWidth: 0 }}>
                <Text fw={level === 0 ? 600 : 500} c="#0f172a">
                  {category.name}
                </Text>
                {dropHint?.mode === "child" && dropHint?.targetId === category.documentId && (
                  <Text size="10px" c="#2563eb" fw={600}>
                    Drop here to make it a child of this category
                  </Text>
                )}
                {category.description && (
                  <Text size="10px" c="#64748b" lineClamp={1}>
                    {category.description}
                  </Text>
                )}
              </Box>
            </Group>

            <Group gap="xs" wrap="nowrap">
              <Tooltip label={category.published ? "Published" : "Unpublished"} position="top">
                <Switch
                  checked={category.published}
                  onChange={() => handleTogglePublish(category.documentId, category.published)}
                  color="green"
                  size="sm"
                />
              </Tooltip>
              <Tooltip label="Invite or Assign Mod" withArrow color="orange">
                <ActionIcon variant="light" color="orange" size="sm" onClick={() => openAssignModModal(category.documentId, category.name)}>
                  <Shield size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Edit" withArrow>
                <ActionIcon variant="light" size="sm" onClick={() => router.push(`/dashboard/categories/edit/${category.documentId}`)}>
                  <Edit size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Delete" withArrow color="red">
                <ActionIcon variant="light" color="red" size="sm" onClick={() => openDeleteModal(category.documentId, category.name)}>
                  <Trash size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Paper>

        {renderTree(category.documentId, level + 1)}

        <Box
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => {
            e.preventDefault();
            if (draggedId && draggedId !== category.documentId) {
              setDropHintStable({ mode: "after", targetId: category.documentId });
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            applyMove("after", category.documentId);
          }}
          style={{
            height: 4,
            marginLeft: dropZoneIndent,
            borderBottom:
              dropHint?.mode === "after" && dropHint?.targetId === category.documentId
                ? "2px solid #2563eb"
                : draggedId
                ? "1px dashed #e2e8f0"
                : "none",
            background:
              dropHint?.mode === "after" && dropHint?.targetId === category.documentId
                ? "rgba(37,99,235,0.08)"
                : "transparent",
            borderRadius: 6,
            marginBottom: 1,
          }}
        />
      </React.Fragment>
    ));
  };

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={1} fw={700} mb="xs" c="#0f172a" style={{ fontSize: "2rem" }}>
            Categories
          </Title>
          <Text size="md" c="#64748b">
            Drag and drop to reorder categories or change parent-child.
          </Text>
        </Box>
        <Button
          leftSection={<Plus size={18} />}
          onClick={() => router.push("/dashboard/categories/create")}
          radius="xl"
          loading={savingTree}
          styles={{
            root: {
              backgroundColor: "#475569",
              "&:hover": { backgroundColor: "#334155" },
            },
          }}
        >
          Create Category
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
          <Select
            placeholder="All types"
            value={draftFilters.level || null}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, level: value || "" }))}
            data={[
              { value: "root", label: "Root category" },
              { value: "child", label: "Child category" },
            ]}
            clearable
            style={{ minWidth: 180 }}
          />
          <Button onClick={() => setFilters(draftFilters)}>Apply</Button>
          <Button
            variant="light"
            color="gray"
            onClick={() => {
              const cleared = { name: "", published: "", level: "" };
              setDraftFilters(cleared);
              setFilters(cleared);
            }}
          >
            Reset
          </Button>
        </Group>
      </Paper>

      <Paper shadow="xs" radius="lg" p="md" style={{ border: "1px solid #e2e8f0" }}>
        {loading ? (
          <Text c="#64748b" ta="center" py="xl">
            Loading categories...
          </Text>
        ) : categories.length === 0 ? (
          <Text c="#64748b" ta="center" py="xl">
            No categories found. Create your first category!
          </Text>
        ) : (
          <>
            <Box
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => {
                e.preventDefault();
                if (draggedId) setDropHintStable({ mode: "root-end" });
              }}
              onDrop={(e) => {
                e.preventDefault();
                applyMove("root-end");
              }}
              style={{
                padding: "8px 10px",
                border:
                  dropHint?.mode === "root-end"
                    ? "2px solid #2563eb"
                    : draggedId
                    ? "1px dashed #cbd5e1"
                    : "1px dashed transparent",
                borderRadius: 8,
                marginBottom: 2,
                color: dropHint?.mode === "root-end" ? "#1d4ed8" : "#64748b",
                background: dropHint?.mode === "root-end" ? "rgba(37,99,235,0.08)" : "transparent",
                fontSize: 12,
              }}
            >
              Drop here to move category as root
            </Box>
            <Paper withBorder radius="sm" p={6} mb={4} style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
              <Group gap="md" wrap="wrap">
                <Text size="10px" c="#475569"><b>Blue line above</b>: move before</Text>
                <Text size="10px" c="#475569"><b>Blue card</b>: make child</Text>
                <Text size="10px" c="#475569"><b>Blue line below</b>: move after</Text>
                <Text size="10px" c="#475569"><b>Top drop zone</b>: move to root</Text>
              </Group>
            </Paper>
            {renderTree(null)}
          </>
        )}
      </Paper>

      <DeleteConfirmModal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setDeletingCategory(null);
        }}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Are you sure you want to delete "${deletingCategory?.name}"?`}
        loading={deleting}
      />

      {selectedCategory && (
        <AssignModeratorModal
          opened={assignModModalOpened}
          onClose={() => {
            setAssignModModalOpened(false);
            setSelectedCategory(null);
          }}
          categoryId={selectedCategory.id}
          categoryName={selectedCategory.name}
          onSuccess={() => undefined}
        />
      )}
    </Box>
  );
}
