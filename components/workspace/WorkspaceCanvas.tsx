'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Layers3,
  Maximize2,
  Minimize2,
  MonitorPlay,
  Sparkles,
  Terminal,
  Wand2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const TAB_ITEMS = [
  { key: 'preview', label: 'Preview' },
  { key: 'code', label: 'Code / Edit' },
  { key: 'exports', label: 'Exports' },
] as const;

const PREVIEW_STYLES = [
  { key: 'academic', label: 'Académico' },
  { key: 'serif', label: 'Serif Minimal' },
  { key: 'neon', label: 'Neón Oscuro' },
  { key: 'executive', label: 'Ejecutivo' },
] as const;

const QUICK_STARTERS = [
  {
    id: 'article',
    name: 'Redactar artículo científico',
    type: 'document' as const,
    language: 'markdown',
    path: 'article.md',
    content: '# Artículo científico\n\n## Introducción\n\nEscribe aquí la hipótesis y el marco teórico.',
  },
  {
    id: 'landing',
    name: 'Crear landing page minimalista',
    type: 'web' as const,
    language: 'html',
    path: 'landing.html',
    content: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0a0a0c; color: #f5f3ff; font-family: Inter, sans-serif; }
      .card { max-width: 880px; padding: 48px; border-radius: 22px; background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.2); }
      h1 { font-size: 56px; margin-bottom: 16px; }
      p { color: #d4d4d8; line-height: 1.7; }
      button { background: #8b5cf6; border: none; border-radius: 12px; color: white; padding: 12px 20px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Yosseling Studio</h1>
      <p>Un producto listo para presentar con una estética premium y minimalista.</p>
      <button>Comenzar</button>
    </div>
  </body>
</html>`,
  },
  {
    id: 'python',
    name: 'Script Python',
    type: 'document' as const,
    language: 'python',
    path: 'script.py',
    content: 'def main():\n    print("Hola desde Yosseling")\n\nif __name__ == "__main__":\n    main()',
  },
] as const;

type WorkspaceArtifact = {
  id: string;
  name: string;
  type: 'document' | 'web';
  content: string;
  language: 'markdown' | 'html' | 'json' | 'typescript' | 'javascript' | 'css' | 'python' | 'jsx' | 'tsx' | 'py';
  path: string;
  createdAt: number;
  updatedAt: number;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeArtifactText(raw: string) {
  let cleaned = raw ?? '';

  cleaned = cleaned.replace(/<\/?tool_call\b[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\s*function\s*=\s*['"][^'"]+['"][^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/?function\b[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\s*\/?\s*(tool_call|function)\s*>/gi, '');
  cleaned = cleaned.replace(/<\s*(tool_call|function)\s*[^>]*>/gi, '');
  cleaned = cleaned.replace(/\[\s*tool_call[\s\S]*?\]/gi, '');
  cleaned = cleaned.replace(/\{\s*"tool"\s*:[\s\S]*?\}/gi, '');
  cleaned = cleaned.replace(/\{\s*\w+\s*:\s*\{[\s\S]*?\}\s*\}/gi, '');
  cleaned = cleaned.replace(/(?:^|\s)(?:\/|\\)(?:Users|home|workspace|testbed|tmp|var|opt|root|private|mnt|Applications|Program Files)[^\s\n\r)\]]+/gi, ' ');
  cleaned = cleaned.replace(/(?:^|\s)(?:\/|\\)[A-Za-z0-9._\-/]+(?:\.[A-Za-z0-9]+)?/g, ' ');
  cleaned = cleaned.replace(/(?:\b(?:function|tool|path|filename|file)\s*[:=]\s*(?:\/|\\)[^\n\r]+)/gi, ' ');
  cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => match.replace(/<[^>]+>/g, ''));
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/^\s+|\s+$/g, '');

  return cleaned;
}

function renderInlineMarkdown(text: string) {
  let next = escapeHtml(text);
  next = next.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[a-zA-Z0-9.+-]+;base64,[^\s)]+|\/[^\s)]+)\)/g, (_match, label, url) => {
    const safeUrl = String(url ?? '');
    const altText = label || 'Ilustración';
    const fallback = `
      <svg viewBox="0 0 320 180" width="100%" height="180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${altText}">
        <defs>
          <linearGradient id="imgFill" x1="0" x2="1">
            <stop offset="0%" stop-color="#4c1d95" />
            <stop offset="100%" stop-color="#a78bfa" />
          </linearGradient>
        </defs>
        <rect width="320" height="180" rx="18" fill="#0f172a" stroke="rgba(168,85,247,0.45)"/>
        <rect x="28" y="22" width="264" height="136" rx="14" fill="rgba(124,58,237,0.08)" stroke="rgba(196,181,253,0.5)"/>
        <path d="M72 118 L124 84 L167 98 L208 62 L246 78 L252 118 Z" fill="url(#imgFill)" opacity="0.8"/>
        <circle cx="120" cy="78" r="12" fill="#e9d5ff" opacity="0.9"/>
        <circle cx="200" cy="64" r="10" fill="#ddd6fe" opacity="0.9"/>
        <path d="M52 126 H268" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
        <path d="M62 54 H112" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
      </svg>
      <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;color:#f5f3ff;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;white-space:nowrap;">Ilustración</span>
    `;

    return `<figure class="embedded-figure"><div class="image-card"><img src="${safeUrl}" alt="${altText}" onerror="this.style.display='none'; this.parentNode.querySelector('.image-fallback').style.display='flex';" /><div class="image-fallback" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;">${fallback}</div></div><figcaption>${altText}</figcaption></figure>`;
  });
  next = next.replace(/\[(.*?)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  next = next.replace(/`([^`]+)`/g, '<code>$1</code>');
  next = next.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  next = next.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  next = next.replace(/__(.+?)__/g, '<strong>$1</strong>');
  next = next.replace(/_([^_]+)_/g, '<em>$1</em>');
  next = next.replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>');
  next = next.replace(/\s*#\s+(.+)$/gm, '<h2>$1</h2>');
  next = next.replace(/\s*\*\s+(.+)$/gm, '<li>$1</li>');
  next = next.replace(/\s*[-]\s+(.+)$/gm, '<li>$1</li>');
  next = next.replace(/<li>(.*)<\/li>\s*<li>(.*)<\/li>/g, '<ul><li>$1</li><li>$2</li></ul>');
  next = next.replace(/<li>(.*)<\/li>/g, '<ul><li>$1</li></ul>');
  next = next.replace(/<h2>(.*)<\/h2>/g, '<h2>$1</h2>');
  return next;
}

function parseArrayLiteral(raw: string) {
  const normalized = raw.replace(/'/g, '"').replace(/\bTrue\b/gi, 'true').replace(/\bFalse\b/gi, 'false').replace(/\bNone\b/gi, 'null');
  try {
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildChartSvg(type: 'bar' | 'line' | 'donut', labels: string[], values: number[]) {
  const safeLabels = labels.length ? labels : ['A', 'B', 'C'];
  const safeValues = values.length ? values : [10, 20, 15];
  const maxValue = Math.max(...safeValues, 1);

  if (type === 'donut') {
    const total = safeValues.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) || 1;
    const segments = safeValues.map((value, index) => {
      const startAngle = (safeValues.slice(0, index).reduce((sum, current) => sum + ((Number.isFinite(current) ? current : 0) / total) * 360, 0));
      const endAngle = startAngle + ((Number.isFinite(value) ? value : 0) / total) * 360;
      const x1 = 70 + 50 * Math.cos((startAngle - 90) * (Math.PI / 180));
      const y1 = 70 + 50 * Math.sin((startAngle - 90) * (Math.PI / 180));
      const x2 = 70 + 50 * Math.cos((endAngle - 90) * (Math.PI / 180));
      const y2 = 70 + 50 * Math.sin((endAngle - 90) * (Math.PI / 180));
      const largeArc = ((Number.isFinite(value) ? value : 0) / total) * 360 > 180 ? 1 : 0;
      const color = ['#8b5cf6', '#c084fc', '#a78bfa', '#7c3aed', '#d8b4fe'][index % 5];
      return `<path d="M 70 70 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" opacity="0.9" />`;
    }).join('');

    return `
      <div style="display:flex;flex-direction:column;gap:12px;align-items:center;">
        <svg viewBox="0 0 180 140" width="100%" height="140" xmlns="http://www.w3.org/2000/svg" style="max-width:240px;">
          ${segments}
          <circle cx="70" cy="70" r="20" fill="#f4f1ea" />
          <text x="70" y="76" text-anchor="middle" font-size="12" fill="#1d2433" font-weight="700">${safeValues.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0)}</text>
        </svg>
        <div style="display:flex;flex-wrap:wrap;gap:6px 10px;justify-content:center;font-size:11px;">
          ${safeLabels.map((label, index) => `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:999px;background:${['#8b5cf6', '#c084fc', '#a78bfa', '#7c3aed', '#d8b4fe'][index % 5]};display:inline-block;"></span>${label}</span>`).join('')}
        </div>
      </div>
    `;
  }

  const chartHeight = 180;
  const chartWidth = 420;
  const padding = 28;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2;
  const barWidth = innerWidth / Math.max(safeValues.length, 1);

  const bars = safeValues.map((value, index) => {
    const normalized = (Number(value) / maxValue) * innerHeight;
    const x = padding + index * barWidth + 10;
    const y = chartHeight - padding - normalized;
    const color = ['#8b5cf6', '#c084fc', '#a78bfa', '#7c3aed', '#d8b4fe'][index % 5];
    return `
      <g>
        <rect x="${x}" y="${y}" width="${Math.max(barWidth - 18, 12)}" height="${normalized}" rx="8" fill="${color}" opacity="0.88" />
        <text x="${x + (Math.max(barWidth - 18, 12) / 2)}" y="${chartHeight - padding + 16}" text-anchor="middle" font-size="10" fill="#cbd5e1">${escapeHtml(safeLabels[index] ?? `S${index + 1}`)}</text>
      </g>
    `;
  }).join('');

  const points = safeValues.map((value, index) => {
    const x = padding + index * (innerWidth / Math.max(safeValues.length - 1, 1));
    const y = chartHeight - padding - ((Number(value) / maxValue) * innerHeight);
    return `${x},${y}`;
  }).join(' ');

  const lineChart = type === 'line' ? `
    <polyline points="${points}" fill="none" stroke="#8b5cf6" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
    ${safeValues.map((value, index) => {
      const x = padding + index * (innerWidth / Math.max(safeValues.length - 1, 1));
      const y = chartHeight - padding - ((Number(value) / maxValue) * innerHeight);
      return `<circle cx="${x}" cy="${y}" r="4" fill="#fdf4ff" stroke="#8b5cf6" stroke-width="2" />`;
    }).join('')}
  ` : '';

  return `
    <div style="margin:16px 0;border:1px solid rgba(168,85,247,0.2);background:rgba(15,23,42,0.45);border-radius:18px;padding:14px;">
      <svg viewBox="0 0 ${chartWidth} ${chartHeight}" width="100%" height="200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <g>
          ${type === 'line' ? lineChart : bars}
        </g>
      </svg>
    </div>
  `;
}

function parseChartBlock(block: string) {
  const cleaned = block.trim();
  if (!cleaned) return null;

  const pythonMatch = cleaned.match(/(?:labels|x|categories)\s*=\s*(\[[\s\S]*?\])[\s\S]*?(?:values|y|series)\s*=\s*(\[[\s\S]*?\])/i);
  if (pythonMatch) {
    const labels = parseArrayLiteral(pythonMatch[1]).map((item) => String(item ?? 'Item'));
    const values = parseArrayLiteral(pythonMatch[2]).map((item) => Number(item ?? 0));
    if (labels.length && values.length) {
      return buildChartSvg(values.length > 5 ? 'line' : 'bar', labels, values);
    }
  }

  const inlineMatch = cleaned.match(/(?:^|\n)(?:chart|grafica|gráfico)\s*[:=]\s*(\{[\s\S]*\}|\[[\s\S]*\])$/i);
  if (inlineMatch) {
    try {
      const parsed = JSON.parse(inlineMatch[1]);
      if (Array.isArray(parsed)) {
        const labels = parsed.map((item) => String(item.label ?? item.name ?? item.x ?? 'Item'));
        const values = parsed.map((item) => Number(item.value ?? item.y ?? 0));
        return buildChartSvg('bar', labels, values);
      }
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.data)) {
        const labels = parsed.data.map((item: any) => String(item.label ?? item.name ?? item.x ?? 'Item'));
        const values = parsed.data.map((item: any) => Number(item.value ?? item.y ?? 0));
        const type = parsed.type === 'line' ? 'line' : parsed.type === 'donut' ? 'donut' : 'bar';
        return buildChartSvg(type, labels, values);
      }
    } catch {
      // no-op
    }
  }

  const dataMapMatch = cleaned.match(/(?:labels|categories|x)\s*[:=]\s*(\[[\s\S]*?\])\s*,\s*(?:values|series|y)\s*[:=]\s*(\[[\s\S]*?\])/i);
  if (dataMapMatch) {
    const labels = parseArrayLiteral(dataMapMatch[1]).map((item) => String(item ?? 'Item'));
    const values = parseArrayLiteral(dataMapMatch[2]).map((item) => Number(item ?? 0));
    if (labels.length && values.length) {
      return buildChartSvg(values.length > 5 ? 'line' : 'bar', labels, values);
    }
  }

  const tableRows = cleaned.split('\n').map((row) => row.trim()).filter(Boolean).filter((row) => row.includes('|'));
  if (tableRows.length >= 2) {
    const rows = tableRows.map((row) => row.split('|').map((cell) => cell.trim()).filter(Boolean).slice(1, -1));
    const labels = rows.slice(1).map((cells) => cells[0] ?? 'Item');
    const values = rows.slice(1).map((cells) => Number(cells[cells.length - 1] ?? 0));
    if (labels.length && values.length) {
      return buildChartSvg('bar', labels, values);
    }
  }

  return null;
}

function markdownToHtml(md: string, mode: string) {
  const sanitized = sanitizeArtifactText(md).replace(/\r\n/g, '\n');
  const blocks = sanitized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const palette = {
    academic: { background: '#f4f1ea', text: '#1d2433', accent: '#7c3aed', font: 'Georgia, serif' },
    serif: { background: '#f8f6f2', text: '#1f2937', accent: '#7c3aed', font: 'Times New Roman, serif' },
    neon: { background: '#090b12', text: '#f4f4f5', accent: '#8b5cf6', font: 'Inter, sans-serif' },
    executive: { background: '#111827', text: '#e5e7eb', accent: '#a78bfa', font: 'Segoe UI, sans-serif' },
  }[mode] ?? {
    background: '#f4f1ea', text: '#1d2433', accent: '#7c3aed', font: 'Georgia, serif',
  };

  const body = blocks.map((block) => {
    const chartBlock = parseChartBlock(block);
    if (chartBlock) return chartBlock;

    const cardMatch = block.match(/^:::card(?:\s+title\s*[:=]\s*([\w\s-]+))?\n([\s\S]+?)\n:::/i);
    if (cardMatch) {
      const title = (cardMatch[1] ?? 'Nota').trim();
      const content = cardMatch[2].trim();
      return `<div class="content-card"><div class="card-title">${escapeHtml(title)}</div><div class="card-body">${renderInlineMarkdown(content)}</div></div>`;
    }

    const lines = block.split('\n');
    if (lines.every((line) => /^#{1,6}\s+/.test(line))) {
      return lines.map((line) => `<h2>${renderInlineMarkdown(line.replace(/^#{1,6}\s+/, ''))}</h2>`).join('');
    }

    if (lines.some((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))) {
      const items = lines.map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')).filter(Boolean);
      return `<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`;
    }

    return `<p>${renderInlineMarkdown(block)}</p>`;
  }).join('');

  return `
    <html>
      <head>
        <style>
          body { margin: 0; padding: 32px; background: ${palette.background}; color: ${palette.text}; font-family: ${palette.font}; line-height: 1.7; }
          div.preview-shell { max-width: 980px; margin: 0 auto; border-left: 4px solid ${palette.accent}; padding-left: 24px; }
          h1, h2, h3 { color: ${palette.accent}; margin: 0.6em 0 0.35em; line-height: 1.2; }
          p { margin: 0 0 1em; }
          ul, ol { margin: 0 0 1em 1.25em; padding-left: 1rem; }
          li { margin-bottom: 0.35em; }
          blockquote { border-left: 3px solid ${palette.accent}; margin: 1em 0; padding-left: 1em; color: ${palette.text}; opacity: 0.9; }
          .content-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(168,85,247,0.25); border-radius: 16px; padding: 14px 16px; margin: 1rem 0; box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12); }
          .card-title { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: ${palette.accent}; margin-bottom: 0.5rem; font-weight: 700; }
          .card-body { color: ${palette.text}; }
          .embedded-figure { margin: 1rem 0; display: block; }
          .image-card { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; min-height: 180px; border-radius: 16px; border: 1px solid rgba(168,85,247,0.25); background: rgba(15,23,42,0.6); }
          .image-card img { display: block; width: 100%; max-height: 260px; object-fit: cover; border-radius: 16px; }
          .image-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
          .embedded-figure figcaption { font-size: 12px; color: ${palette.text}; opacity: 0.75; margin-top: 0.4rem; }
          strong { color: ${palette.accent}; }
          code { background: rgba(124, 58, 237, 0.08); padding: 0.1em 0.35em; border-radius: 0.35em; }
        </style>
      </head>
      <body>
        <div class="preview-shell">${body || '<p>Sin contenido.</p>'}</div>
      </body>
    </html>
  `;
}

function createConsoleDebugScript() {
  return `
    <script>
      (() => {
        const send = (level, args) => {
          const safeArgs = args.map((arg) => {
            if (typeof arg === 'string') return arg;
            try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
          });
          window.parent.postMessage({ source: 'yosseling-canvas-console', level, args: safeArgs, at: Date.now() }, '*');
        };

        const originalError = console.error.bind(console);
        const originalLog = console.log.bind(console);

        console.error = (...args) => {
          send('error', args);
          originalError(...args);
        };

        console.log = (...args) => {
          send('log', args);
          originalLog(...args);
        };

        window.addEventListener('error', (event) => {
          send('error', [event.message || 'Runtime error']);
        });
      })();
    </script>
  `;
}

function toMarkdownTable(rows: unknown[][]) {
  if (!rows.length) return '## Datos importados\n\nSin contenido.';
  const normalized = rows
    .map((row) => row.map((cell) => (cell == null ? '' : String(cell))))
    .filter((row) => row.some((cell) => cell.trim().length > 0));

  if (!normalized.length) return '## Datos importados\n\nSin contenido.';

  const [header, ...body] = normalized;
  const safeHeader = header.length ? header : ['Dato'];
  const top = `| ${safeHeader.join(' | ')} |`;
  const separator = `| ${safeHeader.map(() => '---').join(' | ')} |`;
  const items = body.slice(0, 20).map((row) => {
    const values = Array.from({ length: safeHeader.length }, (_, index) => row[index] ?? '');
    return `| ${values.join(' | ')} |`;
  });

  return [top, separator, ...items].join('\n');
}

async function parseImportedFile(file: File): Promise<WorkspaceArtifact> {
  const fileName = file.name || 'documento-importado';
  const lowerName = fileName.toLowerCase();
  const now = Date.now();

  if (lowerName.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const text = await page.getTextContent();
      const pageText = text.items.map((item: any) => (typeof item.str === 'string' ? item.str : '')).join(' ');
      pages.push(pageText.trim());
    }

    return {
      id: `import-pdf-${now}`,
      name: fileName,
      type: 'document',
      content: pages.filter(Boolean).join('\n\n') || `# Documento PDF importado\n\n${fileName}`,
      language: 'markdown',
      path: fileName,
      createdAt: now,
      updatedAt: now,
    };
  }

  if (lowerName.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const content = (result.value || '').trim() || `# Documento DOCX importado\n\n${fileName}`;

    return {
      id: `import-docx-${now}`,
      name: fileName,
      type: 'document',
      content,
      language: 'markdown',
      path: fileName,
      createdAt: now,
      updatedAt: now,
    };
  }

  if (lowerName.endsWith('.pptx')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slideEntries = Object.keys(zip.files)
      .filter((entry) => entry.startsWith('ppt/slides/') && entry.endsWith('.xml'))
      .sort();

    const textBlocks: string[] = [];
    for (const entry of slideEntries) {
      const xml = await zip.file(entry)?.async('string');
      if (!xml) continue;
      const slideText = Array.from(xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g))
        .map((match) => match[1].replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
        .join(' ');
      if (slideText) textBlocks.push(slideText);
    }

    return {
      id: `import-pptx-${now}`,
      name: fileName,
      type: 'document',
      content: textBlocks.length ? textBlocks.map((text) => text.trim()).join('\n\n') : `# Presentación importada\n\n${fileName}`,
      language: 'markdown',
      path: fileName,
      createdAt: now,
      updatedAt: now,
    };
  }

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.csv')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false }) as unknown[][];
    const tableContent = toMarkdownTable(rows);

    return {
      id: `import-sheet-${now}`,
      name: fileName,
      type: 'document',
      content: tableContent,
      language: 'markdown',
      path: fileName,
      createdAt: now,
      updatedAt: now,
    };
  }

  const text = await file.text();
  return {
    id: `import-text-${now}`,
    name: fileName,
    type: 'document',
    content: text || `# Documento importado\n\n${fileName}`,
    language: lowerName.endsWith('.html') ? 'html' : 'markdown',
    path: fileName,
    createdAt: now,
    updatedAt: now,
  };
}

export function WorkspaceCanvas({ currentArtifact, onArtifactChange }: { currentArtifact?: WorkspaceArtifact | null; onArtifactChange?: (artifact: WorkspaceArtifact) => void; }) {
  const {
    workspaceFiles,
    activeWorkspaceFile,
    workspacePanelTab,
    setWorkspacePanelTab,
    setWorkspaceFiles,
    setComposerDraft,
    setIsWorkspaceOpen,
  } = useAppStore();

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const defaultArtifact = currentArtifact ?? (workspaceFiles[0] ? {
    id: workspaceFiles[0].id,
    name: workspaceFiles[0].path.split('/').pop() ?? 'artifact',
    type: workspaceFiles[0].path.endsWith('.html') || workspaceFiles[0].content.includes('<html') ? 'web' : 'document',
    content: workspaceFiles[0].content,
    language: workspaceFiles[0].language,
    path: workspaceFiles[0].path,
    createdAt: workspaceFiles[0].createdAt,
    updatedAt: workspaceFiles[0].updatedAt,
  } : null);

  const [versions, setVersions] = useState<WorkspaceArtifact[]>([]);
  const [versionIndex, setVersionIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [previewStyle, setPreviewStyle] = useState<'academic' | 'serif' | 'neon' | 'executive'>('academic');
  const [consoleLogs, setConsoleLogs] = useState<Array<{ id: number; level: 'log' | 'error'; message: string }>>([]);
  const [ghostMenu, setGhostMenu] = useState<{ visible: boolean; x: number; y: number; text: string }>({ visible: false, x: 0, y: 0, text: '' });
  const [imageModal, setImageModal] = useState<{ open: boolean; paragraph: string; prompt: string; style: 'Academic' | 'Photography' | 'Illustration' | 'Editorial' }>({ open: false, paragraph: '', prompt: '', style: 'Academic' });
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pdfjsGlobal = (pdfjsLib as any);
      const nextOptions = pdfjsGlobal.GlobalWorkerOptions ?? {};
      nextOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjsGlobal.GlobalWorkerOptions = nextOptions;
    }
  }, []);

  useEffect(() => {
    if (!defaultArtifact) {
      setVersions([]);
      setVersionIndex(0);
      return;
    }

    setVersions((previous) => {
      const previousLast = previous[previous.length - 1];
      if (previousLast && previousLast.id === defaultArtifact.id && previousLast.content === defaultArtifact.content) {
        setVersionIndex(Math.max(0, previous.length - 1));
        return previous;
      }

      const next: WorkspaceArtifact[] = [...previous, defaultArtifact].slice(-8) as WorkspaceArtifact[];
      setVersionIndex(Math.max(0, next.length - 1));
      return next;
    });
  }, [defaultArtifact]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== 'yosseling-canvas-console') return;
      const nextLog: { id: number; level: 'log' | 'error'; message: string } = {
        id: Date.now() + Math.random(),
        level: event.data.level === 'error' ? 'error' : 'log',
        message: Array.isArray(event.data.args) ? event.data.args.join(' ') : String(event.data.args ?? ''),
      };
      setConsoleLogs((previous) => [...previous.slice(-20), nextLog]);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const liveArtifact = useMemo(() => {
    if (!defaultArtifact) return null;
    if (!versions.length) return defaultArtifact;
    return versions[Math.min(versionIndex, versions.length - 1)] ?? defaultArtifact;
  }, [defaultArtifact, versionIndex, versions]);

  const previewDoc = useMemo(() => {
    if (!liveArtifact) return '<html><body style="padding:24px;color:#e5e7eb;background:#0a0a0c;">Sin contenido</body></html>';

    const content = sanitizeArtifactText(liveArtifact.content).trim();
    if (!content) return '<html><body style="padding:24px;color:#e5e7eb;background:#0a0a0c;">Sin contenido</body></html>';

    const lower = liveArtifact.path.toLowerCase();
    const isWebArtifact = liveArtifact.type === 'web' || lower.endsWith('.html') || /<!doctype html|<html|<body|<div|<section|<main|<script/i.test(content);

    if (isWebArtifact) {
      const html = content.startsWith('<!DOCTYPE') || content.startsWith('<html') || content.startsWith('<body') ? content : `
        <html>
          <body style="margin:0;background:#0a0a0c;color:#e5e7eb;font-family:Inter,Segoe UI,sans-serif;padding:24px;">
            ${content}
          </body>
        </html>
      `;
      return `${html}${createConsoleDebugScript()}`;
    }

    if (lower.endsWith('.md') || /^(#\s|[-*]\s|\d+\.\s)/m.test(content) || content.includes('```')) {
      return markdownToHtml(content, previewStyle);
    }

    return `
      <html>
        <body style="margin:0;background:#0a0a0c;color:#e5e7eb;font-family:ui-monospace,monospace;padding:24px;">
          <pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(content)}</pre>
        </body>
      </html>
    `;
  }, [liveArtifact, previewStyle]);

  const savedProjects = useMemo(() => {
    const normalizedProjects: WorkspaceArtifact[] = [];

    if (defaultArtifact) normalizedProjects.push(defaultArtifact);
    workspaceFiles.forEach((file) => {
      const project: WorkspaceArtifact = {
        id: file.id,
        name: file.path.split('/').pop() ?? 'artifact',
        type: file.path.endsWith('.html') || file.content.includes('<html') ? 'web' : 'document',
        content: file.content,
        language: file.language,
        path: file.path,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      };
      if (!normalizedProjects.some((item) => item.id === project.id)) {
        normalizedProjects.push(project);
      }
    });

    const documentItems = normalizedProjects.filter((project) => project.type === 'document' && project.language === 'markdown');
    const webItems = normalizedProjects.filter((project) => project.type === 'web');
    const codeItems = normalizedProjects.filter((project) => project.type === 'document' && project.language !== 'markdown');

    return [
      { category: 'Documentos', items: documentItems },
      { category: 'Apps Web', items: webItems },
      { category: 'Código', items: codeItems },
    ];
  }, [defaultArtifact, workspaceFiles]);

  const updateActiveFile = (nextContent: string) => {
    if (!liveArtifact) return;
    const updatedArtifact = { ...liveArtifact, content: nextContent, updatedAt: Date.now() };
    if (onArtifactChange) onArtifactChange(updatedArtifact);

    setVersions((previous) => {
      const next: WorkspaceArtifact[] = [...previous, updatedArtifact].slice(-8) as WorkspaceArtifact[];
      return next;
    });
    setVersionIndex((previous) => Math.max(0, previous));
  };

  const applyImportedArtifact = (artifact: WorkspaceArtifact) => {
    if (onArtifactChange) onArtifactChange(artifact);
    setVersions([artifact]);
    setVersionIndex(0);
    setWorkspacePanelTab('preview');
    setIsWorkspaceOpen(true);
  };

  const handleImportFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const [file] = Array.from(files);
    if (!file) return;

    setIsImporting(true);
    try {
      const imported = await parseImportedFile(file);
      applyImportedArtifact(imported);
    } catch {
      const fallback: WorkspaceArtifact = {
        id: `import-fallback-${Date.now()}`,
        name: file.name || 'archivo-importado',
        type: 'document',
        content: `# ${file.name || 'Archivo importado'}\n\nNo se pudo analizar automáticamente.` ,
        language: 'markdown',
        path: file.name || 'archivo-importado',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      applyImportedArtifact(fallback);
    } finally {
      setIsImporting(false);
      setIsDraggingFile(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  const handleEditProjectWithAI = (project: WorkspaceArtifact) => {
    const context = `Contexto del proyecto: ${project.name}\nRuta: ${project.path}\nTipo: ${project.type}\n\nContenido:\n${project.content}`;
    setComposerDraft(`Edita este proyecto y mejora su estructura, claridad y calidad. Contexto del artefacto:\n\n${context}`);
    setIsWorkspaceOpen(false);
  };

  const handleOpenImageModal = () => {
    const paragraph = getSelectedParagraph();
    if (!paragraph) return;
    setImageModal({
      open: true,
      paragraph,
      prompt: paragraph.slice(0, 180),
      style: 'Academic',
    });
  };

  const handleCreateIllustration = async () => {
    if (!imageModal.paragraph) return;
    setIsGeneratingImage(true);
    try {
      const prompt = `${imageModal.prompt || imageModal.paragraph}, ${imageModal.style.toLowerCase()} style, editorial illustration, detailed, high quality`;
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json() as { success?: boolean; imageUrl?: string; error?: string };
      if (!res.ok || !data.success || !data.imageUrl) {
        throw new Error(data.error ?? 'No se pudo generar la ilustración.');
      }
      const markdown = `\n\n![${imageModal.paragraph.slice(0, 36) || 'Ilustración'}](${data.imageUrl})\n`;
      const textarea = textareaRef.current;
      if (textarea) {
        const currentValue = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const nextValue = `${currentValue.slice(0, start)}${currentValue.slice(start, end)}${markdown}${currentValue.slice(end)}`;
        textarea.value = nextValue;
        updateActiveFile(nextValue);
      }
      setImageModal({ open: false, paragraph: '', prompt: '', style: 'Academic' });
    } catch {
      setImageModal((current) => ({ ...current, open: false }));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const applyTemplate = (template: { name: string; type: 'document' | 'web'; language: string; path: string; content: string }) => {
    const artifact: WorkspaceArtifact = {
      id: `template-${Date.now()}`,
      name: template.name,
      type: template.type,
      content: template.content,
      language: (template.language === 'html' || template.language === 'markdown' || template.language === 'json' || template.language === 'typescript' || template.language === 'javascript' || template.language === 'css' || template.language === 'python' || template.language === 'jsx' || template.language === 'tsx' || template.language === 'py'
        ? template.language
        : 'markdown') as WorkspaceArtifact['language'],
      path: template.path,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (onArtifactChange) onArtifactChange(artifact);
    setVersions([artifact]);
    setVersionIndex(0);
    setWorkspacePanelTab('preview');
    setIsWorkspaceOpen(true);
  };

  const handleCopy = async () => {
    if (!liveArtifact) return;
    try {
      await navigator.clipboard.writeText(liveArtifact.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // no-op
    }
  };

  const handleDownload = () => {
    if (!liveArtifact) return;
    const blob = new Blob([liveArtifact.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = liveArtifact.path.split('/').pop() || 'yosseling-artifact.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleVersionStep = (direction: 'prev' | 'next') => {
    if (!versions.length) return;
    const nextIndex = direction === 'prev' ? Math.max(0, versionIndex - 1) : Math.min(versions.length - 1, versionIndex + 1);
    setVersionIndex(nextIndex);
    const snapshot = versions[nextIndex];
    if (snapshot && onArtifactChange) onArtifactChange(snapshot);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const getSelectedParagraph = () => {
    const textarea = textareaRef.current;
    if (!textarea) return '';
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end).trim();
    if (selected) return selected;

    const before = value.slice(0, start);
    const after = value.slice(end);
    const beforeLine = before.split(/\n/).pop() ?? '';
    const afterLine = after.split(/\n/).find(Boolean) ?? '';
    return (beforeLine + afterLine).trim();
  };

  const handleExportPdf = async () => {
    if (!liveArtifact) return;
    const previewFrame = document.querySelector('iframe[title="Workspace preview"]') as HTMLIFrameElement | null;
    const target = previewFrame?.contentWindow?.document.body;
    if (!target) return;

    const canvas = await html2canvas(target, { backgroundColor: '#0a0a0c', scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageWidth = pageWidth - 40;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    let heightLeft = imageHeight;
    let position = 20;

    pdf.addImage(imgData, 'PNG', 20, position, imageWidth, imageHeight);
    heightLeft -= pageHeight - 40;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight + 40;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 20, position, imageWidth, imageHeight);
      heightLeft -= pageHeight - 40;
    }

    pdf.save((liveArtifact.path.split('/').pop() ?? 'yosseling-artifact') + '.pdf');
  };

  const handleExportDocx = () => {
    if (!liveArtifact) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(liveArtifact.name || 'Yosseling Artifact')}</title>
          <style>
            body {
              margin: 0;
              padding: 32px;
              background: #f8f7fb;
              color: #18181b;
              font-family: Arial, Helvetica, sans-serif;
              line-height: 1.6;
            }
            h1, h2, h3, h4 {
              color: #4c1d95;
              margin: 0 0 12px;
            }
            p, li {
              margin: 0 0 10px;
            }
            code {
              background: rgba(124, 58, 237, 0.08);
              padding: 2px 6px;
              border-radius: 4px;
            }
            pre {
              background: #111827;
              color: #f5f3ff;
              padding: 16px;
              border-radius: 12px;
              overflow-x: auto;
            }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          ${previewDoc.replace(/<html>|<\/html>|<head>[\s\S]*?<\/head>|<body[^>]*>|<\/body>/gi, '')}
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
    const filename = (liveArtifact.path.split('/').pop() ?? 'yosseling-artifact').replace(/\.(html|md|txt|json|py|tsx?|js|css)$/i, '') + '.doc';
    downloadBlob(blob, filename);
  };

  const handleExportHtml = () => {
    if (!liveArtifact) return;
    const blob = new Blob([previewDoc], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, (liveArtifact.path.split('/').pop() ?? 'yosseling-artifact') + '.html');
  };

  const handleSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selection = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
    if (!selection.trim()) {
      setGhostMenu({ visible: false, x: 0, y: 0, text: '' });
      return;
    }

    const rect = textarea.getBoundingClientRect();
    const caretOffset = textarea.value.slice(0, textarea.selectionStart).split('\n').length;
    const top = 16 + (caretOffset - 1) * 22;
    setGhostMenu({
      visible: true,
      x: rect.left + 120,
      y: rect.top + top,
      text: selection,
    });
  };

  const runGhostAction = (action: 'rewrite' | 'translate' | 'expand' | 'fix') => {
    const textarea = textareaRef.current;
    if (!textarea || !ghostMenu.text) return;
    const before = textarea.value.slice(0, textarea.selectionStart);
    const after = textarea.value.slice(textarea.selectionEnd);
    const selected = ghostMenu.text.trim();

    let finalText = selected;
    if (action === 'rewrite') finalText = `Reescrito: ${selected.trim()}`;
    if (action === 'translate') finalText = `[Traducción] ${selected.trim()}`;
    if (action === 'expand') finalText = `${selected.trim()}\n\nMás detalle: El contenido se amplía con contexto adicional y una estructura más clara.`;
    if (action === 'fix') finalText = selected.replace(/teh/gi, 'the').replace(/recieve/gi, 'receive').replace(/occured/gi, 'occurred');

    const nextValue = `${before}${finalText}${after}`;
    textarea.value = nextValue;
    if (liveArtifact && onArtifactChange) {
      onArtifactChange({ ...liveArtifact, content: nextValue, updatedAt: Date.now() });
    }
    setGhostMenu({ visible: false, x: 0, y: 0, text: '' });
  };

  if (!liveArtifact) {
    return (
      <div className="flex h-full flex-col bg-[#090b12] text-slate-300">
        <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-purple-300">Workspace</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[10px] text-purple-100 transition hover:bg-purple-500/20"
            >
              {isImporting ? 'Importando...' : 'Importar'}
            </button>
            <button
              type="button"
              onClick={() => setIsWorkspaceOpen(false)}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
            >
              Cerrar
            </button>
          </div>
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.xlsx,.csv,.html,.md,.txt"
          className="hidden"
          onChange={(event) => void handleImportFiles(event.target.files)}
        />

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          <div
            onDragOver={(event) => { event.preventDefault(); setIsDraggingFile(true); }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(event) => {
              event.preventDefault();
              void handleImportFiles(event.dataTransfer.files);
            }}
            className={`rounded-2xl border border-dashed p-4 transition ${isDraggingFile ? 'border-purple-400 bg-purple-500/10' : 'border-white/10 bg-white/5'}`}
          >
            <div className="mb-2 flex items-center gap-2 text-purple-200">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Importar documento</span>
            </div>
            <p className="text-sm text-slate-300">Arrastra un PDF, DOCX, PPTX, XLSX o CSV para abrirlo automáticamente en el Workspace.</p>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-purple-200">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Quick starters</span>
            </div>
            <p className="text-sm text-slate-300">Inicia un proyecto con una plantilla lista para editar.</p>
          </div>

          <div className="grid gap-3">
            {QUICK_STARTERS.map((starter) => (
              <button
                key={starter.id}
                type="button"
                onClick={() => applyTemplate(starter)}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-purple-500/30 hover:bg-purple-500/10"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{starter.name}</span>
                  <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-purple-200">
                    {starter.type === 'web' ? 'Web' : 'Doc'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{starter.path}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#090b12] text-white">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen((open) => !open)}
            className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
          >
            <FolderOpen className="h-3.5 w-3.5 text-purple-300" />
            Proyectos
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-purple-300">Workspace</span>
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[9px] text-purple-200">
            {liveArtifact.path.split('/').pop()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[10px] text-purple-100 transition hover:bg-purple-500/20"
          >
            {isImporting ? 'Importando...' : 'Importar'}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".pdf,.docx,.pptx,.xlsx,.csv,.html,.md,.txt"
            className="hidden"
            onChange={(event) => void handleImportFiles(event.target.files)}
          />
          {versions.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => handleVersionStep('prev')}
                disabled={versionIndex === 0}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-1"><ChevronLeft className="h-3 w-3" /> Anterior</span>
              </button>
              <button
                type="button"
                onClick={() => handleVersionStep('next')}
                disabled={versionIndex >= versions.length - 1}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="inline-flex items-center gap-1">Siguiente <ChevronRight className="h-3 w-3" /></span>
              </button>
              <span className="text-[9px] text-slate-400">Versión {Math.min(versionIndex + 1, versions.length)} de {versions.length}</span>
            </>
          )}

          <button
            type="button"
            onClick={() => setDrawerOpen((value) => !value)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
            aria-label="Alternar proyectos guardados"
          >
            {drawerOpen ? 'Ocultar' : 'Proyectos'}
          </button>

          <button
            type="button"
            onClick={() => setIsMaximized((value) => !value)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
            aria-label="Maximizar Workspace"
          >
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsWorkspaceOpen(false)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:text-white"
            aria-label="Cerrar Workspace"
          >
            Cerrar
          </button>
        </div>
      </div>

      <div
        onDragOver={(event) => { event.preventDefault(); setIsDraggingFile(true); }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={(event) => {
          event.preventDefault();
          void handleImportFiles(event.dataTransfer.files);
        }}
        className="border-b border-white/5 bg-[#0d0d12]"
      >
        {isDraggingFile && (
          <div className="border-b border-purple-500/30 bg-purple-500/10 px-3 py-2 text-center text-[10px] uppercase tracking-[0.22em] text-purple-100">
            Suelta el archivo para importarlo al Workspace
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setWorkspacePanelTab(tab.key as any)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all duration-300 ease-in-out',
                workspacePanelTab === tab.key
                  ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)]'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('flex min-h-0 flex-1 overflow-hidden transition-all duration-300 ease-in-out', isMaximized && 'bg-[#07080d]')}>
        {drawerOpen && (
          <aside className="w-[220px] border-r border-white/5 bg-[#0b0b12] p-3">
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-purple-300">
              <Layers3 className="h-3.5 w-3.5" />
              Proyectos guardados
            </div>

            <div className="space-y-4 overflow-y-auto">
              {savedProjects.map((group) => (
                <div key={group.category} className="space-y-2">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">{group.category}</p>
                  {group.items.length === 0 ? (
                    <p className="text-[10px] text-slate-500">Vacío</p>
                  ) : (
                    group.items.map((project) => (
                      <div key={`${group.category}-${project.id}`} className="rounded-xl border border-white/10 bg-white/5 p-2 transition hover:border-purple-500/30 hover:bg-purple-500/10">
                        <button
                          type="button"
                          onClick={() => onArtifactChange?.(project)}
                          className="w-full text-left"
                        >
                          <p className="truncate text-[11px] font-medium text-white">{project.name}</p>
                          <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-slate-400">{project.language}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditProjectWithAI(project)}
                          className="mt-2 w-full rounded-lg border border-purple-500/20 bg-purple-500/10 px-2 py-1.5 text-[10px] font-medium text-purple-100 transition hover:bg-purple-500/20"
                        >
                          Editar con IA
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {workspacePanelTab === 'preview' && (
            <div className="flex h-full flex-col overflow-hidden bg-[#0a0a0c]">
              <div className="flex items-center justify-between border-b border-white/5 bg-[#0d0d12] px-3 py-2">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  <MonitorPlay className="h-3.5 w-3.5 text-purple-300" />
                  Preview
                </div>
                <select
                  value={previewStyle}
                  onChange={(event) => setPreviewStyle(event.target.value as typeof previewStyle)}
                  className="rounded-lg border border-white/10 bg-[#0a0a0c] px-2 py-1 text-[10px] text-slate-200 outline-none"
                >
                  {PREVIEW_STYLES.map((style) => (
                    <option key={style.key} value={style.key}>{style.label}</option>
                  ))}
                </select>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                <iframe
                  title="Workspace preview"
                  srcDoc={previewDoc}
                  className="h-full w-full border-0 bg-[#0a0a0c]"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>

              {liveArtifact.type === 'web' && (
                <div className="border-t border-white/5 bg-[#090b12] p-2">
                  <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-purple-300">
                    <Terminal className="h-3.5 w-3.5" />
                    Console / Logs
                  </div>
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-[#0a0a0c] p-2 text-[11px] text-slate-200">
                    {consoleLogs.length === 0 ? (
                      <p className="text-slate-500">Sin errores capturados.</p>
                    ) : (
                      consoleLogs.map((log) => (
                        <div key={log.id} className={cn('rounded-md px-2 py-1', log.level === 'error' ? 'bg-red-500/10 text-red-200' : 'bg-white/5 text-slate-200')}>
                          {log.level === 'error' ? '[ERROR]' : '[LOG]'} {log.message}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {workspacePanelTab === 'code' && (
            <div className="relative flex h-full flex-col overflow-hidden bg-[#0d0d12]">
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <Code2 className="h-3.5 w-3.5 text-purple-300" />
                  Editor
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{liveArtifact.language}</span>
                  <button
                    type="button"
                    onClick={handleOpenImageModal}
                    className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[9px] font-medium text-purple-100 transition hover:bg-purple-500/20"
                  >
                    Generar imagen
                  </button>
                </div>
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={liveArtifact.content}
                  onSelect={handleSelection}
                  onClick={handleSelection}
                  onMouseUp={handleSelection}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    updateActiveFile(nextValue);
                  }}
                  spellCheck={false}
                  className="h-full w-full resize-none bg-[#0d0d12] px-4 py-3 font-mono text-[12px] leading-6 text-slate-100 outline-none"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                />

                {ghostMenu.visible && (
                  <button
                    type="button"
                    onClick={handleOpenImageModal}
                    className="absolute z-20 rounded-lg border border-purple-500/30 bg-[#12131a] px-2 py-1 text-[9px] font-medium text-purple-200 shadow-lg"
                    style={{ left: ghostMenu.x + 8, top: ghostMenu.y + 18 }}
                  >
                    Generar imagen
                  </button>
                )}
              </div>

              {ghostMenu.visible && (
                <div
                  className="absolute z-30 flex gap-2 rounded-xl border border-purple-500/30 bg-[#12131a] p-2 shadow-2xl"
                  style={{ left: ghostMenu.x, top: ghostMenu.y }}
                >
                  {[
                    { label: 'Reescribir', action: 'rewrite' },
                    { label: 'Traducir', action: 'translate' },
                    { label: 'Expandir', action: 'expand' },
                    { label: 'Corregir', action: 'fix' },
                  ].map((option) => (
                    <button
                      key={option.action}
                      type="button"
                      onClick={() => runGhostAction(option.action as 'rewrite' | 'translate' | 'expand' | 'fix')}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-200 hover:bg-purple-500/10"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {workspacePanelTab === 'exports' && (
            <div className="flex h-full flex-col justify-center gap-4 bg-[#0a0a0c] px-5 py-6 text-slate-200">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-300">
                  <FileText className="h-3.5 w-3.5" />
                  Exportar
                </div>
                <p className="mb-4 text-sm text-slate-400">
                  Copia o descarga el contenido actual del artefacto activo.
                </p>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-purple-500/20"
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? 'Copiado' : 'Copiar contenido'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Exportar PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleExportDocx}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Exportar Word
                  </button>
                  <button
                    type="button"
                    onClick={handleExportHtml}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Exportar HTML
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Descargar archivo
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0d0d12] p-4">
                <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">Contenido</p>
                <textarea
                  value={liveArtifact.content}
                  onChange={(event) => updateActiveFile(event.target.value)}
                  spellCheck={false}
                  className="h-44 w-full resize-none rounded-xl border border-white/10 bg-[#0a0a0c] p-3 text-[12px] leading-6 text-slate-200 outline-none focus:border-purple-500/50"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {imageModal.open && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-purple-500/20 bg-[#0c0d13] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.18em] text-purple-300">Generar ilustración</p>
              <button type="button" onClick={() => setImageModal((current) => ({ ...current, open: false }))} className="text-sm text-slate-400 hover:text-white">×</button>
            </div>
            <p className="mb-3 text-sm text-slate-300">Se insertará una imagen markdown justo debajo del párrafo seleccionado.</p>
            <textarea
              value={imageModal.prompt}
              onChange={(event) => setImageModal((current) => ({ ...current, prompt: event.target.value }))}
              className="h-24 w-full resize-none rounded-xl border border-white/10 bg-[#0a0a0c] p-3 text-sm text-slate-200 outline-none focus:border-purple-500/40"
            />
            <div className="mt-3 flex items-center gap-2">
              <label className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Estilo</label>
              <select
                value={imageModal.style}
                onChange={(event) => setImageModal((current) => ({ ...current, style: event.target.value as 'Academic' | 'Photography' | 'Illustration' | 'Editorial' }))}
                className="rounded-lg border border-white/10 bg-[#0a0a0c] px-2 py-1 text-[11px] text-slate-200 outline-none"
              >
                <option value="Academic">Académico</option>
                <option value="Photography">Fotografía</option>
                <option value="Illustration">Ilustración</option>
                <option value="Editorial">Editorial</option>
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setImageModal((current) => ({ ...current, open: false }))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">Cancelar</button>
              <button type="button" disabled={isGeneratingImage} onClick={handleCreateIllustration} className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm text-purple-100 disabled:opacity-60">
                {isGeneratingImage ? 'Generando...' : 'Crear imagen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
