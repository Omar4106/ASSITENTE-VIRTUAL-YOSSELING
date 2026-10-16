'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, RefreshCw, CreditCard as Edit2, Trash2, Volume2, ThumbsUp, ThumbsDown, MoveHorizontal as MoreHorizontal, User, Download, Brain, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { Message } from '@/types';
import { cn } from '@/lib/utils';
import { MediaDownloader } from './MediaDownloader';

interface Props {
  message: Message;
  chatId: string;
  onSpeak?: (text: string) => void;
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extMap: Record<string, string> = {
      powershell: 'ps1', bash: 'sh', python: 'py', javascript: 'js',
      typescript: 'ts', sql: 'sql', html: 'html', css: 'css', json: 'json',
      java: 'java', c: 'c', cpp: 'cpp', text: 'txt',
    };
    const ext = extMap[language] ?? 'txt';
    const blob = new Blob([children], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yosseling_script.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-white/[0.08]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1A1B26] border-b border-white/[0.08]">
        <span className="text-xs text-[#B3B3B3] font-mono">{language || 'text'}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs text-[#B3B3B3] hover:text-purple-300 transition-colors"
          >
            <Download size={12} />
            Descargar
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-[#B3B3B3] hover:text-white transition-colors"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: '#0D0E14',
          fontSize: '13px',
          lineHeight: '1.6',
        }}
        PreTag="div"
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

const GENERAR_IMAGEN_REGEX = /\[GENERAR_IMAGEN:\s*([^\]]+)\]/i;

function AutoIllustration({ prompt }: { prompt: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json() as { url?: string; error?: string };
        if (cancelled) return;
        if (res.ok && data.url) {
          setImageUrl(data.url);
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [prompt]);

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-cyan-200 text-xs">
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
        Generando ilustración...
      </div>
    );
  }

  if (error || !imageUrl) return null;

  return (
    <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block overflow-hidden rounded-xl border border-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Ilustración de Yosseling" className="max-h-[400px] w-full object-cover" />
    </a>
  );
}

export function MessageBubble({ message, chatId, onSpeak }: Props) {
  const { deleteMessage, regenerateResponse, editMessage, settings } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isUser = message.role === 'user';
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const isEmptyStreaming = !isUser && message.isStreaming && !message.content && !message.reasoning && !message.imageUrl && !message.isImageGenerating;

  const socialUrl = isUser && message.content
    ? (() => {
        const SOCIAL_URL_REGEX = /https?:\/\/(?:www\.|m\.)?(?:vt\.tiktok\.com|vm\.tiktok\.com|tiktok\.com|instagram\.com\/(?:reel|p|reels|tv)\/|instagr\.am|reel\.instagram\.com|facebook\.com\/(?:share\/v\/|share\/r\/|share\/|watch\/?|reel\/|videos\/)?|fb\.watch|fb\.gg|youtu\.be|youtube\.com\/(?:watch|shorts|embed))\S+/i;
        return message.content.match(SOCIAL_URL_REGEX)?.[0] ?? null;
      })()
    : null;

  const generarImagenMatch = !isUser && message.content ? message.content.match(GENERAR_IMAGEN_REGEX) : null;
  const generarImagenPrompt = generarImagenMatch?.[1]?.trim() ?? null;
  const displayContent = !isUser && generarImagenPrompt
    ? message.content.replace(GENERAR_IMAGEN_REGEX, '').trim()
    : message.content;

  const userAvatar = settings.userAvatar;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const handleSaveEdit = () => {
    editMessage(chatId, message.id, editContent);
    setIsEditing(false);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('group flex gap-3 px-4 py-3', isUser ? 'justify-end' : 'justify-start')}
      style={isEmptyStreaming ? { display: 'none' } : undefined}
    >
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden border border-purple-500/30 glow-purple">
          <Image
            src="/assets/images/logo_de_yosseling_sin_fondo_.png"
            alt="Yosseling"
            width={32}
            height={32}
            className="object-cover"
          />
        </div>
      )}

      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser && 'items-end')}>
        {!isUser && (
          <span className="text-[10px] font-medium text-purple-300/80 mb-1 select-none">Yosseling</span>
        )}

        <div
          className={cn(
            'relative rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'text-white rounded-tr-sm'
              : 'text-white/90 rounded-tl-sm'
          )}
          style={isUser ? {
            background: 'linear-gradient(135deg, rgba(124,58,237,0.75) 0%, rgba(79,70,229,0.7) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(168,85,247,0.3)',
            boxShadow: '0 4px 20px rgba(124,58,237,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
          } : {
            background: 'rgba(12,9,28,0.72)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(124,58,237,0.12)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                autoFocus
                className="w-full bg-transparent text-sm outline-none resize-none text-white min-h-[60px]"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) handleSaveEdit();
                  if (e.key === 'Escape') { setIsEditing(false); setEditContent(message.content); }
                }}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setIsEditing(false); setEditContent(message.content); }} className="text-xs text-[#B3B3B3] hover:text-white px-2 py-1 rounded">Cancelar</button>
                <button onClick={handleSaveEdit} className="text-xs text-white bg-purple-500 hover:bg-purple-400 px-2 py-1 rounded">Guardar</button>
              </div>
            </div>
          ) : (
            <>
              {!isUser && message.reasoning && (
                <div className="mb-2 rounded-xl border border-purple-500/15 bg-black/30 overflow-hidden">
                  <button
                    onClick={() => setReasoningOpen(o => !o)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-purple-300/70 hover:text-purple-200 transition-colors"
                  >
                    <Brain size={13} className="shrink-0" />
                    <span className="font-medium">
                      {message.isStreaming ? 'Pensando...' : 'Pensamiento de Yosseling'}
                    </span>
                    <ChevronDown
                      size={13}
                      className={cn('ml-auto transition-transform', reasoningOpen && 'rotate-180')}
                    />
                  </button>
                  {reasoningOpen && (
                    <div className="px-3 pb-3 pt-1 text-[12px] leading-relaxed text-slate-400 whitespace-pre-wrap">
                      {message.reasoning}
                    </div>
                  )}
                </div>
              )}
              {message.isImageGenerating && (
                <div className="flex items-center gap-2 text-cyan-200">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                  Generando tu imagen...
                </div>
              )}
              {message.imageUrl && (
                <a href={message.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={message.imageUrl} alt="Imagen generada por Yosseling" className="max-h-[520px] w-full object-cover" />
                </a>
              )}
              {displayContent && (!isUser ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const isInline = !match;
                      if (isInline) {
                        return (
                          <code className="bg-white/10 rounded px-1 py-0.5 text-purple-300 font-mono text-[0.85em]" {...props}>
                            {children}
                          </code>
                        );
                      }
                      return (
                        <CodeBlock language={match[1]}>
                          {String(children).replace(/\n$/, '')}
                        </CodeBlock>
                      );
                    },
                    p({ children }) { return <p className="mb-2 last:mb-0">{children}</p>; },
                    ul({ children }) { return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>; },
                    ol({ children }) { return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>; },
                    h1({ children }) { return <h1 className="text-xl font-bold mb-3 text-white">{children}</h1>; },
                    h2({ children }) { return <h2 className="text-lg font-semibold mb-2 text-white">{children}</h2>; },
                    h3({ children }) { return <h3 className="text-base font-semibold mb-2 text-white/90">{children}</h3>; },
                    blockquote({ children }) { return <blockquote className="border-l-2 border-purple-500 pl-3 text-[#B3B3B3] italic my-2">{children}</blockquote>; },
                    table({ children }) { return <div className="overflow-x-auto my-3"><table className="w-full text-sm border-collapse">{children}</table></div>; },
                    th({ children }) { return <th className="border border-white/10 px-3 py-2 text-left bg-white/5 text-white font-medium">{children}</th>; },
                    td({ children }) { return <td className="border border-white/10 px-3 py-2 text-[#B3B3B3]">{children}</td>; },
                    a({ href, children }) { return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">{children}</a>; },
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
              ) : (
                <p className="whitespace-pre-wrap">{displayContent}</p>
              ))}

              {/* Auto illustration */}
              {!isUser && !message.isStreaming && generarImagenPrompt && (
                <AutoIllustration prompt={generarImagenPrompt} />
              )}

              {message.isStreaming && (
                <span className="typing-cursor" />
              )}

              {socialUrl && (
                <MediaDownloader url={socialUrl} />
              )}
            </>
          )}

          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.attachments.map(file => (
                <div key={file.id} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1.5 text-xs">
                  <span className="text-purple-300">📎</span>
                  <span className="text-white/80 truncate max-w-[120px]">{file.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={cn(
          'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
          isUser ? 'flex-row-reverse' : 'flex-row'
        )}>
          <span className="text-[10px] text-[#B3B3B3]/50">{formatTime(message.timestamp)}</span>

          {!isUser && message.responseTime && (
            <span className="text-[10px] text-[#B3B3B3]/50">· {(message.responseTime / 1000).toFixed(1)}s</span>
          )}

          <div className="flex items-center gap-0.5 ml-1">
            <ActionBtn icon={copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />} label="Copiar" onClick={handleCopy} />
            {!isUser && onSpeak && <ActionBtn icon={<Volume2 size={12} />} label="Leer" onClick={() => onSpeak(message.content)} />}
            {!isUser && <ActionBtn icon={<RefreshCw size={12} />} label="Regenerar" onClick={() => regenerateResponse(chatId, message.id)} />}
            <ActionBtn icon={<Edit2 size={12} />} label="Editar" onClick={() => setIsEditing(true)} />
            <ActionBtn icon={<Trash2 size={12} />} label="Eliminar" onClick={() => deleteMessage(chatId, message.id)} danger />
          </div>
        </div>
      </div>

      {isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden border border-white/10 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgb(124,58,237), rgb(79,70,229))' }}>
          {userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatar} alt="Tu avatar" className="w-full h-full object-cover" />
          ) : (
            <User size={14} className="text-white" />
          )}
        </div>
      )}
    </motion.div>
  );
}

function ActionBtn({
  icon, label, onClick, danger
}: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        'p-1 rounded transition-colors',
        danger ? 'text-[#B3B3B3] hover:text-red-400' : 'text-[#B3B3B3] hover:text-white'
      )}
    >
      {icon}
    </button>
  );
}
