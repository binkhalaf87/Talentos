import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { useCallback, useState, useEffect, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Undo2, Redo2, Sparkles, Loader2, AlignLeft, AlignCenter, AlignRight,
  Heading2, Heading3, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResumeRichEditorProps {
  content: string;
  onChange: (html: string) => void;
  onRephraseSelection: (selectedText: string) => Promise<string | null>;
  isRTL?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

const ToolbarButton = ({
  active, onClick, children, disabled, title,
}: {
  active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      "p-1.5 rounded-md transition-colors disabled:opacity-40",
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )}
  >
    {children}
  </button>
);

const ResumeRichEditor = ({
  content,
  onChange,
  onRephraseSelection,
  isRTL = false,
  placeholder: placeholderText = "Start typing...",
  disabled = false,
}: ResumeRichEditorProps) => {
  const [rephrasing, setRephrasing] = useState(false);
  const [bubbleMenu, setBubbleMenu] = useState<{ top: number; left: number } | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Placeholder.configure({ placeholder: placeholderText }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, " ");
      if (selectedText.trim().length > 0) {
        const coords = editor.view.coordsAtPos(from);
        const wrapperRect = editorWrapperRef.current?.getBoundingClientRect();
        if (wrapperRect) {
          setBubbleMenu({
            top: coords.top - wrapperRect.top - 45,
            left: coords.left - wrapperRect.left,
          });
        }
      } else {
        setBubbleMenu(null);
      }
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-5",
          "prose-headings:text-foreground prose-headings:font-display",
          "prose-p:text-foreground prose-p:leading-relaxed prose-p:my-1",
          "prose-strong:text-foreground prose-strong:font-semibold",
          "prose-ul:text-foreground prose-ol:text-foreground",
          "prose-li:text-foreground prose-li:my-0.5",
          isRTL ? "text-right direction-rtl" : "text-left"
        ),
        dir: isRTL ? "rtl" : "ltr",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleRephrase = useCallback(async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;

    setRephrasing(true);
    try {
      const improved = await onRephraseSelection(selectedText);
      if (improved && improved.trim()) {
        editor.chain().focus().deleteSelection().insertContent(improved.trim()).run();
      }
    } finally {
      setRephrasing(false);
      setBubbleMenu(null);
    }
  }, [editor, onRephraseSelection]);

  if (!editor) return null;

  return (
    <div ref={editorWrapperRef} className="relative border border-border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border bg-muted/30 flex-wrap">
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Floating Bubble Menu */}
      {bubbleMenu && (
        <div
          className="absolute z-50 flex items-center gap-1 bg-popover border border-border rounded-lg shadow-lg px-2 py-1.5"
          style={{ top: bubbleMenu.top, left: bubbleMenu.left }}
        >
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn("p-1 rounded", editor.isActive("bold") ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn("p-1 rounded", editor.isActive("italic") ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <Separator orientation="vertical" className="h-4 mx-0.5" />
          <button
            type="button"
            onClick={handleRephrase}
            disabled={rephrasing}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {rephrasing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {isRTL ? "إعادة صياغة" : "Rephrase"}
          </button>
        </div>
      )}

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
};

export default ResumeRichEditor;
