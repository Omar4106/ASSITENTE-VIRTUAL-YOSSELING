# Plan de Arquitectura: Workspace Type-CANVAS para Yosseling

## Arquitectura Objetivo

```
┌─────────────────────────────────────────────────────────────┐
│  app/workspace/page.tsx                                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  3-Column Split Layout                                  │ │
│  │  │                                                      │ │
│  │  │ Left:  Chat Area (mínimo 350px)                     │ │
│  │  │  ┌───────────────────────────────┐                  │ │
│  │  │  │ Chat Area (existente)         │                  │ │
│  │  │  │                               │                  │ │
│  │  │  └───────────────────────────────┘                  │ │
│  │  │                                                      │ │
│  │  │ Center:  Preview + Editor (flex main)                │ │
│  │  │  ├─ Panel tabs (Preview / Editor)                    │ │
│  │  │  │   ┌───────────────────────┐                       │ │
│  │  │  │   │ Preview Panel        │                       │ │
│  │  │  │   │ - iframe o @preview   │                       │ │
│  │  │  │   │ - Live React render   │                       │ │
│  │  │  │   │ - Styles dinámicos    │                       │ │
│  │  │  │   │                       │                       │ │
│  │  │  │   └───────────────────────┘                       │ │
│  │  │  │   ┌───────────────────────┐                       │ │
│  │  │  │   │ Editor Panel (Code)   │                       │ │
│  │  │  │   │ - Monaco editor       │                       │ │
│  │  │  │   │ - Syntax highlighting   │                       │ │
│  │  │  │   │ - Download export     │                       │ │
│  │  │  │   │ - Export PDF/MD       │                       │ │
│  │  │  │   └───────────────────────┘                       │ │
│  │  │                                                      │ │
│  │  │ Right:  File Explorer + Tools Panel                  │ │
│  │  │  ┌───────────────────────┐                          │ │
│  │  │  │ File Explorer         │                          │ │
│  │  │  │ - arr Extensions      │                          │ │
│  │  │  │ - src/                │                          │ │
│  │  │  │ - public/             │                          │ │
│  │  │  │ - components/         │                          │ │
│  │  │  │   - draggable files   │                          │ │
│  │  │  │   - context menus     │                          │ │
│  │  │  └───────────────────────┘                          │ │
│  │  │  ┌───────────────────────┐                          │ │
│  │  │  │ Exports Panel         │                          │ │
│  │  │  │ - Export Code 2 File  │                          │ │
│  │  │  │ - Copy to Clipboard   │                          │ │
│  │  │  │ - Export PDF          │                          │ │
│  │  │  │ - Export Markdown     │                          │ │
│  │  │  └───────────────────────┘                          │ │
│  │  └─────────────────────────────────────────────────────┘ │
│  │                                                      │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Fase 1: Foundation & Types (1-2 días)

**1.1 New Types (`types/workspace.ts`)**
- `WorkspaceFile`: { path, content, language, type, isModified }
- `PanelTabType`: 'preview' | 'code' | 'files' | 'exports'
- `ExportFormat`: 'code' | 'pdf' | 'markdown'
- `ExecutionContext`: { lang, files, imports }

**1.2 Extend State (`lib/store.ts`)**
```typescript
interface AppState {
  // ... existing
  workspaceFiles: WorkspaceFile[];
  activeWorkspaceFile: string | null;
  workspacePanelTab: PanelTabType;
  previewUrl: string | null;
  executionContext: ExecutionContext | null;
}
```

### Fase 2: File Management System (1-2 días)

**2.1 File Explorer (`components/workspace/FileExplorer.tsx`)**
- Virtual file system (arrays, filtered by path patterns)
- Drag-drop upload
- Context menus (rename, delete, duplicate)
- Toast notifications

**2.2 File Operations (`lib/workspace/files.ts`)**
- `createNewFile(path, content)`
- `deleteFile(path)`
- `renameFile(path, name)`
- `commitFile(path)` (track uncommitted changes)
- `loadRoutesFromFileSystem()`

**2.3 Workspace Database (`lib/db/workspace.ts`)**
- Supabase table: `workspace_files`
- Schema: id, path, content, language, created_at, updated_at
- `loadWorkspace(), saveWorkspace(), clearWorkspace()`

### Fase 3: Live Preview Engine (1 día)

**3.1 Preview Router API (`app/api/preview/route.ts`)**
```typescript
POST /api/preview
- Receives { files: WorkspaceFile[] }
- Builds ephemeral app (Next.js eval o Shadcn.utils)
- Serves preview in iframe
- Returns previewUrl
```

**3.2 Preview Component (`components/workspace/PreviewPanel.tsx`)**
- iframe con tarjetas de carga
- Reset del preview al cambiar archivos
- Debug info panel

### Fase 4: Code Editor (1 día)

**4.1 Editor Integration (`components/workspace/CodeEditor.tsx`)**
- Use Monaco Editor (o codemirror con fallback a textarea simple)
- Syntax highlighting por lenguaje
- Auto-indentation
- Line numbers
- Copy/download actions

### Fase 5: Search Engine (1-2 días)

**5.1 Web Search Service (`lib/services/search/web-scraper.ts`)**
```typescript
searchWeb(query: string): Promise<SearchResult[]>
- Bing API / Custom Search (personal key)
- Expected format: { title, url, snippet, timestamp }
- Caching (Redis o localStorage)
```

**5.2 Search Integration (`components/chat/SearchTool.tsx`)**
- Panel de búsqueda contextual
- Search engine state en store:
  ```typescript
  searchEngine: {
    enabled: boolean;
    results: SearchResult[];
    loading: boolean;
    query: string;
  }
  ```
- Use `messages` pattern: `[BUSCAR_WEB: { query }]`

**5.3 Search Endpoint (`app/api/search/route.ts`)**
```typescript
POST /api/search
- Valida (rate limit, auth)
- Llama `web-scraper.ts`
- Incluye resultados en response con SSE streaming
```

### Fase 6: Export System (1 día)

**6.1 Export Actions (`components/workspace/ExportPanel.tsx`)**
```typescript
- ExportCodeAsFile(files, lang)
- ExportCodeToClipboard(code)
- ExportMarkdown(content, title)
- ExportPDF(html, filename): servidor dependiente (wkhtmltopdf o headless-chrome)
```

**6.2 Export Service (`lib/export/constitutor.ts`)**
- Markdown builder
- PDF generator (edge con Puppeteer o similar)
- Client-side copy API

### Fase 7: yosseling-points (1-2 días)

La IA de Yosseling debe reconocer patrones de generación de aplicaciones:

**7.1 Search Tool Pattern (`):**
```
User: "Busca información sobre Papillon digital en marketplaces"
→ Añadir al prompt: [BUSCAR_WEB:{query}]
→ yosseling detecta y ejecuta búsqueda en tiempo real
→ Respuesta incluye snippets citados con método
```

**7.2 App Generation Pattern:**
```
User: "Crear Landing Page generosa con 50% DPITCH"
→ Detectar: [CREAR_APP_LANDING:{promo, discounts, primaryColor, ...}]
→ yosseling genera:
  1. auto create export file for code generation
  2. call internal generateAppCode API endpoint
  3. return generated components + structure
```

### Fase 8: Dashboard Page (1 día)

**8.1 Workspace Page (`app/workspace/page.tsx`)**
```tsx
<WorkspaceSplitLayout>
  <ChatPanel />
  <PreviewEditorPanel />
  <FileExplorerPanel />
</WorkspaceSplitLayout>
```

**8.2 Navigation entry**
- Update `app/page.tsx` para agregar navigation button:
  ```tsx
  <Button onClick={() => router.push('/workspace')}>
    🚀 Launch Canvas
  </Button>
  ```

## Database Schema (Supabase)

```sql
-- existing tables (no changes needed)
-- chats: messages, memory: items, settings

-- New tables
create table workspace_files (
  id text primary key default gen_random_uuid(),
  chat_id text references chats(id) on delete cascade,
  path text not null, -- e.g., "src/App.tsx"
  content text not null,
  language text, -- "typescript", "css", "json"
  type text, -- "component", "page", "style", "config"
  created_at bigint default (extract(epoch from now()) * 1000),
  updated_at bigint default (extract(epoch from now()) * 1000),
  unique(chat_id, path)
);

create table search_results (
  id text primary key default gen_random_uuid(),
  chat_id text references chats(id) on delete cascade,
  query text not null,
  results jsonb not null, -- [{title, url, snippet, timestamp}]
  engine text,
  status text, -- "pending" | "completed" | "error"
  created_at bigint default (extract(epoch from now()) * 1000)
);
```

## Priority Stack

**Tier 1 - Core (Week 1):**
- [ ] Fase 1 (Types & Store)
- [ ] Fase 2 (File Explorer)
- [ ] Fase 3 (Simple Preview)
- [ ] Fase 8 (Workspace page navigation)

**Tier 2 - Enhanced (Week 2):**
- [ ] Fase 4 (Code Editor + Monaco)
- [ ] Fase 6 (Export System)
- [ ] Fase 2.3 (Workspace DB + persistence)

**Tier 3 - Advanced (Week 3):**
- [ ] Fase 5 (Search Engine + Tool)
- [ ] Fase 3.1 (Advanced Preview Router)
- [ ] 7. App Generation Patterns

**Tier 4 - Polish:**
- [ ] Performance optimizations
- [ ] Keyboard shortcuts
- [ ] Undo / Redo system
- [ ] Quick action toolbar

## Tech Stack Decisions

**Editor:**
- Primary: Monaco Editor (Mozilla) - best for Next.js + React
- Alternative: CodeMirror 6
- Fallback: Simple React textarea con syntax highlight custom

**Preview:**
- Strategy A: Next.js App Router eval de archivos (ideal pero riesgoso security)
- Strategy B: iframe pointing a temp Next.js server endpoint (más seguro)
- Chosen: Strategy B por seguridad + simplicidad

**PDF Export:**
- Options:
  - Puppeteer server endpoint (headless Chrome)
  - wkhtmltopdf
  - PDFKit (client-side, menos features)
- Chosen: Puppeteer server endpoint (desktop)

**Search:**
- Option A: Bing Custom Search API ($5/mo base)
- Option B: SERPAPI (Pay per search)
- Option C: Free scraping libraries (exposed to CORS issues)
- Chosen: Option B por balance feature/costo

## Home Run Sprint

Se puede lograr funcionalidad MVP en **3 días** con features:
```
✅ Canvas mode (/workspace)
✅ File explorer con arrastrar-drop
✅ Preview simple (iframe)
✅ Code download
✅ Search tool
✅ Automatic app generation prompts
```

Estimated time:
- Day 1: Store, file explorer, preview router
- Day 2: Workspace page, search tool, export actions
- Day 3: Integration con yosseling-points, polish

---

**Start Implementation:** ¿Profundizar qué aspectos te gustaría ver primero? (store, file explorer, preview en acción, o search engine)