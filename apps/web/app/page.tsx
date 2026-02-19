"use client";

import { Loader2, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ForumLayout from "../components/ForumLayout";
import PostCard, { type PostCardPost } from "../components/PostCard";
import ShareModal from "../components/ShareModal";
import { api } from "../lib/api";
import { setPageMeta, SITE_NAME } from "../lib/meta";

interface Post extends PostCardPost {
  status: string;
}

type FeedSummaryMap = Record<string, { upvotes?: number; downvotes?: number; comments?: number; score?: number }>;

interface Category {
  id: number;
  documentId: string;
  name: string;
  description: string;
  slug?: string;
  parent?: { id?: number } | null;
}

interface StaticPage {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string;
  ftType: "front" | "footer";
}

const PAGE_SIZE = 10;

export default function ForumPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sharePost, setSharePost] = useState<PostCardPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [frontPage, setFrontPage] = useState<StaticPage | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchCategories = useCallback(async () => {
    const categoriesRes = await api.get("/api/categories", {
      params: {
        sort: ["sortOrder:asc", "name:asc"],
        populate: "parent",
        filters: { parent: { $null: true } },
      },
    });

    let rootCategories = categoriesRes.data?.data || [];

    if (rootCategories.length === 0) {
      const allCategoriesRes = await api.get("/api/categories", {
        params: {
          sort: ["sortOrder:asc", "name:asc"],
          populate: "parent",
        },
      });
      const allCategories = allCategoriesRes.data?.data || [];
      rootCategories = allCategories.filter((category: Category) => !category?.parent?.id);
    }

    setCategories(rootCategories);
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
        pagination: {
          page: targetPage,
          pageSize: PAGE_SIZE,
        },
      },
    });

    const fetchedPosts = response.data?.data || [];
    const postIds = fetchedPosts.map((post: Post) => post.id).filter((id: number) => Number.isFinite(id));
    let summaryMap: FeedSummaryMap = {};

    if (postIds.length > 0) {
      try {
        const summaryRes = await api.get("/api/post-actions/feed-summary", {
          params: { postIds: postIds.join(",") },
        });
        summaryMap = summaryRes.data?.data || {};
      } catch (error) {
        console.error("Failed to fetch feed summary:", error);
      }
    }

    const normalizedPosts: Post[] = fetchedPosts.map((post: Post) => {
      const summary = summaryMap[String(post.id)];
      return {
        ...post,
        upvotesCount: typeof summary?.upvotes === "number" ? summary.upvotes : 0,
        downvotesCount: typeof summary?.downvotes === "number" ? summary.downvotes : 0,
        commentsCount: typeof summary?.comments === "number" ? summary.comments : 0,
        score: typeof summary?.score === "number" ? summary.score : 0,
      };
    });

    const pagination = response.data?.meta?.pagination;
    setPosts((previous) => (append ? [...previous, ...normalizedPosts] : normalizedPosts));
    setPage(targetPage);

    if (pagination?.pageCount) {
      setHasMore(targetPage < pagination.pageCount);
    } else {
      setHasMore(fetchedPosts.length === PAGE_SIZE);
    }
  }, []);

  const fetchFrontPage = useCallback(async () => {
    const response = await api.get("/api/pages", {
      params: {
        sort: ["updatedAt:desc", "createdAt:desc"],
        filters: {
          ftType: {
            $eq: "front",
          },
        },
        pagination: {
          page: 1,
          pageSize: 1,
        },
        status: "published",
      },
    });

    const entry = response.data?.data?.[0] || null;
    setFrontPage(entry);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await Promise.all([fetchCategories(), fetchPosts(1, false), fetchFrontPage()]);
      } catch (error) {
        console.error("Failed to fetch home data:", error);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [fetchCategories, fetchFrontPage, fetchPosts]);

  useEffect(() => {
    const desc = "Gikky là nơi chia sẻ kiến thức, thảo luận chuyên sâu và kinh nghiệm giao dịch từ cộng đồng.";
    if (frontPage?.title) {
      setPageMeta(frontPage.title, desc);
    } else {
      document.title = SITE_NAME + " - Cộng đồng chia sẻ kiến thức";
    }
  }, [frontPage]);

  const loadMorePosts = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await fetchPosts(page + 1, true);
    } catch (error) {
      console.error("Failed to load more posts:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPosts, hasMore, loading, loadingMore, page]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMorePosts();
      },
      { rootMargin: "280px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMorePosts]);

  const formatDate = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;

    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = String(date.getFullYear());
    return date.getFullYear() === now.getFullYear() ? `${dd}/${mm}` : `${dd}/${mm}/${yyyy}`;
  };

  return (
    <ForumLayout categories={categories}>
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700/35 dark:bg-slate-900">
            <div className="text-slate-500 dark:text-slate-400">Đang tải...</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700/35 dark:bg-slate-900">
            <p className="text-slate-500 dark:text-slate-400">Chưa có bài viết.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700/35 dark:bg-slate-900">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#dbeafe] text-[#3b82f6] dark:bg-blue-900/40 dark:text-blue-400">
                <MessageSquare size={20} />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">{frontPage?.title || "Community"}</h1>
            </div>

            <div className="space-y-4 px-5 pb-5">
              {frontPage?.content ? (
                <div
                  className="max-w-none text-[15px] leading-7 text-slate-700 dark:text-slate-300 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400"
                  dangerouslySetInnerHTML={{ __html: frontPage.content }}
                />
              ) : (
                <p className="text-[15px] leading-7 text-slate-700 dark:text-slate-300">Chưa có nội dung giới thiệu cộng đồng.</p>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700/35" />

            <div className="divide-y divide-slate-200 dark:divide-slate-700/35">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  formatDate={formatDate}
                  categoryPrefix="c"
                  onShare={(targetPost) => setSharePost(targetPost)}
                />
              ))}

              <div ref={sentinelRef} className="py-3 text-center">
                {loadingMore && (
                  <span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 size={15} className="animate-spin" />
                    Đang tải thêm...
                  </span>
                )}
                {!hasMore && posts.length > 0 && <span className="text-xs text-slate-400 dark:text-slate-500">Bạn đã đến cuối.</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      <ShareModal post={sharePost} onClose={() => setSharePost(null)} />
    </ForumLayout>
  );
}

