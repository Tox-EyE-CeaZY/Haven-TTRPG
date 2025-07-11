"use client";

import { useEffect, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { $getRoot, $getSelection } from "lexical";
import Link from "next/link";
import { ToolbarPlugin } from "@/components/lexical/ToolbarPlugin";

const theme = {
  // Add custom theme styles here if needed
};

export default function LexicalTestPage() {
  const initialConfig = {
    namespace: "LexicalTestEditor",
    theme,
    onError(error) {
      throw error;
    },
    nodes: [HeadingNode, ListNode, ListItemNode, QuoteNode, LinkNode],
  };

  return (
    <div className="min-h-screen bg-gray-800 text-white p-2 md:p-4 flex flex-col">
      <div className="mb-4">
        <Link href="/admin/test" className="text-indigo-400 hover:text-indigo-200 transition-colors">
          &larr; Back to Admin Test
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-indigo-400 mb-6">Lexical Editor Test</h1>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-full max-w-6xl flex-1 bg-gray-700 rounded-lg shadow-xl px-0 py-2 min-h-[400px] overflow-hidden flex flex-col">
          <LexicalComposer initialConfig={initialConfig}>
            {/* Top Bar inside LexicalComposer for context */}
            <div className="flex items-center justify-between bg-gray-900 rounded-t-lg px-3 py-2 border-b border-gray-600">
              <ToolbarPlugin />
            </div>
            {/* Editor area with placeholder inside, fills remaining space */}
            <div className="relative flex-1 min-h-[350px] flex flex-col">
              <RichTextPlugin
                contentEditable={<ContentEditable className="outline-none w-full h-full min-h-[350px] p-2 bg-transparent flex-1" style={{height: '100%', userSelect: 'text', whiteSpace: 'pre-wrap', wordBreak: 'break-word'}} />}
                placeholder={<div className="absolute left-2 top-2 text-gray-400 pointer-events-none select-none">Start typing...</div>}
              />
              <ListPlugin />
              <LinkPlugin />
            </div>
            <HistoryPlugin />
            <OnChangePlugin onChange={editorState => {
              // You can handle editor state changes here if needed
            }} />
          </LexicalComposer>
        </div>
      </div>
    </div>
  );
}
