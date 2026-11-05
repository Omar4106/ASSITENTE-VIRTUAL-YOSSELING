'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  className?: string;
  readOnly?: boolean;
}

const LANGUAGE_SYNTAX_CONFIG: Record<string, { bg: string; fg: string; keywords: string[] }> = {
  typescript: {
    bg: 'bg-[#1e1e1e]',
    fg: 'text-[#d4d4d4]',
    keywords: [
      'import', 'from', 'export', 'function', 'const', 'let', 'var', 'return', 'if', 'else',
      'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'class', 'interface',
      'type', 'extends', 'implements', 'new', 'this', 'super', 'this', 'return',
      'async', 'await', 'Promise', 'undefined', 'null', 'true', 'false',
      'React', 'useState', 'useEffect', 'useRef', 'useCallback',
    ],
  },
  css: {
    bg: 'bg-[#1e1e1e]',
    fg: 'text-[#d4d4d4]',
    keywords: ['color', 'background', 'display', 'flex', 'grid', 'padding', 'margin', 'width', 'height'],
  },
  json: {
    bg: 'bg-[#1e1e1e]',
    fg: 'text-[#d4d4d4]',
    keywords: [],
  },
  markdown: {
    bg: 'bg-[#fafafa]',
    fg: 'text-[#374151]',
    keywords: ['', ''],
  },
  javascript: {
    bg: 'bg-[#1e1e1e]',
    fg: 'text-[#d4d4d4]',
    keywords: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while'],
  },
};

export function CodeEditor({ className, readOnly = true }: CodeEditorProps) {
  const { activeWorkspaceFile, workspaceFiles, setWorkspaceFiles } = useAppStore();
  const activeFile = workspaceFiles.find(f => f.id === activeWorkspaceFile);

  const [code, setCode] = useState(activeFile?.content ?? '');
  const [language, setLanguage] = useState(activeFile?.language ?? 'typescript');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (activeFile) {
      setCode(activeFile.content);
      setLanguage(activeFile.language);
    } else {
      setCode('');
      setLanguage('typescript');
    }
  }, [activeFile?.id, activeFile?.content, activeFile?.language]);

  useEffect(() => {
    if (!activeFile || readOnly) return;

    const timeoutId = window.setTimeout(() => {
      const currentState = useAppStore.getState();
      let didChange = false;
      const updatedFiles = currentState.workspaceFiles.map((file) => {
        if (file.id !== activeFile.id) return file;
        if (file.content === code) return file;
        didChange = true;
        return { ...file, content: code, isModified: true, updatedAt: Date.now() };
      });

      if (didChange) {
        currentState.setWorkspaceFiles(updatedFiles);
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [code, activeFile?.id, readOnly]);

  const highlightCode = (code: string, lang: string): string => {
    const config = LANGUAGE_SYNTAX_CONFIG[lang] || LANGUAGE_SYNTAX_CONFIG.typescript;
    let hl = code;

    // Escape HTML
    hl = hl.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Highlight keywords
    if (config.keywords.length > 0) {
      config.keywords.forEach(keyword => {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
        hl = hl.replace(regex, '<span class="text-purple-400 font-bold">$1</span>');
      });
    }

    // Highlight brackets
    hl = hl.replace(/\[([^\]]+)\]/g, '<span class="text-cyan-400">[$1]</span>');
    hl = hl.replace(/\{/g, '<span class="text-purple-400 text-red-400">{</span>');
    hl = hl.replace(/\}/g, '<span class="text-purple-400 text-red-400">}</span>');

    // Highlight strings
    hl = hl.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, '<span class="text-green-400">$&</span>');

    // Highlight comments
    hl = hl.replace(/(\/\/.*$)/gm, '<span class="text-slate-500 italic">$1</span>');
    hl = hl.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-slate-500 italic">$1</span>');

    return hl;
  };

  const syncScroll = () => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.parentElement?.scrollTop ?? 0;
    }
  };

  return (
    <div
      className={cn(
        'flex h-full bg-[#0d0e14] overflow-hidden',
        className
      )}
    >
      {/* Line Numbers */}
      <div
        className={cn(
          'flex flex-col items-end justify-start pt-2 pr-4 text-right text-slate-600 select-none',
          LANGUAGE_SYNTAX_CONFIG[language]?.bg.split(' ')[0]
        )}
        style={{ fontFamily: 'monospace' }}
      >
        {code.split('\n').map((_, i) => (
          <div
            key={i}
            className="h-[21px] leading-[21px] text-xs"
            style={{ fontFamily: 'monospace' }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Code Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Static highlighted version (background) */}
        {code.length > 0 && !readOnly && (
          <div
            className="absolute inset-0 w-full overflow-auto pointer-events-none whitespace-pre-wrap text-[13px] leading-[21px] p-4 pr-12"
            style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
            // usamos un timeout para evitar un ciclo infinito
            dangerouslySetInnerHTML={{ __html: highlightCode(code, language) }}
          />
        )}

        {/* Editable textarea (foreground) */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          readOnly={readOnly}
          className={cn(
            'absolute inset-0 w-full h-full px-4 py-2 outline-none',
            'resize-none overflow-auto whitespace-pre-wrap',
            'text-[13px] leading-[21px]',
            readOnly ? 'opacity-50 cursor-not-allowed' : 'opacity-100',
            LANGUAGE_SYNTAX_CONFIG[language]?.fg
          )}
          style={{
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            resize: 'none',
          }}
          spellCheck={false}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}