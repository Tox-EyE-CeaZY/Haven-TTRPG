"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  CAN_UNDO_COMMAND,
  CAN_REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  FORMAT_ELEMENT_COMMAND,
} from "lexical";
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useCallback, useEffect, useState } from "react";

function ToolbarButton({ onClick, active, label, icon, disabled }: { onClick: () => void; active?: boolean; label: string; icon?: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`mx-1 px-2 py-1 rounded ${active ? "bg-indigo-500 text-white" : "bg-gray-800 text-gray-200 hover:bg-gray-700"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      {icon || label}
    </button>
  );
}

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isBullet, setIsBullet] = useState(false);
  const [isNumbered, setIsNumbered] = useState(false);
  const [blockType, setBlockType] = useState('paragraph');

  // Listen for selection changes to update toolbar state
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          setIsBold(selection.hasFormat("bold"));
          setIsItalic(selection.hasFormat("italic"));
          setIsUnderline(selection.hasFormat("underline"));
          setIsCode(selection.hasFormat("code"));
          // Detect block type for headings, lists, etc.
          const anchorNode = selection.anchor.getNode();
          let type = anchorNode.getType();
          // For list items, check parent type
          if (type === 'listitem') {
            const parent = anchorNode.getParent();
            if (parent) type = parent.getType();
          }
          setBlockType(type);
        }
      });
    });
  }, [editor]);

  // Listen for undo/redo availability
  useEffect(() => {
    return editor.registerCommand(CAN_UNDO_COMMAND, setCanUndo, 1);
  }, [editor]);
  useEffect(() => {
    return editor.registerCommand(CAN_REDO_COMMAND, setCanRedo, 1);
  }, [editor]);

  const format = useCallback((type: "bold" | "italic" | "underline" | "code") => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  }, [editor]);

  const undo = useCallback(() => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  }, [editor]);
  const redo = useCallback(() => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  }, [editor]);

  const setHeading = (level: number) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, `h${level}`);
  };
  const setParagraph = () => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "paragraph");
  };
  const insertBulletList = () => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  };
  const insertNumberedList = () => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  };
  const removeList = () => {
    editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
  };
  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url !== null) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url === '' ? null : url);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <ToolbarButton onClick={undo} label="Undo" icon={<span>&#8630;</span>} disabled={!canUndo} />
      <ToolbarButton onClick={redo} label="Redo" icon={<span>&#8631;</span>} disabled={!canRedo} />
      <span className="mx-2 border-l border-gray-600 h-5" />
      <ToolbarButton onClick={() => format("bold")} label="Bold" icon={<b>B</b>} active={isBold} />
      <ToolbarButton onClick={() => format("italic")} label="Italic" icon={<i>I</i>} active={isItalic} />
      <ToolbarButton onClick={() => format("underline")} label="U" active={isUnderline} />
      <ToolbarButton onClick={() => format("code")} label="Code" icon={<span>{"</>"}</span>} active={isCode} />
      <span className="mx-2 border-l border-gray-600 h-5" />
      <ToolbarButton onClick={setParagraph} label="Paragraph" active={blockType === 'paragraph'} />
      <ToolbarButton onClick={() => setHeading(1)} label="H1" active={blockType === 'h1'} />
      <ToolbarButton onClick={() => setHeading(2)} label="H2" active={blockType === 'h2'} />
      <ToolbarButton onClick={() => setHeading(3)} label="H3" active={blockType === 'h3'} />
      <span className="mx-2 border-l border-gray-600 h-5" />
      <ToolbarButton onClick={insertBulletList} label="Bulleted List" icon={<span>&#8226; ...</span>} active={blockType === 'bullet'} />
      <ToolbarButton onClick={insertNumberedList} label="Numbered List" icon={<span>1. 2. 3.</span>} active={blockType === 'number'} />
      <ToolbarButton onClick={removeList} label="Remove List" />
      <span className="mx-2 border-l border-gray-600 h-5" />
      <ToolbarButton onClick={insertLink} label="Link" icon={<span>&#128279;</span>} />
      {/* Add more tools as needed */}
    </div>
  );
}
