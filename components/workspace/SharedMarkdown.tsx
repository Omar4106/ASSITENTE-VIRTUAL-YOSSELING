'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function SharedMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-headings:text-purple-100 prose-a:text-purple-300 prose-blockquote:border-purple-400/40">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
