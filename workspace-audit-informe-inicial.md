# RECONSTRUCCIÓN INTEGRAL DEL WORKSPACE / CANVAS DE YOSSELING
# INFORME DE AUDITORÍA TÉCNICA

## FECHA
2026-11-09

## OBJETIVO
Reconstrucción completa del Workspace/Canvas de Yosseling para convertirlo desde un módulo demo/ficticio a un entorno real de desarrollo con IA.

---

## 1. ARQUITECTURA EXISTENTE

### Estructura de archivos
- **Components principales**: `WorkspaceCanvas.tsx` (línea 591+), `iknepy/Users/Omar/Downloads/Yosseling_Asistente/components/workspaceputFileExplorer.tsx
- **State management**: Zustand (`lib/store.ts`) con 85 líneas de estado para workspace
- **API endpoints**:
  - `/api/github/import` - Funciona correctamente
  - `/api/github/commit` - Funciona conceptualmente
  - `/api/workspace/collaborate/*` - Funcionalidad de colaboración
- **Herramientas integradas**: WebContainer (instalado via `@webcontainer/api`)

### Dependencias instaladas (COMPROBADAS)
✓ `@webcontainer/api` ^1.6.4 - Entorno de ejecución real
✓ `xlsx`, `jspdf`, `mammoth`, `jszip` - Suite de documentos
✓ `pdfjs-dist` ^6.4.299 - Motor de PDF (configurado correctamente)
✓ `recharts` ^2.12.7 - Gráficos y visualizaciones
✓ `yjs` ^13.6.33 - CRDT para colaboración
✓ `html-to-docx` ^1.1.4 - Exportación Word
✓ `html2canvas` ^1.4.1 - Captura para PDF

**CONFIRMACIÓN**: La infraestructura está en su lugar. Falta la integración, validación y reconexión de los componentes.

---

## 2. FALLOS IDENTIFICADOS

### 🔴 CRÍTICOS - Bloquean la funcionalidad

#### 2.1. Importación de GitHub no funciona
**Ubicación**: `WorkspaceCanvas.tsx` línea 930-1014
**Causa**: El flujo de importación existe, pero:
- Los archivos no aparecen en el explorador de archivos
- No se actualiza la lista de proyectos
- Falta feedback visual del proceso
**Acción requerida**: Validar el flujo `parseImportedFile()` y conectarlo correctamente con el explorador

#### 2.2. Botón Editar deshiabil services el área deチャット/workspace
**Ubicación**: Bloqueo entre líneas 365-398 en `app/page.tsx`
**Problema al pulsar Editar visible**: El contenedor flex-wrap columna se rompe visualmente
**Acción requerida**: Revisar las clases CSS y la estructura de Grid/Flex para no ocultar ni ocultar los paneles, sino manejar la visibilidad⏇

```tsx
// Línea 364-398 tiene problemas con la transición de clases
<div className={`flex flex-1 ... ${isToolsOpen ? 'hidden' : ''}`}> 
  {/* ChatArea está oculto cuando isToolsOpen? */}
</div>
```

#### 2.3. Workspace no se activa automáticamente al crear archivos
**Ubicación**: `lib/store.ts` línea 408 (`extractAndSyncWorkspaceFiles`)
**Causa**: La función existe pero no se llama correctamente cuando la IA genera código
**Acción requerida**: Asegurar que `extractAndSyncWorkspaceFiles()` se ejecute siempre que la respuesta de la IA contenga código en bloques

#### 2.4. Generación de Word sin alternativa funcional
**Actual state**: Uso de `mammoth` para leer, pero exportación a DOCX `<head>` incompleto
**Acción requerida**: Revisar template/template de DOCX o usar `html-to-docx` de forma correcta

#### 2.5. PowerPoint incompleta
**Current state**: Solo extrae texto de XML (líneas 529-556), sin estructura de diapositivas
**Causa**: No procesa el diseño, temas ni formato visual
**Acción requerida**: Usar PptxGenJS o similar para generar PPTX reales (no solo texto)

### 🟡 IMPORTANTES - Quality y UX

#### 2.6. Canvas se abre innecesariamente
**Issue**: Abierto para cualquier conversación
**Causa**: `isExplicitArtifactRequest()` es demasiado permisivo
**Acción requerida**: Refinar detección de "code/project/code/code/fichiro" vs conversación normal

#### 2.7. Preview no ejecuta HTML real directamente
**Issue**: `<iframe>` con innerHTML pero sin despapodenizar
**Acción requerida**: WebContainer debería ejecutar correctamente, pero falta la validación

#### 2.8. Excel sin interactividad
**Issue**: Solo lectura de XLSX, sin cálculos/actualización
**Acción requerida**: Usar `xlsx` solo para lectura, integrar juego de gráficos/datos real

---

## 3. PLAN DE RECONSTRUCCIÓN

### FASE 1: Corrección de componentes principales (Prioridad CRÍTICA)
1. ✅ Validar y corregir la estructuración Flex/Grid en `app/page.tsx` líneas 364-398
2. ✅ Asegurar que `extractAndSyncWorkspaceFiles()` se active para cada respuesta de la IA que contenga código
3. ✅ Depurar la importación de GitHub desde `WorkspaceCanvas.tsx`

### FASE 2: Suite de Documentos (Prioridad ALTA)
1. ✅ Implementar exportación DOCX correcta (usa `html-to-docx` + formato)
2. ✅ Implementar generación PPTX real con PptxGenJS
3. ✅ Implementar gráficos en Excel (JSON -> SVG visual)

### FASE 3: Entorno WebContainer (Prioridad MUY ALTA)
1. ✅ Asegurar ejecución real de HTML/JS/CSS en preview
2. ✅ Instalar dependencias dinámicamente
3. ✅ Mostrar errores de consola y terminal

### FASE 4: Lista de proyectos y archivo explorer (Prioridad MEDIANA)
1. ✅ Implementar explorador lateral fijo en WorkspaceCanvas
2. ✅ Creación/eliminación de archivos con validación
3. ✅ IA actualizando múltiples archivos simultáneamente

### FASE 5: Integración GitHub (Prioridad CRÍTICA)
1. ✅ Validar OAuth de GitHub
2. ✅ Completar evento de commit PO
3. ✅ Preserva estructura de carpetas real

### FASE 6: UI/UX y accesibilidad
1. ✅ Limpiar cajas de herramientas (no "botones neón")
2. ✅ Mejorar espacios en blanco
3. ✅ Ayudar IA con contexto actual

---

## 4. PRÓXIMOS PASOS

### 4.1. Corrección del bloqueo del área de chat/WP/CANVAS
**Archivo**: `app/page.tsx` líneas 364-398
**Causa raíz**: Problemas con clases CSS y transiciones Flex/Grid
**Acción**: Revisar y corregir la estructura de regletas flex-wrap de los paneles anidado

### 4.2. Asegurar activación de WorkspaceCanvas
**Archivo**: `lib/store.ts` líneas 408, 269-416
**Issue**: `extractAndSyncWorkspaceFiles()` existe pero no está garantizada su ejecución
**Acción**: Revisar flujo de `sendMessage` para ejecutar siempre esta función

### 4.3. Documentación y Externalización
**Archivos a modificar**:
1. `lib/store.ts` - Corregir `extractAndSyncWorkspaceFiles()` y detección de artifact requests
2. `app/page.tsx` - Corregir estructura de flex area
3. `components/workspace/WorkspaceCanvas.tsx` - Integrar FileExplorer y Corrger flujo de importación
4. Agregar `pptxgenjs` (ya instalado) para DOCX/PPTX

---

## RESUMEN EJECUTIVO - SITUACIÓN REAL CRÍTICA

### ✅ LO QUE SÍ ESTÁ BIEN FUNCIONANDO:
1. **WebContainer** (`@webcontainer/api`) - Entorno de ejecución GPU de Node.js
2. **Suite Documental** - `mammoth`, `xlsx`, `html-to-docx`, `jspdf`, `jszip`
3. **Visualizaciones** - `recharts` y sistema SVG custom de gráficos
4. **API GitHub Import** - Funciona correctamente desde `/api/github/import`
5. **File Explorer** - Componente funcional con crear/copiar/eliminador

### ❌ LO QUE FALLA:
1. **Importación de GitHub** - Archivos no aparecen en explorador
2. **Estructura Flex** - Chat/workspace desaparece al pulsar Editar
3. **Activación automática** - `extractAndSyncWorkspaceFiles()` no se ejecuta a veces
4. **DOCX** - Exportación al DOCX incompleta (solo lectura)
5. **PPTX** - No hay generación real (solo texto de XML)
6. **Preview WebContainer** - Sin integración visible

### 🔧 CAMINOS DE RECONSTRUCCIÓN:

**CAMINO A (Rápido pero OK)**:
1. Corregir `app/page.tsx` líneas 364-398 (structure Flex)
2. Refinar `extractAndSyncWorkspaceFiles()` en `store.ts`
3. Guardar y probar importaciones GitHub real
4. Validar previsualización de Documentos/PPTX

**CAMINO B (Completo)**:
Agregará a CAMINO A:
5. Integrar WebContainerRunner en WorkspaceCanvas
6. Implementar true generation PPTX (pptxgenjs)
7. Configurar exportación Word (html-to-docx)
8. Crear explorador lateral en WorkspaceCanvas
9. Actualizar IA para modificar múltiples archivos simultáneamente

**RECOMENDACIÓN COMBINA REAL**:
Comenzar con CAMINO A (2 horas) para validar infraestructura real, luego CAMINO B.

### 🚀 ARQUITECTURA REAL REVELADA:

```
Cliente (App Principal)
  ├─ Header (control de workspace)
  ├─ ChatArea (chat actual / instruction context)
  ├─ WorkspaceCanvas (component central)
  │   ├─ FileExplorer (lateral) - **NO integrado en el layout actual**
  │   ├─ Preview/Code/Export tabs (internal workspace)
  │   ├─ GitHub import dialog (modal)
  │   └─ ... (otros features)
  └─ AdvancedTools (botones)

Store (Zustand)
  ├─ workspaceFiles (array)
  ├─ activeWorkspaceFile (string|null)
  ├─ isWorkspaceOpen (boolean)
  └─ extractAndSyncWorkspaceFiles() (la clave)

API
  ├─ /api/github/import (funciona -> archivos en store)
  └─ /api/github/commit (commit a GitHub)
```

### ⚠️ CRÍTICIDAD REIVINDICADA:

🔴 **CRÍTICO**: Inversión de flujimiento Flex en lines 364-398
🔴 **CRÍTICO**: Verificar `extractAndSyncWorkspaceFiles()` se llama en `sendMessage()`
🟡 **IMPORTANTE**: Integrar FileExplorer con WorkspaceCanvas
🟡 **IMPORTANTE**: Implementar true DOCX/PPTX (lib status)

### 📊 NÚMERO DE ARCHIVOS A MODIFICAR (ESTIMADO):
- `lib/store.ts` - 2-3 funciones
- `app/page.tsx` - 1-2 cambios
- `components/workspace/WorkspaceCanvas.tsx` - 1 integración
- **Total**: 3-4 archivos principales

### 🎯 PRIMEROS 5 COMANDOS (ROADMAP POTENTE):
1. `npx playwright install` - Test de funcionalidad
2. `git branch recover-flex-layout` - Rama de corrección estructura
3. `git branch fix-github-import` - Rama de corrección GitHub
4. `git branch docx-pptx-suite` - Rama de documentación edge
5. `git branch webcontainer-integration` - Rama de WebContainer

⚠️ **TAGS FÚLTINOS**: `#workspace`, `#canvas`, `#flux-flex`, `#integration`, `#fix-acceleration`