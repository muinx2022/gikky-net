"use client";

import { useState } from "react";
import { Title, Text, Box, Paper, TextInput, Select, Switch, Button, Group } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ArrowLeft, Save, CheckCircle, XCircle } from "lucide-react";
import { strapiApi } from "../../../../lib/strapi";
import { generateSlug } from "../../../../lib/utils";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { usePageTitle } from '../../../../hooks/usePageTitle';

const TiptapEditor = dynamic(() => import("../../../../components/TiptapEditor"), {
  ssr: false,
});

export default function CreatePagePage() {
  usePageTitle('Create Page');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content: "",
    ftType: "front",
    isPublished: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await strapiApi.post("/api/admin-pages", {
        data: formData,
      });

      notifications.show({
        title: "Success",
        message: "Page created successfully",
        color: "green",
        icon: <CheckCircle size={18} />,
      });

      router.push("/dashboard/pages");
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error?.response?.data?.error?.message || "Failed to create page.",
        color: "red",
        icon: <XCircle size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTitleChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      title: value,
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
          Create New Page
        </Title>
        <Text size="md" c="#64748b">
          Create front content or footer link page
        </Text>
      </Box>

      <Paper shadow="xs" p="xl" radius="lg" style={{ border: "1px solid #e2e8f0" }}>
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Title"
            placeholder="Enter page title"
            required
            value={formData.title}
            onChange={(e) => handleTitleChange(e.currentTarget.value)}
            mb="md"
          />

          <TextInput
            label="Slug"
            placeholder="page-slug"
            required
            value={formData.slug}
            onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.currentTarget.value }))}
            mb="md"
          />

          <Select
            label="Type"
            value={formData.ftType}
            onChange={(value) => setFormData((prev) => ({ ...prev, ftType: (value as "front" | "footer") || "front" }))}
            data={[
              { value: "front", label: "Front" },
              { value: "footer", label: "Footer" },
            ]}
            mb="md"
          />

          <Box mb="md">
            <Text size="sm" fw={500} mb={6}>
              Content <span style={{ color: "red" }}>*</span>
            </Text>
            <TiptapEditor
              content={formData.content}
              onChange={(content) => setFormData((prev) => ({ ...prev, content }))}
              placeholder="Write page content here..."
            />
          </Box>

          <Switch
            label="Published"
            checked={formData.isPublished}
            onChange={(e) => setFormData((prev) => ({ ...prev, isPublished: e.currentTarget.checked }))}
            mb="xl"
          />

          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => router.back()} radius="xl">
              Cancel
            </Button>
            <Button type="submit" leftSection={<Save size={18} />} loading={loading} radius="xl">
              Create Page
            </Button>
          </Group>
        </form>
      </Paper>
    </Box>
  );
}
