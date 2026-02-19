"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ForumLayout from "../../components/ForumLayout";
import PostCard, { type PostCardPost } from "../../components/PostCard";
import ShareModal from "../../components/ShareModal";
import { api } from "../../lib/api";

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

export default function PopularPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sharePost, setSharePost] = useState<PostCardPost | null>(null);
  const [loading, setLoading] = useState(true);

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

    let rootCategories = categoriesRes.data?.data || [];

    if (rootCategories.length === 0) {
      const allCategoriesRes = await api.get("/api/categories", {
        params: {
          sort: ["sortOrder:asc", "name:asc"],
          populate: "parent",
        },
      });
      const allCategories = allCategoriesRes.data?.data || [];
      rootCategories = allCategories.filter((cat: Category) => !cat?.parent?.id);
    }

    setCategories(rootCategories);
  }, []);

  const fetchPopularPosts = useCallback(async () => {
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
        pagination: {
          page: 1,
          pageSize: 200,
        },
      },
    });

    const fetchedPosts: Post[] = response.data?.data || [];
    const postIds = fetchedPosts.map((post) => post.id).filter((id) => Number.isFinite(id));
    let summaryMap: FeedSummaryMap = {};

    if (postIds.length > 0) {
      try {
        const summaryRes = await api.get("/api/post-actions/feed-summary", {
          params: {
            postIds: postIds.join(","),
          },
        });
        summaryMap = summaryRes.data?.data || {};
      } catch (error) {
        console.error("Failed to fetch feed summary:", error);
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

    normalizedPosts.sort((a, b) => {
      // Sort by score first (which includes engagement bonus)
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;

      // Then by comments
      const commentsDiff = (b.commentsCount || 0) - (a.commentsCount || 0);
      if (commentsDiff !== 0) return commentsDiff;

      // Finally by date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setPosts(normalizedPosts);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await Promise.all([fetchCategories(), fetchPopularPosts()]);
      } catch (error) {
        console.error("Failed to fetch popular data:", error);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [fetchCategories, fetchPopularPosts]);

  const formatDate = useMemo(
    () => (dateString: string) => {
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
    },
    []
  );

  return (
    <ForumLayout categories={categories}>
      <div className="space-y-3 pt-5 md:pt-6">
        {loading ? (
          <div className="rounded-sm border border-slate-300 bg-white p-12 text-center dark:border-slate-700/35 dark:bg-slate-900">
            <div className="text-slate-500 dark:text-slate-400">Đang tải...</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-sm border border-slate-300 bg-white p-12 text-center dark:border-slate-700/35 dark:bg-slate-900">
            <p className="text-slate-500 dark:text-slate-400">Chưa có bài viết</p>
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

