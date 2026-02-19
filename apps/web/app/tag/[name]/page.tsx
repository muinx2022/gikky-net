"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Hash } from "lucide-react";
import ForumLayout from "../../../components/ForumLayout";
import PostCard, { type PostCardPost } from "../../../components/PostCard";
import ShareModal from "../../../components/ShareModal";
import { api } from "../../../lib/api";

interface Category {
  id: number;
  documentId: string;
  name: string;
  description: string;
  slug?: string;
  parent?: { id?: number } | null;
}

interface Post extends PostCardPost {
  status: string;
}

type FeedSummaryMap = Record<string, { upvotes?: number; downvotes?: number; comments?: number; score?: number }>;

const PAGE_SIZE = 10;

const formatDate = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return date.toLocaleDateString("vi-VN", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

const formatCategoryTitle = (name: string) =>
  name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

export default function TagPage({ params }: { params: Promise<{ name: string }> }) {
  const resolvedParams = use(params);
  const tagName = decodeURIComponent(resolvedParams.name);

  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sharePost, setSharePost] = useState<PostCardPost | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.get("/api/categories", {
      params: { sort: ["sortOrder:asc", "name:asc"], populate: { parent: true } },
    })
      .then((res) => {
        const all: Category[] = res.data?.data || [];
        setCategories(all.filter((c) => !c.parent?.id));
      })
      .catch(() => {});
  }, []);

  const fetchPosts = useCallback(async (targetPage: number, append: boolean) => {
    const response = await api.get("/api/posts", {
      params: {
        sort: "createdAt:desc",
        populate: {
          categories: true,
          tags: true,
          author: { fields: ["id", "username"], populate: { avatar: true } },
        },
        filters: {
          tags: { name: { $eq: tagName } },
          status: { $eq: "published" },
        },
        pagination: { page: targetPage, pageSize: PAGE_SIZE },
      },
    });

    const fetched: Post[] = response.data?.data || [];
    const postIds = fetched.map((p) => p.id).filter((id) => Number.isFinite(id));
    let summaryMap: FeedSummaryMap = {};

    if (postIds.length > 0) {
      try {
        const summaryRes = await api.get("/api/post-actions/feed-summary", {
          params: { postIds: postIds.join(",") },
        });
        summaryMap = summaryRes.data?.data || {};
      } catch {}
    }

    const normalized: Post[] = fetched.map((post) => {
      const s = summaryMap[String(post.id)];
      return {
        ...post,
        upvotesCount: typeof s?.upvotes === "number" ? s.upvotes : 0,
        downvotesCount: typeof s?.downvotes === "number" ? s.downvotes : 0,
        commentsCount: typeof s?.comments === "number" ? s.comments : 0,
        score: typeof s?.score === "number" ? s.score : 0,
      };
    });

    const pagination = response.data?.meta?.pagination;
    if (targetPage === 1) setTotalPosts(pagination?.total ?? fetched.length);

    setPosts((prev) => (append ? [...prev, ...normalized] : normalized));
    setPage(targetPage);
    setHasMore(pagination?.pageCount ? targetPage < pagination.pageCount : fetched.length === PAGE_SIZE);
  }, [tagName]);

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setPage(1);
    setHasMore(true);
    fetchPosts(1, false).finally(() => setLoading(false));
  }, [fetchPosts]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await fetchPosts(page + 1, true);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPosts, hasMore, loading, loadingMore, page]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "280px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <ForumLayout categories={categories}>
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {/* Header */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <Hash size={20} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tháº»</div>
                  <h1 className="text-xl font-bold text-slate-900">
                    {tagName}
                    <span className="ml-2 text-sm font-normal text-slate-400">{totalPosts} bài viết</span>
                  </h1>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200" />

            {posts.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500">Chưa có bài viết với thẻ này.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    formatDate={formatDate}
                    categoryPrefix="c"
                    formatCategoryTitle={formatCategoryTitle}
                    onShare={(p) => setSharePost(p)}
                  />
                ))}

                <div ref={sentinelRef} className="py-3 text-center">
                  {loadingMore && (
                    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 size={15} className="animate-spin" />
                      Đang tải thêm bài viết...
                    </span>
                  )}
                  {!hasMore && posts.length > 0 && (
                    <span className="text-xs text-slate-400">Bạn đã đến cuối.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ShareModal post={sharePost} onClose={() => setSharePost(null)} />
    </ForumLayout>
  );
}

