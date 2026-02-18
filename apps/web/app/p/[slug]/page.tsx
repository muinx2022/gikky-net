"use client";

import { useEffect, useState, use } from "react";
import { api } from "../../../lib/api";
import { clearAuthSession, getAuthToken, setStoredUser } from "../../../lib/auth-storage";
import Link from "next/link";
import { Heart, Bookmark, MessageSquare, Send, CornerDownRight, X, ArrowUp, ArrowDown } from "lucide-react";
import ForumLayout from "../../../components/ForumLayout";
import TiptapEditor from "../../../components/TiptapEditor";
import LoginModal from "../../../components/LoginModal";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../../../components/AuthContext";
// Force recompile v3

interface AuthorAvatar {
  id: number;
  url: string;
  formats?: { thumbnail?: { url: string } };
}

interface Post {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: string;
  moderationStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  categories?: Array<{ id: number; name: string; slug?: string }>;
  tags?: Array<{ id: number; name: string }>;
  author?: {
    id: number;
    username: string;
    email: string;
    avatar?: AuthorAvatar | null;
  };
}

interface Comment {
  id: number;
  documentId: string;
  content: string;
  createdAt: string;
  author?: {
    id: number;
    username: string;
    avatar?: AuthorAvatar | null;
  };
  parent?: {
    id: number;
    documentId: string;
  };
  replies?: Comment[];
}

interface UserData {
  id: number;
  username: string;
  email: string;
}

interface Category {
  id: number;
  documentId: string;
  name: string;
  description: string;
}

export default function PostDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  // Unwrap params Promise
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const { currentUser, handleLoginSuccess: updateAuthContext } = useAuth();

  console.log('PostDetailPage rendered - v4');

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpvoted, setIsUpvoted] = useState(false);
  const [isDownvoted, setIsDownvoted] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [upvotesCount, setUpvotesCount] = useState(0);
  const [downvotesCount, setDownvotesCount] = useState(0);
  const [followsCount, setFollowsCount] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [showFormatInComment, setShowFormatInComment] = useState(false);
  const [showFormatInReply, setShowFormatInReply] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginIntent, setLoginIntent] = useState<'comment' | null>(null);
  const [publishingPost, setPublishingPost] = useState(false);
  const [commentUpvoteCounts, setCommentUpvoteCounts] = useState<Record<number, number>>({});
  const [commentDownvoteCounts, setCommentDownvoteCounts] = useState<Record<number, number>>({});
  const [commentUpvoteIds, setCommentUpvoteIds] = useState<Record<number, string>>({});
  const [commentDownvoteIds, setCommentDownvoteIds] = useState<Record<number, string>>({});
  const [showToast, setShowToast] = useState<{show: boolean; message: string; type: 'success' | 'error'}>({
    show: false,
    message: '',
    type: 'success'
  });

  // Extract documentId from slug parameter (format: slug--documentId)
  const slugParts = resolvedParams.slug.split("--");
  const documentId = slugParts[slugParts.length - 1];
  const targetCommentId = searchParams.get("comment");

  useEffect(() => {
    const bootstrap = async () => {
      // currentUser is managed by AuthContext, just fetch data
      await fetchPostData(currentUser?.id);
      await fetchCategories();
    };

    bootstrap();
  }, [documentId, currentUser?.id]);

  const fetchCategories = async () => {
    try {
      const response = await api.get("/api/categories", {
        params: {
          sort: ["sortOrder:asc", "name:asc"],
          filters: {
            parent: {
              $null: true,
            },
          },
        },
      });
      setCategories(response.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  // Only one input form can be open at a time.
  useEffect(() => {
    if (showCommentForm) {
      setReplyingTo(null);
      setReplyContent("");
      setShowFormatInReply(null);
    }
  }, [showCommentForm]);

  useEffect(() => {
    if (replyingTo !== null) {
      setShowCommentForm(false);
      setShowFormatInComment(false);
    }
  }, [replyingTo]);

  // Close comment/reply forms when user logs out
  useEffect(() => {
    if (!currentUser) {
      setShowCommentForm(false);
      setNewComment("");
      setShowFormatInComment(false);
      setReplyingTo(null);
      setReplyContent("");
      setShowFormatInReply(null);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!targetCommentId || comments.length === 0) return;
    const el = document.getElementById(`comment-${targetCommentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-blue-500", "rounded-lg");
    const t = window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-blue-500", "rounded-lg");
    }, 1800);
    return () => window.clearTimeout(t);
  }, [targetCommentId, comments]);

  const fetchPostData = async (userId?: number) => {
    try {
      const populateParams = { populate: { categories: true, tags: true, author: { populate: { avatar: true } } } };
      const jwt = getAuthToken();

      // Fetch post by documentId. If authenticated, try draft first.
      let postRes;
      if (jwt) {
        try {
          postRes = await api.get(`/api/posts/${documentId}`, {
            params: { ...populateParams, status: "draft" },
            headers: { Authorization: `Bearer ${jwt}` },
          });
        } catch {
          postRes = await api.get(`/api/posts/${documentId}`, {
            params: populateParams,
          });
        }
      } else {
        postRes = await api.get(`/api/posts/${documentId}`, {
          params: populateParams,
        });
      }
      const postData = postRes.data?.data;

      if (!postData) {
        console.error("No post data found");
        setLoading(false);
        return;
      }

      // Draft posts are only visible to owner; everyone else gets not-found view.
      const isOwner = Number(postData?.author?.id) === Number(userId);
      if (postData.status === "draft" && !isOwner) {
        let canViewDraft = false;
        const jwt = getAuthToken();

        // Fallback for old/inconsistent author relation: verify ownership via /posts/my list.
        if (jwt) {
          try {
            const myPostsRes = await api.get("/api/posts/my", {
              headers: { Authorization: `Bearer ${jwt}` },
            });
            const myPosts = myPostsRes.data?.data || [];
            canViewDraft = myPosts.some((item: any) => item?.documentId === postData?.documentId);
          } catch {
            canViewDraft = false;
          }
        }

        if (!canViewDraft) {
          setPost(null);
          return;
        }
      }

      setPost(postData);

      // Fetch comments for this post
      try {
        const jwt = getAuthToken();
        const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
        const commentsRes = await api.get(`/api/comments`, {
          params: {
            filters: { post: { documentId: { $eq: documentId } } },
            populate: { author: { populate: { avatar: true } }, parent: true },
            sort: "createdAt:asc",
          },
          headers,
        });
        const commentsData = commentsRes.data?.data || [];

        // Build hierarchical comment structure
        const hierarchicalComments = buildCommentTree(commentsData);
        setComments(hierarchicalComments);
      } catch (commentError) {
        console.error("Failed to fetch comments:", commentError);
        const jwt = getAuthToken();
        if (jwt) {
          setShowToast({ show: true, message: "Cannot load comments. Check login/permission.", type: "error" });
          setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
        }
      }

      // Fetch unified actions summary (post like/follow + comment likes)
      try {
        const jwt = getAuthToken();
        const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
        const summaryRes = await api.get(`/api/post-actions/summary?postId=${postData.id}`, { headers });
        const summary = summaryRes.data?.data;

        setUpvotesCount(summary?.counts?.post?.upvote || 0);
        setDownvotesCount(summary?.counts?.post?.downvote || 0);
        setFollowsCount(summary?.counts?.post?.follow || 0);

        const myPostUpvoteId = summary?.myActions?.post?.upvote || null;
        const myPostDownvoteId = summary?.myActions?.post?.downvote || null;
        const myPostFollowId = summary?.myActions?.post?.follow || null;
        setIsUpvoted(Boolean(myPostUpvoteId));
        setIsDownvoted(Boolean(myPostDownvoteId));
        setIsFollowed(Boolean(myPostFollowId));

        setCommentUpvoteCounts(summary?.counts?.commentUpvotes || {});
        setCommentDownvoteCounts(summary?.counts?.commentDownvotes || {});
        setCommentUpvoteIds(summary?.myActions?.commentUpvotes || {});
        setCommentDownvoteIds(summary?.myActions?.commentDownvotes || {});
      } catch (actionSummaryError) {
        console.error("Failed to fetch post actions summary:", actionSummaryError);
      }
    } catch (error) {
      console.error("Failed to fetch post data:", error);
    } finally {
      setLoading(false);
    }
  };

  const buildCommentTree = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // First pass: create map of all comments
    flatComments.forEach((comment) => {
      commentMap.set(comment.documentId, { ...comment, replies: [] });
    });

    // Second pass: build tree structure
    flatComments.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment.documentId);
      if (!commentWithReplies) return;

      if (comment.parent?.documentId) {
        const parentComment = commentMap.get(comment.parent.documentId);
        if (parentComment) {
          parentComment.replies = parentComment.replies || [];
          parentComment.replies.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    // Sorting rule: same parent/same level => newest first
    const sortTree = (items: Comment[], level: number): Comment[] => {
      const sorted = [...items].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

      return sorted.map((item) => ({
        ...item,
        replies: item.replies ? sortTree(item.replies, level + 1) : [],
      }));
    };

    return sortTree(rootComments, 0);
  };

  const handleUpvote = async () => {
    if (String(post?.status || "").toLowerCase() === "draft") return;
    console.log('handleUpvote called', { currentUser, post });

    try {
      const jwt = getAuthToken();

      if (!jwt) {
        setShowLoginModal(true);
        setShowToast({ show: true, message: "Vui lòng đăng nhập để bình chọn", type: "error" });
        setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
        return;
      }

      if (!post?.id) {
        setShowToast({ show: true, message: "Bài viết chưa tải đúng", type: "error" });
        setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
        return;
      }

      console.log('Sending upvote request', { postId: post.id });
      const response = await api.post(
        `/api/post-actions/toggle`,
        {
          data: {
            targetType: "post",
            actionType: "upvote",
            postId: post.id,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );

      console.log('Upvote response:', response.data);
      const action = response.data?.data;
      const nextUpvoted = Boolean(action?.active);
      
      // If upvote was toggled on, remove downvote
      if (nextUpvoted) {
        setIsDownvoted(false);
      }
      
      setIsUpvoted(nextUpvoted);
      
      // Refresh the counts
      if (currentUser) {
        await fetchPostData(currentUser.id);
      }
      
      setShowToast({ show: true, message: nextUpvoted ? "Đã ủng hộ" : "Đã bỏ bình chọn", type: "success" });
      setTimeout(() => setShowToast({ show: false, message: "", type: "success" }), 3000);
    } catch (error: any) {
      console.error("Failed to upvote post:", error);
      console.error("Error details:", {
        response: error?.response,
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data
      });
      setShowToast({
        show: true,
        message: `Bình chọn thất bại: ${error?.response?.data?.error?.message || error.message}`,
        type: "error",
      });
      setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
    }
  };

  const handleDownvote = async () => {
    if (String(post?.status || "").toLowerCase() === "draft") return;
    console.log('handleDownvote called', { currentUser, post });

    try {
      const jwt = getAuthToken();

      if (!jwt) {
        setShowLoginModal(true);
        setShowToast({ show: true, message: "Vui lòng đăng nhập để bình chọn", type: "error" });
        setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
        return;
      }

      if (!post?.id) {
        setShowToast({ show: true, message: "Bài viết chưa tải đúng", type: "error" });
        setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
        return;
      }

      console.log('Sending downvote request', { postId: post.id });
      const response = await api.post(
        `/api/post-actions/toggle`,
        {
          data: {
            targetType: "post",
            actionType: "downvote",
            postId: post.id,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );

      console.log('Downvote response:', response.data);
      const action = response.data?.data;
      const nextDownvoted = Boolean(action?.active);
      
      // If downvote was toggled on, remove upvote
      if (nextDownvoted) {
        setIsUpvoted(false);
      }
      
      setIsDownvoted(nextDownvoted);
      
      // Refresh the counts
      if (currentUser) {
        await fetchPostData(currentUser.id);
      }
      
      setShowToast({ show: true, message: nextDownvoted ? "Đã phản đối" : "Đã bỏ bình chọn", type: "success" });
      setTimeout(() => setShowToast({ show: false, message: "", type: "success" }), 3000);
    } catch (error: any) {
      console.error("Failed to downvote post:", error);
      console.error("Error details:", {
        response: error?.response,
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data
      });
      setShowToast({
        show: true,
        message: `Bình chọn thất bại: ${error?.response?.data?.error?.message || error.message}`,
        type: "error",
      });
      setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
    }
  };

  const handleFollow = async () => {
    if (String(post?.status || "").toLowerCase() === "draft") return;
    try {
      const jwt = getAuthToken();
      if (!jwt) {
        setShowLoginModal(true);
        setShowToast({ show: true, message: "Vui lòng đăng nhập để theo dõi bài viết", type: "error" });
        setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
        return;
      }

      if (!post?.id) {
        setShowToast({ show: true, message: "Bài viết chưa tải đúng", type: "error" });
        setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
        return;
      }

      const response = await api.post(
        `/api/post-actions/toggle`,
        {
          data: {
            targetType: "post",
            actionType: "follow",
            postId: post.id,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );

      const action = response.data?.data;
      const nextFollowed = Boolean(action?.active);
      setIsFollowed(nextFollowed);
      setFollowsCount(action?.count ?? 0);
      setShowToast({ show: true, message: nextFollowed ? "Đã theo dõi bài viết" : "Đã bỏ theo dõi bài viết", type: "success" });
      setTimeout(() => setShowToast({ show: false, message: "", type: "success" }), 3000);
    } catch (error: any) {
      console.error("Failed to follow/unfollow post:", error);
      setShowToast({
        show: true,
        message: `Cập nhật theo dõi thất bại: ${error?.response?.data?.error?.message || error.message}`,
        type: "error",
      });
      setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
    }
  };

  const handlePublishNow = async () => {
    if (!post) return;

    const jwt = getAuthToken();
    if (!jwt) {
      setShowLoginModal(true);
      setShowToast({ show: true, message: "Please sign in to publish this post", type: "error" });
      setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
      return;
    }

    try {
      setPublishingPost(true);
      await api.put(
        `/api/posts/${post.documentId}?status=published`,
        { data: { status: "published" } },
        { headers: { Authorization: `Bearer ${jwt}` } }
      );

      setPost((prev) => (prev ? { ...prev, status: "published" } : prev));
      setShowToast({ show: true, message: "Post is now published", type: "success" });
      setTimeout(() => setShowToast({ show: false, message: "", type: "success" }), 3000);
    } catch (error: any) {
      setShowToast({
        show: true,
        message: `Failed to publish post: ${error?.response?.data?.error?.message || error?.message || "Unknown error"}`,
        type: "error",
      });
      setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
    } finally {
      setPublishingPost(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!currentUser) {
      alert("Vui lòng đăng nhập để bình luận");
      return;
    }
    if (!newComment.trim()) return;

    try {
      const jwt = getAuthToken();
      if (!jwt) {
        alert("Vui lòng đăng nhập để bình luận");
        return;
      }

      await api.post(
        `/api/comments`,
        {
          data: {
            content: newComment,
            post: post?.id,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );

      setNewComment("");
      setShowCommentForm(false);
      setShowFormatInComment(false);
      setShowToast({ show: true, message: 'Đã đăng bình luận thành công!', type: 'success' });
      setTimeout(() => setShowToast({ show: false, message: '', type: 'success' }), 3000);

      // Refresh comments
      if (currentUser) {
        fetchPostData(currentUser.id);
      } else {
        fetchPostData();
      }
    } catch (error: any) {
      console.error("Failed to post comment:", error);
      setShowToast({
        show: true,
        message: `Đăng bình luận thất bại: ${error?.response?.data?.error?.message || error?.message || "Lỗi không xác định"}`,
        type: 'error',
      });
      setTimeout(() => setShowToast({ show: false, message: '', type: 'error' }), 3000);
    }
  };

  const handleSubmitReply = async (parentId: number) => {
    if (!currentUser) {
      alert("Vui lòng đăng nhập để trả lời");
      return;
    }
    if (!replyContent.trim()) return;

    try {
      const jwt = getAuthToken();
      if (!jwt) {
        alert("Vui lòng đăng nhập để trả lời");
        return;
      }

      await api.post(
        `/api/comments`,
        {
          data: {
            content: replyContent,
            post: post?.id,
            parent: parentId,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );

      setReplyContent("");
      setReplyingTo(null);
      setShowFormatInReply(null);
      setShowToast({ show: true, message: 'Đã đăng trả lời thành công!', type: 'success' });
      setTimeout(() => setShowToast({ show: false, message: '', type: 'success' }), 3000);

      // Refresh comments
      if (currentUser) {
        fetchPostData(currentUser.id);
      } else {
        fetchPostData();
      }
    } catch (error: any) {
      console.error("Failed to post reply:", error);
      setShowToast({
        show: true,
        message: `Đăng trả lời thất bại: ${error?.response?.data?.error?.message || error?.message || "Lỗi không xác định"}`,
        type: 'error',
      });
      setTimeout(() => setShowToast({ show: false, message: '', type: 'error' }), 3000);
    }
  };

  const handleUpvoteComment = async (commentId: number) => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }

    try {
      const jwt = getAuthToken();
      if (!jwt) {
        setShowLoginModal(true);
        return;
      }

      const response = await api.post(
        `/api/post-actions/toggle`,
        {
          data: {
            targetType: "comment",
            actionType: "upvote",
            commentId,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );

      const action = response.data?.data;
      const nextUpvoted = Boolean(action?.active);

      // If upvoted, remove downvote
      if (nextUpvoted) {
        setCommentDownvoteIds((prev) => {
          const next = { ...prev };
          delete next[commentId];
          return next;
        });
      }

      setCommentUpvoteIds((prev) => {
        const next = { ...prev };
        if (action?.active && action?.documentId) {
          next[commentId] = action.documentId;
        } else {
          delete next[commentId];
        }
        return next;
      });

      // Refresh counts
      if (currentUser) {
        await fetchPostData(currentUser.id);
      }
    } catch (error: any) {
      console.error("Failed to upvote comment:", error);
      setShowToast({
        show: true,
        message: `Bình chọn thất bại: ${error?.response?.data?.error?.message || error.message}`,
        type: "error",
      });
      setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
    }
  };

  const handleDownvoteComment = async (commentId: number) => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }

    try {
      const jwt = getAuthToken();
      if (!jwt) {
        setShowLoginModal(true);
        return;
      }

      const response = await api.post(
        `/api/post-actions/toggle`,
        {
          data: {
            targetType: "comment",
            actionType: "downvote",
            commentId,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );

      const action = response.data?.data;
      const nextDownvoted = Boolean(action?.active);

      // If downvoted, remove upvote
      if (nextDownvoted) {
        setCommentUpvoteIds((prev) => {
          const next = { ...prev };
          delete next[commentId];
          return next;
        });
      }

      setCommentDownvoteIds((prev) => {
        const next = { ...prev };
        if (action?.active && action?.documentId) {
          next[commentId] = action.documentId;
        } else {
          delete next[commentId];
        }
        return next;
      });

      // Refresh counts
      if (currentUser) {
        await fetchPostData(currentUser.id);
      }
    } catch (error: any) {
      console.error("Failed to downvote comment:", error);
      setShowToast({
        show: true,
        message: `Bình chọn thất bại: ${error?.response?.data?.error?.message || error.message}`,
        type: "error",
      });
      setTimeout(() => setShowToast({ show: false, message: "", type: "error" }), 3000);
    }
  };

  const sanitizeCommentHtml = (html: string) => {
    return (html || "")
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+=(["']).*?\1/gi, "")
      .replace(/javascript:/gi, "");
  };

  const sanitizePostHtml = (html: string) => {
    return (html || "")
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+=(["']).*?\1/gi, "")
      .replace(/javascript:/gi, "");
  };

  const htmlToPlainText = (html: string) => {
    if (!html) return "";
    const normalized = html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p>/gi, "\n")
      .replace(/<\/?p>/gi, "");

    if (typeof document === "undefined") {
      return normalized.replace(/<[^>]+>/g, "").trim();
    }

    const temp = document.createElement("div");
    temp.innerHTML = normalized;
    return (temp.textContent || temp.innerText || "").trim();
  };

  const plainTextToHtml = (text: string) => {
    if (!text) return "";
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return escaped
      .split(/\r?\n/)
      .map((line) => (line.trim() ? `<p>${line}</p>` : "<p><br></p>"))
      .join("");
  };

  const toggleCommentFormat = () => {
    if (showFormatInComment) {
      setNewComment(htmlToPlainText(newComment));
      setShowFormatInComment(false);
      return;
    }
    setNewComment(plainTextToHtml(newComment));
    setShowFormatInComment(true);
  };

  const toggleReplyFormat = (commentId: number) => {
    if (showFormatInReply === commentId) {
      setReplyContent(htmlToPlainText(replyContent));
      setShowFormatInReply(null);
      return;
    }
    setReplyContent(plainTextToHtml(replyContent));
    setShowFormatInReply(commentId);
  };

  const formatDate = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return "vừa xong";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} phút trước`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} giờ trước`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ngày trước`;
    } else if (diffInSeconds < 2592000) {
      const weeks = Math.floor(diffInSeconds / 604800);
      return `${weeks} tuần trước`;
    } else if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months} tháng trước`;
    } else {
      const years = Math.floor(diffInSeconds / 31536000);
      return `${years} năm trước`;
    }
  };

  const getInitials = (username: string) => username.substring(0, 2).toUpperCase();

  const renderAvatar = (username: string, avatar?: AuthorAvatar | null, size = "w-8 h-8") => {
    const url = avatar?.formats?.thumbnail?.url || avatar?.url;
    const fullUrl = url ? (url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:1337"}${url}`) : null;
    return (
      <div className={`${size} rounded-full flex-shrink-0 overflow-hidden bg-blue-100 dark:bg-blue-900 flex items-center justify-center`}>
        {fullUrl
          ? <img src={fullUrl} alt={username} className="w-full h-full object-cover" />
          : <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{getInitials(username)}</span>
        }
      </div>
    );
  };
  const wasUpdated =
    Boolean(post) &&
    Boolean(post?.updatedAt) &&
    Boolean(post?.createdAt) &&
    new Date(post!.updatedAt).getTime() - new Date(post!.createdAt).getTime() > 60_000;

  const renderComment = (comment: Comment, level: number = 0) => {
    return (
      <div
        key={comment.id}
        id={`comment-${comment.documentId}`}
        className={`${level > 0 ? "ml-5 pl-3 border-l border-slate-300 dark:border-slate-800" : ""} mb-4`}
      >
        <div className="flex items-start gap-3">
          {renderAvatar(comment.author?.username || "Anonymous", comment.author?.avatar)}
          <div className="flex-1 min-w-0">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                {comment.author?.username ? (
                  <Link href={`/user/${encodeURIComponent(comment.author.username)}`} className="font-medium text-sm text-slate-900 dark:text-white hover:underline">
                    {comment.author.username}
                  </Link>
                ) : (
                  <span className="font-medium text-sm text-slate-900 dark:text-white">Anonymous</span>
                )}
                <span className="text-xs text-slate-500">
                  {formatDate(comment.createdAt)}
                </span>
              </div>
              <div
                className="text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(comment.content) }}
              />
            </div>
            {!commentsBlocked && String(post.status || "").toLowerCase() !== "draft" && (
              <div className="flex items-center gap-4 mt-2 text-xs">
                {/* Upvote/Downvote */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleUpvoteComment(comment.id)}
                    className={`p-0.5 transition-colors ${
                      commentUpvoteIds[comment.id]
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400"
                    }`}
                    title="Upvote"
                  >
                    <ArrowUp size={14} strokeWidth={commentUpvoteIds[comment.id] ? 2.5 : 2} />
                  </button>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 min-w-[1.5rem] text-center">
                    {(commentUpvoteCounts[comment.id] || 0) - (commentDownvoteCounts[comment.id] || 0)}
                  </span>
                  <button
                    onClick={() => handleDownvoteComment(comment.id)}
                    className={`p-0.5 transition-colors ${
                      commentDownvoteIds[comment.id]
                        ? "text-purple-600 dark:text-purple-400"
                        : "text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
                    }`}
                    title="Downvote"
                  >
                    <ArrowDown size={14} strokeWidth={commentDownvoteIds[comment.id] ? 2.5 : 2} />
                  </button>
                </div>
                
                <button
                  onClick={() => {
                    setReplyingTo(comment.id);
                  }}
                  className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 text-slate-500 dark:text-slate-400"
                >
                  <CornerDownRight size={12} />
                  Trả lời
                </button>
              </div>
            )}

            {/* Reply input */}
            {!commentsBlocked && String(post.status || "").toLowerCase() !== "draft" && replyingTo === comment.id && (
              <div className="mt-3">
                {showFormatInReply === comment.id ? (
                  <div className="relative">
                    <TiptapEditor
                      content={replyContent}
                      onChange={(html) => setReplyContent(html)}
                      placeholder="Viết trả lời..."
                      className="bg-white dark:bg-slate-900"
                      compact
                    />
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      <button
                        onClick={() => toggleReplyFormat(comment.id)}
                        className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        {showFormatInReply === comment.id ? 'Ẩn định dạng' : 'Hiển thị định dạng'}
                      </button>
                      <button
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent("");
                          setShowFormatInReply(null);
                        }}
                        className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={() => handleSubmitReply(comment.id)}
                        disabled={!replyContent.trim()}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Trả lời
                      </button>
                    </div>
                  </div>
              ) : (
                <div className="relative">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Viết trả lời..."
                    rows={2}
                    className="w-full min-h-[180px] px-3 py-2 pb-14 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitReply(comment.id);
                      }
                    }}
                    autoFocus
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button
                      onClick={() => toggleReplyFormat(comment.id)}
                      className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                    >
                      {showFormatInReply === comment.id ? 'Ẩn định dạng' : 'Hiển thị định dạng'}
                    </button>
                    <button
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyContent("");
                        setShowFormatInReply(null);
                      }}
                      className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={() => handleSubmitReply(comment.id)}
                      disabled={!replyContent.trim()}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Trả lời
                    </button>
                  </div>
                </div>
              )}
              </div>
            )}

            {/* Nested replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-3">
                {comment.replies.map((reply) => renderComment(reply, level + 1))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <ForumLayout categories={categories}>
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </ForumLayout>
    );
  }

  if (!post) {
    return (
      <ForumLayout categories={categories}>
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
          <p className="text-slate-600">Không tìm thấy bài viết</p>
        </div>
      </ForumLayout>
    );
  }

  // Check if post is hidden by moderator
  if (post.moderationStatus === 'delete') {
    return (
      <ForumLayout categories={categories}>
        <div className="max-w-3xl">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🚫</span>
              </div>
              <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-2">Bài viết đã bị ẩn</h2>
              <p className="text-red-700 dark:text-red-300">
                Bài viết này đã bị kiểm duyệt viên ẩn và không còn hiển thị công khai.
              </p>
            </div>
          </div>
      </ForumLayout>
    );
  }

  // Check if comments are blocked
  const commentsBlocked = post.moderationStatus === 'block-comment';
  const isDraftPost = String(post.status || "").toLowerCase() === "draft";

  return (
    <ForumLayout categories={categories}>
      {/* Toast Notification */}
      {showToast.show && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`px-6 py-3 rounded-sm shadow-lg ${
            showToast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}>
            {showToast.message}
          </div>
        </div>
      )}
      <div className="space-y-4">
            {/* Post Content */}
            <article className="rounded-xl border border-slate-300 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
          {/* Categories */}
          {post.categories && post.categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {post.categories.map((cat) => {
                const catSlug = cat.slug || cat.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
                return (
                  <Link
                    key={cat.id}
                    href={`/c/${catSlug}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                  >
                    <span className="text-blue-400 dark:text-blue-500">›</span>
                    {cat.name}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            {post.title}
          </h1>

          {isDraftPost && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
              <span>Bài viết này đang ở dạng nháp, bạn muốn hiển thị với tất cả mọi người không?</span>
              <button
                type="button"
                onClick={handlePublishNow}
                disabled={publishingPost}
                className="rounded bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {publishingPost ? "Publishing..." : "Hiển thị bài viết ngay"}
              </button>
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-6 pb-6 border-b border-slate-300 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {renderAvatar(post.author?.username || "Anonymous", post.author?.avatar)}
              {post.author?.username ? (
                <Link href={`/user/${encodeURIComponent(post.author.username)}`} className="font-medium text-slate-700 dark:text-slate-300 hover:underline">
                  {post.author.username}
                </Link>
              ) : (
                <span className="font-medium text-slate-700 dark:text-slate-300">Anonymous</span>
              )}
            </div>
            <span>•</span>
            <span>{formatDate(post.createdAt)}</span>
            {wasUpdated && (
              <>
                <span>•</span>
                <span className="text-blue-600 dark:text-blue-400">Cập nhật {formatDate(post.updatedAt)}</span>
              </>
            )}
          </div>

          {/* Content */}
          <div className="prose dark:prose-invert max-w-none mb-6">
            <div
              className="text-slate-700 dark:text-slate-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizePostHtml(post.content) }}
            />
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {post.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tag/${tag.name}`}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400"
                >
                  <span className="text-slate-400 dark:text-slate-500">#</span>{tag.name}
                </Link>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-6 pt-6 border-t border-slate-300 dark:border-slate-800">
            {/* Upvote/Downvote */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={isDraftPost}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Upvote button clicked!');
                  handleUpvote();
                }}
                className={`p-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isUpvoted
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400"
                }`}
                title={isDraftPost ? "Draft post" : "Upvote"}
              >
                <ArrowUp size={20} strokeWidth={isUpvoted ? 2.5 : 2} />
              </button>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[2rem] text-center">
                {upvotesCount - downvotesCount}
              </span>
              <button
                type="button"
                disabled={isDraftPost}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Downvote button clicked!');
                  handleDownvote();
                }}
                className={`p-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDownvoted
                    ? "text-purple-600 dark:text-purple-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
                }`}
                title={isDraftPost ? "Draft post" : "Downvote"}
              >
                <ArrowDown size={20} strokeWidth={isDownvoted ? 2.5 : 2} />
              </button>
            </div>

            {/* Follow/Bookmark */}
            <button
              type="button"
              disabled={isDraftPost}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Follow button clicked!');
                handleFollow();
              }}
              className={`flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isFollowed
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
              }`}
              title={isDraftPost ? "Draft post" : (isFollowed ? "Unfollow" : "Follow this post")}
            >
              <Bookmark size={20} fill={isFollowed ? "currentColor" : "none"} />
              {followsCount > 0 && (
                <span className="text-sm">{followsCount}</span>
              )}
            </button>
          </div>
        </article>

        {/* Comments Section */}
        <div className="rounded-xl border border-slate-300 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <MessageSquare size={20} />
            Bình luận ({comments.length})
          </h2>

          {/* Comments Blocked Warning */}
          {(commentsBlocked || isDraftPost) && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
              <p className="text-orange-800 dark:text-orange-200 text-sm font-medium">
                {isDraftPost ? "Draft post: comments are disabled." : "Comments are disabled on this post by a moderator."}
              </p>
            </div>
          )}

          {/* Add Comment */}
          {!commentsBlocked && !isDraftPost && !showCommentForm && (
            <div
              onClick={() => {
                if (!currentUser) {
                  setLoginIntent('comment');
                  setShowLoginModal(true);
                  return;
                }
                setReplyingTo(null);
                setReplyContent("");
                setShowFormatInReply(null);
                setShowCommentForm(true);
              }}
              className="mb-8 p-3 border-2 border-dashed border-slate-400 dark:border-slate-800 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
            >
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                💬 Nhấn để tham gia thảo luận...
              </p>
            </div>
          )}

          {!commentsBlocked && !isDraftPost && showCommentForm && (
            <div className="mb-8">
              <div className="flex gap-3">
                {renderAvatar(currentUser?.username || "?", currentUser?.avatarUrl ? { id: 0, url: currentUser.avatarUrl } : undefined)}
                <div className="flex-1">
                  {showFormatInComment ? (
                    <div className="relative">
                      <TiptapEditor
                        content={newComment}
                        onChange={(html) => setNewComment(html)}
                        placeholder="Viết bình luận..."
                        className="bg-slate-50 dark:bg-slate-800"
                        compact
                      />
                      <div className="absolute bottom-2 right-2 flex items-center gap-2">
                        <button
                          onClick={toggleCommentFormat}
                          className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                        >
                          {showFormatInComment ? 'Ẩn định dạng' : 'Hiển thị định dạng'}
                        </button>
                        <button
                          onClick={() => {
                            setShowCommentForm(false);
                            setNewComment("");
                            setShowFormatInComment(false);
                          }}
                          className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={handleSubmitComment}
                          disabled={!newComment.trim()}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Đăng bình luận
                        </button>
                      </div>
                    </div>
                ) : (
                  <div className="relative">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Viết bình luận..."
                      rows={3}
                      className="w-full min-h-[180px] px-4 py-3 pb-14 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white resize-none"
                      autoFocus
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      <button
                        onClick={toggleCommentFormat}
                        className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        {showFormatInComment ? 'Ẩn định dạng' : 'Hiển thị định dạng'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCommentForm(false);
                          setNewComment("");
                          setShowFormatInComment(false);
                        }}
                        className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim()}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Đăng bình luận
                      </button>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                Chưa có bình luận. Hãy là người đầu tiên!
              </p>
            ) : (
              comments.map((comment) => renderComment(comment))
            )}
          </div>
        </div>
          </div>
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => {
            setShowLoginModal(false);
            setLoginIntent(null);
          }}
          onLoginSuccess={(user) => {
            // Update global auth context (currentUser comes from there)
            updateAuthContext(user);
            setShowLoginModal(false);
            
            // Only open comment form if user clicked comment box
            if (loginIntent === 'comment') {
              setReplyingTo(null);
              setReplyContent("");
              setShowFormatInReply(null);
              setShowCommentForm(true);
            }
            
            setLoginIntent(null);
          }}
        />
    </ForumLayout>
  );
}

