"use client";

import { Loader2 } from "lucide-react";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ForumLayout from "../../../components/ForumLayout";
import PostCard, { type PostCardPost } from "../../../components/PostCard";
import ShareModal from "../../../components/ShareModal";
import { useToast } from "../../../components/Toast";
import { api } from "../../../lib/api";
import { getAuthToken, getStoredUser } from "../../../lib/auth-storage";

interface Category {
  id: number;
  documentId: string;
  name: string;
  description: string;
  slug?: string;
  parent?: { id?: number } | null;
  children?: Category[];
}

interface Post extends PostCardPost {
  status: string;
}

type FeedSummaryMap = Record<string, { likes?: number; comments?: number }>;

const PAGE_SIZE = 10;

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

const toCategorySlug = (category: Category) => category.slug || normalizeSlug(category.name);

const formatCategoryTitle = (name: string) =>
  name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const resolveCurrentUserId = (): number | null => {
  const parsed = getStoredUser<{ id?: number }>();
  return typeof parsed?.id === "number" ? parsed.id : null;
};

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const categorySlug = resolvedParams.slug;

  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isFollowingCategory, setIsFollowingCategory] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [sharePost, setSharePost] = useState<PostCardPost | null>(null);
  const { showToast, ToastContainer } = useToast();

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrentUserId(resolveCurrentUserId());
  }, []);

  const selectedCategoryIds = useMemo(() => {
    if (!selectedCategory) return [] as number[];

    const childrenByParent = new Map<number, number[]>();
    for (const category of allCategories) {
      const parentId = category.parent?.id;
      if (!parentId) continue;
      const list = childrenByParent.get(parentId) || [];
      list.push(category.id);
      childrenByParent.set(parentId, list);
    }

    const collected = new Set<number>();
    const stack = [selectedCategory.id];
    while (stack.length > 0) {
      const currentId = stack.pop() as number;
      if (collected.has(currentId)) continue;
      collected.add(currentId);
      const children = childrenByParent.get(currentId) || [];
      for (const childId of children) {
        if (!collected.has(childId)) stack.push(childId);
      }
    }

    return Array.from(collected);
  }, [allCategories, selectedCategory]);

  const subCategories = useMemo(() => {
    if (!selectedCategory) return [] as Category[];

    if (Array.isArray(selectedCategory.children) && selectedCategory.children.length > 0) {
      return selectedCategory.children;
    }

    return allCategories.filter((cat) => cat.parent?.id === selectedCategory.id);
  }, [allCategories, selectedCategory]);

  const fetchCategories = useCallback(async () => {
    const categoriesRes = await api.get("/api/categories", {
      params: {
        sort: ["sortOrder:asc", "name:asc"],
        populate: {
          parent: true,
          children: true,
        },
      },
    });

    const fetchedCategories = categoriesRes.data?.data || [];
    const rootCategories = fetchedCategories.filter((cat: Category) => !cat?.parent?.id);

    setAllCategories(fetchedCategories);
    setCategories(rootCategories);

    const matchedCategory = fetchedCategories.find(
      (cat: Category) => cat.slug === categorySlug || normalizeSlug(cat.name) === categorySlug
    );

    setSelectedCategory(matchedCategory || null);
    return matchedCategory || null;
  }, [categorySlug]);

  const fetchCategoryFollowSummary = useCallback(async (categoryId: number) => {
    try {
      const effectiveUserId = currentUserId ?? resolveCurrentUserId();
      const followCacheKey =
        effectiveUserId !== null ? `category-follow:${effectiveUserId}:${categoryId}` : null;

      if (followCacheKey) {
        const cached = localStorage.getItem(followCacheKey);
        if (cached === "1") {
          setIsFollowingCategory(true);
        } else if (cached === "0") {
          setIsFollowingCategory(false);
        }
      }

      const jwt = getAuthToken();
      const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;

      const summaryRes = await api.get("/api/category-actions/summary", {
        params: { categoryId },
        headers,
      });

      const summary = summaryRes.data?.data;
      if (typeof summary?.count === "number") {
        setFollowersCount(summary.count);
      }
      if (typeof summary?.myAction !== "undefined") {
        setIsFollowingCategory(Boolean(summary.myAction));
      }

      if (followCacheKey) {
        localStorage.setItem(followCacheKey, summary?.myAction ? "1" : "0");
      }
    } catch (error) {
      console.error("Failed to fetch category follow summary:", error);
    }
  }, [currentUserId]);

  const fetchPostsByCategory = useCallback(
    async (targetPage: number, append: boolean, categoryIds: number[]) => {
      const response = await api.get("/api/posts", {
        params: {
          sort: "createdAt:desc",
          populate: {
            categories: true,
            tags: true,
            author: {
              fields: ["id", "username"],
            },
          },
          filters: {
            categories: {
              id: {
                $in: categoryIds,
              },
            },
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
            params: {
              postIds: postIds.join(","),
            },
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
          likesCount: typeof summary?.likes === "number" ? summary.likes : 0,
          commentsCount: typeof summary?.comments === "number" ? summary.comments : 0,
        };
      });
      const pagination = response.data?.meta?.pagination;

      setPosts((prev) => (append ? [...prev, ...normalizedPosts] : normalizedPosts));
      setPage(targetPage);

      if (pagination?.pageCount) {
        setHasMore(targetPage < pagination.pageCount);
      } else {
        setHasMore(fetchedPosts.length === PAGE_SIZE);
      }
    },
    []
  );

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setPosts([]);
      setPage(1);
      setHasMore(true);

      try {
        const matchedCategory = await fetchCategories();

        if (!matchedCategory) {
          setHasMore(false);
          return;
        }

        await fetchCategoryFollowSummary(matchedCategory.id);
      } catch (error) {
        console.error("Failed to fetch category page data:", error);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [fetchCategories, fetchCategoryFollowSummary, fetchPostsByCategory]);

  const loadMorePosts = useCallback(async () => {
    if (loading || loadingMore || !hasMore || selectedCategoryIds.length === 0) return;

    setLoadingMore(true);
    try {
      await fetchPostsByCategory(page + 1, true, selectedCategoryIds);
    } catch (error) {
      console.error("Failed to load more category posts:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPostsByCategory, hasMore, loading, loadingMore, page, selectedCategoryIds]);

  useEffect(() => {
    if (!selectedCategory || selectedCategoryIds.length === 0 || loading) return;
    fetchPostsByCategory(1, false, selectedCategoryIds).catch((error) => {
      console.error("Failed to refresh category posts with descendants:", error);
    });
  }, [fetchPostsByCategory, loading, selectedCategory, selectedCategoryIds]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMorePosts();
        }
      },
      { rootMargin: "280px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMorePosts]);

  const toggleFollowCategory = async () => {
    if (!selectedCategory) return;

    const jwt = getAuthToken();
    if (!jwt) {
      showToast("Please sign in to follow this category", "error");
      return;
    }

    try {
      const response = await api.post(
        "/api/category-actions/toggle",
        {
          data: {
            actionType: "follow",
            categoryId: selectedCategory.id,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );

      const action = response.data?.data;
      const nextFollowing = Boolean(action?.active);
      setIsFollowingCategory(nextFollowing);
      setFollowersCount(action?.count ?? 0);
      showToast(nextFollowing ? "Followed category" : "Unfollowed category", "success");

      const effectiveUserId = currentUserId ?? resolveCurrentUserId();
      if (effectiveUserId !== null) {
        localStorage.setItem(`category-follow:${effectiveUserId}:${selectedCategory.id}`, nextFollowing ? "1" : "0");
      }
    } catch (error) {
      console.error("Failed to follow/unfollow category:", error);
      showToast("Failed to update follow status", "error");
    }
  };

  const formatDate = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <ForumLayout categories={categories}>
      <ToastContainer />
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-sm border border-slate-300 bg-white p-12 text-center dark:border-slate-700/35 dark:bg-slate-900">
            <div className="text-slate-500 dark:text-slate-400">Loading...</div>
          </div>
        ) : !selectedCategory ? (
          <div className="rounded-sm border border-slate-300 bg-white p-12 text-center dark:border-slate-700/35 dark:bg-slate-900">
            <p className="text-slate-500 dark:text-slate-400">This category does not exist.</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-sm border border-slate-300 bg-white p-12 text-center dark:border-slate-700/35 dark:bg-slate-900">
            <p className="text-slate-500 dark:text-slate-400">No posts in this category yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Category</div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {selectedCategory ? (
                      <>
                        {`c/${formatCategoryTitle(selectedCategory.name)}`}{" "}
                        <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{`(following: ${followersCount})`}</span>
                      </>
                    ) : (
                      "Category not found"
                    )}
                  </h1>
                  {selectedCategory?.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">{selectedCategory.description}</p>
                  )}
                </div>
                {selectedCategory && (
                  <button
                    onClick={toggleFollowCategory}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isFollowingCategory
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700/35 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {isFollowingCategory ? "Following" : "Follow"}
                  </button>
                )}
              </div>

              {selectedCategory && subCategories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {subCategories.map((subCategory) => (
                    <Link
                      key={subCategory.id}
                      href={`/c/${toCategorySlug(subCategory)}`}
                      className="rounded-md border border-slate-300/70 px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700/35 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                    >
                      c/{formatCategoryTitle(subCategory.name)}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200" />

            <div className="divide-y divide-slate-200">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  formatDate={formatDate}
                  categoryPrefix="c"
                  formatCategoryTitle={formatCategoryTitle}
                  onShare={(targetPost) => setSharePost(targetPost)}
                />
              ))}

              <div ref={sentinelRef} className="py-3 text-center">
                {loadingMore && (
                  <span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 size={15} className="animate-spin" />
                    Loading more posts...
                  </span>
                )}
                {!hasMore && posts.length > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">You have reached the end.</span>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      <ShareModal post={sharePost} onClose={() => setSharePost(null)} />
    </ForumLayout>
  );
}
