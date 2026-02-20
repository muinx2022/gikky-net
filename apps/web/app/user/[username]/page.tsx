"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, User } from "lucide-react";
import ForumLayout from "../../../components/ForumLayout";
import PostCard, { type PostCardPost } from "../../../components/PostCard";
import ShareModal from "../../../components/ShareModal";
import { api, getStrapiURL } from "../../../lib/api";

interface UserProfile {
  id: number;
  username: string;
  bio?: string | null;
  avatar?: { url: string; formats?: { thumbnail?: { url: string } } } | null;
  createdAt?: string | null;
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

const formatJoinDate = (dateString?: string | null) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString("vi-VN", { year: "numeric", month: "long" });
};

export default function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const resolvedParams = use(params);
  const username = decodeURIComponent(resolvedParams.username);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sharePost, setSharePost] = useState<PostCardPost | null>(null);
  const [notFound, setNotFound] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPosts = useCallback(async (targetPage: number, append: boolean, userId: number) => {
    const response = await api.get("/api/posts", {
      params: {
        sort: "createdAt:desc",
        populate: {
          categories: true,
          tags: true,
          author: { fields: ["id", "username"], populate: { avatar: true } },
        },
        filters: {
          author: { id: { $eq: userId } },
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
  }, []);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setPosts([]);
    setPage(1);
    setHasMore(true);

    api.get(`/api/profile/${encodeURIComponent(username)}`)
      .then((res) => {
        const user: UserProfile = res.data;
        setProfile(user);
        return fetchPosts(1, false, user.id);
      })
      .catch((err) => {
        if (err?.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [username, fetchPosts]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || !profile) return;
    setLoadingMore(true);
    try {
      await fetchPosts(page + 1, true, profile.id);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPosts, hasMore, loading, loadingMore, page, profile]);

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

  const avatarUrl = (() => {
    const av = profile?.avatar;
    if (!av) return null;
    const raw = av.formats?.thumbnail?.url || av.url;
    return raw ? (raw.startsWith("http") ? raw : getStrapiURL(raw)) : null;
  })();

  return (
    <ForumLayout>
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-slate-400" />
          </div>
        ) : notFound ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-500">Không tìm thấy người dùng.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {/* Profile header */}
            <div className="px-5 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100">
                  {avatarUrl
                    ? <img src={avatarUrl} alt={profile?.username} className="h-full w-full object-cover" />
                    : <User size={28} className="text-blue-400" />
                  }
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{profile?.username}</h1>
                  {profile?.bio && (
                    <p className="mt-0.5 text-sm text-slate-500">{profile.bio}</p>
                  )}
                  {profile?.createdAt && (
                    <p className="mt-1 text-xs text-slate-400">Tham gia {formatJoinDate(profile.createdAt)}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 px-5 py-3">
              <span className="text-sm text-slate-500">{totalPosts} bài viết</span>
            </div>

            <div className="border-t border-slate-200" />

            {posts.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500">Chưa có bài viết nào.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    formatDate={formatDate}
                    categoryPrefix="c"
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
