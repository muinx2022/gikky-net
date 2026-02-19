"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, MessageSquare, Share2 } from "lucide-react";
import { getStrapiURL } from "../lib/api";

export interface PostCardPost {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content?: string;
  excerpt?: string;
  createdAt: string;
  author?: {
    id: number;
    username: string;
    avatar?: { url: string; formats?: { thumbnail?: { url: string } } } | null;
  } | null;
  comments?: Array<{ id: number }>;
  commentsCount?: number;
  categories?: Array<{ id: number; name: string; slug?: string }>;
  tags?: Array<{ id: number; name: string }>;
  post_actions?: Array<{
    id: number;
    actionType: "like" | "follow" | "upvote" | "downvote";
    targetType: "post" | "comment";
  }>;
  upvotesCount?: number;
  downvotesCount?: number;
  score?: number;
}

type ContentPreview =
  | { type: "video"; src: string }
  | { type: "image"; src: string; alt: string }
  | { type: "text"; text: string }
  | null;

const decodeEntities = (str: string): string => {
  if (typeof document === "undefined") {
    return str.replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"');
  }
  const el = document.createElement("textarea");
  el.innerHTML = str;
  return el.value;
};

function getContentPreview(content?: string): ContentPreview {
  if (!content) return null;

  const videoBlock = content.match(/<video[\s\S]*?(?:<\/video>|>)/i);
  if (videoBlock) {
    const srcMatch = videoBlock[0].match(/src=["']([^"']+)["']/i);
    const src = srcMatch?.[1];
    if (src) return { type: "video", src: decodeEntities(src) };
  }

  const imgMatch = content.match(/<img[^>]+>/i);
  if (imgMatch) {
    const srcMatch = imgMatch[0].match(/src=["']([^"']+)["']/i);
    const altMatch = imgMatch[0].match(/alt=["']([^"']*)["']/i);
    const src = srcMatch?.[1];
    if (src) return { type: "image", src: decodeEntities(src), alt: altMatch?.[1] ?? "" };
  }

  const plain = content
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return null;

  const words = plain.split(/\s+/);
  const trimmed = words.slice(0, 150).join(" ") + (words.length > 150 ? "..." : "");
  return { type: "text", text: trimmed };
}

interface PostCardProps {
  post: PostCardPost;
  formatDate: (value: string) => string;
  categoryPrefix?: "c" | "r";
  formatCategoryTitle?: (value: string) => string;
  onShare: (post: PostCardPost) => void;
}

export default function PostCard({ post, formatDate, formatCategoryTitle, onShare }: PostCardProps) {
  const router = useRouter();
  const commentsCount = post.commentsCount ?? post.comments?.length ?? 0;
  const upvotesCount =
    post.upvotesCount ??
    post.post_actions?.filter((action) => action.targetType === "post" && action.actionType === "upvote").length ??
    0;
  const downvotesCount =
    post.downvotesCount ??
    post.post_actions?.filter((action) => action.targetType === "post" && action.actionType === "downvote").length ??
    0;
  const score = upvotesCount - downvotesCount;

  const preview = getContentPreview(post.content);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && !entry.isIntersecting) el.pause();
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [preview?.type]);

  const postUrl = `/p/${post.slug}--${post.documentId}`;

  return (
    <article
      className="px-5 py-4 transition hover:bg-slate-50 cursor-pointer"
      onClick={() => router.push(postUrl)}
    >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {(() => {
              const av = post.author?.avatar;
              const rawUrl = av?.formats?.thumbnail?.url || av?.url;
              const avatarUrl = rawUrl ? (rawUrl.startsWith("http") ? rawUrl : getStrapiURL(rawUrl)) : null;
              const authorUsername = post.author?.username;
              const inner = (
                <>
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                    {avatarUrl
                      ? <img src={avatarUrl} alt={authorUsername || ""} className="h-full w-full object-cover" />
                      : (authorUsername || "?").charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{authorUsername || "anonymous"}</span>
                </>
              );
              return authorUsername ? (
                <Link
                  href={`/user/${encodeURIComponent(authorUsername)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 hover:underline"
                >
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-2">{inner}</div>
              );
            })()}
          </div>
          <span className="text-sm text-slate-400">{formatDate(post.createdAt)}</span>
        </div>

        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-900 md:text-xl">
          <Link href={postUrl} onClick={(e) => e.stopPropagation()} className="hover:underline">{post.title}</Link>
        </h2>

        {preview?.type === "video" && (
          <div onClick={(event) => event.stopPropagation()} className="mb-3">
            <video
              ref={videoRef}
              src={preview.src}
              className="w-full rounded-xl object-contain"
              style={{ maxHeight: 460 }}
              playsInline
              preload="metadata"
              loop
              controls
            />
          </div>
        )}

        {preview?.type === "image" && (
          <img
            src={preview.src}
            alt={preview.alt}
            referrerPolicy="no-referrer"
            className="mb-3 w-full rounded-xl object-contain"
            style={{ maxHeight: 460 }}
          />
        )}

        {preview?.type === "text" && <p className="mb-3 text-base leading-relaxed text-slate-700">{preview.text}</p>}

        {post.categories && post.categories.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {post.categories.slice(0, 4).map((category) => (
              <Link
                key={category.id}
                href={category.slug ? `/c/${category.slug}` : "#"}
                onClick={(e) => e.stopPropagation()}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {formatCategoryTitle ? formatCategoryTitle(category.name) : category.name}
              </Link>
            ))}
          </div>
        )}
        {post.tags && post.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {post.tags.slice(0, 6).map((tag) => (
              <Link
                key={tag.id}
                href={`/tag/${encodeURIComponent(tag.name)}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-5 border-t border-slate-100 pt-3 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare size={15} />
            {commentsCount} bình luận
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye size={15} />
            <span className={score > 0 ? "text-green-600" : score < 0 ? "text-red-600" : ""}>
              {score > 0 ? `+${score}` : score} điểm
            </span>
          </span>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onShare(post);
            }}
            className="ml-auto inline-flex items-center gap-1.5 font-medium text-slate-600 transition hover:text-[#2563eb]"
          >
            <Share2 size={15} />
            Chia sẻ
          </button>
        </div>
    </article>
  );
}
