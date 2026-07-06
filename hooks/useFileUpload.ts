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
};

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
      const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      attachedFile.dataUrl = dataUrl;
    } else {
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
