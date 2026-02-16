"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
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
    actionType: "like" | "follow";
    targetType: "post" | "comment";
  }>;
  likesCount?: number;
}

type ContentPreview =
  | { type: "video"; src: string }
  | { type: "image"; src: string; alt: string }
  | { type: "rich"; html: string }
  | { type: "text"; text: string }
  | null;

const hasRichFormatting = (content: string) =>
  /<(h[1-6]|ul|ol|li|blockquote|pre|code|strong|b|em|i|u|s|a|table|iframe)\b/i.test(content);

function getContentPreview(content?: string): ContentPreview {
  if (!content) return null;

  const videoBlock = content.match(/<video[\s\S]*?(?:<\/video>|>)/i);
  if (videoBlock) {
    const srcMatch = videoBlock[0].match(/src=["']([^"']+)["']/i);
    const src = srcMatch?.[1];
    if (src) return { type: "video", src };
  }

  const imgMatch = content.match(/<img[^>]+>/i);
  if (imgMatch) {
    const srcMatch = imgMatch[0].match(/src=["']([^"']+)["']/i);
    const altMatch = imgMatch[0].match(/alt=["']([^"']*)["']/i);
    const src = srcMatch?.[1];
    if (src) return { type: "image", src, alt: altMatch?.[1] ?? "" };
  }

  if (hasRichFormatting(content)) {
    return { type: "rich", html: content };
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
  const trimmed = words.slice(0, 36).join(" ") + (words.length > 36 ? "..." : "");
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
  const commentsCount = post.commentsCount ?? post.comments?.length ?? 0;
  const likesCount =
    post.likesCount ??
    post.post_actions?.filter((action) => action.targetType === "post" && action.actionType === "like").length ??
    0;

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

  return (
    <Link href={`/p/${post.slug}--${post.documentId}`} className="block">
      <article className="px-5 py-4 transition hover:bg-slate-50">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {(() => {
              const av = post.author?.avatar;
              const rawUrl = av?.formats?.thumbnail?.url || av?.url;
              const avatarUrl = rawUrl ? (rawUrl.startsWith("http") ? rawUrl : getStrapiURL(rawUrl)) : null;
              return (
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                  {avatarUrl
                    ? <img src={avatarUrl} alt={post.author?.username || ""} className="h-full w-full object-cover" />
                    : (post.author?.username || "?").charAt(0).toUpperCase()}
                </div>
              );
            })()}
            <span className="font-medium">{post.author?.username || "anonymous"}</span>
          </div>
          <span className="text-sm text-slate-400">{formatDate(post.createdAt)}</span>
        </div>

        <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-900 md:text-xl">{post.title}</h2>

        {preview?.type === "video" && (
          <div onClick={(event) => event.preventDefault()} className="mb-3">
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
            className="mb-3 w-full rounded-xl object-contain"
            style={{ maxHeight: 460 }}
          />
        )}

        {preview?.type === "text" && <p className="mb-3 text-base leading-relaxed text-slate-700">{preview.text}</p>}
        {preview?.type === "rich" && (
          <div
            className="prose mb-3 max-w-none text-[15px] leading-7 text-slate-700"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        )}

        {post.categories && post.categories.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {post.categories.slice(0, 4).map((category) => (
              <span key={category.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {formatCategoryTitle ? formatCategoryTitle(category.name) : category.name}
              </span>
            ))}
          </div>
        )}
        {post.tags && post.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {post.tags.slice(0, 6).map((tag) => (
              <span key={tag.id} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-5 border-t border-slate-100 pt-3 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare size={15} />
            {commentsCount} replies
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye size={15} />
            {likesCount} likes
          </span>
          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onShare(post);
            }}
            className="ml-auto inline-flex items-center gap-1.5 font-medium text-slate-600 transition hover:text-[#2563eb]"
          >
            <Share2 size={15} />
            Share
          </button>
        </div>
      </article>
    </Link>
  );
}
