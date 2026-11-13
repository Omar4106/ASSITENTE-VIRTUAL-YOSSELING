# Configuración de Puter API - Token de Autenticación

## Resumen Rápido

Para habilitar la generación de imágenes con Puter en Yosseling, necesitas:

1. Un **Bearer Token** válido del servicio Puter API
2. Agregarlo al archivo `.env.local` como `PUTER_AUTH_TOKEN`

## ¿Cómo obtener el PUTER_AUTH_TOKEN?

### Método 1: Desde Puter.com (Recomendado)

1. Visita https://puter.com
2. Entra en tu cuenta o crea una cuenta nueva
3. Ve a **Settings** → **API Tokens**
4. Si no existe un token, genera uno nuevo
5. Copia el token (debe comenzar con `puter/...`)

### Método 2: Usando el Script de Ejemplo

Crea un archivo `test-puter-token.js` en la raíz del proyecto:

```javascript
// test-puter-token.js
const fetch = require('node-fetch'); // Esto pausará si node-fetch no está instalado

// O usa la API REST de Puter directamente
const response = await fetch('https://api.puter.com/drivers/call', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer TU_TOKEN_COMPLETO_AQUI',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    interface: 'puter-image-generation',
    driver: 'ai-image',
    method: 'generate',
    args: {
      prompt: 'galaxy in space',
      provider: 'gemini',
      model: 'gemini-nano-banana-2.1',
    },
  })
});

const data = await response.json();
console.log('Response:', JSON.stringify(data, null, 2));
```

Luego ejecuta y revisa la respuesta.

## Configuración con Environment Variables

### 1. Crear/Actualizar archivo `.env.local`

```env
# Configuración de Puter para generación de imágenes
# Genera este token desde: https://puter.com/settings/api-tokens
PUTER_AUTH_TOKEN=puter/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

El endpoint lee `PUTER_AUTH_TOKEN` únicamente en el servidor; no uses el prefijo `NEXT_PUBLIC_` para no exponer el token al cliente.

### 2. Propiedades del Token

| Propiedad | Valor | Descripción |
|-----------|-------|-------------|
| `PUTER_AUTH_TOKEN` | string | Token de autenticación Bearer |
| `formato` | `puter/...` | Comienza con "puter/" |
| `longitud` | ~150 caracteres | Token completo de Puter |
| `persistence` | temporal | Puede expirar largo plazo |

### 3. Validación

Verifica que el token está bien configurado:

1. Cierra la terminal
2. Reinicia el servidor: `npm run dev`
3. Abre https: //localhost:3000
4. Intenta generar una imagen
5. Revisa la consola del servidor con `console.log('[puter-image] ...')`

## Flujo de Autenticación

```
┌──────────────────────────────────────────────────────┐
│  Cliente (Browser)                                   │
│  user: "[GENERAR_IMAGEN: galaxy in space]"           │
└────────────────┬─────────────────────────────────────┘
                 │ POST
                 ▼
┌──────────────────────────────────────────────────────┐
│  /api/puter-image                                    │
│  - Lee PUTER_AUTH_TOKEN de env *                     │
│  - Hace fetch('https://api.puter.com/drivers/call')  │
│  - Authorization: Bearer TOKEN                       │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Puter API REST                                      │
│  - Autentica con token                               │
│  - Ejecuta txt2img                                 │
│  - Retorno: { result: { data_url: "https://..." } } │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Cliente Recibe URLs                                  │
│  - Imagen generada                                   │
│  - Renderizada sin popups de autenticación            │
└──────────────────────────────────────────────────────┘
```

## Códigos de Respuesta

### Token Válido

```json
{
  "success": true,
  "imageUrl": "https://i.puter.com/...",
  "provider": "puter-api-rest"
}
```

### Token Inválido o Expirado

```json
{
  "success": false,
  "error": "No pude generar la imagen ahora mismo (límite temporal del servido o token de Puter)."
}
```

### Token No Configurado

```json
{
  "success": true,  // pero luego fallará al generar
}
```

## Ejemplos de Uso

### En el Chat

```
Usuario: Hazme una imagen de un gato astronauta

[Sin popups de autenticación]

[Sistema genera imagen sin confirmación]

Yosseling: [Imagen de gato astronauta]
```

### En la Consola del Servidor

```bash
[generate-image] Puter success {
  status: 200,
  driver: 'ai-image',
  model: 'gemini-nano-banana-2.1'
}
```

## Troubleshooting

### Error: "PUTER_AUTH_TOKEN no configurado"

**Causa:** La variable de entorno no está configurada correctamente.

**Solución:**
1. Verifica que `.env.local` existe en la raíz del proyecto
2. Asegúrate de que CONTIENE la línea con el token
3. Usa este formato:
   ```env
   PUTER_AUTH_TOKEN=puter/...
   ```
4. Usa triple comillas en Windows para incluir caracteres especiales:
   ```env
   PUTER_AUTH_TOKEN="puter/eyJhbGciOi..."
   ```
5. Reinicia el servidor después de cada cambio

### Error: "PUTER_AUTH_TOKEN invalid"

**Causa:** El token es incorrecto o está mal formateado.

**Solución:**
1. Verifica que el token COMIENZA con "puter/"
2. Asegúrate de copiar TODO el token (no solo una parte)
3. Genera un nuevo token en https://puter.com/settings/api-tokens
4. El token suele tener alrededor de ~150 caracteres

### Error: "límite temporal del servido o token"

**Causas:**
- El token está expirado (Puter tokens son temporales)
- Has excedido el límite de llamadas gratuitas
- La cuenta de Puter está bloqueada

**Soluciones:**
1. Genera un nuevo token en https://puter.com/settings/api-tokens
2. Revisa límites gratuitos vs premium en Puter
3. Verifica que la cuenta no está suspendida
4. Si usas muchos tokens, considera generar un JWT más robusto

### Error: 503 - Se dio un error generando imagen

**Causa:** Puter API temporariamente no disponible.

**Solución:**
1. Espera 30 segundos y vuelve a intentar
2. Revisa el cuerpo de error de Puter en los logs `[generate-image]`; esta ruta no usa proveedores de respaldo

## Reflección y Mejoras

### Problema Anterior (❌)
- Usaba `@heyputer/puter.js` en servidor
- Causaba error de compilación: "Attempted import error"
- Exigía JWT Secret complejo
- Facebook email sektör.py de contraseña y secretos

### Solución Actual (✅)
- Usa `fetch` nativo de Node.js
- Solo requiere un Bearer Token simple
- Token se puede obtener web a web en Puter.com
- No rompe build de Next.js

## Alternatives

### Opción 1: Endpoint /api/generate-image (BD)
- Usa Puter directamente con Gemini Nano Banana
- Requiere `PUTER_AUTH_TOKEN` en el servidor
- Devuelve el error de Puter sin cambiar a otro proveedor

### Opción 2: PUTER_AUTH_TOKEN + SDK en Cliente (WP)
- Funciona pero abre popups de autenticación
- No recomendado para usuarios finales

### Opción 3: JWT Secret + SDK en Backend (OP)
- Necesita script de generación de JWT
- Volución: el script 💯% autónoma sin web interactions
- Sin dependencia de Puter.com para runtime

## Referencias

- [Puter API Documentation](https://api.puter.com/)
- [Puter Drivers - AI](https://api.puter.com/drivers/ai)
- [Puter Settings - API Tokens](https://puter.com/settings/api-tokens)
- Endpoint Actual: `/api/puter-image` (API REST direct)
- Endpoint de chat: `/api/generate-image` (Puter, sin fallback)

## Ejemplo Completo de Configuración

`.env.local`:

```env
# Puter API Configuration (server-only)
PUTER_AUTH_TOKEN=puter/your-token-here
```