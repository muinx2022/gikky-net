"use client";

import { Check, Copy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface SharePost {
  title: string;
  slug: string;
  documentId: string;
}

interface ShareModalProps {
  post: SharePost | null;
  onClose: () => void;
}

export default function ShareModal({ post, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [post?.documentId]);

  const postUrl = useMemo(() => {
    if (!post) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/p/${post.slug}--${post.documentId}`;
  }, [post]);

  if (!post) return null;

  const openShareWindow = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer,width=680,height=520");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-400 bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Chia sẻ bài viết</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close share modal">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 line-clamp-2 text-sm text-slate-600">{post.title}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`)}
            className="rounded border border-slate-400 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Facebook
          </button>
          <button
            onClick={() =>
              openShareWindow(
                `https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(post.title)}`
              )
            }
            className="rounded border border-slate-400 px-3 py-2 text-sm hover:bg-slate-50"
          >
            X (Twitter)
          </button>
          <button
            onClick={() =>
              openShareWindow(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`)
            }
            className="rounded border border-slate-400 px-3 py-2 text-sm hover:bg-slate-50"
          >
            LinkedIn
          </button>
          <button
            onClick={() =>
              openShareWindow(
                `https://www.reddit.com/submit?url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(post.title)}`
              )
            }
            className="rounded border border-slate-400 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Reddit
          </button>
          <button
            onClick={() =>
              openShareWindow(`https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(post.title)}`)
            }
            className="rounded border border-slate-400 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Telegram
          </button>
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center justify-center gap-1 rounded border border-slate-400 px-3 py-2 text-sm hover:bg-slate-50"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Đã sao chép" : "Sao chép link"}
          </button>
        </div>
      </div>
    </div>
  );
}
