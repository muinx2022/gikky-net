"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import ForumLayout from "../../../components/ForumLayout";
import ConfirmModal from "../../../components/ConfirmModal";
import { useToast } from "../../../components/Toast";
import { Shield, FolderTree, FileText, Check, X, Trash2 } from "lucide-react";
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

export default function ModeratorPage() {
  const [moderatorCategories, setModeratorCategories] = useState<ModeratorCategory[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
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

      // Fetch categories where user is a moderator
      const categoriesRes = await api.get(`/api/category-actions/my-moderated`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const allModCategories = (categoriesRes.data?.data || []) as ModeratorCategory[];

      const modCategories = allModCategories.filter((modCat) => Boolean(modCat.category));

      setModeratorCategories(modCategories);

      // Fetch posts from first category if available
      const firstCategory = modCategories[0];
      if (firstCategory?.category) {
        setSelectedCategory(firstCategory.category.documentId);
        await fetchPostsForCategory(firstCategory.category.id);
      }
    } catch (error) {
      console.error("Failed to fetch moderator data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPostsForCategory = async (categoryId: number) => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;

      // Use custom moderator endpoint that includes moderationStatus
      const postsRes = await api.get(
        `/api/posts/moderator/list?categoryId=${categoryId}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );

      setPosts(postsRes.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    }
  };

  const handleCategoryChange = async (categoryId: string) => {
    setSelectedCategory(categoryId);
    const category = moderatorCategories.find((m) => m.category.documentId === categoryId);
    if (category) {
      await fetchPostsForCategory(category.category.id);
    }
  };

  const refreshPosts = async () => {
    if (selectedCategory) {
      const category = moderatorCategories.find(m => m.category.documentId === selectedCategory);
      if (category) await fetchPostsForCategory(category.category.id);
    }
  };

  const executeApprove = async (postId: string) => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;

      await api.post(`/api/posts/${postId}/approve`, {}, {
        headers: { Authorization: `Bearer ${jwt}` }
      });

      showToast("Post approved successfully", "success");
      await refreshPosts();
      setConfirmModal({ ...confirmModal, isOpen: false });
    } catch (error) {
      console.error("Failed to approve post:", error);
      showToast("Failed to approve post", "error");
      setConfirmModal({ ...confirmModal, isOpen: false });
    }
  };

  const executeReject = async (postId: string) => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;

      await api.post(`/api/posts/${postId}/reject`, {}, {
        headers: { Authorization: `Bearer ${jwt}` }
      });

      showToast("Comments blocked successfully", "success");
      await refreshPosts();
      setConfirmModal({ ...confirmModal, isOpen: false });
    } catch (error) {
      console.error("Failed to block comments:", error);
      showToast("Failed to block comments", "error");
      setConfirmModal({ ...confirmModal, isOpen: false });
    }
  };

  const executeHide = async (postId: string) => {
    try {
      const jwt = getAuthToken();
      if (!jwt) return;

      await api.post(`/api/posts/${postId}/hide`, {}, {
        headers: { Authorization: `Bearer ${jwt}` }
      });

      showToast("Post hidden successfully", "success");
      await refreshPosts();
      setConfirmModal({ ...confirmModal, isOpen: false });
    } catch (error) {
      console.error("Failed to hide post:", error);
      showToast("Failed to hide post", "error");
      setConfirmModal({ ...confirmModal, isOpen: false });
    }
  };

  const handleApprove = (postId: string, postTitle: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Approve Post",
      message: `Are you sure you want to approve "${postTitle}"? This will make it visible and enable comments.`,
      confirmText: "Approve",
      confirmColor: "green",
      onConfirm: async () => {
        await executeApprove(postId);
      },
    });
  };

  const handleReject = (postId: string, postTitle: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Block Comments",
      message: `Are you sure you want to block comments on "${postTitle}"?`,
      confirmText: "Block Comments",
      confirmColor: "orange",
      onConfirm: async () => {
        await executeReject(postId);
      },
    });
  };

  const handleHide = (postId: string, postTitle: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Hide Post",
      message: `Are you sure you want to hide "${postTitle}"? This will remove it from public view.`,
      confirmText: "Hide Post",
      confirmColor: "red",
      onConfirm: async () => {
        await executeHide(postId);
      },
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "draft":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const getModerationStatusBadge = (moderationStatus?: string | null) => {
    if (!moderationStatus) {
      return (
        <span className="px-3 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          Approved
        </span>
      );
    }

    switch (moderationStatus) {
      case "block-comment":
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
            Comments Blocked
          </span>
        );
      case "delete":
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
            Hidden
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <ForumLayout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </ForumLayout>
    );
  }

  if (!currentUser) {
    return (
      <ForumLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <p className="text-yellow-800 dark:text-yellow-200">Please sign in to access the moderator panel.</p>
          </div>
        </div>
      </ForumLayout>
    );
  }

  if (moderatorCategories.length === 0) {
    return (
      <ForumLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Moderator Panel</h2>
            </div>
            <p className="text-blue-800 dark:text-blue-200">
              You are not a moderator of any categories yet. Contact an administrator to become a moderator.
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
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmColor={confirmModal.confirmColor}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Moderator Panel</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Manage posts in your categories
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Categories */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-300 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <FolderTree size={20} />
                Your Categories
              </h2>
              <div className="space-y-2">
                {moderatorCategories.map((modCategory) => (
                  modCategory.category && (
                    <button
                      key={modCategory.id}
                      onClick={() => handleCategoryChange(modCategory.category.documentId)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedCategory === modCategory.category.documentId
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {modCategory.category.name}
                    </button>
                  )
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Posts */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-300 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText size={20} />
                Posts ({posts.length})
              </h2>

              {posts.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                  No posts in this category yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="border border-slate-300 dark:border-slate-800 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                            {post.title}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                            <span>By {post.author?.username || "Anonymous"}</span>
                            <span>•</span>
                            <span>{formatDate(post.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getModerationStatusBadge(post.moderationStatus)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleApprove(post.documentId, post.title)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-sm"
                          title="Publish post and enable comments"
                        >
                          <Check size={14} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(post.documentId, post.title)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors text-sm"
                          title="Block comments on this post"
                        >
                          <X size={14} />
                          Block Comments
                        </button>
                        <button
                          onClick={() => handleHide(post.documentId, post.title)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-sm"
                          title="Hide post from public (archived)"
                        >
                          <Trash2 size={14} />
                          Hide Post
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ForumLayout>
  );
}



