"use client";

import { useState } from "react";
import { Title, Text, Box, Paper, TextInput, Textarea, Switch, Button, Group } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ArrowLeft, Save, CheckCircle, XCircle } from "lucide-react";
import { strapiApi } from "../../../../lib/strapi";
import { generateSlug } from "../../../../lib/utils";
import { useRouter } from "next/navigation";

export default function CreateTagPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    published: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await strapiApi.post("/api/admin-tags", {
        data: {
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
          published: formData.published,
        },
      });

      notifications.show({
        title: "Success",
        message: "Tag created successfully",
        color: "green",
        icon: <CheckCircle size={18} />,
      });

      router.push("/dashboard/tags");
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error?.response?.data?.error?.message || "Failed to create tag.",
        color: "red",
        icon: <XCircle size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: generateSlug(value),
    }));
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
          Create New Tag
        </Title>
        <Text size="md" c="#64748b">
          Create a reusable tag for posts
        </Text>
      </Box>

      <Paper shadow="xs" p="xl" radius="lg" style={{ border: "1px solid #e2e8f0" }}>
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Name"
            placeholder="Enter tag name"
            required
            value={formData.name}
            onChange={(e) => handleNameChange(e.currentTarget.value)}
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
            <Button type="submit" leftSection={<Save size={18} />} loading={loading} radius="xl">
              Create Tag
            </Button>
          </Group>
        </form>
      </Paper>
    </Box>
  );
}

