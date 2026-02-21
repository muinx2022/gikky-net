"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import ForumLayout from "../../../components/ForumLayout";
import ConfirmModal from "../../../components/ConfirmModal";
import { useToast } from "../../../components/Toast";
import { Shield, FolderTree, FileText, Check, X, Flag, ExternalLink, ChevronLeft, ChevronRight, MessageSquareOff, EyeOff } from "lucide-react";
import { getAuthToken, getStoredUser } from "../../../lib/auth-storage";

interface Category {
  id: number;
  documentId: string;
  name: string;
  slug: string;
}

interface Post {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  status: string;
  moderationStatus?: string | null;
  createdAt: string;
  author?: {
    id: number;
    username: string;
  };
  categories?: Category[];
}

interface ModeratorCategory {
  id: number;
  documentId: string;
  actionType?: string;
  status?: string;
  category: Category;
}

interface Report {
  id: number;
  reason: string;
  detail?: string | null;
  status: string;
  createdAt: string;
  post?: { id: number; documentId: string; title: string; author?: { id: number; username: string } } | null;
  comment?: { id: number; documentId: string; content: string; author?: { id: number; username: string } } | null;
  reportedBy?: { id: number; username: string } | null;
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("vi-VN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getModerationStatusBadge = (moderationStatus?: string | null) => {
  if (!moderationStatus) {
    return (
      <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
        Đã duyệt
      </span>
    );
  }
  if (moderationStatus === "block-comment") {
    return (
      <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
        Khóa bình luận
      </span>
    );
  }
  if (moderationStatus === "delete") {
    return (
      <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
        Đã ẩn
      </span>
    );
  }
  return null;
};

interface PostDetail extends Post {
  content: string;
}

const POSTS_PAGE_SIZE = 10;

export default function ModeratorPage() {
  const [moderatorCategories, setModeratorCategories] = useState<ModeratorCategory[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postPage, setPostPage] = useState(1);
  const [postPageCount, setPostPageCount] = useState(1);
  const [postTotal, setPostTotal] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [postDetail, setPostDetail] = useState<PostDetail | null>(null);
  const [postDetailLoading, setPostDetailLoading] = useState(false);
  const [postDetailOpen, setPostDetailOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmColor: "red" | "orange" | "green";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    confirmColor: "red",
    onConfirm: () => {},
  });
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser(user);
      fetchModeratorData();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchModeratorData = async () => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;

      const categoriesRes = await api.get(`/api/category-actions/my-moderated`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const allModCategories = (categoriesRes.data?.data || []) as ModeratorCategory[];
      const modCategories = allModCategories.filter((modCat) => Boolean(modCat.category));

      setModeratorCategories(modCategories);

      const firstCategory = modCategories[0];
      if (firstCategory?.category) {
        setSelectedCategory(firstCategory.category.documentId);
        await fetchPostsForCategory(firstCategory.category.id, 1);
        await fetchReportsForCategory(firstCategory.category.id);
      }
    } catch (error) {
      console.error("Failed to fetch moderator data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportsForCategory = async (categoryId: number) => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;
      const reportsRes = await api.get(`/api/reports/mod-queue?categoryId=${categoryId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      setReports(reportsRes.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    }
  };

  const fetchPostsForCategory = async (categoryId: number, targetPage: number = 1) => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;
      const postsRes = await api.get(`/api/posts/moderator/list`, {
        params: {
          categoryId,
          page: targetPage,
          pageSize: POSTS_PAGE_SIZE,
        },
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const fetchedPosts = (postsRes.data?.data || []) as Post[];
      const pagination = postsRes.data?.meta?.pagination;
      setPosts(fetchedPosts);
      setPostPage(Number(pagination?.page) || targetPage);
      setPostPageCount(Number(pagination?.pageCount) || 1);
      setPostTotal(Number(pagination?.total) || fetchedPosts.length);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    }
  };

  const handleCategoryChange = async (categoryDocId: string) => {
    setSelectedCategory(categoryDocId);
    const category = moderatorCategories.find((m) => m.category.documentId === categoryDocId);
    if (category) {
      await fetchPostsForCategory(category.category.id, 1);
      await fetchReportsForCategory(category.category.id);
    }
  };

  const refreshData = async () => {
    if (selectedCategory) {
      const category = moderatorCategories.find((m) => m.category.documentId === selectedCategory);
      if (category) {
        await fetchPostsForCategory(category.category.id, postPage);
        await fetchReportsForCategory(category.category.id);
      }
    }
  };

  const handlePostsPageChange = async (nextPage: number) => {
    if (!selectedCategory) return;
    const category = moderatorCategories.find((m) => m.category.documentId === selectedCategory);
    if (!category) return;
    await fetchPostsForCategory(category.category.id, nextPage);
  };

  const openPostDetail = async (documentId: string) => {
    setPostDetailOpen(true);
    setPostDetailLoading(true);
    setPostDetail(null);
    try {
      const jwt = getAuthToken();
      if (!jwt) return;
      const res = await api.get(`/api/posts/moderator/detail/${documentId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      setPostDetail(res.data?.data || null);
    } catch {
      showToast("Không thể tải nội dung bài viết", "error");
      setPostDetailOpen(false);
    } finally {
      setPostDetailLoading(false);
    }
  };

  const handleDismissReport = async (reportId: number) => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;
      await api.patch(`/api/reports/${reportId}/dismiss`, {}, { headers: { Authorization: `Bearer ${jwt}` } });
      showToast("Đã bác bỏ báo cáo", "success");
      await refreshData();
    } catch {
      showToast("Thao tác thất bại", "error");
    }
  };

  const executeApprove = async (postId: string) => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;
      await api.post(`/api/posts/${postId}/approve`, {}, { headers: { Authorization: `Bearer ${jwt}` } });
      showToast("Đã duyệt bài viết thành công", "success");
      await refreshData();
    } catch {
      showToast("Duyệt bài thất bại", "error");
    } finally {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const executeReject = async (postId: string) => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;
      await api.post(`/api/posts/${postId}/reject`, {}, { headers: { Authorization: `Bearer ${jwt}` } });
      showToast("Đã khóa bình luận thành công", "success");
      await refreshData();
    } catch {
      showToast("Khóa bình luận thất bại", "error");
    } finally {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const executeHide = async (postId: string) => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;
      await api.post(`/api/posts/${postId}/hide`, {}, { headers: { Authorization: `Bearer ${jwt}` } });
      showToast("Đã ẩn bài viết thành công", "success");
      await refreshData();
    } catch {
      showToast("Ẩn bài thất bại", "error");
    } finally {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleApprove = (postId: string, postTitle: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Duyệt bài viết",
      message: `Bạn có chắc muốn duyệt "${postTitle}"? Bài viết sẽ được hiển thị và cho phép bình luận.`,
      confirmText: "Duyệt",
      confirmColor: "green",
      onConfirm: () => executeApprove(postId),
    });
  };

  const handleReject = (postId: string, postTitle: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Khóa bình luận",
      message: `Bạn có chắc muốn khóa bình luận trên "${postTitle}"?`,
      confirmText: "Khóa bình luận",
      confirmColor: "orange",
      onConfirm: () => executeReject(postId),
    });
  };

  const handleHide = (postId: string, postTitle: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Ẩn bài viết",
      message: `Bạn có chắc muốn ẩn "${postTitle}"? Bài viết sẽ bị xóa khỏi tầm nhìn công khai.`,
      confirmText: "Ẩn bài",
      confirmColor: "red",
      onConfirm: () => executeHide(postId),
    });
  };

  if (loading) {
    return (
      <ForumLayout>
        <div className="w-full">
          <div className="rounded border border-slate-300 bg-white p-4 md:p-6 dark:border-slate-700/35 dark:bg-slate-900">
            <p className="text-slate-600 dark:text-slate-400">Đang tải...</p>
          </div>
        </div>
      </ForumLayout>
    );
  }

  if (!currentUser) {
    return (
      <ForumLayout>
        <div className="w-full">
          <div className="rounded border border-slate-300 bg-white p-4 md:p-6 dark:border-slate-700/35 dark:bg-slate-900">
            <p className="text-slate-600 dark:text-slate-400">Vui lòng đăng nhập để truy cập bảng kiểm duyệt.</p>
          </div>
        </div>
      </ForumLayout>
    );
  }

  if (moderatorCategories.length === 0) {
    return (
      <ForumLayout>
        <div className="w-full">
          <div className="rounded border border-slate-300 bg-white p-4 md:p-6 dark:border-slate-700/35 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <Shield size={20} className="text-slate-500 dark:text-slate-400" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bảng kiểm duyệt</h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              Bạn chưa là kiểm duyệt viên của bất kỳ danh mục nào. Liên hệ quản trị viên để trở thành kiểm duyệt viên.
            </p>
          </div>
        </div>
      </ForumLayout>
    );
  }

  return (
    <ForumLayout>
      <ToastContainer />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmColor={confirmModal.confirmColor}
      />

      {/* Post detail modal */}
      {postDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-28">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setPostDetailOpen(false); setPostDetail(null); }} />
          <div className="relative flex w-full max-w-2xl flex-col rounded border border-slate-300 bg-white dark:border-slate-700/35 dark:bg-slate-900" style={{ maxHeight: "calc(100vh - 8rem)" }}>
            {postDetailLoading ? (
              <div className="p-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">Đang tải nội dung...</p>
              </div>
            ) : postDetail ? (
              <>
                {/* Fixed header */}
                <div className="shrink-0 border-b border-slate-200 p-4 dark:border-slate-700/35">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{postDetail.title}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>Bởi {postDetail.author?.username || "Ẩn danh"}</span>
                        <span>|</span>
                        <span>{formatDate(postDetail.createdAt)}</span>
                        <span>|</span>
                        {getModerationStatusBadge(postDetail.moderationStatus)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={`/p/${postDetail.slug}--${postDetail.documentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <ExternalLink size={13} />
                        Xem
                      </a>
                      <button
                        onClick={() => { setPostDetailOpen(false); setPostDetail(null); }}
                        className="inline-flex items-center justify-center rounded px-2.5 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scrollable content */}
                <div
                  className="min-h-0 flex-1 overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none text-sm text-slate-800 dark:text-slate-200"
                  dangerouslySetInnerHTML={{ __html: postDetail.content || "" }}
                />

                {/* Fixed footer actions */}
                <div className="shrink-0 flex flex-wrap items-center gap-2 border-t border-slate-200 p-4 dark:border-slate-700/35">
                  <button
                    onClick={() => { handleApprove(postDetail.documentId, postDetail.title); setPostDetailOpen(false); setPostDetail(null); }}
                    title="Duyệt"
                    aria-label="Duyệt"
                    className="inline-flex h-8 w-8 items-center justify-center rounded transition bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => { handleReject(postDetail.documentId, postDetail.title); setPostDetailOpen(false); setPostDetail(null); }}
                    title="Khóa bình luận"
                    aria-label="Khóa bình luận"
                    className="inline-flex h-8 w-8 items-center justify-center rounded transition bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
                  >
                    <MessageSquareOff size={14} />
                  </button>
                  <button
                    onClick={() => { handleHide(postDetail.documentId, postDetail.title); setPostDetailOpen(false); setPostDetail(null); }}
                    title="Ẩn bài"
                    aria-label="Ẩn bài"
                    className="inline-flex h-8 w-8 items-center justify-center rounded transition bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                  >
                    <EyeOff size={14} />
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div className="w-full">
        <div className="rounded border border-slate-300 bg-white p-4 md:p-6 dark:border-slate-700/35 dark:bg-slate-900">
          {/* Header */}
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <Shield size={20} className="text-slate-500 dark:text-slate-400" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bảng kiểm duyệt</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Quản lý bài viết trong danh mục của bạn</p>
          </div>

          {/* Category tabs */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <FolderTree size={15} />
              Danh mục của bạn
            </div>
            <div className="flex flex-wrap gap-2">
              {moderatorCategories.map((modCategory) =>
                modCategory.category ? (
                  <button
                    key={modCategory.id}
                    onClick={() => handleCategoryChange(modCategory.category.documentId)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                      selectedCategory === modCategory.category.documentId
                        ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                >
                  {modCategory.category.name}
                </button>
              ) : null
            )}
            </div>
          </div>

          {/* Reports */}
          {reports.length > 0 && (
            <div className="mb-5">
              <div className="mb-3 flex items-center gap-2">
                <Flag size={15} className="text-red-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Báo cáo chờ xử lý
                  <span className="ml-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {reports.length}
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-slate-300 dark:divide-slate-700/35">
                {reports.map((report) => {
                  const target = report.post
                    ? `Bài viết: ${report.post.title}`
                    : `Bình luận: ${(report.comment?.content || "").replace(/<[^>]+>/g, "").trim().slice(0, 60)}`;
                  const author = report.post?.author || report.comment?.author;
                  return (
                    <div key={report.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{target}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>Tác giả: {author?.username || "Ẩn danh"}</span>
                          <span>•</span>
                          <span>Báo cáo bởi: {report.reportedBy?.username || "Ẩn danh"}</span>
                          {report.detail && (
                            <>
                              <span>•</span>
                              <span className="italic">{report.detail}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDismissReport(report.id)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <X size={13} />
                        Bác bỏ
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Posts */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <FileText size={15} className="text-slate-500 dark:text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Bài viết
                <span className="ml-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {postTotal}
                </span>
              </h2>
            </div>

            {posts.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có bài viết trong danh mục này.</p>
            ) : (
              <div className="divide-y divide-slate-300 dark:divide-slate-700/35">
                {posts.map((post) => (
                  <div key={post.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <button
                        onClick={() => openPostDetail(post.documentId)}
                        className="text-left text-base font-semibold text-slate-900 hover:underline dark:text-slate-100 break-words"
                      >
                        {post.title}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>Bởi {post.author?.username || "Ẩn danh"}</span>
                        <span>|</span>
                        <span>{formatDate(post.createdAt)}</span>
                        <span>|</span>
                        {getModerationStatusBadge(post.moderationStatus)}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleApprove(post.documentId, post.title)}
                        title="Duyệt"
                        aria-label="Duyệt"
                        className="inline-flex h-8 w-8 items-center justify-center rounded transition bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => handleReject(post.documentId, post.title)}
                        title="Khóa bình luận"
                        aria-label="Khóa bình luận"
                        className="inline-flex h-8 w-8 items-center justify-center rounded transition bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
                      >
                        <MessageSquareOff size={14} />
                      </button>
                      <button
                        onClick={() => handleHide(post.documentId, post.title)}
                        title="Ẩn bài"
                        aria-label="Ẩn bài"
                        className="inline-flex h-8 w-8 items-center justify-center rounded transition bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                      >
                        <EyeOff size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {postPageCount > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => handlePostsPageChange(postPage - 1)}
                  disabled={postPage <= 1}
                  title="Trang trước"
                  className="inline-flex items-center rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/35 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {postPage}/{postPageCount}
                </span>
                <button
                  onClick={() => handlePostsPageChange(postPage + 1)}
                  disabled={postPage >= postPageCount}
                  title="Trang sau"
                  className="inline-flex items-center rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/35 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ForumLayout>
  );
}
