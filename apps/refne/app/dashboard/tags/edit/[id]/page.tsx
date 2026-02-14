"use client";

import { useState, useEffect } from "react";
import { Title, Text, Box, Paper, TextInput, Textarea, Switch, Button, Group, LoadingOverlay } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ArrowLeft, Save, CheckCircle, XCircle } from "lucide-react";
import { strapiApi } from "../../../../../lib/strapi";
import { useRouter, useParams } from "next/navigation";

export default function EditTagPage() {
  const router = useRouter();
  const params = useParams();
  const tagId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    published: true,
  });

  useEffect(() => {
    if (!tagId) return;
    const fetchTag = async () => {
      try {
        const response = await strapiApi.get(`/api/admin-tags/${tagId}`);
        const tag = response.data.data;
        setFormData({
          name: tag.name || "",
          slug: tag.slug || "",
          description: tag.description || "",
          published: Boolean(tag.published),
        });
      } catch (error) {
        notifications.show({
          title: "Error",
          message: "Failed to load tag",
          color: "red",
          icon: <XCircle size={18} />,
        });
        router.back();
      } finally {
        setLoading(false);
      }
    };
    fetchTag();
  }, [tagId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await strapiApi.put(`/api/admin-tags/${tagId}`, {
        data: formData,
      });

      notifications.show({
        title: "Success",
        message: "Tag updated successfully",
        color: "green",
        icon: <CheckCircle size={18} />,
      });
      router.push("/dashboard/tags");
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error?.response?.data?.error?.message || "Failed to update tag.",
        color: "red",
        icon: <XCircle size={18} />,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Group mb="xl">
        <Button variant="subtle" color="gray" leftSection={<ArrowLeft size={18} />} onClick={() => router.back()} radius="xl">
          Back
        </Button>
      </Group>

      <Box mb="xl">
        <Title order={1} fw={700} mb="xs" c="#0f172a" style={{ fontSize: "2rem" }}>
          Edit Tag
        </Title>
        <Text size="md" c="#64748b">
          Update tag details
        </Text>
      </Box>

      <Paper shadow="xs" p="xl" radius="lg" style={{ border: "1px solid #e2e8f0", position: "relative" }}>
        <LoadingOverlay visible={loading} />
        {!loading && (
          <form onSubmit={handleSubmit}>
            <TextInput
              label="Name"
              placeholder="Enter tag name"
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.currentTarget.value }))}
              mb="md"
              styles={{ label: { fontWeight: 600, color: "#334155", marginBottom: 8 } }}
            />

            <TextInput
              label="Slug"
              placeholder="tag-slug"
              required
              value={formData.slug}
              onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.currentTarget.value }))}
              mb="md"
              styles={{ label: { fontWeight: 600, color: "#334155", marginBottom: 8 } }}
            />

            <Textarea
              label="Description"
              placeholder="Brief description of this tag"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.currentTarget.value }))}
              mb="md"
              styles={{ label: { fontWeight: 600, color: "#334155", marginBottom: 8 } }}
            />

            <Switch
              label="Published"
              checked={formData.published}
              onChange={(e) => setFormData((prev) => ({ ...prev, published: e.currentTarget.checked }))}
              mb="xl"
            />

            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={() => router.back()} radius="xl">
                Cancel
              </Button>
              <Button type="submit" leftSection={<Save size={18} />} loading={saving} radius="xl">
                Save Changes
              </Button>
            </Group>
          </form>
        )}
      </Paper>
    </Box>
  );
}

