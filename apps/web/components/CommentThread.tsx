"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CornerDownRight, Flag, MessageSquare, X } from "lucide-react";
import { api, getStrapiURL } from "../lib/api";
import { getAuthToken } from "../lib/auth-storage";
import LoginModal from "./LoginModal";
import { useAuth } from "./AuthContext";
import TiptapEditor from "./TiptapEditor";

type RelationKey = "post" | "journalTrade";

interface CommentThreadProps {
  relation: RelationKey;
  targetDocumentId: string;
  targetEntityId?: number | null;
  disabled?: boolean;
  disabledMessage?: string;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  if (weeks < 4) return `${weeks} tuần trước`;
  if (months < 12) return `${months} tháng trước`;
  return `${years} năm trước`;
}

function sanitizeCommentHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

function plainTextToHtml(text: string) {
  return (text || "")
    .split("\n")
    .map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .join("<br>");
}

function htmlToPlainText(html: string) {
  const normalized = (html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "");
  return normalized.replace(/\n{3,}/g, "\n\n").trim();
}

export default function CommentThread({
  relation,
  targetDocumentId,
  targetEntityId,
  disabled = false,
  disabledMessage = "Bình luận đang bị tắt.",
}: CommentThreadProps) {
  const { currentUser, handleLoginSuccess } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [showFormatInComment, setShowFormatInComment] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [showFormatInReply, setShowFormatInReply] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginIntent, setLoginIntent] = useState<"comment" | "reply" | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [commentUpvoteCounts, setCommentUpvoteCounts] = useState<Record<number, number>>({});
  const [commentDownvoteCounts, setCommentDownvoteCounts] = useState<Record<number, number>>({});
  const [commentUpvoteIds, setCommentUpvoteIds] = useState<Record<number, string>>({});
  const [commentDownvoteIds, setCommentDownvoteIds] = useState<Record<number, string>>({});
  const [reportModal, setReportModal] = useState<{ open: boolean; commentDocId: string | null }>({ open: false, commentDocId: null });
  const [reportReason, setReportReason] = useState('other');
  const [reportDetail, setReportDetail] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return "A";
    return name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  };

  const renderAvatar = (username: string, avatar?: any, size: string = "w-9 h-9") => {
    const rawUrl = avatar?.formats?.thumbnail?.url || avatar?.url || null;
    const fullUrl = rawUrl ? (String(rawUrl).startsWith("http") ? rawUrl : getStrapiURL(rawUrl)) : null;
    return (
      <div className={`${size} rounded-full flex-shrink-0 overflow-hidden bg-blue-100 dark:bg-blue-900 flex items-center justify-center`}>
        {fullUrl ? (
          <img src={fullUrl} alt={username} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{getInitials(username)}</span>
        )}
      </div>
    );
  };

  const buildCommentTree = (flatComments: any[]) => {
    const commentMap = new Map<string, any>();
    const rootComments: any[] = [];
    flatComments.forEach((comment) => commentMap.set(comment.documentId, { ...comment, replies: [] }));
    flatComments.forEach((comment) => {
      const item = commentMap.get(comment.documentId);
      if (!item) return;
      if (comment.parent?.documentId) {
        const parent = commentMap.get(comment.parent.documentId);
        if (parent) parent.replies.push(item);
      } else {
        rootComments.push(item);
      }
    });
    const sortTree = (items: any[]): any[] =>
      [...items]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((item) => ({ ...item, replies: sortTree(item.replies || []) }));
    return sortTree(rootComments);
  };

  const loadComments = async () => {
    if (!targetDocumentId) return;
    try {
      const jwt = getAuthToken();
      const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
      const res = await api.get("/api/comments", {
        params: {
          filters: { [relation]: { documentId: { $eq: targetDocumentId } } },
          sort: "createdAt:asc",
          populate: { author: { populate: { avatar: true } }, parent: true },
        },
        headers,
      });
      const rows = res.data?.data || [];
      setComments(buildCommentTree(rows));
      const allIds: number[] = rows.map((r: any) => r.id).filter(Boolean);
      await loadCommentActionSummary(allIds);
    } catch {
      setComments([]);
    }
  };

  const loadCommentActionSummary = async (commentIds: number[]) => {
    if (commentIds.length === 0) return;
    try {
      const jwt = getAuthToken();
      const headers = jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
      const res = await api.get(`/api/post-actions/comment-summary?commentIds=${commentIds.join(",")}`, { headers });
      const summary = res.data?.data || {};
      setCommentUpvoteCounts(summary?.counts?.commentUpvoteCounts || {});
      setCommentDownvoteCounts(summary?.counts?.commentDownvoteCounts || {});
      setCommentUpvoteIds(summary?.myActions?.commentUpvotes || {});
      setCommentDownvoteIds(summary?.myActions?.commentDownvotes || {});
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadComments();
  }, [relation, targetDocumentId, targetEntityId]);

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

  const handleSubmitComment = async () => {
    if (disabled) return;
    if (!newComment.trim()) return;
    if (isSubmittingComment) return;
    const jwt = getAuthToken();
    if (!jwt) {
      setLoginIntent("comment");
      setShowLoginModal(true);
      return;
    }
    if (!targetEntityId) return;
    try {
      setIsSubmittingComment(true);
      await api.post(
        "/api/comments",
        { data: { content: newComment, [relation]: targetEntityId } },
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      setNewComment("");
      setShowCommentForm(false);
      setShowFormatInComment(false);
      await loadComments();
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleSubmitReply = async (parentId: number) => {
    if (disabled) return;
    if (!replyContent.trim()) return;
    if (isSubmittingReply) return;
    const jwt = getAuthToken();
    if (!jwt) {
      setLoginIntent("reply");
      setShowLoginModal(true);
      return;
    }
    if (!targetEntityId) return;
    try {
      setIsSubmittingReply(true);
      await api.post(
        "/api/comments",
        { data: { content: replyContent, [relation]: targetEntityId, parent: parentId } },
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      setReplyContent("");
      setReplyingTo(null);
      setShowFormatInReply(null);
      await loadComments();
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleUpvoteComment = async (commentId: number) => {
    if (disabled) return;
    const jwt = getAuthToken();
    if (!jwt) {
      setLoginIntent("comment");
      setShowLoginModal(true);
      return;
    }
    const existingUpvoteId = commentUpvoteIds[commentId] || null;
    const existingDownvoteId = commentDownvoteIds[commentId] || null;

    const res = await api.post(
      "/api/post-actions/toggle",
      { data: { targetType: "comment", actionType: "upvote", commentId } },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
    const action = res.data?.data;
    const nextActive = Boolean(action?.active);
    const nextId = action?.documentId || "";

    setCommentUpvoteCounts((prev) => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] || 0) + (nextActive ? 1 : -1)) }));
    if (nextActive && existingDownvoteId) {
      setCommentDownvoteCounts((prev) => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] || 0) - 1) }));
      setCommentDownvoteIds((prev) => {
        const { [commentId]: _removed, ...rest } = prev;
        return rest;
      });
    }
    setCommentUpvoteIds((prev) => {
      if (nextActive) return { ...prev, [commentId]: nextId };
      const { [commentId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleDownvoteComment = async (commentId: number) => {
    if (disabled) return;
    const jwt = getAuthToken();
    if (!jwt) {
      setLoginIntent("comment");
      setShowLoginModal(true);
      return;
    }
    const existingUpvoteId = commentUpvoteIds[commentId] || null;
    const existingDownvoteId = commentDownvoteIds[commentId] || null;

    const res = await api.post(
      "/api/post-actions/toggle",
      { data: { targetType: "comment", actionType: "downvote", commentId } },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
    const action = res.data?.data;
    const nextActive = Boolean(action?.active);
    const nextId = action?.documentId || "";

    setCommentDownvoteCounts((prev) => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] || 0) + (nextActive ? 1 : -1)) }));
    if (nextActive && existingUpvoteId) {
      setCommentUpvoteCounts((prev) => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] || 0) - 1) }));
      setCommentUpvoteIds((prev) => {
        const { [commentId]: _removed, ...rest } = prev;
        return rest;
      });
    }
    setCommentDownvoteIds((prev) => {
      if (nextActive) return { ...prev, [commentId]: nextId };
      const { [commentId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmitCommentReport = async () => {
    if (!reportModal.commentDocId) return;
    const jwt = getAuthToken();
    if (!jwt) { setShowLoginModal(true); return; }
    setIsSubmittingReport(true);
    try {
      await api.post('/api/reports', { comment: reportModal.commentDocId, reason: reportReason, detail: reportDetail || undefined }, { headers: { Authorization: `Bearer ${jwt}` } });
      setReportModal({ open: false, commentDocId: null });
      setReportDetail('');
      setReportReason('other');
    } catch {
      // silent fail
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const renderComment = (comment: any, level: number = 0): React.ReactNode => {
    return (
      <div key={comment.id} id={`comment-${comment.documentId}`} className={`${level > 0 ? "ml-5 pl-3 border-l border-slate-300 dark:border-slate-800" : ""} mb-4`}>
        <div className="flex items-start gap-3">
          {renderAvatar(comment.author?.username || "Anonymous", comment.author?.avatar)}
          <div className="flex-1 min-w-0">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-slate-900 dark:text-white">{comment.author?.username || "Anonymous"}</span>
                <span className="text-xs text-slate-500">{formatDate(comment.createdAt)}</span>
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(comment.content) }} />
            </div>

            {!disabled && (
              <div className="flex items-center gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleUpvoteComment(comment.id)}
                    className={`p-0.5 transition-colors ${commentUpvoteIds[comment.id] ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400"}`}
                    title="Upvote"
                  >
                    <ArrowUp size={14} strokeWidth={commentUpvoteIds[comment.id] ? 2.5 : 2} />
                  </button>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 min-w-[1.5rem] text-center">
                    {(commentUpvoteCounts[comment.id] || 0) - (commentDownvoteCounts[comment.id] || 0)}
                  </span>
                  <button
                    onClick={() => handleDownvoteComment(comment.id)}
                    className={`p-0.5 transition-colors ${commentDownvoteIds[comment.id] ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"}`}
                    title="Downvote"
                  >
                    <ArrowDown size={14} strokeWidth={commentDownvoteIds[comment.id] ? 2.5 : 2} />
                  </button>
                </div>

                <button onClick={() => setReplyingTo(comment.id)} className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <CornerDownRight size={12} />
                  Trả lời
                </button>

                {currentUser && currentUser.id !== (comment.author?.id || comment.author) && (
                  <button
                    onClick={() => { setReportModal({ open: true, commentDocId: comment.documentId }); setReportReason('other'); setReportDetail(''); }}
                    className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    title="Báo cáo bình luận"
                  >
                    <Flag size={12} />
                  </button>
                )}
              </div>
            )}

            {!disabled && replyingTo === comment.id && (
              <div className="mt-3">
                {showFormatInReply === comment.id ? (
                  <div className="relative">
                    <TiptapEditor content={replyContent} onChange={(html) => setReplyContent(html)} placeholder="Viết trả lời..." className="bg-white dark:bg-slate-900" compact />
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      <button onClick={() => toggleReplyFormat(comment.id)} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                        {showFormatInReply === comment.id ? "Ẩn định dạng" : "Hiển thị định dạng"}
                      </button>
                      <button onClick={() => { setReplyingTo(null); setReplyContent(""); setShowFormatInReply(null); }} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">Hủy</button>
                      <button onClick={() => handleSubmitReply(comment.id)} disabled={!replyContent.trim() || isSubmittingReply} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isSubmittingReply ? "Đang gửi..." : "Trả lời"}</button>
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
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      <button onClick={() => toggleReplyFormat(comment.id)} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                        {showFormatInReply === comment.id ? "Ẩn định dạng" : "Hiển thị định dạng"}
                      </button>
                      <button onClick={() => { setReplyingTo(null); setReplyContent(""); setShowFormatInReply(null); }} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">Hủy</button>
                      <button onClick={() => handleSubmitReply(comment.id)} disabled={!replyContent.trim() || isSubmittingReply} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isSubmittingReply ? "Đang gửi..." : "Trả lời"}</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {comment.replies && comment.replies.length > 0 && <div className="mt-3">{comment.replies.map((reply: any) => renderComment(reply, level + 1))}</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <MessageSquare size={20} />
        Bình luận ({comments.length})
      </h2>

      {disabled && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
          <p className="text-orange-800 dark:text-orange-200 text-sm font-medium">{disabledMessage}</p>
        </div>
      )}

      {!disabled && !showCommentForm && (
        <div
          onClick={() => {
            if (!currentUser) {
              setLoginIntent("comment");
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
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">💬 Nhấn để tham gia thảo luận...</p>
        </div>
      )}

      {!disabled && showCommentForm && (
        <div className="mb-8">
          <div className="flex gap-3">
            {renderAvatar(currentUser?.username || "?", (currentUser as any)?.avatar || ((currentUser as any)?.avatarUrl ? { url: (currentUser as any).avatarUrl } : null))}
            <div className="flex-1">
              {showFormatInComment ? (
                <div className="relative">
                  <TiptapEditor content={newComment} onChange={(html) => setNewComment(html)} placeholder="Viết bình luận..." className="bg-slate-50 dark:bg-slate-800" compact />
                  <div className="absolute bottom-2 right-2 flex items-center gap-2">
                    <button onClick={toggleCommentFormat} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                      {showFormatInComment ? "Ẩn định dạng" : "Hiển thị định dạng"}
                    </button>
                    <button onClick={() => { setShowCommentForm(false); setNewComment(""); setShowFormatInComment(false); }} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">Hủy</button>
                    <button onClick={handleSubmitComment} disabled={!newComment.trim() || isSubmittingComment} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isSubmittingComment ? "Đang gửi..." : "Đăng bình luận"}</button>
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
                    <button onClick={toggleCommentFormat} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                      {showFormatInComment ? "Ẩn định dạng" : "Hiển thị định dạng"}
                    </button>
                    <button onClick={() => { setShowCommentForm(false); setNewComment(""); setShowFormatInComment(false); }} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">Hủy</button>
                    <button onClick={handleSubmitComment} disabled={!newComment.trim() || isSubmittingComment} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isSubmittingComment ? "Đang gửi..." : "Đăng bình luận"}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {comments.length === 0 ? <p className="text-center text-slate-500 dark:text-slate-400 py-8">Chưa có bình luận. Hãy là người đầu tiên!</p> : comments.map((comment) => renderComment(comment))}
      </div>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setLoginIntent(null);
        }}
        onLoginSuccess={(user) => {
          handleLoginSuccess(user);
          setShowLoginModal(false);
          if (loginIntent === "comment") {
            setReplyingTo(null);
            setReplyContent("");
            setShowFormatInReply(null);
            setShowCommentForm(true);
          }
          setLoginIntent(null);
        }}
      />

      {/* Report Comment Modal */}
      {reportModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Báo cáo bình luận</h3>
              <button onClick={() => setReportModal({ open: false, commentDocId: null })} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lý do</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="spam">Spam</option>
                  <option value="inappropriate">Nội dung không phù hợp</option>
                  <option value="harassment">Quấy rối</option>
                  <option value="misinformation">Thông tin sai lệch</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chi tiết (tuỳ chọn)</label>
                <textarea
                  value={reportDetail}
                  onChange={(e) => setReportDetail(e.target.value)}
                  placeholder="Mô tả thêm về vi phạm..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setReportModal({ open: false, commentDocId: null })} className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Hủy</button>
                <button
                  onClick={handleSubmitCommentReport}
                  disabled={isSubmittingReport}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmittingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
