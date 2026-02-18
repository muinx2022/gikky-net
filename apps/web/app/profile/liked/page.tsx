"use client";

import { useCallback, useEffect, useState } from "react";
import ForumLayout from "../../../components/ForumLayout";
import PostCard, { type PostCardPost } from "../../../components/PostCard";
import ShareModal from "../../../components/ShareModal";
import { api } from "../../../lib/api";
import { getAuthToken } from "../../../lib/auth-storage";

interface Category {
  id: number;
  documentId: string;
  name: string;
  description: string;
  slug?: string;
  parent?: { id: number } | null;
}

interface Post extends PostCardPost {
  status: string;
}

type FeedSummaryMap = Record<string, { upvotes?: number; downvotes?: number; comments?: number; score?: number }>;

export default function SavedPostsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [sharePost, setSharePost] = useState<PostCardPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCategories = useCallback(async () => {
    const categoriesRes = await api.get("/api/categories", {
      params: {
        sort: ["sortOrder:asc", "name:asc"],
        populate: "parent",
        filters: {
          parent: {
            $null: true,
          },
        },
      },
    });

    const rootCategories = categoriesRes.data?.data || [];
    setCategories(rootCategories);
  }, []);

  const fetchSavedPosts = useCallback(async () => {
    const jwt = getAuthToken();
    if (!jwt) {
      setError("Vui lòng đăng nhập để xem bài viết đã lưu.");
      return;
    }

    const meRes = await api.get("/api/users/me", {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const me = meRes.data as { id?: number };
    if (!me?.id) {
      setError("Không thể xác định người dùng hiện tại.");
      return;
    }

    const response = await api.get("/api/posts", {
      params: {
        sort: "createdAt:desc",
        populate: {
          categories: true,
          author: {
            fields: ["id", "username"],
            populate: { avatar: true },
          },
        },
        filters: {
          post_actions: {
            actionType: { $eq: "follow" },
            targetType: { $eq: "post" },
            user: { id: { $eq: me.id } },
          },
        },
      },
      headers: { Authorization: `Bearer ${jwt}` },
    });

    const fetchedPosts = (response.data?.data || []) as Post[];
    const postIds = fetchedPosts.map((post) => post.id).filter((id) => Number.isFinite(id));
    let summaryMap: FeedSummaryMap = {};

    if (postIds.length > 0) {
      try {
        const summaryRes = await api.get("/api/post-actions/feed-summary", {
          params: { postIds: postIds.join(",") },
        });
        summaryMap = summaryRes.data?.data || {};
      } catch (summaryError) {
        console.error("Failed to fetch saved feed summary:", summaryError);
      }
    }

    const normalizedPosts: Post[] = fetchedPosts.map((post) => {
      const summary = summaryMap[String(post.id)];
      return {
        ...post,
        upvotesCount: typeof summary?.upvotes === "number" ? summary.upvotes : 0,
        downvotesCount: typeof summary?.downvotes === "number" ? summary.downvotes : 0,
        commentsCount: typeof summary?.comments === "number" ? summary.comments : 0,
        score: typeof summary?.score === "number" ? summary.score : 0,
      };
    });

    setPosts(normalizedPosts);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        await Promise.all([fetchCategories(), fetchSavedPosts()]);
      } catch (err: any) {
        setError(err?.response?.data?.error?.message || err?.message || "Tải bài viết đã lưu thất bại.");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [fetchCategories, fetchSavedPosts]);

  const formatDate = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <ForumLayout categories={categories}>
      <div className="pt-5 md:pt-6 space-y-3">
        <div className="rounded border border-slate-300 bg-white px-4 py-3 dark:border-slate-700/35 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bài viết đã lưu</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Bài viết bạn đang theo dõi.</p>
        </div>

        {loading ? (
          <div className="rounded-sm border border-slate-300 bg-white p-12 text-center dark:border-slate-700/35 dark:bg-slate-900">
            <div className="text-slate-500 dark:text-slate-400">Đang tải...</div>
          </div>
        ) : error ? (
          <div className="rounded-sm border border-slate-300 bg-white p-12 text-center dark:border-slate-700/35 dark:bg-slate-900">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-sm border border-slate-300 bg-white p-12 text-center dark:border-slate-700/35 dark:bg-slate-900">
            <p className="text-slate-500 dark:text-slate-400">Chưa có bài viết nào được lưu.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-200">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                formatDate={formatDate}
                categoryPrefix="c"
                onShare={(targetPost) => setSharePost(targetPost)}
              />
            ))}
          </div>
        )}
      </div>

      <ShareModal post={sharePost} onClose={() => setSharePost(null)} />
    </ForumLayout>
  );
}
