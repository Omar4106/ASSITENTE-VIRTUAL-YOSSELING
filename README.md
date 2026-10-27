<div align="center">

# 🌌 Yosseling — Tu Asistente Virtual Inteligente

**PWA de Inteligencia Artificial Conversacional, Autónoma y Proactiva**

[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://assitente-virtual-yosseling.vercel.app/)
[![License](https://img.shields.io/badge/License-MIT-blue.style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Framework-Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[🌐 Probar Yosseling en Vivo](https://assitente-virtual-yosseling.vercel.app/)

---

</div>

## 📌 Descripción

**Yosseling** es una plataforma de asistencia virtual de última generación diseñada para ofrecer una experiencia conversacional fluida, veloz y completamente adaptada al usuario. Combina el poder de la nube con capacidades **offline de ejecución local**, privacidad absoluta guardada en el dispositivo y herramientas avanzadas para análisis de archivos, generación de imágenes y optimización de sistemas.

---

## ✨ Características Principales

### 🚀 Selección Inteligente y Modo Ultra Rápido
- **Modo Automático:** Yosseling analiza el contexto de tu consulta y selecciona internamente la mejor IA en la nube sin complicaciones.
- **Modo Ultra Rápido (Groq):** Respuestas instantáneas impulsadas por la infraestructura de baja latencia de Groq (`llama-3.3`).

### ⚡ Modo Local Conversacional (Offline)
- **Onboarding por Voz/Texto:** Pregunta *"¿puedes responder sin internet?"* y Yosseling detectará la intención, solicitando tu confirmación para descargar e instalar un motor local súper ligero (vía WebGPU / Ollama).
- **Auto-Fallback:** Transición transparente entre la nube y el modo offline cuando se pierde la conexión a internet.

### 🎨 Generación e Inspección Multimodal
- **Generación de Imágenes:** Enrutamiento automático hacia modelos de generación visual (FLUX.1-schnell / SDXL / DALL-E) directamente desde el chat.
- **Multilector de Archivos:** Análisis y extracción inteligente de texto desde `.pdf`, `.docx`, `.pptx`, `.txt`, imágenes (`.png`, `.jpg`), y lectura de metadatos/cadenas en binarios y ejecutables (`.exe`).

### 🛠️ Motor de Optimización de Dispositivos (Scripts)
- Detección de intenciones sobre lentitud o problemas en PC/Celular.
- Generación y exportación de scripts ejecutables seguros (`.ps1`, `.bat`, `.sh` para Windows/Linux y comandos `ADB` para Android) para limpiar caché, desinstalar bloatware y acelerar el sistema.

### 🛡️ Seguridad Avanzada (Hardening & Privacy)
- **Anti-XSS & Sanitización:** Filtrado de entradas y renderizado seguro de código estático.
- **Aislamiento de C/C++:** Procesamiento de binarios y scripts en entornos sandbox sin ejecución directa en servidor.
- **Prompt Injection Defense:** Protección de variables de entorno, claves de API y reglas de comportamiento interno.
- **Privacidad Local:** El perfil de usuario, recuerdos e historial se almacenan exclusivamente en `localStorage` / `IndexedDB` sin bases de datos externas.

---

## 🎨 Estilo Visual: Cosmic Glassmorphism

Un diseño estético minimalista y futurista con:
- Fondos inspirados en nebulosas y constelaciones digitales.
- Transparencias y efectos de vidrio esmerilado (*Frosted Glass*).
- Interfaz adaptable y responsive para móviles (PWA) y computadoras de escritorio.

---

## 🛠️ Tecnologías Utilizadas

- **Core:** Next.js, React, TypeScript, Tailwind CSS.
- **IA Cloud:** Groq, OpenAI, Gemini, OpenRouter, Cerebras, HuggingFace, fal.ai.
- **IA Local:** WebGPU / Ollama Integration.
- **Seguridad:** DOMPurify, Content Security Policy (CSP), Rate Limiting.
- **Despliegue:** Vercel.

---

## 🚀 Instalación y Desarrollo Local

Si deseas clonar y ejecutar este proyecto localmente:

```bash
# Clonar e instalar dependencias
git clone https://github.com/Omar4106/ASSITENTE-VIRTUAL-YOSSELING.git
cd ASSITENTE-VIRTUAL-YOSSELING
npm install

# Iniciar el servidor de desarrollo
npm run dev
```

### Generación de imágenes

Para habilitar los motores adicionales, crea `.env.local` en la raíz y configura las claves solo ahí para desarrollo; en producción, usa el almacén de variables secretas del despliegue. No uses prefijos `NEXT_PUBLIC_` ni incluyas claves en el código:

```env
HF_TOKEN=tu_token_de_huggingface
FAL_KEY=tu_clave_de_fal
```

El motor rápido usa Fal.ai FLUX Schnell; el motor de mayor detalle usa Hugging Face FLUX Dev. Cada ruta devuelve un error explícito si su clave no está configurada.

## 📱 Aplicación Android con Capacitor

El proyecto Android usa Capacitor y abre la versión desplegada en Vercel dentro de una WebView nativa sin barra de navegador. La app requiere conexión para las funciones respaldadas por las rutas API de Next.js; el Service Worker puede conservar recursos visitados, pero no convierte las APIs remotas en funciones offline.

Requisitos: Android Studio con Android SDK y un JDK compatible con la versión de Gradle del proyecto.

```bash
# Añadir la plataforma Android (solo la primera vez)
npx cap add android

# Sincronizar configuración y assets web
npx cap sync android

# Abrir el proyecto en Android Studio
npx cap open android
```

En Android Studio, espera la sincronización de Gradle y usa **Build > Build Bundle(s) / APK(s) > Build APK(s)**. El APK de depuración se genera en `android/app/build/outputs/apk/debug/`.
