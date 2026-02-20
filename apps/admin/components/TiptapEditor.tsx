"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { Box, Group, ActionIcon, Divider, Text } from '@mantine/core';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Undo,
  Redo,
  ImagePlus,
  Video,
} from 'lucide-react';
import { uploadMedia } from '../lib/upload';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  deferUpload?: boolean;
  onPendingMediaChange?: (items: PendingMediaItem[]) => void;
}

export interface PendingMediaItem {
  id: string;
  file: File;
  kind: 'image' | 'video';
  placeholderSrc: string;
}

const VideoExtension = Node.create({
  name: 'video',
  group: 'block',
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
    return [{ tag: 'video' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(
        {
          controls: true,
          style: 'max-width:100%;height:auto;border-radius:8px;',
        },
        HTMLAttributes
      ),
    ];
  },
});

const YouTubeExtension = Node.create({
  name: 'youtube',
  group: 'block',
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
      'iframe',
      mergeAttributes(
        {
          'data-youtube-embed': 'true',
          width: '100%',
          height: '420',
          frameborder: '0',
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
          allowfullscreen: 'true',
          referrerpolicy: 'strict-origin-when-cross-origin',
          style: 'max-width:100%;border:0;border-radius:8px;',
        },
        HTMLAttributes
      ),
    ];
  },
});

const toYouTubeEmbedUrl = (input: string): string | null => {
  const raw = input.trim();
  if (!raw) return null;

  const match = raw.match(
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (match?.[1]) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }

  return null;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export default function TiptapEditor({
  content,
  onChange,
  placeholder = 'Write something...',
  deferUpload = false,
  onPendingMediaChange,
}: TiptapEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const pushToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 2500);
  };

  const editor = useEditor({
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
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      if (deferUpload) {
        setPendingMedia((prev) => prev.filter((item) => html.includes(item.placeholderSrc)));
      }
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  });

  // Sync content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    onPendingMediaChange?.(pendingMedia);
  }, [pendingMedia, onPendingMediaChange]);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const triggerPick = (kind: 'image' | 'video') => {
    if (kind === 'image') {
      imageInputRef.current?.click();
      return;
    }
    videoInputRef.current?.click();
  };

  const handleUpload = async (file: File | null, kind: 'image' | 'video') => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (kind === 'image' && !isImage) {
      pushToast('error', 'Please choose a valid image file.');
      return;
    }
    if (kind === 'video' && !isVideo) {
      pushToast('error', 'Please choose a valid video file.');
      return;
    }

    try {
      if (deferUpload) {
        const id =
          (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
            .replace(/[^a-zA-Z0-9_-]/g, '');
        const placeholderSrc = URL.createObjectURL(file);

        if (kind === 'image') {
          editor.chain().focus().setImage({ src: placeholderSrc, alt: file.name }).run();
        } else {
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'video',
              attrs: {
                src: placeholderSrc,
                controls: true,
              },
            })
            .run();
        }

        setPendingMedia((prev) => [...prev, { id, file, kind, placeholderSrc }]);
        pushToast('success', 'Added to draft. File will upload when you save.');
        return;
      }

      setUploading(true);
      const uploaded = await uploadMedia(file, { folder: 'forgefeed/editor' });

      if (kind === 'image') {
        editor.chain().focus().setImage({ src: uploaded.url, alt: uploaded.name }).run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'video',
            attrs: {
              src: uploaded.url,
              controls: true,
            },
          })
          .run();
      }
      pushToast('success', 'Uploaded successfully.');
    } catch (error: unknown) {
      pushToast('error', getErrorMessage(error, 'Upload failed.'));
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  return (
    <Box
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {toast ? (
        <Box
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 20,
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            background: toast.type === 'success' ? '#16a34a' : '#dc2626',
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
          }}
        >
          {toast.message}
        </Box>
      ) : null}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleUpload(e.target.files?.[0] || null, 'image')}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => handleUpload(e.target.files?.[0] || null, 'video')}
      />

      {/* Toolbar */}
      <Box
        p="sm"
        style={{
          background: '#fafafa',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Group gap={4}>
          <ActionIcon
            variant={editor.isActive('bold') ? 'filled' : 'subtle'}
            color={editor.isActive('bold') ? 'gray' : 'gray'}
            onClick={() => editor.chain().focus().toggleBold().run()}
            size="sm"
          >
            <Bold size={16} />
          </ActionIcon>
          <ActionIcon
            variant={editor.isActive('italic') ? 'filled' : 'subtle'}
            color={editor.isActive('italic') ? 'gray' : 'gray'}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            size="sm"
          >
            <Italic size={16} />
          </ActionIcon>
          <ActionIcon
            variant={editor.isActive('underline') ? 'filled' : 'subtle'}
            color={editor.isActive('underline') ? 'gray' : 'gray'}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            size="sm"
          >
            <UnderlineIcon size={16} />
          </ActionIcon>
          <ActionIcon
            variant={editor.isActive('strike') ? 'filled' : 'subtle'}
            color={editor.isActive('strike') ? 'gray' : 'gray'}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            size="sm"
          >
            <Strikethrough size={16} />
          </ActionIcon>

          <Divider orientation="vertical" mx={4} />

          <ActionIcon
            variant={editor.isActive('heading', { level: 1 }) ? 'filled' : 'subtle'}
            color={editor.isActive('heading', { level: 1 }) ? 'gray' : 'gray'}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            size="sm"
          >
            <Heading1 size={16} />
          </ActionIcon>
          <ActionIcon
            variant={editor.isActive('heading', { level: 2 }) ? 'filled' : 'subtle'}
            color={editor.isActive('heading', { level: 2 }) ? 'gray' : 'gray'}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            size="sm"
          >
            <Heading2 size={16} />
          </ActionIcon>
          <ActionIcon
            variant={editor.isActive('heading', { level: 3 }) ? 'filled' : 'subtle'}
            color={editor.isActive('heading', { level: 3 }) ? 'gray' : 'gray'}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            size="sm"
          >
            <Heading3 size={16} />
          </ActionIcon>

          <Divider orientation="vertical" mx={4} />

          <ActionIcon
            variant={editor.isActive('bulletList') ? 'filled' : 'subtle'}
            color={editor.isActive('bulletList') ? 'gray' : 'gray'}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            size="sm"
          >
            <List size={16} />
          </ActionIcon>
          <ActionIcon
            variant={editor.isActive('orderedList') ? 'filled' : 'subtle'}
            color={editor.isActive('orderedList') ? 'gray' : 'gray'}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            size="sm"
          >
            <ListOrdered size={16} />
          </ActionIcon>

          <Divider orientation="vertical" mx={4} />

          <ActionIcon
            variant={editor.isActive('blockquote') ? 'filled' : 'subtle'}
            color={editor.isActive('blockquote') ? 'gray' : 'gray'}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            size="sm"
          >
            <Quote size={16} />
          </ActionIcon>
          <ActionIcon
            variant={editor.isActive('code') ? 'filled' : 'subtle'}
            color={editor.isActive('code') ? 'gray' : 'gray'}
            onClick={() => editor.chain().focus().toggleCode().run()}
            size="sm"
          >
            <Code size={16} />
          </ActionIcon>
          <ActionIcon
            variant={editor.isActive('link') ? 'filled' : 'subtle'}
            color={editor.isActive('link') ? 'gray' : 'gray'}
            onClick={addLink}
            size="sm"
          >
            <LinkIcon size={16} />
          </ActionIcon>

          <Divider orientation="vertical" mx={4} />

          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            size="sm"
          >
            <Undo size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            size="sm"
          >
            <Redo size={16} />
          </ActionIcon>

          <Divider orientation="vertical" mx={4} />

          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => triggerPick('image')}
            disabled={uploading}
            size="sm"
            title="Upload image"
          >
            <ImagePlus size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => triggerPick('video')}
            disabled={uploading}
            size="sm"
            title="Upload video"
          >
            <Video size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => {
              const url = window.prompt('Paste YouTube URL:');
              if (!url) return;
              const embedUrl = toYouTubeEmbedUrl(url);
              if (!embedUrl) {
                pushToast('error', 'Invalid YouTube URL.');
                return;
              }
              editor
                .chain()
                .focus()
                .insertContent({
                  type: 'youtube',
                  attrs: { src: embedUrl },
                })
                .run();
            }}
            size="sm"
            title="Embed YouTube"
          >
            YT
          </ActionIcon>
          {uploading ? (
            <Text size="xs" c="dimmed" ml={4}>
              Uploading...
            </Text>
          ) : deferUpload && pendingMedia.length > 0 ? (
            <Text size="xs" c="dimmed" ml={4}>
              Queued: {pendingMedia.length}
            </Text>
          ) : null}
        </Group>
      </Box>

      {/* Editor Content */}
      <Box p="md" style={{ height: 320, overflowY: 'auto' }}>
        <EditorContent editor={editor} />
      </Box>

      <style jsx global>{`
        .tiptap-editor {
          min-height: 288px;
          outline: none;
          color: #1e293b;
        }

        .tiptap-editor p {
          margin: 0.5rem 0;
        }

        .tiptap-editor h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 1rem 0;
        }

        .tiptap-editor h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0.875rem 0;
        }

        .tiptap-editor h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0.75rem 0;
        }

        .tiptap-editor ul,
        .tiptap-editor ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }

        .tiptap-editor blockquote {
          border-left: 3px solid #e2e8f0;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #64748b;
        }

        .tiptap-editor code {
          background: #f1f5f9;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.875rem;
        }

        .tiptap-editor pre {
          background: #0f172a;
          color: white;
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1rem 0;
        }

        .tiptap-editor pre code {
          background: none;
          padding: 0;
          color: white;
        }

        .tiptap-editor a {
          color: #3b82f6;
          text-decoration: underline;
        }

        .tiptap-editor .ProseMirror-placeholder:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          height: 0;
          float: left;
        }
      `}</style>
    </Box>
  );
}
