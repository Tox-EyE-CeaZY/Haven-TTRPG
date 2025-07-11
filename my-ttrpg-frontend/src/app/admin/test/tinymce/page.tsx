"use client";

import { Editor } from '@tinymce/tinymce-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function TinyMceTestPage() {
  const [editorContent, setEditorContent] = useState('<p>Start typing here...</p>');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleEditorChange = (content: string, editor: any) => {
    setEditorContent(content);
    console.log('Editor content changed:', content);
  };

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4 md:p-8 flex flex-col">
      <div className="mb-4">
        <Link href="/admin/test" className="text-indigo-400 hover:text-indigo-200 transition-colors">
          &larr; Back to Admin Test
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-indigo-400 mb-6">TinyMCE Editor Test</h1>

      <div
        className="flex-1 min-h-[400px] min-w-0 flex flex-col bg-gray-700 rounded-lg shadow-xl p-4"
        style={{ flex: 1, minHeight: 0, minWidth: 0 }}
      >
        {isClient && (
          <Editor
            id="main-tinymce-editor"
            apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY}
            init={{
              height: '100%',
              menubar: false,
              plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
              ],
              toolbar: 'undo redo | blocks | ' +
                       'bold italic forecolor | alignleft aligncenter ' +
                       'alignright alignjustify | bullist numlist outdent indent | ' +
                       'removeformat | help',
              content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px; color: #d1d5db; }',
              skin: 'oxide-dark',
              content_css: 'dark',
              autoresize_bottom_margin: 0,
            }}
            value={editorContent}
            onEditorChange={handleEditorChange}
            style={{ height: '100%', width: '100%' }}
          />
        )}
      </div>

      {/* Optional: Display the raw HTML content */}
      {/* <div className="mt-6 p-4 bg-gray-700 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-indigo-300 mb-3">Raw HTML Output</h2>
        <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words">{editorContent}</pre>
      </div> */}
    </div>
  );
}