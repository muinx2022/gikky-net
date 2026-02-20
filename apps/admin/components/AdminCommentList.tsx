"use client";

import { useEffect, useState } from "react";
import { Box, Text, Button, Group, Avatar, Badge, Loader } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Ban, CheckCircle } from "lucide-react";
import { strapiApi } from "../lib/strapi";

interface CommentAuthor {
  id: number;
  username: string;
  email: string;
}

interface RawComment {
  id: number;
  documentId: string;
  content: string;
  disabled: boolean;
  createdAt: string;
  author: CommentAuthor | null;
  parent: { id: number } | null;
}

interface CommentNode extends RawComment {
  children: CommentNode[];
}

function buildTree(comments: RawComment[]): CommentNode[] {
  const map = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((c) => {
    map.set(c.id, { ...c, children: [] });
  });

  comments.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parent?.id && map.has(c.parent.id)) {
      map.get(c.parent.id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

interface CommentRowProps {
  comment: CommentNode;
  depth: number;
  onToggleDisable: (documentId: string, currentDisabled: boolean) => void;
  togglingId: string | null;
}

function CommentRow({ comment, depth, onToggleDisable, togglingId }: CommentRowProps) {
  const isToggling = togglingId === comment.documentId;

  return (
    <Box>
      <Box
        p="sm"
        mb={4}
        style={{
          marginLeft: depth * 24,
          borderLeft: depth > 0 ? "2px solid #e2e8f0" : undefined,
          paddingLeft: depth > 0 ? 12 : undefined,
          background: comment.disabled ? "#f8fafc" : "#fff",
          borderRadius: 6,
          border: "1px solid #e2e8f0",
          opacity: comment.disabled ? 0.65 : 1,
        }}
      >
        <Group justify="space-between" align="flex-start" gap="sm">
          <Box style={{ flex: 1 }}>
            <Group gap={8} mb={4}>
              <Avatar size={24} radius="xl" color="blue">
                {(comment.author?.username || "?")[0].toUpperCase()}
              </Avatar>
              <Text size="xs" fw={600}>
                {comment.author?.username || comment.author?.email || "Unknown"}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(comment.createdAt).toLocaleString("vi-VN")}
              </Text>
              {comment.disabled && (
                <Badge size="xs" color="red" variant="light">
                  Disabled
                </Badge>
              )}
            </Group>
            <Text
              size="sm"
              c={comment.disabled ? "dimmed" : "dark"}
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {comment.content}
            </Text>
          </Box>
          <Button
            size="xs"
            variant="light"
            color={comment.disabled ? "green" : "red"}
            leftSection={
              isToggling ? (
                <Loader size={12} />
              ) : comment.disabled ? (
                <CheckCircle size={13} />
              ) : (
                <Ban size={13} />
              )
            }
            loading={isToggling}
            onClick={() => onToggleDisable(comment.documentId, comment.disabled)}
          >
            {comment.disabled ? "Enable" : "Disable"}
          </Button>
        </Group>
      </Box>

      {comment.children.map((child) => (
        <CommentRow
          key={child.documentId}
          comment={child}
          depth={depth + 1}
          onToggleDisable={onToggleDisable}
          togglingId={togglingId}
        />
      ))}
    </Box>
  );
}

interface AdminCommentListProps {
  postId?: string;
  journalTradeId?: string;
}

export default function AdminCommentList({ postId, journalTradeId }: AdminCommentListProps) {
  const [comments, setComments] = useState<RawComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (postId) params.postId = postId;
      if (journalTradeId) params.journalTradeId = journalTradeId;

      const response = await strapiApi.get("/api/admin-comments", { params });
      setComments(response.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch comments", error);
      notifications.show({ title: "Error", message: "Failed to load comments", color: "red" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (postId || journalTradeId) fetchComments();
  }, [postId, journalTradeId]);

  const handleToggleDisable = async (documentId: string, currentDisabled: boolean) => {
    setTogglingId(documentId);
    try {
      const response = await strapiApi.patch(`/api/admin-comments/${documentId}/disable`);
      const newDisabled: boolean = response.data?.data?.disabled ?? !currentDisabled;
      setComments((prev) =>
        prev.map((c) => (c.documentId === documentId ? { ...c, disabled: newDisabled } : c))
      );
      notifications.show({
        title: "Success",
        message: newDisabled ? "Comment disabled" : "Comment enabled",
        color: newDisabled ? "red" : "green",
      });
    } catch (error) {
      console.error("Failed to toggle comment", error);
      notifications.show({ title: "Error", message: "Failed to update comment", color: "red" });
    } finally {
      setTogglingId(null);
    }
  };

  const tree = buildTree(comments);

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">Loading comments...</Text>
      </Group>
    );
  }

  if (tree.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        No comments yet.
      </Text>
    );
  }

  return (
    <Box>
      <Text size="sm" c="dimmed" mb="sm">
        {comments.length} comment{comments.length !== 1 ? "s" : ""}
        {comments.filter((c) => c.disabled).length > 0 &&
          ` · ${comments.filter((c) => c.disabled).length} disabled`}
      </Text>
      <Box style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tree.map((node) => (
          <CommentRow
            key={node.documentId}
            comment={node}
            depth={0}
            onToggleDisable={handleToggleDisable}
            togglingId={togglingId}
          />
        ))}
      </Box>
    </Box>
  );
}
