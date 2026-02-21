"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Title,
  Text,
  Box,
  Paper,
  Table,
  Badge,
  Group,
  Button,
  Select,
  Modal,
  Textarea,
  Stack,
  Notification,
  Loader,
} from "@mantine/core";
import { strapiApi } from "../../../lib/strapi";
import { usePageTitle } from "../../../hooks/usePageTitle";

interface ReportData {
  id: number;
  reason: string;
  detail?: string | null;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
  post?: {
    id: number;
    documentId: string;
    title: string;
    content?: string;
    author?: { id: number; username: string; strikeCount?: number };
  } | null;
  comment?: {
    id: number;
    documentId: string;
    content: string;
    author?: { id: number; username: string; strikeCount?: number };
    post?: { id: number; documentId: string; title: string } | null;
  } | null;
  reportedBy?: { id: number; username: string } | null;
}

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  inappropriate: "Không phù hợp",
  harassment: "Quấy rối",
  misinformation: "Thông tin sai",
  other: "Khác",
};

export default function ReportsPage() {
  usePageTitle("Reports");
  const PAGE_SIZE = 10;
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [targetFilter, setTargetFilter] = useState<string>("");

  const [banModal, setBanModal] = useState<{ open: boolean; userId: number | null; username: string }>({
    open: false,
    userId: null,
    username: "",
  });
  const [banDuration, setBanDuration] = useState("permanent");
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);

  const [strikeWarning, setStrikeWarning] = useState<{
    show: boolean;
    username: string;
    strikeCount: number;
    userId: number | null;
  }>({
    show: false,
    username: "",
    strikeCount: 0,
    userId: null,
  });

  const [postPreview, setPostPreview] = useState<{
    open: boolean;
    title: string;
    content: string;
    reason: string;
    reportDetail: string;
    loading: boolean;
  }>({
    open: false,
    title: "",
    content: "",
    reason: "",
    reportDetail: "",
    loading: false,
  });

  useEffect(() => {
    fetchReports();
  }, [statusFilter, targetFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, targetFilter]);

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const pagedReports = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return reports.slice(start, start + PAGE_SIZE);
  }, [reports, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (targetFilter) params.targetType = targetFilter;
      const response = await strapiApi.get("/api/admin-reports", { params });
      setReports(response.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateReport = async (reportId: number, status: "reviewed" | "dismissed") => {
    try {
      await strapiApi.patch(`/api/admin-reports/${reportId}`, { status });

      if (status === "reviewed") {
        const report = reports.find((r) => r.id === reportId);
        const author = report?.post?.author || report?.comment?.author;
        if (author) {
          try {
            const usersRes = await strapiApi.get("/api/admin-users", {
              params: { filters: { id: { $eq: author.id } } },
            });
            const userData = usersRes.data?.data?.[0];
            const newStrikes = userData?.strikeCount || 0;
            if (newStrikes >= 3) {
              setStrikeWarning({
                show: true,
                username: author.username,
                strikeCount: newStrikes,
                userId: author.id,
              });
            }
          } catch {
            // ignore
          }
        }
      }

      setReports((prev) => prev.map((item) => (item.id === reportId ? { ...item, status } : item)));
    } catch (error) {
      console.error("Failed to update report:", error);
    }
  };

  const handleBanUser = async () => {
    if (!banModal.userId) return;
    setBanLoading(true);
    try {
      await strapiApi.patch(`/api/admin-users/${banModal.userId}/ban`, {
        duration: banDuration,
        reason: banReason || undefined,
      });
      setBanModal({ open: false, userId: null, username: "" });
      setBanReason("");
      setBanDuration("permanent");
      setStrikeWarning({ show: false, username: "", strikeCount: 0, userId: null });
    } catch (error) {
      console.error("Ban failed:", error);
    } finally {
      setBanLoading(false);
    }
  };

  const getTargetLabel = (report: ReportData) => {
    if (report.post) return `Bài viết: ${report.post.title}`;
    if (report.comment) {
      const content = (report.comment.content || "")
        .replace(/<[^>]+>/g, "")
        .trim()
        .slice(0, 60);
      return `Bình luận: ${content}${content.length >= 60 ? "..." : ""}`;
    }
    return "Không xác định";
  };

  const getAuthor = (report: ReportData) => report.post?.author || report.comment?.author || null;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const openPostPreview = async (report: ReportData) => {
    if (!report.post?.documentId) return;

    setPostPreview({
      open: true,
      title: report.post.title || "Bài viết",
      content: report.post.content || "",
      reason: REASON_LABELS[report.reason] || report.reason,
      reportDetail: report.detail || "",
      loading: !report.post.content,
    });

    if (report.post.content) return;

    try {
      const response = await strapiApi.get(`/api/admin-posts/${report.post.documentId}`);
      const fetched = response.data?.data;
      setPostPreview((prev) => ({
        ...prev,
        content: fetched?.content || "<p><i>Không tải được nội dung bài viết.</i></p>",
        title: fetched?.title || prev.title,
        loading: false,
      }));
    } catch {
      setPostPreview((prev) => ({
        ...prev,
        content: "<p><i>Không tải được nội dung bài viết.</i></p>",
        loading: false,
      }));
    }
  };

  return (
    <Box>
      <Box mb="xl">
        <Title order={1} fw={700} mb="xs" c="#0f172a" style={{ fontSize: "2rem" }}>
          Reports
        </Title>
        <Text size="md" c="#64748b">
          Quản lý báo cáo vi phạm
        </Text>
      </Box>

      {strikeWarning.show && (
        <Notification
          color="orange"
          title={`Người dùng ${strikeWarning.username} có ${strikeWarning.strikeCount} vi phạm`}
          mb="md"
          onClose={() => setStrikeWarning({ show: false, username: "", strikeCount: 0, userId: null })}
        >
          <Group>
            <Text size="sm">Người dùng đã vượt ngưỡng 3 vi phạm.</Text>
            <Button
              size="xs"
              color="red"
              onClick={() => {
                setBanModal({ open: true, userId: strikeWarning.userId, username: strikeWarning.username });
                setBanDuration("permanent");
                setBanReason("");
              }}
            >
              Ban ngay
            </Button>
          </Group>
        </Notification>
      )}

      <Paper shadow="xs" radius="lg" p="md" mb="md" style={{ border: "1px solid #e2e8f0" }}>
        <Group align="end">
          <Select
            label="Trạng thái"
            value={statusFilter || null}
            onChange={(v) => setStatusFilter(v || "")}
            data={[
              { value: "", label: "Tất cả" },
              { value: "pending", label: "Chờ xử lý" },
              { value: "reviewed", label: "Đã xem xét" },
              { value: "dismissed", label: "Đã bác bỏ" },
            ]}
            style={{ minWidth: 160 }}
          />
          <Select
            label="Loại"
            value={targetFilter || null}
            onChange={(v) => setTargetFilter(v || "")}
            data={[
              { value: "post", label: "Bài viết" },
              { value: "comment", label: "Bình luận" },
            ]}
            clearable
            style={{ minWidth: 140 }}
          />
          <Button onClick={fetchReports}>Làm mới</Button>
        </Group>
      </Paper>

      <Paper shadow="xs" radius="lg" style={{ border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <Table highlightOnHover>
          <Table.Thead style={{ background: "#fafafa" }}>
            <Table.Tr>
              <Table.Th>Đối tượng</Table.Th>
              <Table.Th style={{ width: 120 }}>Người báo cáo</Table.Th>
              <Table.Th style={{ width: 120 }}>Tác giả</Table.Th>
              <Table.Th style={{ width: 80, textAlign: "center" }}>Strikes</Table.Th>
              <Table.Th style={{ width: 120 }}>Lý do</Table.Th>
              <Table.Th style={{ width: 140 }}>Ngày</Table.Th>
              <Table.Th style={{ width: 100, textAlign: "center" }}>Trạng thái</Table.Th>
              <Table.Th style={{ width: 180 }}>Hành động</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                  <Text c="#64748b">Đang tải...</Text>
                </Table.Td>
              </Table.Tr>
            ) : reports.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                  <Text c="#64748b">Không có báo cáo nào.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              pagedReports.map((report) => {
                const author = getAuthor(report);
                return (
                  <Table.Tr key={report.id}>
                    <Table.Td>
                      {report.post ? (
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() => openPostPreview(report)}
                          style={{ padding: 0, height: "auto", textAlign: "left", whiteSpace: "normal" }}
                        >
                          <Text size="sm" lineClamp={2}>
                            Bài viết: {report.post.title}
                          </Text>
                        </Button>
                      ) : (
                        <Text size="sm" lineClamp={2}>
                          {getTargetLabel(report)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#64748b">
                        {report.reportedBy?.username || "-"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#64748b">
                        {author?.username || "-"}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "center" }}>
                      {(author?.strikeCount || 0) >= 3 ? (
                        <Badge color="red" variant="filled" size="sm">
                          {author?.strikeCount}
                        </Badge>
                      ) : (
                        <Text size="sm" c="#64748b">
                          {author?.strikeCount || 0}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color="orange" variant="light" size="sm">
                        {REASON_LABELS[report.reason] || report.reason}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="#64748b">
                        {formatDate(report.createdAt)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "center" }}>
                      {report.status === "pending" && (
                        <Badge color="yellow" variant="light" size="sm">
                          Chờ xử lý
                        </Badge>
                      )}
                      {report.status === "reviewed" && (
                        <Badge color="green" variant="light" size="sm">
                          Đã xác nhận
                        </Badge>
                      )}
                      {report.status === "dismissed" && (
                        <Badge color="gray" variant="light" size="sm">
                          Bác bỏ
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {report.status === "pending" && (
                        <Group gap="xs">
                          <Button size="xs" color="red" variant="light" onClick={() => handleUpdateReport(report.id, "reviewed")}>
                            Xác nhận vi phạm
                          </Button>
                          <Button size="xs" color="gray" variant="light" onClick={() => handleUpdateReport(report.id, "dismissed")}>
                            Bác bỏ
                          </Button>
                        </Group>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {!loading && reports.length > 0 && (
        <Group justify="space-between" mt="md">
          <Text size="sm" c="#64748b">
            Page {currentPage}/{totalPages} · {reports.length} items
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

      <Modal
        opened={banModal.open}
        onClose={() => setBanModal({ open: false, userId: null, username: "" })}
        title={`Ban người dùng: ${banModal.username}`}
        centered
      >
        <Stack>
          <Select
            label="Thời hạn ban"
            value={banDuration}
            onChange={(v) => setBanDuration(v || "permanent")}
            data={[
              { value: "1d", label: "1 ngày" },
              { value: "3d", label: "3 ngày" },
              { value: "7d", label: "7 ngày" },
              { value: "permanent", label: "Vĩnh viễn" },
            ]}
          />
          <Textarea
            label="Lý do (tùy chọn)"
            placeholder="Nhập lý do ban..."
            value={banReason}
            onChange={(e) => setBanReason(e.currentTarget.value)}
            rows={3}
          />
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setBanModal({ open: false, userId: null, username: "" })}>
              Hủy
            </Button>
            <Button color="red" loading={banLoading} onClick={handleBanUser}>
              Ban
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={postPreview.open}
        onClose={() => setPostPreview({ open: false, title: "", content: "", reason: "", reportDetail: "", loading: false })}
        title={postPreview.title || "Xem nội dung bài viết"}
        centered
        size="lg"
      >
        <Stack gap="sm">
          <Group gap="xs">
            <Badge color="orange" variant="light">
              {postPreview.reason || "Khác"}
            </Badge>
            {postPreview.reportDetail ? (
              <Text size="sm" c="#64748b">
                Chi tiết báo cáo: {postPreview.reportDetail}
              </Text>
            ) : null}
          </Group>
          <Paper withBorder radius="md" p="md" style={{ maxHeight: "55vh", overflowY: "auto" }}>
            {postPreview.loading ? (
              <Group justify="center" py="lg">
                <Loader size="sm" />
                <Text size="sm" c="#64748b">
                  Đang tải nội dung...
                </Text>
              </Group>
            ) : (
              <Box
                style={{ lineHeight: 1.65 }}
                dangerouslySetInnerHTML={{ __html: postPreview.content || "<p><i>Không có nội dung.</i></p>" }}
              />
            )}
          </Paper>
        </Stack>
      </Modal>
    </Box>
  );
}
