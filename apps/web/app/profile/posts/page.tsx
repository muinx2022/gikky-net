"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Eye, Pencil, X } from "lucide-react";
import ForumLayout from "../../../components/ForumLayout";
import { api } from "../../../lib/api";
import { getAuthToken } from "../../../lib/auth-storage";

interface PostItem {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  publishedAt?: string | null;
  moderationStatus?: "block-comment" | "delete" | null;
  createdAt: string;
  updatedAt: string;
}

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString("vi-VN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Bản nháp",
  published: "Đã xuất bản",
  archived: "Đã lưu trữ",
};

const PAGE_SIZE = 10;

const getModerationBadge = (moderationStatus?: "block-comment" | "delete" | null) => {
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

  return (
    <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
      Đã ẩn
    </span>
  );
};

export default function MyPostsPage() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);
  const [draftingPostId, setDraftingPostId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const paginatedPosts = posts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const run = async () => {
      const jwt = getAuthToken();
      if (!jwt) {
        setError("Vui lòng đăng nhập để xem bài viết của bạn.");
        setLoading(false);
        return;
      }

      try {
        const postsRes = await api.get("/api/posts/my", {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        setPosts(postsRes.data?.data || []);
      } catch (err: any) {
        setError(err?.response?.data?.error?.message || err?.message || "Failed to load posts.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const handlePublishNow = async (post: PostItem) => {
    const jwt = getAuthToken();
    if (!jwt) {
      setError("Vui lòng đăng nhập để thực hiện thao tác này.");
      return;
    }

    try {
      setPublishingPostId(post.documentId);
      await api.put(
        `/api/posts/${post.documentId}?status=published`,
        {
          data: {
            status: "published",
          },
        },
        {
          headers: { Authorization: `Bearer ${jwt}` },
        }
      );

      setPosts((prev) =>
        prev.map((item) =>
          item.documentId === post.documentId
            ? { ...item, status: "published", publishedAt: new Date().toISOString() }
            : item
        )
      );
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || "Không thể hiển thị bài viết ngay lúc này.");
    } finally {
      setPublishingPostId(null);
    }
  };

  const handleMoveToDraft = async (post: PostItem) => {
    const jwt = getAuthToken();
    if (!jwt) {
      setError("Vui lòng đăng nhập để thực hiện thao tác này.");
      return;
    }

    try {
      setDraftingPostId(post.documentId);
      await api.put(
        `/api/posts/${post.documentId}`,
        {
          data: {
            status: "draft",
          },
        },
        {
          headers: { Authorization: `Bearer ${jwt}` },
        }
      );

      setPosts((prev) =>
        prev.map((item) =>
          item.documentId === post.documentId
            ? { ...item, status: "draft", publishedAt: null }
            : item
        )
      );
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || "Không thể chuyển bài viết về nháp.");
    } finally {
      setDraftingPostId(null);
    }
  };

  return (
    <ForumLayout>
      <div className="w-full">
        <div className="rounded border border-slate-300 bg-white p-4 md:p-6 dark:border-slate-700/35 dark:bg-slate-900">
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bài viết của tôi</h1>
          </div>

          {loading ? <p className="text-slate-600 dark:text-slate-400">Đang tải...</p> : null}
          {!loading && error ? <p className="text-red-600 text-sm">{error}</p> : null}

          {!loading && !error && posts.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">Chưa có bài viết.</p>
          ) : null}

          {!loading && !error && posts.length > 0 ? (
            <div className="divide-y divide-slate-300 dark:divide-slate-700/35">
              {paginatedPosts.map((post) => (
                <div key={post.documentId} className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 break-words">{post.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{STATUS_LABEL[post.status] ?? post.status}</span>
                      <span>|</span>
                      <span>{formatDate(post.updatedAt)}</span>
                      <span>|</span>
                      {getModerationBadge(post.moderationStatus)}
                    </div>
                    {String(post.status || "").toLowerCase() === "draft" ? (
                      <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                        <span>Bài viết này đang ở dạng nháp, bạn muốn hiển thị với tất cả mọi người không?</span>
                        <button
                          type="button"
                          onClick={() => handlePublishNow(post)}
                          disabled={publishingPostId === post.documentId}
                          title="Hiển thị bài viết ngay"
                          aria-label="Hiển thị bài viết ngay"
                          className="inline-flex h-7 w-7 items-center justify-center rounded bg-amber-600 text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Check size={14} className={publishingPostId === post.documentId ? "animate-pulse" : ""} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {String(post.status || "").toLowerCase() === "published" ? (
                      <button
                        type="button"
                        onClick={() => handleMoveToDraft(post)}
                        disabled={draftingPostId === post.documentId}
                        title="Chuyển về bài nháp"
                        aria-label="Chuyển về bài nháp"
                        className="inline-flex h-8 w-8 items-center justify-center rounded transition bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X size={14} className={draftingPostId === post.documentId ? "animate-pulse" : ""} />
                      </button>
                    ) : null}
                    <Link
                      href={`/p/${post.slug}--${post.documentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Xem bài viết"
                      aria-label="Xem bài viết"
                      className="inline-flex h-8 w-8 items-center justify-center rounded transition bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      <Eye size={14} />
                    </Link>
                    {post.moderationStatus === "delete" ? (
                      <span
                        title="Không thể sửa bài viết đã bị ẩn"
                        aria-label="Không thể sửa bài viết đã bị ẩn"
                        className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      >
                        <Pencil size={14} />
                      </span>
                    ) : (
                      <Link
                        href={`/profile/posts/${post.documentId}/edit`}
                        title="Sửa bài viết"
                        aria-label="Sửa bài viết"
                        className="inline-flex h-8 w-8 items-center justify-center rounded transition bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                      >
                        <Pencil size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!loading && !error && posts.length > 0 && totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                title="Trang trước"
                aria-label="Trang trước"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/35 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {currentPage}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                title="Trang sau"
                aria-label="Trang sau"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/35 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </ForumLayout>
  );
}
