"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

function ToolbarButton({
  onClick,
  active,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded border transition ${
        active
          ? "bg-[#ef2f5b] text-white border-[#ef2f5b]"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("Enter URL", previousUrl);

    if (url === null) return;

    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 bg-gray-50 p-3">
      <ToolbarButton
        label="P"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      />
      <ToolbarButton
        label="H1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        label="H2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="H3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        label="Bullet List"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="Numbered List"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton label="Link" onClick={setLink} />
      <ToolbarButton
        label="Table"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      />
      <ToolbarButton
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

const editorClassName = [
  "min-h-[500px]",
  "px-4",
  "py-4",
  "focus:outline-none",
  "text-gray-900",

  "[&_h1]:text-3xl",
  "[&_h1]:font-bold",
  "[&_h1]:mt-8",
  "[&_h1]:mb-4",

  "[&_h2]:text-2xl",
  "[&_h2]:font-semibold",
  "[&_h2]:mt-7",
  "[&_h2]:mb-3",

  "[&_h3]:text-xl",
  "[&_h3]:font-semibold",
  "[&_h3]:mt-6",
  "[&_h3]:mb-3",

  "[&_h4]:text-lg",
  "[&_h4]:font-semibold",
  "[&_h4]:mt-5",
  "[&_h4]:mb-2",

  "[&_p]:my-3",
  "[&_p]:leading-7",

  "[&_br]:leading-7",

  "[&_ul]:my-3",
  "[&_ul]:list-disc",
  "[&_ul]:pl-6",

  "[&_ol]:my-3",
  "[&_ol]:list-decimal",
  "[&_ol]:pl-6",

  "[&_li]:my-1",
  "[&_li]:leading-7",

  "[&_li>p]:my-0",
  "[&_li>p]:leading-7",

  "[&_blockquote]:my-4",
  "[&_blockquote]:border-l-4",
  "[&_blockquote]:border-[#ef2f5b]",
  "[&_blockquote]:pl-4",
  "[&_blockquote]:italic",

  "[&_hr]:my-6",

  "[&_a]:text-[#ef2f5b]",
  "[&_a]:underline",

  "[&_table]:w-full",
  "[&_table]:border-collapse",
  "[&_table]:my-5",

  "[&_th]:border",
  "[&_th]:border-gray-300",
  "[&_th]:bg-gray-100",
  "[&_th]:p-3",
  "[&_th]:text-left",

  "[&_td]:border",
  "[&_td]:border-gray-300",
  "[&_td]:p-3",
].join(" ");

export default function RichTextEditor({
  value,
  onChange,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
        hardBreak: {
          keepMarks: true,
        },
        link: {
          openOnClick: false,
          autolink: true,
        },
      }),
      TableKit.configure({
        table: {
          resizable: true,
        },
      }),
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class: editorClassName,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;

    const nextValue = value || "<p></p>";
    const current = editor.getHTML();

    if (nextValue !== current) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
        Enter = new paragraph or new list item · Shift + Enter = line break
      </div>
    </div>
  );
}