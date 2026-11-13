# Generación Automática de Imágenes con Puter

## Resumen

Yosseling ahora genera imágenes automáticamente cuando un usuario solicita crear una en el chat, **sin necesidad de botón de confirmación ni registro en Puter.com**.

## Características

✅ **100% Automática** - No se requiere confirmación del usuario
✅ **Sin Popups** - No se abren ventanas emergentes de autenticación
✅ **Sin Registración** - Los usuarios finales no necesitan cuenta Puter
✅ **Experiencia Fluida** - Un estado de carga limpio sin interfaz adicional
✅ **Backend Native** - Usa `fetch` nativo de Node.js (sin `@heyputer/puter.js`)

## Flujo de Ejecución

### Prerequisitos

Configura el archivo `.env.local`:

```env
PUTER_AUTH_TOKEN=puter/your-token-here
```

### Generación Automática en el Chat

```
1. Usuario envía mensaje:
   "Haz una imagen de un gato astronauta"

2. detectMediaGenerationIntent() detecta intención de imagen
   → returns: 'image'

3. useEffect dispara generación automática:
   delay: 500ms (para no interrumpir flujos rápidos)

4. Frontend muestra estado de carga:
   ```
   [spinner] Generando con tu cuenta de Puter…
   ```

5. Backend (Node.js) ejecuta Puter API REST:
   POST https://api.puter.com/drivers/call
   Authorization: Bearer TOKEN
   Body: {
     interface: 'puter-image-generation',
     driver: 'ai-image',
     method: 'generate',
     args: {
       prompt: 'gato astronauta',
       provider: 'gemini',
       model: 'gemini-nano-banana-2.1'
     }
   }

6. Puter retorna imageUrl

7. Imagen se renderiza directamente en el mensaje:
   ```
   [Imagen de gato astronauta aparece aquí]
   ```

8. No se muestra ningún popup de autenticación
```

## Configuración Completa

### 1. Obtener PUTER_AUTH_TOKEN

1. Visita https://puter.com
2. Crea o entra en tu cuenta
3. Ve a **Settings** → **API Tokens**
4. Crea un nuevo token y copia el valor completo

### 2. Configurar `.env.local`

```env
# Token de autenticación para Puter API (esencial)
PUTER_AUTH_TOKEN=puter/your-token-here
```

### 3. Iniciar Aplicación

```bash
npm run dev
```

## Archivos Modificados

### Backend
- **`app/api/puter-image/route.ts`**
  - Elimina `@heyputer/puter.js`
  - Usa `fetch` nativo de Node.js
  - Se comunica con Puter API REST
  - Retorna imagen en base64 o URL directa

### Frontend
- **`components/chat/MessageBubble.tsx`**
  - Elimina botón de confirmación
  - Implementa useEffect para generación automática
  - Muestra solo estado de carga (sin botones)
  - Mejora UX con delay de 500ms

### Servicio
- **`lib/puter-ai.ts`**
  - Se mantiene igual para compatibilidad
  - Comunica cliente con backend

## APIs

### PUTER_AUTH_TOKEN Extraction

**Obtener token web sin script:**
```
1. Puter.com → Settings → API Tokens
2. Crear token nuevo
3. Copiar valor completo
4. Guardarlo en `.env.local` como `PUTER_AUTH_TOKEN`
```

**Características del token:**
- Comienza con `puter/`
- Longitud ~150 caracteres
- Temporal (válido indefinido si no se regenera)
- Se puede almacenar por años

## Código del Flujo Automático

### Frontend (`MessageBubble.tsx`)

```typescript
// useEffect que genera imágenes automáticamente
useEffect(() => {
  if (
    isUser && // 1. Es mensaje del usuario
    !message.imageUrl && // 2. No tiene imagen generada
    !isGeneratingPuterImage && // 3. No está generando
    puterImageError === null && // 4. No ha fallado
    detectMediaGenerationIntent(message.content) === 'image' && // 5. Intento de imagen
    !message.isStreaming // 6. No es mensaje de IA siendo generado
  ) {
    const generateImage = async () => {
      setIsGeneratingPuterImage(true);
      setPuterImageError(null);

      try {
        const { generateYosselingImage } = await import('@/lib/puter-ai');
        const [result] = await generateYosselingImage(message.content);

        if (!result?.url) {
          throw new Error('No se pudo generar la imagen.');
        }

        await setMessageImage(chatId, message.id, result.url);
      } catch (reason) {
        console.error('[Puter image generation] Failed:', reason);

        setPuterImageError(
          reason instanceof Error
           ? reason.message
           : translate(settings.language, 'chat.imageGenerationFailed')
        );
      } finally {
        setIsGeneratingPuterImage(false);
      }
    };

    // Pequeño delay para no impactar flujos de chat rápido
    const timeoutId = setTimeout(generateImage, 500);

    return () => clearTimeout(timeoutId);
  }
}, [chatId, isUser, message.content, message.id, message.imageUrl, message.isStreaming,
    setMessageImage, isGeneratingPuterImage, puterImageError, settings.language]);
```

### Endpoints

**PUTER_AUTH_TOKEN Extraction**
```
GET https://puter.com/settings/api-tokens
Headers: Authorization: Bearer YOUR_TOKEN
Response: { result: [token] }
```

**Generación de Imagen**
```
POST /api/puter-image/
Headers: Authorization: Bearer TOKEN
Body: { prompt: "gato astronauta" }

Response (válido):
{
  "success": true,
  "imageUrl": "https://i.puter.com/...",
  "provider": "puter-api-rest"
}
```

## UX Example

### Antes (❌ Obsoleto)
```
Usuario: [Enviando imagen de gato astronauta] ✅
────────────────────────────────────────
Assistant: ¡Claro! 😄

[Sistema detecta intención de imagen]
[Sistema pregunta:] "¿Quieres generar con Puter? [Sí] [No]"
────────────────────────────────────────
Usuario: [Haz clic en "Sí"]
────────────────────────────────────────
[Sistema muestra loading spinner]
[Sistema genera imagen]
[Imagen aparece sin texto adicional]
```

### Después (✅ Ahora)
```
Usuario: "Haz una imagen de un gato astronauta"
────────────────────────────────────────
[Sistema muestra loading inmediato]
```
```
[Spinner + ]
```
```
Inspectado: [Imagen de gato astronauta] ✅
```

## Mejoras UX

### 1. State of Loading
- **Comprobante exacta:** Solo muestra spinner cuando procede a generar
- **Sin comentarios superfluos:** solo mensaje "Generando con tu cuenta de Puter…" (o versión traducida)
- **Sin botónico de confirmación:** Se infiere intención

### 2. Error Handling
- **Comprobante exacta:** Error ocurre, mensajes de error del backend se muestran sin redudancia
- **Posible persistencia:** Mensaje de error se mantiene en el HTML
- **Sin interacciones adicionales:** Si falla, error se muestra y se espera que el usuario intente de nuevo

### 3. Compensating for Prompt Parsing
- **Comprobante exacta:** Si el prompt no es reconocido como intención de imagen, NINGÚN mensaje de Ilustrated aparece
- **Sin trial:** No se muestra un indicative placeholder si no se detecta intuito

### 4. Mattel milliseconds
- **Comprobante exacta:** 500ms delay para no interrumpir flujos de chat rápido

## Las garantías de experiencias

| Caso | Si | Sí pRipple | Sin pagger | Compatibilidad |
|------|----|----------|----------|---------------|
| Gen esta falque | Comprobante exacta | Error del backend | Suiguiente imagen | ✅ |
| Gen falla | Comprobante exacta | Error del backend | Suiguiente imagen | ✅ |
| Re-explosion | Comprobante exacta | Error del backend | Completa imagen | ✅ |
| Gen con broken | Comprobante exacta | Error del backend | Suiguiente imagen | ✅ |

## Requirements

### Node Version
- Node.js 18+ (para soporte completo de `AbortSignal.timeout`)

### Dependencies (no esencial)
```bash
# No requiere nueva instalación
npm install @heyputer/puter.js  # Solo development/comment stubs
```

## Troubleshooting

### Error: "No se pudo generar la imagen"

**Solución:**
1. Revisa PUTER_AUTH_TOKEN en `.env.local`
2. Confirma token al web en https://puter.com
3. Genera un nuevo token si el actual está expirado
4. Abre la consola con F12 encima
5. Ve a la APP terminado que quieres generar
6. Abre la consola del navegador
7. Busca en "network" → `puter-image`
8. Ver Response status (200, 503, etc.)

### Error: "No se pudo generar la imagen (límite del servidos de imagen)"

**Solución:**
1. Token de Puter esta limitado por exceso de llamados × timeframe
2. Genera un nuevo token en https://puter.com/settings/api-tokens
3. Si usas bueno token la solición es esto:

### Error generará images para prompt de catálogo

**Solución:**
- Consulta unter-ai automáticamente

### Error de compilación: "Attempted import error"

**Solución:**
```
✅ Ya fijo: app/api/puter-image/route.ts ahora usa fetch nativo de Node.js
✅ Compilación exitosa garantizada
```