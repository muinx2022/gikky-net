"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

interface TiptapEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

export function TiptapEditor({ content, onChange, placeholder = 'Write something...', className = '' }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    autofocus: 'end',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none text-slate-900 dark:text-slate-100 min-h-[160px]',
      },
    },
  }, [placeholder])

  useEffect(() => {
    if (!editor) return
    const id = setTimeout(() => {
      editor.chain().focus('end').run()
    }, 0)
    return () => clearTimeout(id)
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (content !== current) {
      editor.commands.setContent(content || '', { emitUpdate: false })
    }
  }, [editor, content])

  if (!editor) {
    return null
  }

  return (
    <div className={`border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden flex flex-col bg-white dark:bg-slate-900 ${className}`}>
      {/* Toolbar */}
      <div className="border-b border-slate-200 dark:border-slate-700 p-2 flex items-center gap-1 flex-wrap rounded-t-lg bg-white dark:bg-slate-900">
        <button
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBold().run();
          }}
          className={`px-2 py-1 rounded text-sm font-semibold transition-colors ${
            editor.isActive('bold')
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
            editor.isActive('italic')
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
            editor.isActive('underline')
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
            editor.isActive('strike')
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
            editor.isActive('heading', { level: 2 })
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
            editor.isActive('heading', { level: 3 })
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
            editor.isActive('bulletList')
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
            editor.isActive('orderedList')
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
            editor.isActive('codeBlock')
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          type="button"
        >
          {'</>'}
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto cursor-text p-4 min-h-[160px]" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

