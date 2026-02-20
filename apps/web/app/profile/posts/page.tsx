"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
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
              {posts.map((post) => (
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
                          className="rounded bg-amber-600 px-2 py-1 font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {publishingPostId === post.documentId ? "Đang hiển thị..." : "Hiển thị bài viết ngay"}
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
                        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {draftingPostId === post.documentId ? "Đang chuyển..." : "Chuyển về bài nháp"}
                      </button>
                    ) : null}
                    <Link
                      href={`/p/${post.slug}--${post.documentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      <Eye size={14} />
                      Xem
                    </Link>
                    {post.moderationStatus === "delete" ? (
                      <span className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <Pencil size={14} />
                        Không thể sửa
                      </span>
                    ) : (
                      <Link
                        href={`/profile/posts/${post.documentId}/edit`}
                        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                      >
                        <Pencil size={14} />
                        Sửa
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </ForumLayout>
  );
}

