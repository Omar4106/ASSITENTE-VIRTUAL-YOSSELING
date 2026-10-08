'use client';

import { useCallback, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { AttachedFile } from '@/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 120000;
const BINARY_EXTENSIONS = new Set(['exe', 'dll', 'bin', 'msi', 'so', 'dylib', 'app']);
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'csv', 'ts', 'tsx', 'js', 'jsx', 'css', 'html', 'xml', 'yaml', 'yml',
  'sql', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'log', 'ini', 'env', 'sh', 'bat', 'toml',
]);

function genId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsText(file);
  });
}

function readAsBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: await readAsBuffer(file) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const text = await page.getTextContent();
    pages.push((text.items as Array<{ str?: string }>).map(item => item.str ?? '').join(' '));
  }
  return pages.map((text, index) => `Página ${index + 1}:\n${text}`).join('\n\n');
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: await readAsBuffer(file) });
  return result.value;
}

async function extractPptx(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await readAsBuffer(file));
  const slideNames = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const parser = new DOMParser();
  const slides: string[] = [];
  for (const name of slideNames) {
    const xml = parser.parseFromString(await zip.files[name].async('text'), 'application/xml');
    const text = Array.from(xml.getElementsByTagName('a:t')).map(node => node.textContent ?? '').join(' ');
    slides.push(`Diapositiva ${slides.length + 1}:\n${text}`);
  }
  return slides.join('\n\n');
}

function extractBinaryMetadata(buffer: ArrayBuffer, file: File): string {
  const bytes = new Uint8Array(buffer);
  const printable: string[] = [];
  let current = '';
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    if (byte >= 32 && byte <= 126) current += String.fromCharCode(byte);
    else if (current.length >= 4) {
      printable.push(current);
      current = '';
    } else current = '';
  }
  if (current.length >= 4) printable.push(current);
  const signature = Array.from(bytes.slice(0, 16)).map(byte => byte.toString(16).padStart(2, '0')).join(' ');
  return [
    `Nombre: ${file.name}`,
    `Tamaño: ${file.size} bytes`,
    `Tipo declarado: ${file.type || 'desconocido'}`,
    `Cabecera (primeros bytes): ${signature || 'vacía'}`,
    `Cadenas legibles encontradas (muestra):\n${printable.slice(0, 300).join('\n') || 'Ninguna'}`,
  ].join('\n');
}

async function extractContent(file: File, extension: string): Promise<{ content?: string; dataUrl?: string }> {
  if (file.type.startsWith('image/')) return { dataUrl: await readAsDataUrl(file) };
  if (extension === 'pdf') return { content: await extractPdf(file) };
  if (extension === 'docx') return { content: await extractDocx(file) };
  if (extension === 'pptx') return { content: await extractPptx(file) };
  if (BINARY_EXTENSIONS.has(extension)) return { content: extractBinaryMetadata(await readAsBuffer(file), file) };
  if (TEXT_EXTENSIONS.has(extension) || file.type.startsWith('text/')) return { content: await readAsText(file) };
  return { content: `Archivo ${file.name} recibido. No hay un extractor específico para este formato.` };
}

export function useFileUpload() {
  const { addPendingFile } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingName, setProcessingName] = useState('');
  const [error, setError] = useState('');

  const processFile = useCallback(async (file: File): Promise<AttachedFile | null> => {
    if (file.size > MAX_FILE_SIZE) {
      setError(`${file.name} supera el límite de 10 MB.`);
      return null;
    }
    setProcessingName(file.name);
    const extension = extensionOf(file.name);
    try {
      const extracted = await extractContent(file, extension);
      const content = extracted.content?.slice(0, MAX_TEXT_LENGTH);
      const attachedFile: AttachedFile = {
        id: genId(), name: file.name, type: file.type || extension || 'unknown', size: file.size,
        content, dataUrl: extracted.dataUrl,
      };
      addPendingFile(attachedFile);
      return attachedFile;
    } catch {
      setError(`No pude extraer el contenido de ${file.name}. Puedes probar con otro formato.`);
      return null;
    }
  }, [addPendingFile]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setError('');
    setIsProcessing(true);
    try {
      for (const file of Array.from(files)) await processFile(file);
    } finally {
      setIsProcessing(false);
      setProcessingName('');
    }
  }, [processFile]);

  return { processFile, processFiles, isProcessing, processingName, error, clearError: () => setError('') };
}
