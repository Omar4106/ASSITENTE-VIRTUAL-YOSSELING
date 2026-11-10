# MEMORANDUM: ANÁLISIS DE FALLOS CRÍTICOS DEL WORKSPACE YOSSELING

## CONVERTIDO A ESTADO GENERAL - ARRIBA

---

## FALLO CRÍTICO 1: IMPORTACIÓN DE GITHUB - FAIL

### Descripción
Cuando se importa un repositorio de GitHub modules:
- ✅ API `/api/github/import` funciona correctamente
- ✅ Archivos se obtienen y validan
- ❌ Archivos NO aparecen en el explorador de archivos
- ❌ Canvas NO se activa con el material importado

### Ubicación / Análisis

**API (`app/api/github/import/route.ts`)**: FUNCIONA
- Líneas 77-154 implementan fetch de tree, refs y blobs
- Devuelve `files` con `path`, `content`, `sha`
- Sanity checks de file size y content length
- ✅ Retorna JSON válido con `files[]` array

**Store (`lib/store.ts`)**: CALL EXISTE, EXECUTE FALLS
- Línea 708: `const currentFiles = [...useAppStore.getState().workspaceFiles];`
- Línea 728: `const result = upsertWorkspaceArtifact(currentFiles, resolvedPath, codeContent, language, resolvedTab);`
- ✅ El store tiene las funciones para gestionar archivos

**Workspace Canvas (`components/workspace/WorkspaceCanvas.tsx`)**:
- Líneas 930-1014: `handleGithubImport()` existe pero no desplegado correctamente
- ✅ `applyImportedArtifact()` actualiza el state

### Root Cause
Se missing la integración real entre el botón de GitHub Import y el explorador lateral. El flujo actual requiere un componente FileExplorer que NO está integrado en el diseño layout actual.

---

## FALLO CRÍTICO 2: BARRA MULTIMEDIA / TOOLS - DISAPPEARS

### Descripción
Al pulsar "Editable / Modifier" button, tools disappear:

### Review
lines 364-398 en app/page.tsx:
```tsx
<div className={`flex flex-1 min-h-0 overflow-hidden ... ${isToolsOpen ? 'hidden' : ''}`}>
  <div className={`relative flex flex-1 ... ${shouldShowWorkspace ? '' : 'w-full'}`}>
    <div className={`relative h-full ... ${shouldShowWorkspace ? 'w-full md:w-1/2 max-md:hidden' : 'w-full'}`}>
       {/* ChatArea */}
       {/* Workspace Canvas */}
    </div>
  </div>
</div>
```

**Problema**: La estructura flex-wrap y `hidden` classes están rompiendo el layout. El flujo DOES NOT hide both panels; it hides ONE when the other is supposed to show.

### Migración
Necesita corregición complete de flex-direction y clases responsives.

---

## FALLO CRÍTICO 3: WORKSPACE NO ACTIVACIONES AUTOMATIC

### Descripción
Canvas no se activa when inicial tests request file creation.

### Review
Línea 408 en lib/store.ts: `extractAndSyncWorkspaceFiles(fullContent, content)`
- ✅ Existente y llamada después de cada respuesta AI
- ❌ Falls when la respuesta de la IA contiene código EN blocos but sin palabras-specific keywords

**Miución**: The `isExplicitArtifactRequest()` detection is too narrow or not matching the keywords the LLM uses when generating code embeddings.

---

## DOCUMENTO 5: DOCX / PPTX FAILURE

### Descripción
**DOCX** - Only reading (mammoth), exportation incomplete
**PPTX** - Only text extraction from XML, no graphic/visual generation

### Dependencias
✅ `monger-mhorse` installed
✅ `htmll-docx` installed
✅ `pptxgenjs` installed (NUEVAMENTE)

### CAMBIOS REQUERIDOS
1. **DOCX**: Proper integration con `html-to-docx` para generar salidas funcionales.
2. **PPTX**: Use `pptxgenjs` para generar True PPTX (not only text tests).

---

## ÁREAS NO INTEGRADAS

1. **FileExplorer** (220 lines): Sicliente existente but not included in WorkspaceCanvas
2. **CodeEditor** (183 lines): Code highlight + save exist but not in Canvas workflow
3. **WebContainerRunner** (204 lines): Node.js environment but not integrated in preview flow

---

### FASE 1 (URGENT)
- Fix layout flex (app/page.tsx)
- Refine `isExplicitArtifactRequest()` or debug why Canvas isn't opening

### FASE 2 (HIGH PRIORITY)
- Integrate FileExplorer & CodeEditor into WorkspaceCanvas
- Test GitHub import triggered from Canvas
- Fix PPTX generation (use pptxgenjs)
- Fix DOCX export (proper html-to-docx call)

### FASE 3 (MEDIUM PRIORITY)
- Integrate WebContainerRunner
- Fix coarse detection (memo desplegar)
- Improve ready workflows

---

## NUMERO DE ARCHIVOS A MODIFICAR

- `lib/store.ts` - Update `extractAndSyncWorkspaceFiles()` and refine `isExplicitArtifactRequest()`
- `app/page.tsx` - Fix flex layout structure
- `components/workspace/WorkspaceCanvas.tsx` - Integrate FileExplorer & update GitHub import Lógica
- Total: 3-4 files

---

## RECOMENDACIÓN EXECUTIVE

### Leverage Manufacturing del Workarea
- The code/architecture IS there. The problem is integration.
- Already have `@webcontainer/api`, `xlsx`, `mammoth`, `html-to-docx`
- Already have full `FileExplorer`, `CodeEditor`, `WebContainerRunner` components
- Add only `pptxgenjs` (already installed) and integrate the above pieces

### Next Steps
1. Create branches: `recover-flex-layout`, `fix-github-import`, `docx-pptx-suite`
2. Create git tags branches for each fix
3. Test in order: Flex → GitHub → DOCX → PPTX → WebContainer

### Expected Effort
- FASE 1: 1-2 hours (layout + detection refinement)
- FASE 2: 4-6 hours (FileExplorer integration + true document generation)
- TOTAL: 5-8 hours to have fully functional workspace

---

**Created**: 2026-11-09
**Status**: Ready for execution
**Priority**: CRÍTICO / HIGH / MEDIUM
**Tags**: #workspace #canvas #flex #github #integration #fix-execution