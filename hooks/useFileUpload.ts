'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { AttachedFile } from '@/types';

function genId() {
  return Math.random().toString(36).substring(2, 15);
}

const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'audio/ogg': 'audio',
  'audio/m4a': 'audio',
  'audio/x-m4a': 'audio',
  'audio/webm': 'audio',
  'audio/aac': 'audio',
  'video/mp4': 'video',
};

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm'];

export function useFileUpload() {
  const { addPendingFile } = useAppStore();

  const processFile = useCallback(async (file: File): Promise<AttachedFile | null> => {
    const type = ACCEPTED_TYPES[file.type] || file.type.split('/')[1] || 'unknown';

    const attachedFile: AttachedFile = {
      id: genId(),
      name: file.name,
      type,
      size: file.size,
    };

    if (file.type.startsWith('image/')) {
      // Images — read as data URL for preview + vision analysis
      const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      attachedFile.dataUrl = dataUrl;
    } else if (file.type === 'application/pdf' || type === 'pdf') {
      // PDFs — read as data URL so the server can send the binary to Claude
      const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      attachedFile.dataUrl = dataUrl;
    } else if (file.type.startsWith('audio/') || AUDIO_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))) {
      // Audio files — read as data URL for server-side analysis
      const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      attachedFile.dataUrl = dataUrl;
      attachedFile.type = 'audio';
    } else {
      // Text-based files — read as text
      const text = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.readAsText(file);
      }).catch(() => '');
      if (text) {
        attachedFile.content = text.slice(0, 8000);
      }
    }

    addPendingFile(attachedFile);
    return attachedFile;
  }, [addPendingFile]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    await Promise.all(arr.map(processFile));
  }, [processFile]);

  return { processFile, processFiles };
}
