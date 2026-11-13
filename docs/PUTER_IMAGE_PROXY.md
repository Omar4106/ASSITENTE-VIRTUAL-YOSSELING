# Puter Image Generation - Proxy Architecture

## Overview

Esta arquitectura de proxy elimina la necesidad de que los usuarios finales se registren e inicien sesión en Puter.com. La generación de imágenes ocurre en el backend del servidor, donde se utiliza una cuenta maestra de Puter con credenciales configuradas.

## Architecture

```
┌─────────────────┐                    ┌─────────────────────┐
│   Usuario       │  POST /api/puter- │                     │
│   (Cliente)     │───────►           │  Next.js Server     │
│                 │       Endpoint    │                     │
│   Sin sesisco   │                    │  ├── @heyputer/     │
│   en Puter      │                    │  │   puter.js        │
│                 │                    │  ├── JWT Secret    │
└─────────────────┘                    └─────────────────────┘
       │                                       │
       │                                       │
       ▼                                       ▼
┌───────────────────────────────────────────────────────┐
│           Puter AI (google/nano-banana-2.1)          │
│           - txt2img (desatendido)                   │
│           - Sin abrir popups                        │
└───────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────┐
│  Imagen Generada    │
│  - URL temporal     │
│  - Mercado imágenes │
└─────────────────────┘
```

## Componentes

### 1. Backend Endpoint
`app/api/puter-image/route.ts`

- Ejecuta en Node.js (Server Side)
- Usa `@heyputer/puter.js` en el servidor
- Autentica con JWT de cuenta maestra
- Realiza `puter.ai.txt2img()` desatendidamente
- Retorna URL de imagen

### 2. Frontend Service
`lib/puter-ai.ts`

- Funciona en el cliente (browser)
- Hace fetch a `/api/puter-image`
- NO llama a `puter.ai.txt2img()` directamente
- Provides backward-compatible API

### 3. Components
- `AutoIllustration` - Para generación automática
- `handleGeneratePuterImage` - Para generación manual

## Configuration

### Paso 1: Crear Cuenta de Puter

1. Visita `https://puter.com`
2. Regístrate (opcional, si no tienes una cuenta)
3. Guarda tus credenciales:

### Paso 2: Generar JWT Secret

```typescript
// Ejecuta esto en Node.js con Puter
const { uidk } = puter;
const authToken = uidk.generateJWT(token, { username, password });
```

### Paso 3: Configurar Variables de Entorno

En tu archivo `.env.local` o `.env.production`:

```env
# JWT Secret para autenticación con Puter
# Genera este valor usando puter.uidk.generateJWT()
PUTER_JWT_SECRET="tu-jwt-secret-aqui"

# Cuenta maestra de Puter
PUTER_USERNAME="tu-usuario-en-puter.com"
PUTER_PASSWORD="tu-password"
```

### Paso 4: Instalar Dependencias

```bash
npm install @heyputer/puter.js
```

## API Endpoint

### POST /api/puter-image

Genera una imagen usando Puter AI en el servidor.

**Request:**
```typescript
{
  "prompt": "un atardecer tropical con tonos violeta"
}
```

**Response:**
```typescript
{
  "success": true,
  "imageUrl": "https://i.puter.com/...",
  "provider": "puter"
}
```

**Error Response:**
```typescript
{
  "success": false,
  "error": "No pude generar la imagen con Puter. Configura las credenciales..."
}
```

## Usage Examples

### En el Cliente (Frontend)

```typescript
import { generateYosselingImage } from '@/lib/puter-ai';

// Generar imagen
const [result] = await generateYosselingImage(
  'un atardecer tropical con tonos violeta'
);

console.log(result.url); // URL de la imagen generada
```

### En React Component

```tsx
'use client';

import { generateYosselingImage } from '@/lib/puter-ai';

async function handleImageGeneration(prompt: string) {
  setIsGenerating(true);
  try {
    const results = await generateYosselingImage(prompt);
    const imageUrl = results[0]?.url;
    setImageUrl(imageUrl);
  } catch (error) {
    console.error('Failed to generate image:', error);
  } finally {
    setIsGenerating(false);
  }
}
```

## Flow Diagram

### Generación Manual (Chat)

```
1. Usuario envía mensaje en chat
      │
      ▼
2. detectMediaGenerationIntent() detecta intención de imagen
      │
      ▼
3. Componente renderiza botón "Generar imagen"
      │
      ▼
4. Usuario hace clic en botón
      │
      ▼
5. handleGeneratePuterImage() llama a lib/puter-ai.ts
      │
      ▼
6. lib/puter-ai.ts hace fetch POST /api/puter-image
      │
      ▼
7. Server endpoint ejecuta puter.ai.txt2img()
      │
      ▼
8. Se devuelve la imagen URL al cliente
      │
      ▼
9. Imagen se renderiza en el chat (sin popup)
```

### Generación Automática

```
1. Assistant detecta [GENERAR_IMAGEN: prompt]
      │
      ▼
2. Componente MessageBubble renderiza AutoIllustration
      │
      ▼
3. AutoIllustration se monta y hace fetch POST /api/generate-image
      │
      ▼
4. Muestra loading state (spinner, texto)
      │
      ▼
5. Imagen se renderiza cuando llega la URL
```

## Troubleshooting

### Error: "Configura las credenciales de Puter"

**Causa:** La cuenta maestra de Puter no tiene credenciales configuradas.

**Solución:**
1. Verifica `.env.local` tiene `PUTER_JWT_SECRET`, `PUTER_USERNAME`, `PUTER_PASSWORD`
2. Asegúrate de que el JWT secret sea válido (no expirado)
3. Revisa que el usuario sea una cuenta maestra de Puter (no cuenta infantil)

### Error: "No pude generar la imagen con Puter"

**Causas:**
- Límite de pruebas gratuitas de Puter
- Límite de concurrentes por cuenta
- Cuenta de Puter suspendida

**Soluciones:**
1. Esperar tiempo entre generaciones
2. Usar cuenta premium de Puter
3. Comprobar que la cuenta existe y está activa

### Error: PUTER_JWT_SECRET: unhandled Rejection

**Causa:** El JWT secret está mal configurado o expirado.

**Solución:**
1. Regenerar JWT secret en Node.js:
   ```typescript
   const authToken = puter.uidk.generateJWT(secret, { username, password });
   ```
2. Actualizar valor en `.env.local`

## Alternatives

### Server Actions (Next.js 14+)

```typescript
// app/actions/puter-image.ts
'use server'

export async function generateImage(prompt: string) {
  const { puter } = await import('@heyputer/puter.js')
  // ... same logic
}
```

Debería ser preferido para producción.

### Third-Party Proxy

Usar un servicio como:
- Hugging Face Inference API
- DALL-E API
- Stable Diffusion API

Con una cuenta propia y tu propio balance.

## Security Considerations

1. **Credenciales:** El JWT secret y las passwords NO deben exponerse al cliente.
2. **Rate Limiting:** El endpoint ya tiene rate limiting por IP.
3. **Prompt Validation:** El endpoint valida longitud y caracteres del prompt.
4. **Error Messages:** No exponer detalles internos de Puter en mensajes al usuario.

## Example Output

```
User: Hazme una ilustración de un perro feliz
Assistant:
  [Se genera imagen con spinner de loading]
  [La imagen "https://i.puter.com/..." aparece]
```

## References

- Puter.js: https://docs.heyputer.com/
- Puter AI Models: https://i.puter.com/learn/ai/models
- Endpoint Replaced: `/api/generate-image` (OTROS proveedores)
- New Endpoint: `/api/puter-image` (Proveedores: Puter)