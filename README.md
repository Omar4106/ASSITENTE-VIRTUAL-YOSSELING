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
- **Generación de Imágenes:** Enrutamiento automático hacia modelos de generación visual (DALL-E / Pollinations AI) directamente desde el chat.
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
- **IA Cloud:** Groq, OpenAI, Gemini, OpenRouter, Pollinations AI.
- **IA Local:** WebGPU / Ollama Integration.
- **Seguridad:** DOMPurify, Content Security Policy (CSP), Rate Limiting.
- **Despliegue:** Vercel.

---

## 🚀 Instalación y Desarrollo Local

Si deseas clonar y ejecutar este proyecto localmente:

```bash
# 1. Clonar el repositorio
git clone [https://github.com/Omar4106/ASSITENTE-VIRTUAL-YOSSELING.git](https://github.com/Omar4106/ASSITENTE-VIRTUAL-YOSSELING.git)

# 2. Entrar al directorio
cd ASSITENTE-VIRTUAL-YOSSELING

# 3. Instalar dependencias
npm install

# 4. Configurar variables de entorno
cp .env.example .env.local

# 5. Iniciar el servidor de desarrollo
npm run dev


