# Yosseling — Asistente Inteligente

Aplicación de chat con IA construida con Next.js, Supabase y múltiples proveedores de modelos (OpenAI, Gemini, Anthropic, Groq, OpenRouter, Cerebras).

## Despliegue en Vercel

### 1. Variables de entorno obligatorias

Configura estas variables en **Vercel → Settings → Environment Variables**:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase (ej: `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase (pública) |
| `TAVILY_API_KEY` | Clave de Tavily para búsqueda en tiempo real |

### 2. Variables de proveedores de IA (al menos una)

| Variable | Proveedor |
|---|---|
| `OPENAI_API_KEY` | OpenAI (GPT-4, DALL-E) |
| `GEMINI_API_KEY` | Google Gemini |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) |
| `GROQ_API_KEY` | Groq |
| `OPENROUTER_API_KEY` | OpenRouter |
| `CEREBRAS_API_KEY` | Cerebras |

### 3. Pasos

1. Sube el repositorio a GitHub.
2. En Vercel, importa el repositorio.
3. Vercel detecta Next.js automáticamente — no requiere configuración extra.
4. Agrega todas las variables de entorno listadas arriba.
5. Despliega.

## Autenticación

El sistema usa **Supabase Auth** con correo y contraseña:

- Las contraseñas se hashean con bcrypt (gestionado por Supabase).
- Las sesiones se guardan en **cookies HttpOnly y Secure** — no en localStorage ni memoria.
- El middleware (`middleware.ts`) refresca la sesión en cada petición y protege:
  - La página principal (`/`) — redirige a `/login` si no hay sesión.
  - Todas las rutas de API (`/api/*`) — devuelve 401 si no hay sesión.
- Las políticas RLS en Supabase garantizan que cada usuario solo accede a sus propios datos.

## Base de datos

La tabla `user_seals` almacena el perfil de cada usuario (nombre, avatar) vinculada a `auth.users` mediante la columna `user_id`. Las migraciones se aplican automáticamente con Supabase.

## Desarrollo local

```bash
npm install
npm run dev
```

Asegúrate de tener un archivo `.env` con las variables listadas arriba.
