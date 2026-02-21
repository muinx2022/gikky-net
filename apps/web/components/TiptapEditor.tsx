"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { mergeAttributes, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { ImageIcon, Video, Youtube } from "lucide-react";
import { uploadMedia } from "../lib/upload";

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  uploadMode?: "immediate" | "deferred";
  onPendingUploadsChange?: (
    items: Array<{ id: string; file: File; kind: "image" | "video"; blobUrl: string }>
  ) => void;
}

const VideoExtension = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: "video" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(
        {
          controls: true,
          style: "max-width:100%;height:auto;border-radius:8px;",
        },
        HTMLAttributes
      ),
    ];
  },
});

const YouTubeExtension = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "iframe[data-youtube-embed='true']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "iframe",
      mergeAttributes(
        {
          "data-youtube-embed": "true",
          width: "100%",
          height: "420",
          frameborder: "0",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
          allowfullscreen: "true",
          referrerpolicy: "strict-origin-when-cross-origin",
          style: "max-width:100%;border:0;border-radius:8px;",
        },
        HTMLAttributes
      ),
    ];
  },
});

const toYouTubeEmbedUrl = (input: string): string | null => {
  const raw = input.trim();
  if (!raw) return null;

  const watchMatch = raw.match(
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (watchMatch?.[1]) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`;
  }

  return null;
};

export default function TiptapEditor({
  content,
  onChange,
  placeholder = "Viáº¿t gÃ¬ Ä‘Ã³...",
  className = "",
  compact = false,
  uploadMode = "immediate",
  onPendingUploadsChange,
}: TiptapEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pendingUploads, setPendingUploads] = useState<
    Array<{ id: string; file: File; kind: "image" | "video"; blobUrl: string }>
  >([]);

  const pushToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    onPendingUploadsChange?.(pendingUploads);
  }, [pendingUploads, onPendingUploadsChange]);

  useEffect(() => {
    return () => {
      pendingUploads.forEach((item) => URL.revokeObjectURL(item.blobUrl));
    };
  }, [pendingUploads]);

  const editorBodyHeightClass = compact ? "h-[180px]" : "h-[420px]";
  const toolbarClass = compact
    ? "border-b border-slate-300 dark:border-slate-800 p-1.5 flex items-center gap-1 flex-wrap rounded-t-lg bg-white dark:bg-slate-900"
    : "border-b border-slate-300 dark:border-slate-800 p-2 flex items-center gap-1 flex-wrap rounded-t-lg bg-white dark:bg-slate-900";
  const contentClass = compact
    ? `overflow-y-auto cursor-text p-3 pb-10 ${editorBodyHeightClass}`
    : `overflow-y-auto cursor-text p-4 pb-12 ${editorBodyHeightClass}`;
  const proseClass = compact ? "prose prose-sm" : "prose";

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        Link.configure({
          openOnClick: false,
        }),
        Image.configure({
          allowBase64: false,
          inline: false,
        }),
        VideoExtension,
        YouTubeExtension,
        Placeholder.configure({
          placeholder,
        }),
      ],
      content,
      autofocus: "end",
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: `${proseClass} dark:prose-invert w-full !max-w-none focus:outline-none text-slate-900 dark:text-slate-100 h-full`,
        },
      },
    },
    [placeholder, compact]
  );

  useEffect(() => {
    if (!editor) return;
    const id = setTimeout(() => {
      editor.chain().focus("end").run();
    }, 0);
    return () => clearTimeout(id);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content !== current) {
      editor.commands.setContent(content || "", false);
    }
  }, [editor, content]);

  if (!editor) {
    return null;
  }

  const triggerPick = (kind: "image" | "video") => {
    if (kind === "image") {
      imageInputRef.current?.click();
      return;
    }
    videoInputRef.current?.click();
  };

  const handleUpload = async (file: File | null, kind: "image" | "video") => {
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (kind === "image" && !isImage) {
      pushToast("error", "Vui lÃ²ng chá»n file áº£nh há»£p lá»‡.");
      return;
    }
    if (kind === "video" && !isVideo) {
      pushToast("error", "Vui lÃ²ng chá»n file video há»£p lá»‡.");
      return;
    }

    if (uploadMode === "deferred") {
      const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const blobUrl = URL.createObjectURL(file);
      setPendingUploads((prev) => [...prev, { id: pendingId, file, kind, blobUrl }]);

      if (kind === "image") {
        editor.chain().focus().setImage({ src: blobUrl, alt: file.name }).run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "video",
            attrs: {
              src: blobUrl,
              controls: true,
            },
          })
          .run();
      }
      pushToast("success", "ÄÃ£ Ä‘Ã­nh kÃ¨m. File sáº½ Ä‘Æ°á»£c táº£i lÃªn khi báº¡n Ä‘Äƒng.");
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }

    try {
      setUploading(true);
      const uploaded = await uploadMedia(file, { folder: "forgefeed/editor" });

      if (kind === "image") {
        editor.chain().focus().setImage({ src: uploaded.url, alt: uploaded.name }).run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "video",
            attrs: {
              src: uploaded.url,
              controls: true,
            },
          })
          .run();
      }
      if (kind === "video" && uploaded.trimmed) {
        pushToast("success", "Táº£i lÃªn thÃ nh cÃ´ng. Video Ä‘Ã£ Ä‘Æ°á»£c cáº¯t tá»± Ä‘á»™ng cÃ²n 180 giÃ¢y.");
      } else {
        pushToast("success", "Táº£i lÃªn thÃ nh cÃ´ng.");
      }
    } catch (error: any) {
      const message = error?.message || "Táº£i lÃªn tháº¥t báº¡i.";
      pushToast("error", message);
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  return (
    <div
      className={`relative border border-slate-300 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col bg-white dark:bg-slate-900 ${className}`}
    >
      {toast ? (
        <div
          className={`absolute right-2 top-2 z-20 rounded px-3 py-1.5 text-xs font-medium shadow ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files?.[0] || null, "image")}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files?.[0] || null, "video")}
      />

      <div className={toolbarClass}>
        <button
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBold().run();
          }}
          className={`px-2 py-1 rounded text-sm font-semibold transition-colors ${
            editor.isActive("bold")
              ? "bg-blue-600 text-white"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          type="button"
        >
          B
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleItalic().run();
          }}
          className={`px-2 py-1 rounded text-sm italic transition-colors ${
            editor.isActive("italic")
              ? "bg-blue-600 text-white"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          type="button"
        >
          I
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleUnderline().run();
          }}
          className={`px-2 py-1 rounded text-sm underline transition-colors ${
            editor.isActive("underline")
              ? "bg-blue-600 text-white"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          type="button"
        >
          U
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleStrike().run();
          }}
          className={`px-2 py-1 rounded text-sm line-through transition-colors ${
            editor.isActive("strike")
              ? "bg-blue-600 text-white"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          type="button"
        >
          S
        </button>
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />
        <button
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 2 }).run();
          }}
          className={`px-2 py-1 rounded text-sm transition-colors ${
            editor.isActive("heading", { level: 2 })
              ? "bg-blue-600 text-white"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          type="button"
        >
          H2
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 3 }).run();
          }}
          className={`px-2 py-1 rounded text-sm transition-colors ${
            editor.isActive("heading", { level: 3 })
              ? "bg-blue-600 text-white"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          type="button"
        >
          H3
        </button>
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />
        <button
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBulletList().run();
          }}
          className={`px-2 py-1 rounded text-sm transition-colors ${
            editor.isActive("bulletList")
              ? "bg-blue-600 text-white"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          type="button"
        >
          * List
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleOrderedList().run();
          }}
          className={`px-2 py-1 rounded text-sm transition-colors ${
            editor.isActive("orderedList")
              ? "bg-blue-600 text-white"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          type="button"
        >
          1. List
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleCodeBlock().run();
          }}
          className={`px-2 py-1 rounded text-sm font-mono transition-colors ${
            editor.isActive("codeBlock")
              ? "bg-blue-600 text-white"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
          type="button"
        >
          {"</>"}
        </button>
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />
        <button
          type="button"
          onClick={() => triggerPick("image")}
          disabled={uploading}
          className="inline-flex items-center justify-center rounded px-2 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          title="Ảnh"
        >
          <ImageIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => triggerPick("video")}
          disabled={uploading}
          className="inline-flex items-center justify-center rounded px-2 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          title="Video"
        >
          <Video size={16} />
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Dán URL YouTube:");
            if (!url) return;
            const embedUrl = toYouTubeEmbedUrl(url);
            if (!embedUrl) {
              pushToast("error", "URL YouTube không hợp lệ.");
              return;
            }
            editor
              .chain()
              .focus()
              .insertContent({
                type: "youtube",
                attrs: { src: embedUrl },
              })
              .run();
          }}
          className="inline-flex items-center justify-center rounded px-2 py-1 text-slate-700 hover:bg-slate-200"
          title="YouTube"
        >
          <Youtube size={16} />
        </button>
        {uploading ? <span className="text-xs text-slate-500">Đang tải lên...</span> : null}
      </div>

      <div className={contentClass} onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}



