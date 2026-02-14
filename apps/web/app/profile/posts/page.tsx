"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import ForumLayout from "../../../components/ForumLayout";
import { api } from "../../../lib/api";
import { getAuthToken } from "../../../lib/auth-storage";

interface Category {
  id: number;
  documentId: string;
  name: string;
  description: string;
  sortOrder?: number;
  parent?: { id: number; name: string } | null;
}

interface PostItem {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  moderationStatus?: "block-comment" | "delete" | null;
  createdAt: string;
  updatedAt: string;
}

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
};

const getModerationBadge = (moderationStatus?: "block-comment" | "delete" | null) => {
  if (!moderationStatus) {
    return (
      <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
        approved
      </span>
    );
  }

  if (moderationStatus === "block-comment") {
    return (
      <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
        block cmt
      </span>
    );
  }

  return (
    <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
      hidden
    </span>
  );
};

export default function MyPostsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      const jwt = getAuthToken();
      if (!jwt) {
        setError("Please sign in to view your posts.");
        setLoading(false);
        return;
      }

      try {
        const categoriesRes = await api.get("/api/categories", {
          params: {
            sort: ["sortOrder:asc", "name:asc"],
            populate: "parent",
          },
        });
        setCategories(categoriesRes.data?.data || []);

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

  return (
    <ForumLayout categories={categories}>
      <div className="w-full">
        <div className="rounded border border-slate-300 bg-white p-4 md:p-6 dark:border-slate-700/35 dark:bg-slate-900">
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Posts</h1>
          </div>

          {loading ? <p className="text-slate-600 dark:text-slate-400">Loading...</p> : null}
          {!loading && error ? <p className="text-red-600 text-sm">{error}</p> : null}

          {!loading && !error && posts.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">No posts yet.</p>
          ) : null}

          {!loading && !error && posts.length > 0 ? (
            <div className="divide-y divide-slate-300 dark:divide-slate-700/35">
              {posts.map((post) => (
                <div key={post.documentId} className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 break-words">{post.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{post.status}</span>
                      <span>|</span>
                      <span>{formatDate(post.updatedAt)}</span>
                      <span>|</span>
                      {getModerationBadge(post.moderationStatus)}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      href={`/p/${post.slug}--${post.documentId}`}
                      className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      <Eye size={14} />
                      View
                    </Link>
                    {post.moderationStatus === "delete" ? (
                      <span className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <Pencil size={14} />
                        Edit disabled
                      </span>
                    ) : (
                      <Link
                        href={`/profile/posts/${post.documentId}/edit`}
                        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                      >
                        <Pencil size={14} />
                        Edit
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
