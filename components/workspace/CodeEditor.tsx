'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  className?: string;
  inputRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  onSelection?: () => void;
  readOnly?: boolean;
}

function getLanguage(path: string | undefined, language: string | undefined) {
  const extension = path?.split('.').pop()?.toLowerCase();
  if (extension === 'tsx' || extension === 'jsx') return 'tsx';
  if (extension === 'ts') return 'typescript';
  if (extension === 'js') return 'javascript';
  if (extension === 'css') return 'css';
  if (extension === 'html') return 'html';
  if (extension === 'json') return 'json';
  if (extension === 'md') return 'markdown';
  if (extension === 'py' || language === 'python') return 'python';
  return language ?? 'typescript';
}

export function CodeEditor({ className, inputRef, onSelection, readOnly = true }: CodeEditorProps) {
  const workspaceFiles = useAppStore((state) => state.workspaceFiles);
  const activeWorkspaceFile = useAppStore((state) => state.activeWorkspaceFile);
  const setWorkspaceFiles = useAppStore((state) => state.setWorkspaceFiles);
  const activeFile = workspaceFiles.find((file) => file.id === activeWorkspaceFile);
  const [code, setCode] = useState(activeFile?.content ?? '');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const language = useMemo(
    () => getLanguage(activeFile?.path, activeFile?.language),
    [activeFile?.language, activeFile?.path],
  );
  const lineCount = Math.max(1, code.split('\n').length);

  useEffect(() => {
    setCode(activeFile?.content ?? '');
  }, [activeFile?.content, activeFile?.id]);

  useEffect(() => {
    if (!activeFile || readOnly || code === activeFile.content) return;
    const timeoutId = window.setTimeout(() => {
      const currentFiles = useAppStore.getState().workspaceFiles;
      setWorkspaceFiles(currentFiles.map((file) => (
        file.id === activeFile.id
          ? { ...file, content: code, isModified: true, updatedAt: Date.now() }
          : file
      )));
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [activeFile, code, readOnly, setWorkspaceFiles]);

  const syncScroll = () => {
    if (!textareaRef.current || !highlightRef.current) return;
    highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  };

  return (
    <div className={cn('relative h-full min-h-0 overflow-hidden bg-[#1e1e1e]', className)}>
      {!activeFile ? (
        <div className="flex h-full items-center justify-center text-xs text-slate-500">
          Selecciona un archivo para editarlo.
        </div>
      ) : (
        <>
          <div
            ref={highlightRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              wrapLongLines
              customStyle={{
                background: 'transparent',
                margin: 0,
                minHeight: '100%',
                padding: '12px 16px 12px 58px',
                fontSize: '12px',
                lineHeight: '21px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflow: 'visible',
              }}
              codeTagProps={{ style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } }}
            >
              {code || ' '}
            </SyntaxHighlighter>
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-[46px] overflow-hidden bg-[#1e1e1e] pt-3 text-right font-mono text-[11px] leading-[21px] text-[#858585]"
          >
            {Array.from({ length: lineCount }, (_, index) => (
              <div key={index} className="pr-2">{index + 1}</div>
            ))}
          </div>

          <textarea
            ref={(element) => {
              textareaRef.current = element;
              if (inputRef) inputRef.current = element;
            }}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onScroll={syncScroll}
            onSelect={onSelection}
            onClick={onSelection}
            onMouseUp={onSelection}
            readOnly={readOnly}
            aria-label={activeFile.path}
            className={cn(
              'absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent py-3 pl-[58px] pr-4 font-mono text-[12px] leading-[21px] outline-none',
              readOnly ? 'cursor-default' : 'cursor-text',
            )}
            style={{
              color: 'transparent',
              caretColor: '#f4f4f5',
              WebkitTextFillColor: 'transparent',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
              tabSize: 2,
            }}
            spellCheck={false}
          />
        </>
      )}
    </div>
  );
}
