"use client";

import { Download, FileText, ImageIcon, Music2, Video } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function GalleryPanel() {
  const chats = useAppStore((state) => state.chats);
  const items = chats.flatMap((chat) =>
    chat.messages.flatMap((message) => {
      const generated = [
        message.imageUrl ? { id: `${message.id}-image`, name: 'Imagen generada', type: 'image', url: message.imageUrl } : null,
        message.audioUrl ? { id: `${message.id}-audio`, name: 'Audio generado', type: 'audio', url: message.audioUrl } : null,
        message.videoUrl ? { id: `${message.id}-video`, name: 'Video generado', type: 'video', url: message.videoUrl } : null,
      ];
      const attachments = (message.attachments ?? []).map((file, index) => ({
        id: `${message.id}-file-${index}`,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'document',
        url: file.dataUrl,
      }));
      return [...generated, ...attachments].filter((item): item is { id: string; name: string; type: string; url: string } => Boolean(item?.url));
    }),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Galería / Mis Creaciones</h2>
        <p className="mt-0.5 text-xs text-white/50">{items.length} elementos multimedia</p>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-white/50">
          Las imágenes, videos, audios y documentos aparecerán aquí.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 overflow-y-auto p-4">
          {items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
              {item.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-purple-500/15 to-cyan-500/10">
                  {item.type === 'audio' ? <Music2 className="text-purple-300" /> : item.type === 'video' ? <Video className="text-cyan-300" /> : <FileText className="text-white/70" />}
                </div>
              )}
              <div className="flex items-center gap-2 border-t border-white/[0.06] px-2 py-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-white/70">{item.name}</span>
                <a href={item.url} download={item.name} target="_blank" rel="noreferrer" className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white" aria-label={`Descargar ${item.name}`}>
                  <Download size={13} />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
